use std::sync::Arc;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower::ServiceExt;

use sentinel_control_plane_v2::app_with_service;
use sentinel_control_plane_v2::domain::service::ControlPlaneService;
use sentinel_control_plane_v2::infra::attestation::LocalDsseAttestor;
use sentinel_control_plane_v2::infra::config::Settings;
use sentinel_control_plane_v2::infra::policy::{PolicyEngine, StaticPolicyEngine};
use sentinel_control_plane_v2::infra::store::{EventStore, InMemoryEventStore};

const JWT_SECRET: &str = "security-v2-secret";
const SECURITY_FIXTURE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/security_vectors.json"
);

#[derive(Serialize)]
struct TestClaims {
    sub: String,
    tenant: Option<String>,
    scopes: Vec<String>,
    exp: usize,
}

#[derive(Clone, Debug, Deserialize)]
struct SecurityVectorCase {
    name: String,
    tenant_slug: String,
    tool_name: String,
    action: String,
    purpose: Option<String>,
    usage: u64,
    context: Value,
    expected_reason_codes_any: Vec<String>,
}

fn build_app() -> axum::Router {
    let mut settings = Settings::from_env();
    settings.jwt_secret = JWT_SECRET.to_string();
    settings.enable_trace_export = false;
    settings.enforce_risk_gate = true;
    settings.require_approval_above_risk = 0.7;

    let store: Arc<dyn EventStore> = Arc::new(InMemoryEventStore::default());
    let policy: Arc<dyn PolicyEngine> = Arc::new(StaticPolicyEngine);
    let attestor = Arc::new(LocalDsseAttestor::new(settings.dsse_signing_secret.clone()));

    let service = ControlPlaneService::with_components(settings, store, policy, attestor);
    app_with_service(service)
}

fn token(scopes: &[&str], tenant: Option<&str>) -> String {
    let claims = TestClaims {
        sub: "security-actor".to_string(),
        tenant: tenant.map(str::to_string),
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
        serde_json::from_slice(&bytes).expect("response should be valid json")
    };

    (status, value)
}

fn load_case(name: &str) -> SecurityVectorCase {
    let fixture = std::fs::read_to_string(SECURITY_FIXTURE).expect("fixture should be readable");
    let cases: Vec<SecurityVectorCase> =
        serde_json::from_str(&fixture).expect("fixture should be valid json");
    cases
        .into_iter()
        .find(|value| value.name == name)
        .expect("requested fixture case should exist")
}

#[tokio::test]
async fn prompt_injection_and_exfiltration_vector_is_blocked() {
    let app = build_app();
    let bearer = token(&["decisions:authorize", "tenant:all"], None);
    let case = load_case("prompt_injection_exfil");

    let payload = json!({
        "tenant_slug": case.tenant_slug,
        "tool_name": case.tool_name,
        "action": case.action,
        "purpose": case.purpose,
        "usage": case.usage,
        "context": case.context,
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

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["allow"], Value::Bool(false));
    let reason_code = body["reason_code"].as_str().unwrap_or_default();
    assert!(
        case.expected_reason_codes_any
            .iter()
            .any(|value| value == reason_code),
        "unexpected reason code: {reason_code}"
    );
    let risk_codes = body["risk_reason_codes"]
        .as_array()
        .expect("risk reason codes should exist");
    assert!(risk_codes.iter().any(|value| value == "RISK_HIGH_USAGE"));
    assert!(risk_codes.iter().any(|value| value == "RISK_CONTEXT_token"));
}

#[tokio::test]
async fn policy_bypass_attempt_with_forbidden_purpose_is_denied() {
    let app = build_app();
    let bearer = token(&["decisions:authorize", "tenant:all"], None);
    let case = load_case("policy_bypass_forbidden_purpose");

    let payload = json!({
        "tenant_slug": case.tenant_slug,
        "tool_name": case.tool_name,
        "action": case.action,
        "purpose": case.purpose,
        "usage": case.usage,
        "context": case.context,
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

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["allow"], Value::Bool(false));
    let reason_code = body["reason_code"].as_str().unwrap_or_default();
    assert!(
        case.expected_reason_codes_any
            .iter()
            .any(|value| value == reason_code),
        "unexpected reason code: {reason_code}"
    );
}
