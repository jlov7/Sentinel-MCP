use std::fs;
use std::process::Command;

use serde_json::Value;
use uuid::Uuid;

use sentinel_control_plane_v2::domain::models::AttestationPayload;
use sentinel_control_plane_v2::infra::attestation::{Attestor, LocalDsseAttestor};

#[tokio::test]
async fn verifier_cli_validates_local_envelope() {
    let secret = "verifier-cli-secret";
    let payload = AttestationPayload {
        tenant_slug: "platform-eng".to_string(),
        tool_name: "langsmith-docs-search".to_string(),
        action: "invoke".to_string(),
        decision_id: Uuid::new_v4(),
        decision_allow: true,
        request_hash: "sha256:req".to_string(),
        response_hash: Some("sha256:resp".to_string()),
        outcome: Some("success".to_string()),
    };

    let attestor = LocalDsseAttestor::new(secret.to_string());
    let envelope = attestor
        .attest(&payload, "trace-verifier-cli")
        .await
        .expect("local attestation should succeed");

    let envelope_path =
        std::env::temp_dir().join(format!("sentinel-v2-envelope-{}.json", Uuid::new_v4()));
    fs::write(
        &envelope_path,
        serde_json::to_vec(&envelope).expect("envelope should serialize"),
    )
    .expect("envelope fixture should write");

    let output = Command::new(env!("CARGO_BIN_EXE_attestation_verify"))
        .args([
            "--mode",
            "local",
            "--secret",
            secret,
            "--envelope",
            envelope_path
                .to_str()
                .expect("temp path should be valid unicode"),
        ])
        .output()
        .expect("verifier cli should execute");

    let _ = fs::remove_file(&envelope_path);

    assert!(
        output.status.success(),
        "verifier failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout: Value =
        serde_json::from_slice(&output.stdout).expect("verifier output should be valid json");
    assert_eq!(stdout["verified"], Value::Bool(true));
    assert_eq!(stdout["mode"], Value::String("local".to_string()));
}
