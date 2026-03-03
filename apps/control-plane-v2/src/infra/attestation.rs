use std::fmt::Write as _;

use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Utc};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sigstore_sign::oidc::IdentityToken;
use sigstore_sign::types::{Bundle as SigstoreBundle, SignatureContent};
use sigstore_sign::{SigningConfig, SigningContext};
use sigstore_verify::trust_root::TrustedRoot;
use sigstore_verify::{verify, VerificationPolicy};
use thiserror::Error;

use crate::domain::models::AttestationPayload;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DsseSignature {
    pub keyid: String,
    pub sig: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DsseEnvelope {
    pub payload_type: String,
    pub payload: String,
    pub signatures: Vec<DsseSignature>,
    pub attestation_id: String,
    pub trace_id: String,
    pub tenant_slug: String,
    pub issued_at: DateTime<Utc>,
    pub rekor_log_index: Option<u64>,
    pub rekor_uuid: Option<String>,
    pub rekor_log_id: Option<String>,
    pub signer_identity: Option<String>,
    pub signer_issuer: Option<String>,
    pub sigstore_bundle: Option<Value>,
}

#[derive(Debug, Error)]
pub enum AttestationError {
    #[error("failed to serialize payload: {0}")]
    Serialization(String),
    #[error("attestation verification failed: {0}")]
    VerificationFailed(String),
    #[error("failed to call rekor: {0}")]
    RequestFailed(String),
    #[error("rekor returned non-success status {0}: {1}")]
    HttpStatus(StatusCode, String),
    #[error("sigstore operation failed: {0}")]
    Sigstore(String),
}

#[async_trait]
pub trait Attestor: Send + Sync {
    async fn attest(
        &self,
        payload: &AttestationPayload,
        trace_id: &str,
    ) -> Result<DsseEnvelope, AttestationError>;

    async fn verify(&self, envelope: &DsseEnvelope) -> Result<(), AttestationError>;
}

#[derive(Clone)]
pub struct LocalDsseAttestor {
    secret: String,
}

impl LocalDsseAttestor {
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    fn sign_bytes(&self, payload_base64: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(payload_base64.as_bytes());
        hasher.update(b".");
        hasher.update(self.secret.as_bytes());
        BASE64.encode(hasher.finalize())
    }

    fn build_envelope(
        &self,
        payload: &AttestationPayload,
        trace_id: &str,
    ) -> Result<DsseEnvelope, AttestationError> {
        let payload_bytes = serde_json::to_vec(payload)
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;
        let payload_b64 = BASE64.encode(payload_bytes);
        let signature = self.sign_bytes(&payload_b64);

        Ok(DsseEnvelope {
            payload_type: "application/vnd.sentinel.decision+json".to_string(),
            payload: payload_b64,
            signatures: vec![DsseSignature {
                keyid: "sentinel-local".to_string(),
                sig: signature,
            }],
            attestation_id: uuid::Uuid::new_v4().to_string(),
            trace_id: trace_id.to_string(),
            tenant_slug: payload.tenant_slug.clone(),
            issued_at: Utc::now(),
            rekor_log_index: None,
            rekor_uuid: None,
            rekor_log_id: None,
            signer_identity: None,
            signer_issuer: None,
            sigstore_bundle: None,
        })
    }

    fn verify_signature(&self, envelope: &DsseEnvelope) -> Result<(), AttestationError> {
        let expected = self.sign_bytes(&envelope.payload);
        let matched = envelope
            .signatures
            .iter()
            .any(|signature| signature.sig == expected);

        if matched {
            Ok(())
        } else {
            Err(AttestationError::VerificationFailed(
                "envelope signature mismatch".to_string(),
            ))
        }
    }
}

#[async_trait]
impl Attestor for LocalDsseAttestor {
    async fn attest(
        &self,
        payload: &AttestationPayload,
        trace_id: &str,
    ) -> Result<DsseEnvelope, AttestationError> {
        self.build_envelope(payload, trace_id)
    }

    async fn verify(&self, envelope: &DsseEnvelope) -> Result<(), AttestationError> {
        self.verify_signature(envelope)
    }
}

#[derive(Clone, Debug)]
pub struct KeylessSigstoreAttestorConfig {
    pub environment: String,
    pub identity_token: Option<String>,
    pub required_identity: Option<String>,
    pub required_issuer: Option<String>,
    pub allow_ambient_credentials: bool,
    pub strict: bool,
    pub rekor_url: Option<String>,
    pub fulcio_url: Option<String>,
    pub tsa_url: Option<String>,
}

pub struct KeylessSigstoreAttestor {
    local: LocalDsseAttestor,
    signing_context: SigningContext,
    identity_token: Option<String>,
    required_identity: Option<String>,
    required_issuer: Option<String>,
    allow_ambient_credentials: bool,
    strict: bool,
    environment: String,
}

impl KeylessSigstoreAttestor {
    pub fn new(secret: String, config: KeylessSigstoreAttestorConfig) -> Self {
        let mut signing_config = match config.environment.trim().to_ascii_lowercase().as_str() {
            "staging" => SigningConfig::staging(),
            _ => SigningConfig::production(),
        };

        if let Some(rekor_url) = config.rekor_url {
            signing_config.rekor_url = rekor_url;
        }
        if let Some(fulcio_url) = config.fulcio_url {
            signing_config.fulcio_url = fulcio_url;
        }
        if let Some(tsa_url) = config.tsa_url {
            signing_config.tsa_url = Some(tsa_url);
        }

        Self {
            local: LocalDsseAttestor::new(secret),
            signing_context: SigningContext::with_config(signing_config),
            identity_token: config.identity_token,
            required_identity: config.required_identity,
            required_issuer: config.required_issuer,
            allow_ambient_credentials: config.allow_ambient_credentials,
            strict: config.strict,
            environment: config.environment,
        }
    }

    async fn resolve_identity_token(&self) -> Result<IdentityToken, AttestationError> {
        if let Some(identity_token) = &self.identity_token {
            return IdentityToken::from_jwt(identity_token)
                .map_err(|error| AttestationError::Sigstore(error.to_string()));
        }

        if self.allow_ambient_credentials {
            let ambient = IdentityToken::detect_ambient()
                .await
                .map_err(|error| AttestationError::Sigstore(error.to_string()))?;
            if let Some(token) = ambient {
                return Ok(token);
            }
        }

        Err(AttestationError::Sigstore(
            "no sigstore identity token available (configure SENTINEL_V2_SIGSTORE_IDENTITY_TOKEN or ambient credentials)".to_string(),
        ))
    }

    fn trusted_root(&self) -> Result<TrustedRoot, AttestationError> {
        match self.environment.trim().to_ascii_lowercase().as_str() {
            "staging" => TrustedRoot::staging()
                .map_err(|error| AttestationError::Sigstore(error.to_string())),
            _ => TrustedRoot::production()
                .map_err(|error| AttestationError::Sigstore(error.to_string())),
        }
    }

    fn verification_policy(&self) -> VerificationPolicy {
        let mut policy = VerificationPolicy::default();
        if let Some(required_identity) = &self.required_identity {
            policy = policy.require_identity(required_identity.clone());
        }
        if let Some(required_issuer) = &self.required_issuer {
            policy = policy.require_issuer(required_issuer.clone());
        }
        policy
    }
}

#[async_trait]
impl Attestor for KeylessSigstoreAttestor {
    async fn attest(
        &self,
        payload: &AttestationPayload,
        trace_id: &str,
    ) -> Result<DsseEnvelope, AttestationError> {
        let mut envelope = self.local.build_envelope(payload, trace_id)?;

        let identity_token = self.resolve_identity_token().await?;
        let signer_identity = identity_token.subject().to_string();
        let signer_issuer = identity_token.issuer().to_string();
        let signer = self.signing_context.signer(identity_token);

        let payload_bytes = BASE64
            .decode(envelope.payload.as_bytes())
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;

        let bundle = signer
            .sign(payload_bytes.as_slice())
            .await
            .map_err(|error| AttestationError::Sigstore(error.to_string()))?;

        let signature = extract_bundle_signature(&bundle)?;
        let bundle_json = bundle
            .to_json_pretty()
            .map_err(|error| AttestationError::Sigstore(error.to_string()))?;
        let bundle_value: Value = serde_json::from_str(&bundle_json)
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;

        envelope.signatures = vec![DsseSignature {
            keyid: "sigstore-keyless".to_string(),
            sig: signature,
        }];
        envelope.rekor_log_index = bundle
            .verification_material
            .tlog_entries
            .first()
            .and_then(|entry| entry.log_index.as_u64());
        envelope.rekor_uuid = extract_rekor_entry_uuid(&bundle_value);
        envelope.rekor_log_id = extract_rekor_log_id(&bundle_value);
        envelope.signer_identity = Some(signer_identity);
        envelope.signer_issuer = Some(signer_issuer);
        envelope.sigstore_bundle = Some(bundle_value);

        Ok(envelope)
    }

    async fn verify(&self, envelope: &DsseEnvelope) -> Result<(), AttestationError> {
        let Some(bundle_value) = &envelope.sigstore_bundle else {
            if self.strict {
                return Err(AttestationError::VerificationFailed(
                    "sigstore bundle missing from attestation envelope".to_string(),
                ));
            }
            return self.local.verify_signature(envelope);
        };

        let bundle_json = serde_json::to_string(bundle_value)
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;
        let bundle = SigstoreBundle::from_json(&bundle_json)
            .map_err(|error| AttestationError::Sigstore(error.to_string()))?;

        let payload_bytes = BASE64
            .decode(envelope.payload.as_bytes())
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;

        let trusted_root = self.trusted_root()?;
        let policy = self.verification_policy();

        let result = verify(payload_bytes.as_slice(), &bundle, &policy, &trusted_root)
            .map_err(|error| AttestationError::VerificationFailed(error.to_string()))?;

        if !result.success {
            return Err(AttestationError::VerificationFailed(
                "sigstore verification reported unsuccessful result".to_string(),
            ));
        }

        let bundle_signature = extract_bundle_signature(&bundle)?;
        let signature_matches = envelope
            .signatures
            .iter()
            .any(|signature| signature.sig == bundle_signature);

        if !signature_matches {
            return Err(AttestationError::VerificationFailed(
                "envelope signature does not match sigstore bundle".to_string(),
            ));
        }

        Ok(())
    }
}

#[derive(Clone)]
pub struct SigstoreRekorAttestor {
    local: LocalDsseAttestor,
    rekor_url: String,
    strict_rekor: bool,
    client: reqwest::Client,
}

impl SigstoreRekorAttestor {
    pub fn new(secret: String, rekor_url: String, strict_rekor: bool) -> Self {
        Self {
            local: LocalDsseAttestor::new(secret),
            rekor_url,
            strict_rekor,
            client: reqwest::Client::new(),
        }
    }

    async fn publish_rekor_entry(
        &self,
        envelope: &mut DsseEnvelope,
    ) -> Result<(), AttestationError> {
        let payload_hash = payload_sha256(&envelope.payload)?;
        let signature = envelope
            .signatures
            .first()
            .ok_or_else(|| {
                AttestationError::VerificationFailed(
                    "envelope missing signature for rekor upload".to_string(),
                )
            })?
            .sig
            .clone();

        let request_body = json!({
            "apiVersion": "0.0.1",
            "kind": "hashedrekord",
            "spec": {
                "data": {
                    "hash": {
                        "algorithm": "sha256",
                        "value": payload_hash
                    }
                },
                "signature": {
                    "content": signature,
                    "publicKey": {
                        "content": BASE64.encode("sentinel-keyless-placeholder")
                    }
                }
            }
        });

        let url = format!(
            "{}/api/v1/log/entries",
            self.rekor_url.trim_end_matches('/')
        );

        let response = self
            .client
            .post(url)
            .json(&request_body)
            .send()
            .await
            .map_err(|error| AttestationError::RequestFailed(error.to_string()))?;

        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|error| AttestationError::RequestFailed(error.to_string()))?;

        if !status.is_success() {
            return Err(AttestationError::HttpStatus(status, text));
        }

        let value: Value = serde_json::from_str(&text)
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;
        let (uuid, log_index) = parse_rekor_response(&value);

        envelope.rekor_uuid = uuid;
        envelope.rekor_log_index = log_index;
        envelope.rekor_log_id = extract_rekor_log_id(&value);

        Ok(())
    }

    async fn verify_rekor_entry(&self, envelope: &DsseEnvelope) -> Result<(), AttestationError> {
        let Some(rekor_uuid) = envelope.rekor_uuid.as_ref() else {
            if self.strict_rekor {
                return Err(AttestationError::VerificationFailed(
                    "strict rekor mode requires a rekor UUID".to_string(),
                ));
            }
            return Ok(());
        };

        let url = format!(
            "{}/api/v1/log/entries/{}",
            self.rekor_url.trim_end_matches('/'),
            rekor_uuid
        );

        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| AttestationError::RequestFailed(error.to_string()))?;

        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|error| AttestationError::RequestFailed(error.to_string()))?;

        if !status.is_success() {
            return Err(AttestationError::HttpStatus(status, text));
        }

        let value: Value = serde_json::from_str(&text)
            .map_err(|error| AttestationError::Serialization(error.to_string()))?;

        let expected_hash = payload_sha256(&envelope.payload)?;
        let logged_hash = extract_rekor_hash(&value).ok_or_else(|| {
            AttestationError::VerificationFailed(
                "rekor hash value not found in response".to_string(),
            )
        })?;

        if expected_hash == logged_hash {
            Ok(())
        } else {
            Err(AttestationError::VerificationFailed(
                "rekor hash does not match envelope payload".to_string(),
            ))
        }
    }
}

#[async_trait]
impl Attestor for SigstoreRekorAttestor {
    async fn attest(
        &self,
        payload: &AttestationPayload,
        trace_id: &str,
    ) -> Result<DsseEnvelope, AttestationError> {
        let mut envelope = self.local.build_envelope(payload, trace_id)?;

        match self.publish_rekor_entry(&mut envelope).await {
            Ok(()) => Ok(envelope),
            Err(error) if self.strict_rekor => Err(error),
            Err(error) => {
                tracing::warn!("rekor submission skipped in non-strict mode: {error}");
                Ok(envelope)
            }
        }
    }

    async fn verify(&self, envelope: &DsseEnvelope) -> Result<(), AttestationError> {
        self.local.verify_signature(envelope)?;
        self.verify_rekor_entry(envelope).await
    }
}

fn extract_bundle_signature(bundle: &SigstoreBundle) -> Result<String, AttestationError> {
    match &bundle.content {
        SignatureContent::MessageSignature(signature) => {
            Ok(BASE64.encode(signature.signature.as_bytes()))
        }
        SignatureContent::DsseEnvelope(envelope) => envelope
            .signatures
            .first()
            .map(|signature| BASE64.encode(signature.sig.as_bytes()))
            .ok_or_else(|| {
                AttestationError::VerificationFailed(
                    "sigstore dsse bundle does not contain signature".to_string(),
                )
            }),
    }
}

fn extract_rekor_entry_uuid(bundle_value: &Value) -> Option<String> {
    bundle_value
        .pointer("/verification_material/tlog_entries/0/entry_uuid")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn extract_rekor_log_id(bundle_value: &Value) -> Option<String> {
    bundle_value
        .pointer("/verification_material/tlog_entries/0/log_id/key_id")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn parse_rekor_response(value: &Value) -> (Option<String>, Option<u64>) {
    if let Some(object) = value.as_object() {
        if let Some((uuid, entry)) = object.iter().next() {
            let log_index = entry.get("logIndex").and_then(Value::as_u64);
            return (Some(uuid.to_string()), log_index);
        }
    }

    let uuid = value
        .get("uuid")
        .and_then(Value::as_str)
        .map(str::to_string);
    let log_index = value.get("logIndex").and_then(Value::as_u64);

    (uuid, log_index)
}

fn payload_sha256(payload_base64: &str) -> Result<String, AttestationError> {
    let bytes = BASE64
        .decode(payload_base64.as_bytes())
        .map_err(|error| AttestationError::Serialization(error.to_string()))?;
    let digest = Sha256::digest(bytes);

    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(&mut hex, "{byte:02x}");
    }

    Ok(hex)
}

fn extract_rekor_hash(value: &Value) -> Option<String> {
    let candidate = if let Some(object) = value.as_object() {
        object.iter().next().map(|(_, entry)| entry).cloned()
    } else {
        Some(value.clone())
    }?;

    let body_base64 = candidate.get("body")?.as_str()?;
    let body_bytes = BASE64.decode(body_base64.as_bytes()).ok()?;
    let body_json: Value = serde_json::from_slice(&body_bytes).ok()?;

    body_json
        .get("spec")
        .and_then(|spec| spec.get("data"))
        .and_then(|data| data.get("hash"))
        .and_then(|hash| hash.get("value"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::{extract_rekor_entry_uuid, extract_rekor_log_id};
    use serde_json::json;

    #[test]
    fn extracts_rekor_log_id_from_sigstore_bundle() {
        let bundle = json!({
            "verification_material": {
                "tlog_entries": [
                    {
                        "log_id": { "key_id": "rekor-log-key-id" },
                        "log_index": 9
                    }
                ]
            }
        });

        assert_eq!(
            extract_rekor_log_id(&bundle).as_deref(),
            Some("rekor-log-key-id")
        );
    }

    #[test]
    fn extracts_rekor_entry_uuid_when_present() {
        let bundle = json!({
            "verification_material": {
                "tlog_entries": [
                    { "entry_uuid": "71f7571f-0d87-4db2-abf3-5f6d567e8f03" }
                ]
            }
        });

        assert_eq!(
            extract_rekor_entry_uuid(&bundle).as_deref(),
            Some("71f7571f-0d87-4db2-abf3-5f6d567e8f03")
        );
    }
}
