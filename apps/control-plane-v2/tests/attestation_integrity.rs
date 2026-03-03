use uuid::Uuid;

use sentinel_control_plane_v2::domain::models::AttestationPayload;
use sentinel_control_plane_v2::infra::attestation::{Attestor, LocalDsseAttestor};

#[tokio::test]
async fn local_attestation_verification_fails_when_payload_is_tampered() {
    let attestor = LocalDsseAttestor::new("test-secret".to_string());
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

    let mut envelope = attestor
        .attest(&payload, "trace-attestation-integrity")
        .await
        .expect("attestation should succeed");

    envelope.payload.push('A');

    let result = attestor.verify(&envelope).await;
    assert!(result.is_err());
}
