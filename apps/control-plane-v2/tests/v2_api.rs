use std::sync::Arc;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::Serialize;
use serde_json::{json, Value};
use tower::ServiceExt;
use uuid::Uuid;

use sentinel_control_plane_v2::app_with_service;
use sentinel_control_plane_v2::domain::service::ControlPlaneService;
use sentinel_control_plane_v2::infra::attestation::LocalDsseAttestor;
use sentinel_control_plane_v2::infra::config::Settings;
use sentinel_control_plane_v2::infra::policy::{PolicyEngine, StaticPolicyEngine};
use sentinel_control_plane_v2::infra::store::{EventStore, InMemoryEventStore};

const JWT_SECRET: &str = "test-v2-secret";

#[derive(Serialize)]
struct TestClaims {
    sub: String,
    tenant: Option<String>,
    scopes: Vec<String>,
    exp: usize,
}

fn build_app() -> axum::Router {
    let mut settings = Settings::from_env();
    settings.jwt_secret = JWT_SECRET.to_string();
    settings.enable_trace_export = false;

    let store: Arc<dyn EventStore> = Arc::new(InMemoryEventStore::default());
    let policy: Arc<dyn PolicyEngine> = Arc::new(StaticPolicyEngine);
    let attestor = Arc::new(LocalDsseAttestor::new(settings.dsse_signing_secret.clone()));

    let service = ControlPlaneService::with_components(settings, store, policy, attestor);
    app_with_service(service)
}

fn token(scopes: &[&str], tenant: Option<&str>) -> String {
    let claims = TestClaims {
        sub: "test-actor".to_string(),
        tenant: tenant.map(|value| value.to_string()),
        scopes: scopes.iter().map(|value| value.to_string()).collect(),
        exp: (Utc::now() + Duration::hours(1)).timestamp() as usize,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .expect("token should encode")
}

async fn send(
    app: &axum::Router,
    method: Method,
    path: &str,
    bearer: Option<&str>,
    payload: Option<Value>,
) -> (StatusCode, Value) {
    let mut request = Request::builder().method(method).uri(path);
    if let Some(bearer) = bearer {
        request = request.header("authorization", format!("Bearer {bearer}"));
    }
    request = request.header("content-type", "application/json");

    let body = payload
        .map(|value| Body::from(value.to_string()))
        .unwrap_or_else(Body::empty);

    let response = app
        .clone()
        .oneshot(request.body(body).expect("request should build"))
        .await
        .expect("request should succeed");

    let status = response.status();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("body should collect")
        .to_bytes();

    let value = if bytes.is_empty() {
        json!({})
    } else {
        serde_json::from_slice(&bytes).expect("response body should be valid json")
    };

    (status, value)
}

#[tokio::test]
async fn requires_authentication() {
    let app = build_app();

    let (status, body) = send(&app, Method::GET, "/v2/meta/protocols", None, None).await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(body["error"]
        .as_str()
        .unwrap_or_default()
        .contains("Authorization"));
}

#[tokio::test]
async fn kill_switch_takes_precedence_over_policy_allow() {
    let app = build_app();
    let bearer = token(
        &[
            "decisions:authorize",
            "control:kill",
            "tenant:all",
            "meta:read",
        ],
        None,
    );

    let request_payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "action": "invoke",
        "purpose": "support",
        "usage": 2,
        "context": {},
        "replay_token": null,
        "trace_id": null
    });

    let (status, first_decision) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(request_payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(first_decision["allow"], Value::Bool(true));
    assert!(first_decision["attestation_id"].is_string());

    let kill_payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "reason": "test kill switch"
    });

    let (status, _) = send(
        &app,
        Method::POST,
        "/v2/control/kill-switch",
        Some(&bearer),
        Some(kill_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, second_decision) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(request_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(second_decision["allow"], Value::Bool(false));
    assert_eq!(
        second_decision["reason_code"],
        Value::String("KILL_SWITCH_ACTIVE".to_string())
    );
    assert!(second_decision["attestation_id"].is_null());
}

#[tokio::test]
async fn approval_request_and_resolution_flow() {
    let app = build_app();
    let bearer = token(
        &[
            "decisions:authorize",
            "approvals:request",
            "approvals:resolve",
            "tenant:all",
        ],
        None,
    );

    let authorize_payload = json!({
        "tenant_slug": "finops",
        "tool_name": "finance-ledger-writer",
        "action": "write",
        "purpose": "finance",
        "usage": 5000,
        "context": {"payment": "invoice"},
        "trace_id": null,
        "replay_token": null
    });

    let (status, decision) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(authorize_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(decision["allow"], Value::Bool(false));
    assert_eq!(decision["requires_approval"], Value::Bool(true));

    let approval_payload = json!({
        "tenant_slug": "finops",
        "trace_id": decision["trace_id"],
        "decision_id": decision["decision_id"],
        "reason": "high-risk transfer",
        "ttl_seconds": 600
    });

    let (status, approval) = send(
        &app,
        Method::POST,
        "/v2/approvals/request",
        Some(&bearer),
        Some(approval_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(approval["state"], Value::String("pending".to_string()));

    let approval_id = approval["approval_id"]
        .as_str()
        .expect("approval id should exist");

    let resolve_payload = json!({"approved": true, "note": "validated by reviewer"});
    let (status, resolved) = send(
        &app,
        Method::POST,
        &format!("/v2/approvals/{approval_id}/resolve"),
        Some(&bearer),
        Some(resolve_payload),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(resolved["state"], Value::String("approved".to_string()));
}

#[tokio::test]
async fn provenance_attestation_verifies() {
    let app = build_app();
    let bearer = token(
        &[
            "provenance:attest",
            "provenance:verify",
            "provenance:read",
            "tenant:all",
        ],
        None,
    );

    let trace_id = "trace-v2-attest-1";
    let attest_payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "action": "invoke",
        "trace_id": trace_id,
        "decision_id": Uuid::new_v4(),
        "decision_allow": true,
        "request_hash": "sha256:req",
        "response_hash": "sha256:resp",
        "outcome": "success"
    });

    let (status, attested) = send(
        &app,
        Method::POST,
        "/v2/provenance/attest",
        Some(&bearer),
        Some(attest_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(attested["rekor_log_id"].is_null());

    let attestation_id = attested["attestation_id"]
        .as_str()
        .expect("attestation id should exist");

    let (status, verification) = send(
        &app,
        Method::GET,
        &format!("/v2/provenance/{attestation_id}/verify"),
        Some(&bearer),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(verification["verified"], Value::Bool(true));
}

#[tokio::test]
async fn replay_token_cannot_be_reused() {
    let app = build_app();
    let bearer = token(&["decisions:authorize", "tenant:all"], None);

    let payload = json!({
        "tenant_slug": "support",
        "tool_name": "customer-profile-api",
        "action": "invoke",
        "purpose": "support",
        "usage": 1,
        "context": {},
        "trace_id": null,
        "replay_token": "nonce-1"
    });

    let (status, _) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(payload.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(payload),
    )
    .await;

    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body["error"]
        .as_str()
        .unwrap_or_default()
        .contains("replay token"));
}

#[tokio::test]
async fn allowed_decision_emits_provenance_attestation_event() {
    let app = build_app();
    let bearer = token(
        &["decisions:authorize", "evidence:read", "tenant:all"],
        None,
    );

    let payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "action": "invoke",
        "purpose": "support",
        "usage": 1,
        "context": {"query": "audit"},
        "trace_id": null,
        "replay_token": null
    });

    let (status, decision) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(decision["allow"], Value::Bool(true));
    assert!(decision["attestation_id"].is_string());

    let trace_id = decision["trace_id"]
        .as_str()
        .expect("trace id should exist for allowed decision");

    let (status, evidence) = send(
        &app,
        Method::GET,
        &format!("/v2/evidence/{trace_id}"),
        Some(&bearer),
        None,
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let events = evidence["events"]
        .as_array()
        .expect("evidence events should be an array");
    assert!(
        events.iter().any(|event| {
            event["event_type"] == Value::String("provenance.attested.decision".to_string())
        }),
        "expected provenance attestation event in trace evidence"
    );
}

#[tokio::test]
async fn cross_tenant_decision_is_forbidden() {
    let app = build_app();
    let bearer = token(&["decisions:authorize"], Some("platform-eng"));

    let payload = json!({
        "tenant_slug": "finops",
        "tool_name": "finance-ledger-writer",
        "action": "write",
        "purpose": "finance",
        "usage": 1,
        "context": {},
        "trace_id": null,
        "replay_token": null
    });

    let (status, body) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&bearer),
        Some(payload),
    )
    .await;

    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body["error"]
        .as_str()
        .unwrap_or_default()
        .contains("tenant"));
}

#[tokio::test]
async fn evidence_read_respects_tenant_isolation() {
    let app = build_app();
    let admin = token(
        &["decisions:authorize", "evidence:read", "tenant:all"],
        None,
    );

    let payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "action": "invoke",
        "purpose": "support",
        "usage": 1,
        "context": {},
        "trace_id": null,
        "replay_token": null
    });

    let (status, decision) = send(
        &app,
        Method::POST,
        "/v2/decisions/authorize",
        Some(&admin),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let other_tenant = token(&["evidence:read"], Some("finops"));
    let trace_id = decision["trace_id"]
        .as_str()
        .expect("trace id should exist");

    let (status, _) = send(
        &app,
        Method::GET,
        &format!("/v2/evidence/{trace_id}"),
        Some(&other_tenant),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn attestation_read_respects_tenant_isolation() {
    let app = build_app();
    let admin = token(
        &[
            "provenance:attest",
            "provenance:read",
            "provenance:verify",
            "tenant:all",
        ],
        None,
    );

    let payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "action": "invoke",
        "trace_id": "trace-tenant-isolation",
        "decision_id": Uuid::new_v4(),
        "decision_allow": true,
        "request_hash": "sha256:req",
        "response_hash": "sha256:resp",
        "outcome": "success"
    });

    let (status, created) = send(
        &app,
        Method::POST,
        "/v2/provenance/attest",
        Some(&admin),
        Some(payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let attestation_id = created["attestation_id"]
        .as_str()
        .expect("attestation id should exist");

    let other_tenant = token(&["provenance:read"], Some("finops"));
    let (status, _) = send(
        &app,
        Method::GET,
        &format!("/v2/provenance/{attestation_id}"),
        Some(&other_tenant),
        None,
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn interop_authorize_endpoints_accept_mcp_and_a2a_payloads() {
    let app = build_app();
    let bearer = token(&["decisions:authorize", "tenant:all"], None);

    let mcp_payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "purpose": "support",
        "usage": 1,
        "call": {"method":"search","params":{"query":"safety"}},
        "replay_token": null
    });
    let (status, mcp_decision) = send(
        &app,
        Method::POST,
        "/v2/interop/mcp/authorize",
        Some(&bearer),
        Some(mcp_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(mcp_decision["attestation_id"].is_string());
    assert_eq!(mcp_decision["allow"], Value::Bool(true));

    let a2a_payload = json!({
        "tenant_slug": "platform-eng",
        "capability": "multi-agent-sync",
        "intent": "coordinate",
        "purpose": "support",
        "usage": 1,
        "payload": {"agent":"planner","task":"handoff"},
        "replay_token": null
    });
    let (status, a2a_decision) = send(
        &app,
        Method::POST,
        "/v2/interop/a2a/authorize",
        Some(&bearer),
        Some(a2a_payload),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(a2a_decision["attestation_id"].is_string());
    assert_eq!(a2a_decision["allow"], Value::Bool(true));
}
