use std::sync::Arc;

use chrono::{Duration, Utc};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::auth::Identity;
use crate::domain::error::DomainError;
use crate::domain::models::{
    A2aAuthorizeRequest, ApprovalCreateRequest, ApprovalRecord, ApprovalResolveRequest,
    ApprovalState, AttestationDetailResponse, AttestationPayload, AttestationRequest,
    AttestationResponse, AttestationVerifyResponse, AuthorizationDecision, AuthorizationRequest,
    EvidenceResponse, KillSwitchRequest, KillSwitchResponse, KillSwitchRestoreRequest,
    McpAuthorizeRequest, PolicyBundleMetadata, ProtocolMetadata,
};
use crate::infra::attestation::{Attestor, LocalDsseAttestor};
use crate::infra::config::Settings;
use crate::infra::policy::{OpaPolicyEngine, PolicyEngine};
use crate::infra::risk::RiskEngine;
use crate::infra::store::{EventRecord, EventStore, InMemoryEventStore};

#[derive(Clone)]
pub struct ControlPlaneService {
    pub settings: Settings,
    store: Arc<dyn EventStore>,
    policy_engine: Arc<dyn PolicyEngine>,
    attestor: Arc<dyn Attestor>,
    risk_engine: RiskEngine,
}

impl ControlPlaneService {
    pub fn new(settings: Settings, store: InMemoryEventStore) -> Self {
        let policy_engine = OpaPolicyEngine::new(settings.opa_url.clone());
        let attestor = LocalDsseAttestor::new(settings.dsse_signing_secret.clone());

        Self {
            settings,
            store: Arc::new(store),
            policy_engine: Arc::new(policy_engine),
            attestor: Arc::new(attestor),
            risk_engine: RiskEngine,
        }
    }

    pub fn with_components(
        settings: Settings,
        store: Arc<dyn EventStore>,
        policy_engine: Arc<dyn PolicyEngine>,
        attestor: Arc<dyn Attestor>,
    ) -> Self {
        Self {
            settings,
            store,
            policy_engine,
            attestor,
            risk_engine: RiskEngine,
        }
    }

    pub async fn authorize(
        &self,
        identity: &Identity,
        input: AuthorizationRequest,
    ) -> Result<AuthorizationDecision, DomainError> {
        self.require_scope(identity, "decisions:authorize")?;
        self.enforce_tenant(identity, &input.tenant_slug)?;
        self.validate_authorization_input(&input)?;

        let trace_id = input
            .trace_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        if let Some(replay_token) = &input.replay_token {
            let expires_at = Utc::now() + Duration::seconds(self.settings.replay_token_ttl_seconds);
            let reserved = self
                .store
                .reserve_replay_token(replay_token, expires_at)
                .await
                .map_err(|error| DomainError::Internal(error.to_string()))?;
            if !reserved {
                return Err(DomainError::Conflict(
                    "replay token already used or unexpired".to_string(),
                ));
            }
        }

        if self
            .store
            .is_tool_disabled(&input.tenant_slug, &input.tool_name)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?
        {
            let decision = AuthorizationDecision {
                decision_id: Uuid::new_v4(),
                trace_id: trace_id.clone(),
                allow: false,
                reason_code: Some("KILL_SWITCH_ACTIVE".to_string()),
                reason: Some("tool is disabled by kill switch".to_string()),
                quota_remaining: None,
                risk_score: 0.0,
                risk_reason_codes: vec!["KILL_SWITCH_ACTIVE".to_string()],
                requires_approval: false,
                attestation_id: None,
            };

            self.record_event(
                &trace_id,
                &input.tenant_slug,
                "decision.denied.kill_switch",
                json!({ "request": input, "decision": decision }),
            )
            .await?;

            return Ok(decision);
        }

        let policy_result = self
            .policy_engine
            .evaluate(
                &self.settings.policy_package,
                json!({
                    "tenant": input.tenant_slug,
                    "tool": input.tool_name,
                    "action": input.action,
                    "purpose": input.purpose,
                    "usage": input.usage,
                    "context": input.context,
                }),
            )
            .await;

        let (mut allow, mut reason_code, mut reason, quota_remaining) = match policy_result {
            Ok(result) => {
                let deny_code = if result.allow {
                    None
                } else {
                    Some("POLICY_DENY".to_string())
                };
                (
                    result.allow,
                    deny_code,
                    result.deny_reason,
                    result.quota_remaining,
                )
            }
            Err(error) => (
                false,
                Some("POLICY_UNAVAILABLE".to_string()),
                Some(format!("policy engine unavailable: {error}")),
                None,
            ),
        };

        let risk = self.risk_engine.assess(&input);
        let requires_approval = risk.score >= self.settings.require_approval_above_risk;

        if allow && requires_approval {
            allow = false;
            reason_code = Some("APPROVAL_REQUIRED".to_string());
            reason = Some("risk threshold exceeded; approval required".to_string());
        }

        if allow && self.settings.enforce_risk_gate && risk.score >= 0.9 {
            allow = false;
            reason_code = Some("RISK_GATE_BLOCKED".to_string());
            reason = Some("risk gate denied high-risk invocation".to_string());
        }

        let mut decision = AuthorizationDecision {
            decision_id: Uuid::new_v4(),
            trace_id: trace_id.clone(),
            allow,
            reason_code,
            reason,
            quota_remaining,
            risk_score: risk.score,
            risk_reason_codes: risk.reason_codes,
            requires_approval,
            attestation_id: None,
        };

        if decision.allow {
            match self.attest_authorized_decision(&input, &decision).await {
                Ok(attestation_id) => decision.attestation_id = Some(attestation_id),
                Err(error) => {
                    decision.allow = false;
                    decision.reason_code = Some("ATTESTATION_FAILED".to_string());
                    decision.reason =
                        Some(format!("attestation failed; denied fail-closed: {error}"));
                    decision.attestation_id = None;
                }
            }
        }

        let event_type = if decision.allow {
            "decision.allowed"
        } else {
            "decision.denied"
        };

        self.record_event(
            &trace_id,
            &input.tenant_slug,
            event_type,
            json!({ "request": input, "decision": decision }),
        )
        .await?;

        Ok(decision)
    }

    pub async fn trigger_kill_switch(
        &self,
        identity: &Identity,
        input: KillSwitchRequest,
    ) -> Result<KillSwitchResponse, DomainError> {
        self.require_scope(identity, "control:kill")?;
        self.enforce_tenant(identity, &input.tenant_slug)?;

        let affected = self
            .store
            .set_kill_switch(&input.tenant_slug, input.tool_name.as_deref(), true)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.record_event(
            &Uuid::new_v4().to_string(),
            &input.tenant_slug,
            "control.kill_switch.enabled",
            json!({
                "tenant_slug": input.tenant_slug,
                "tool_name": input.tool_name,
                "reason": input.reason,
                "affected_tools": affected,
            }),
        )
        .await?;

        Ok(KillSwitchResponse {
            status: "disabled".to_string(),
            affected_tools: affected,
        })
    }

    pub async fn restore_kill_switch(
        &self,
        identity: &Identity,
        input: KillSwitchRestoreRequest,
    ) -> Result<KillSwitchResponse, DomainError> {
        self.require_scope(identity, "control:kill")?;
        self.enforce_tenant(identity, &input.tenant_slug)?;

        let affected = self
            .store
            .set_kill_switch(&input.tenant_slug, input.tool_name.as_deref(), false)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.record_event(
            &Uuid::new_v4().to_string(),
            &input.tenant_slug,
            "control.kill_switch.restored",
            json!({
                "tenant_slug": input.tenant_slug,
                "tool_name": input.tool_name,
                "affected_tools": affected,
            }),
        )
        .await?;

        Ok(KillSwitchResponse {
            status: "enabled".to_string(),
            affected_tools: affected,
        })
    }

    pub async fn create_approval(
        &self,
        identity: &Identity,
        input: ApprovalCreateRequest,
    ) -> Result<ApprovalRecord, DomainError> {
        self.require_scope(identity, "approvals:request")?;
        self.enforce_tenant(identity, &input.tenant_slug)?;

        let ttl_seconds = input.ttl_seconds.unwrap_or(300).clamp(30, 86_400);
        let now = Utc::now();
        let approval = ApprovalRecord {
            approval_id: Uuid::new_v4(),
            tenant_slug: input.tenant_slug.clone(),
            trace_id: input.trace_id,
            decision_id: input.decision_id,
            state: ApprovalState::Pending,
            reason: input.reason,
            requested_by: identity.sub.clone(),
            resolved_by: None,
            note: None,
            created_at: now,
            expires_at: now + Duration::seconds(ttl_seconds),
            resolved_at: None,
        };

        self.store
            .upsert_approval(approval.clone())
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.record_event(
            &approval.trace_id,
            &approval.tenant_slug,
            "approval.requested",
            json!({ "approval": approval }),
        )
        .await?;

        Ok(approval)
    }

    pub async fn resolve_approval(
        &self,
        identity: &Identity,
        approval_id: Uuid,
        input: ApprovalResolveRequest,
    ) -> Result<ApprovalRecord, DomainError> {
        self.require_scope(identity, "approvals:resolve")?;

        let mut approval = self
            .store
            .get_approval(approval_id)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?
            .ok_or_else(|| DomainError::NotFound("approval not found".to_string()))?;

        self.enforce_tenant(identity, &approval.tenant_slug)?;

        if approval.state != ApprovalState::Pending {
            return Err(DomainError::Conflict(
                "approval can only be resolved from pending state".to_string(),
            ));
        }

        approval.state = if input.approved {
            ApprovalState::Approved
        } else {
            ApprovalState::Denied
        };
        approval.note = input.note;
        approval.resolved_by = Some(identity.sub.clone());
        approval.resolved_at = Some(Utc::now());

        self.store
            .upsert_approval(approval.clone())
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.record_event(
            &approval.trace_id,
            &approval.tenant_slug,
            "approval.resolved",
            json!({ "approval": approval }),
        )
        .await?;

        Ok(approval)
    }

    pub async fn create_attestation(
        &self,
        identity: &Identity,
        input: AttestationRequest,
    ) -> Result<AttestationResponse, DomainError> {
        self.require_scope(identity, "provenance:attest")?;
        self.enforce_tenant(identity, &input.tenant_slug)?;

        let payload = AttestationPayload {
            tenant_slug: input.tenant_slug.clone(),
            tool_name: input.tool_name,
            action: input.action,
            decision_id: input.decision_id,
            decision_allow: input.decision_allow,
            request_hash: input.request_hash,
            response_hash: input.response_hash,
            outcome: input.outcome,
        };

        let envelope = self
            .attestor
            .attest(&payload, &input.trace_id)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.store
            .put_attestation(envelope.clone())
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.record_event(
            &input.trace_id,
            &input.tenant_slug,
            "provenance.attested",
            json!({ "attestation": envelope }),
        )
        .await?;

        Ok(AttestationResponse {
            attestation_id: envelope.attestation_id,
            trace_id: envelope.trace_id,
            issued_at: envelope.issued_at,
            rekor_log_index: envelope.rekor_log_index,
            rekor_uuid: envelope.rekor_uuid,
            rekor_log_id: envelope.rekor_log_id,
        })
    }

    pub async fn get_attestation(
        &self,
        identity: &Identity,
        attestation_id: &str,
    ) -> Result<AttestationDetailResponse, DomainError> {
        self.require_scope(identity, "provenance:read")?;

        let envelope = self
            .store
            .get_attestation(attestation_id)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?
            .ok_or_else(|| DomainError::NotFound("attestation not found".to_string()))?;
        self.enforce_tenant(identity, &envelope.tenant_slug)?;

        Ok(AttestationDetailResponse {
            attestation: envelope,
        })
    }

    pub async fn verify_attestation(
        &self,
        identity: &Identity,
        attestation_id: &str,
    ) -> Result<AttestationVerifyResponse, DomainError> {
        self.require_scope(identity, "provenance:verify")?;

        let envelope = self
            .store
            .get_attestation(attestation_id)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?
            .ok_or_else(|| DomainError::NotFound("attestation not found".to_string()))?;
        self.enforce_tenant(identity, &envelope.tenant_slug)?;

        let verified = self.attestor.verify(&envelope).await.is_ok();

        Ok(AttestationVerifyResponse {
            attestation_id: envelope.attestation_id,
            verified,
            trace_id: envelope.trace_id,
        })
    }

    pub async fn replay_authorization(
        &self,
        identity: &Identity,
        mut request: AuthorizationRequest,
    ) -> Result<AuthorizationDecision, DomainError> {
        self.require_scope(identity, "replay:decision")?;

        if request.replay_token.is_none() {
            request.replay_token = Some(Uuid::new_v4().to_string());
        }

        let decision = self.authorize(identity, request.clone()).await?;

        self.record_event(
            &decision.trace_id,
            &request.tenant_slug,
            "decision.replayed",
            json!({ "request": request, "decision": decision }),
        )
        .await?;

        Ok(decision)
    }

    pub async fn authorize_mcp(
        &self,
        identity: &Identity,
        request: McpAuthorizeRequest,
    ) -> Result<AuthorizationDecision, DomainError> {
        self.authorize(
            identity,
            AuthorizationRequest {
                tenant_slug: request.tenant_slug,
                tool_name: request.tool_name,
                action: "mcp.tool.call".to_string(),
                purpose: request.purpose,
                usage: request.usage,
                context: json!({ "mcp_call": request.call }),
                trace_id: None,
                replay_token: request.replay_token,
            },
        )
        .await
    }

    pub async fn authorize_a2a(
        &self,
        identity: &Identity,
        request: A2aAuthorizeRequest,
    ) -> Result<AuthorizationDecision, DomainError> {
        self.authorize(
            identity,
            AuthorizationRequest {
                tenant_slug: request.tenant_slug,
                tool_name: request.capability,
                action: request.intent,
                purpose: request.purpose,
                usage: request.usage,
                context: json!({ "a2a_payload": request.payload }),
                trace_id: None,
                replay_token: request.replay_token,
            },
        )
        .await
    }

    pub async fn evidence(
        &self,
        identity: &Identity,
        trace_id: &str,
    ) -> Result<EvidenceResponse, DomainError> {
        self.require_scope(identity, "evidence:read")?;

        let events = self
            .store
            .events_by_trace(trace_id)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        let tenant_slug = events
            .first()
            .map(|event| event.tenant_slug.clone())
            .ok_or_else(|| DomainError::NotFound("evidence trace not found".to_string()))?;
        self.enforce_tenant(identity, &tenant_slug)?;

        Ok(EvidenceResponse {
            trace_id: trace_id.to_string(),
            events,
        })
    }

    pub fn protocols(&self, identity: &Identity) -> Result<ProtocolMetadata, DomainError> {
        self.require_scope(identity, "meta:read")?;
        Ok(ProtocolMetadata {
            mcp_spec_revision: self.settings.mcp_spec_revision.clone(),
            a2a_spec_revision: self.settings.a2a_spec_revision.clone(),
        })
    }

    pub fn policy_bundle(&self, identity: &Identity) -> Result<PolicyBundleMetadata, DomainError> {
        self.require_scope(identity, "meta:read")?;
        Ok(PolicyBundleMetadata {
            policy_package: self.settings.policy_package.clone(),
            bundle_version: self.settings.policy_bundle_version.clone(),
            bundle_sha256: self.settings.policy_bundle_sha256.clone(),
        })
    }

    fn validate_authorization_input(
        &self,
        input: &AuthorizationRequest,
    ) -> Result<(), DomainError> {
        if input.tenant_slug.trim().is_empty() {
            return Err(DomainError::BadRequest(
                "tenant_slug is required".to_string(),
            ));
        }

        if input.tool_name.trim().is_empty() {
            return Err(DomainError::BadRequest("tool_name is required".to_string()));
        }

        if input.action.trim().is_empty() {
            return Err(DomainError::BadRequest("action is required".to_string()));
        }

        Ok(())
    }

    async fn attest_authorized_decision(
        &self,
        request: &AuthorizationRequest,
        decision: &AuthorizationDecision,
    ) -> Result<String, DomainError> {
        let request_hash = json_sha256(json!({
            "tenant_slug": request.tenant_slug.clone(),
            "tool_name": request.tool_name.clone(),
            "action": request.action.clone(),
            "purpose": request.purpose.clone(),
            "usage": request.usage,
            "context": request.context.clone(),
            "trace_id": decision.trace_id.clone(),
            "replay_token": request.replay_token.clone(),
        }))?;

        let response_hash = json_sha256(json!({
            "decision_id": decision.decision_id,
            "trace_id": decision.trace_id.clone(),
            "allow": decision.allow,
            "reason_code": decision.reason_code.clone(),
            "reason": decision.reason.clone(),
            "quota_remaining": decision.quota_remaining,
            "risk_score": decision.risk_score,
            "risk_reason_codes": decision.risk_reason_codes.clone(),
            "requires_approval": decision.requires_approval,
        }))?;

        let payload = AttestationPayload {
            tenant_slug: request.tenant_slug.clone(),
            tool_name: request.tool_name.clone(),
            action: request.action.clone(),
            decision_id: decision.decision_id,
            decision_allow: decision.allow,
            request_hash,
            response_hash: Some(response_hash),
            outcome: Some("authorized".to_string()),
        };

        let envelope = self
            .attestor
            .attest(&payload, &decision.trace_id)
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.store
            .put_attestation(envelope.clone())
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))?;

        self.record_event(
            &decision.trace_id,
            &request.tenant_slug,
            "provenance.attested.decision",
            json!({
                "decision_id": decision.decision_id,
                "attestation": envelope
            }),
        )
        .await?;

        Ok(envelope.attestation_id)
    }

    fn require_scope(&self, identity: &Identity, required_scope: &str) -> Result<(), DomainError> {
        if identity.has_scope(required_scope) || identity.has_scope("admin:all") {
            Ok(())
        } else {
            Err(DomainError::Forbidden(format!(
                "missing required scope '{required_scope}'"
            )))
        }
    }

    fn enforce_tenant(&self, identity: &Identity, tenant_slug: &str) -> Result<(), DomainError> {
        if identity.has_scope("tenant:all") || identity.has_scope("admin:all") {
            return Ok(());
        }

        if let Some(identity_tenant) = &identity.tenant {
            if identity_tenant == tenant_slug {
                return Ok(());
            }
        }

        Err(DomainError::Forbidden(
            "token tenant does not match request tenant".to_string(),
        ))
    }

    async fn record_event(
        &self,
        trace_id: &str,
        tenant_slug: &str,
        event_type: &str,
        payload: serde_json::Value,
    ) -> Result<(), DomainError> {
        self.store
            .append_event(EventRecord {
                id: Uuid::new_v4(),
                trace_id: trace_id.to_string(),
                tenant_slug: tenant_slug.to_string(),
                event_type: event_type.to_string(),
                created_at: Utc::now(),
                payload,
            })
            .await
            .map_err(|error| DomainError::Internal(error.to_string()))
    }
}

fn json_sha256(value: Value) -> Result<String, DomainError> {
    let bytes =
        serde_json::to_vec(&value).map_err(|error| DomainError::Internal(error.to_string()))?;
    let digest = Sha256::digest(bytes);
    Ok(format!("sha256:{digest:x}"))
}
