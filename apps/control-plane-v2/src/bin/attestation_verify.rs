use std::env;
use std::fs;
use std::io::{self, Read};
use std::process;

use sentinel_control_plane_v2::infra::attestation::{
    Attestor, DsseEnvelope, KeylessSigstoreAttestor, KeylessSigstoreAttestorConfig,
    LocalDsseAttestor, SigstoreRekorAttestor,
};
use serde_json::json;

#[derive(Default)]
struct CliArgs {
    mode: String,
    envelope_path: String,
    secret: Option<String>,
    rekor_url: Option<String>,
    sigstore_environment: String,
    identity_token: Option<String>,
    required_identity: Option<String>,
    required_issuer: Option<String>,
    allow_ambient_credentials: bool,
}

fn usage() -> String {
    [
        "usage: attestation_verify --mode <local|rekor|sigstore_keyless> --envelope <path|-> [options]",
        "",
        "options:",
        "  --secret <value>                    shared secret for local/rekor modes",
        "  --rekor-url <url>                   Rekor URL for rekor mode (default: http://localhost:3000)",
        "  --sigstore-environment <env>        production|staging (default: production)",
        "  --identity-token <jwt>              explicit OIDC token for keyless mode",
        "  --required-identity <subject>       identity constraint for keyless verification",
        "  --required-issuer <issuer>          issuer constraint for keyless verification",
        "  --allow-ambient-credentials         allow ambient OIDC lookup for keyless mode",
    ]
    .join("\n")
}

fn parse_args() -> Result<CliArgs, String> {
    let mut args = CliArgs {
        sigstore_environment: "production".to_string(),
        ..CliArgs::default()
    };

    let mut iter = env::args().skip(1);
    while let Some(flag) = iter.next() {
        match flag.as_str() {
            "--mode" => {
                args.mode = iter
                    .next()
                    .ok_or_else(|| "missing value for --mode".to_string())?;
            }
            "--envelope" => {
                args.envelope_path = iter
                    .next()
                    .ok_or_else(|| "missing value for --envelope".to_string())?;
            }
            "--secret" => {
                args.secret = Some(
                    iter.next()
                        .ok_or_else(|| "missing value for --secret".to_string())?,
                );
            }
            "--rekor-url" => {
                args.rekor_url = Some(
                    iter.next()
                        .ok_or_else(|| "missing value for --rekor-url".to_string())?,
                );
            }
            "--sigstore-environment" => {
                args.sigstore_environment = iter
                    .next()
                    .ok_or_else(|| "missing value for --sigstore-environment".to_string())?;
            }
            "--identity-token" => {
                args.identity_token = Some(
                    iter.next()
                        .ok_or_else(|| "missing value for --identity-token".to_string())?,
                );
            }
            "--required-identity" => {
                args.required_identity = Some(
                    iter.next()
                        .ok_or_else(|| "missing value for --required-identity".to_string())?,
                );
            }
            "--required-issuer" => {
                args.required_issuer = Some(
                    iter.next()
                        .ok_or_else(|| "missing value for --required-issuer".to_string())?,
                );
            }
            "--allow-ambient-credentials" => {
                args.allow_ambient_credentials = true;
            }
            "--help" | "-h" => {
                return Err(usage());
            }
            other => {
                return Err(format!("unknown flag '{other}'\n\n{}", usage()));
            }
        }
    }

    if args.mode.trim().is_empty() || args.envelope_path.trim().is_empty() {
        return Err(usage());
    }

    Ok(args)
}

fn read_envelope(path: &str) -> Result<DsseEnvelope, String> {
    let bytes = if path == "-" {
        let mut buf = Vec::new();
        io::stdin()
            .read_to_end(&mut buf)
            .map_err(|error| format!("failed to read envelope from stdin: {error}"))?;
        buf
    } else {
        fs::read(path).map_err(|error| format!("failed to read envelope file '{path}': {error}"))?
    };

    serde_json::from_slice::<DsseEnvelope>(&bytes)
        .map_err(|error| format!("failed to decode envelope JSON: {error}"))
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("{error}");
        process::exit(2);
    }
}

async fn run() -> Result<(), String> {
    let args = parse_args()?;
    let envelope = read_envelope(&args.envelope_path)?;
    let mode = args.mode.trim().to_ascii_lowercase();

    let verifier: Box<dyn Attestor> = match mode.as_str() {
        "local" => Box::new(LocalDsseAttestor::new(
            args.secret
                .ok_or_else(|| "local mode requires --secret".to_string())?,
        )),
        "rekor" | "sigstore_rekor" => Box::new(SigstoreRekorAttestor::new(
            args.secret
                .ok_or_else(|| "rekor mode requires --secret".to_string())?,
            args.rekor_url
                .unwrap_or_else(|| "http://localhost:3000".to_string()),
            true,
        )),
        "keyless" | "sigstore_keyless" => Box::new(KeylessSigstoreAttestor::new(
            args.secret
                .ok_or_else(|| "sigstore keyless mode requires --secret".to_string())?,
            KeylessSigstoreAttestorConfig {
                environment: args.sigstore_environment,
                identity_token: args.identity_token,
                required_identity: args.required_identity,
                required_issuer: args.required_issuer,
                allow_ambient_credentials: args.allow_ambient_credentials,
                strict: true,
                rekor_url: args.rekor_url,
                fulcio_url: None,
                tsa_url: None,
            },
        )),
        other => {
            return Err(format!("unsupported mode '{other}'\n\n{}", usage()));
        }
    };

    verifier
        .verify(&envelope)
        .await
        .map_err(|error| format!("verification failed: {error}"))?;

    if matches!(mode.as_str(), "rekor" | "sigstore_rekor") && envelope.rekor_uuid.is_none() {
        return Err("verification failed: missing rekor_uuid for rekor mode".to_string());
    }

    if matches!(mode.as_str(), "keyless" | "sigstore_keyless")
        && (envelope.sigstore_bundle.is_none()
            || envelope.rekor_log_index.is_none()
            || envelope.rekor_log_id.is_none())
    {
        return Err(
            "verification failed: missing Sigstore transparency linkage fields".to_string(),
        );
    }

    let output = json!({
        "verified": true,
        "mode": mode,
        "attestation_id": envelope.attestation_id,
        "trace_id": envelope.trace_id,
        "rekor_uuid": envelope.rekor_uuid,
        "rekor_log_index": envelope.rekor_log_index,
        "rekor_log_id": envelope.rekor_log_id,
    });
    println!(
        "{}",
        serde_json::to_string_pretty(&output)
            .map_err(|error| format!("failed to render output JSON: {error}"))?
    );

    Ok(())
}
