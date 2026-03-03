use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use chrono::{Duration as ChronoDuration, Utc};
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

const JWT_SECRET: &str = "perf-v2-secret";
const MIXED_LOAD_FIXTURE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/mixed_load_cases.json"
);

#[derive(Serialize)]
struct TestClaims {
    sub: String,
    tenant: Option<String>,
    scopes: Vec<String>,
    exp: usize,
}

#[derive(Clone, Debug, Deserialize)]
struct MixedLoadCase {
    tenant_slug: String,
    tool_name: String,
    action: String,
    purpose: Option<String>,
    usage: u64,
    context: Value,
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
        sub: "perf-actor".to_string(),
        tenant: tenant.map(str::to_string),
        scopes: scopes.iter().map(|value| value.to_string()).collect(),
        exp: (Utc::now() + ChronoDuration::hours(1)).timestamp() as usize,
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

#[tokio::test]
async fn p95_authorization_latency_and_throughput_gate() {
    let app = build_app();
    let bearer = token(&["decisions:authorize", "tenant:all"], None);
    let fixture = std::fs::read_to_string(MIXED_LOAD_FIXTURE).expect("fixture should be readable");
    let cases: Vec<MixedLoadCase> =
        serde_json::from_str(&fixture).expect("fixture should be valid json");
    assert!(
        !cases.is_empty(),
        "fixture should contain at least one case"
    );

    const REQUESTS: usize = 300;
    let mut samples = Vec::with_capacity(REQUESTS);
    let suite_start = Instant::now();

    for index in 0..REQUESTS {
        let scenario = &cases[index % cases.len()];
        let payload = json!({
            "tenant_slug": scenario.tenant_slug,
            "tool_name": scenario.tool_name,
            "action": scenario.action,
            "purpose": scenario.purpose,
            "usage": scenario.usage,
            "context": { "dataset_case": index % cases.len(), "batch": index, "input": scenario.context },
            "trace_id": null,
            "replay_token": format!("perf-nonce-{index}")
        });

        let started = Instant::now();
        let (status, _) = send(
            &app,
            Method::POST,
            "/v2/decisions/authorize",
            Some(&bearer),
            Some(payload),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        samples.push(started.elapsed());
    }

    samples.sort();
    let p95_index = ((REQUESTS as f64) * 0.95).ceil() as usize - 1;
    let p95 = samples[p95_index];
    let throughput = (REQUESTS as f64) / suite_start.elapsed().as_secs_f64();

    assert!(
        p95 <= Duration::from_millis(50),
        "p95 latency too high: {:?}",
        p95
    );
    assert!(
        throughput >= 100.0,
        "throughput too low: {:.2} req/s",
        throughput
    );
}

#[tokio::test]
async fn kill_switch_propagation_gate_under_load() {
    let app = build_app();
    let bearer = token(&["decisions:authorize", "control:kill", "tenant:all"], None);

    let kill_payload = json!({
        "tenant_slug": "platform-eng",
        "tool_name": "langsmith-docs-search",
        "reason": "perf-gate-kill"
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

    for index in 0..150 {
        let payload = json!({
            "tenant_slug": "platform-eng",
            "tool_name": "langsmith-docs-search",
            "action": "invoke",
            "purpose": "support",
            "usage": 1,
            "context": {"iteration": index},
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
        assert_eq!(
            body["reason_code"],
            Value::String("KILL_SWITCH_ACTIVE".to_string())
        );
    }
}
