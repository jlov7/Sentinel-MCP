use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use uuid::Uuid;

use crate::api::error::ApiError;
use crate::auth::{authenticate, Identity};
use crate::domain::models::{
    A2aAuthorizeRequest, ApprovalCreateRequest, ApprovalResolveRequest, AttestationRequest,
    AuthorizationRequest, EvidenceResponse, KillSwitchRequest, KillSwitchRestoreRequest,
    McpAuthorizeRequest, ReplayDecisionRequest,
};
use crate::domain::service::ControlPlaneService;

#[derive(Clone)]
pub struct AppState {
    service: Arc<ControlPlaneService>,
}

pub fn build_router(service: ControlPlaneService) -> Router {
    let state = AppState {
        service: Arc::new(service),
    };

    Router::new()
        .route("/healthz", get(healthz))
        .route("/v2/decisions/authorize", post(authorize))
        .route("/v2/interop/mcp/authorize", post(authorize_mcp))
        .route("/v2/interop/a2a/authorize", post(authorize_a2a))
        .route("/v2/control/kill-switch", post(trigger_kill_switch))
        .route("/v2/control/kill-switch/restore", post(restore_kill_switch))
        .route("/v2/provenance/attest", post(attest))
        .route("/v2/provenance/{attestation_id}", get(get_attestation))
        .route(
            "/v2/provenance/{attestation_id}/verify",
            get(verify_attestation),
        )
        .route("/v2/approvals/request", post(request_approval))
        .route(
            "/v2/approvals/{approval_id}/resolve",
            post(resolve_approval),
        )
        .route("/v2/replay/decision", post(replay_decision))
        .route("/v2/evidence/{trace_id}", get(evidence))
        .route("/v2/meta/protocols", get(meta_protocols))
        .route("/v2/meta/policy-bundle", get(meta_policy_bundle))
        .with_state(state)
}

async fn healthz() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "service": "sentinel-control-plane-v2" }))
}

async fn authorize(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthorizationRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let decision = state.service.authorize(&identity, payload).await?;
    Ok(Json(serde_json::to_value(decision).unwrap_or_default()))
}

async fn authorize_mcp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<McpAuthorizeRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let decision = state.service.authorize_mcp(&identity, payload).await?;
    Ok(Json(serde_json::to_value(decision).unwrap_or_default()))
}

async fn authorize_a2a(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<A2aAuthorizeRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let decision = state.service.authorize_a2a(&identity, payload).await?;
    Ok(Json(serde_json::to_value(decision).unwrap_or_default()))
}

async fn trigger_kill_switch(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<KillSwitchRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state
        .service
        .trigger_kill_switch(&identity, payload)
        .await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn restore_kill_switch(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<KillSwitchRestoreRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state
        .service
        .restore_kill_switch(&identity, payload)
        .await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn request_approval(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ApprovalCreateRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state.service.create_approval(&identity, payload).await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn resolve_approval(
    State(state): State<AppState>,
    Path(approval_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<ApprovalResolveRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state
        .service
        .resolve_approval(&identity, approval_id, payload)
        .await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn attest(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AttestationRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state.service.create_attestation(&identity, payload).await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn get_attestation(
    State(state): State<AppState>,
    Path(attestation_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state
        .service
        .get_attestation(&identity, &attestation_id)
        .await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn verify_attestation(
    State(state): State<AppState>,
    Path(attestation_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state
        .service
        .verify_attestation(&identity, &attestation_id)
        .await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn replay_decision(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ReplayDecisionRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state
        .service
        .replay_authorization(&identity, payload.request)
        .await?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn evidence(
    State(state): State<AppState>,
    Path(trace_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<EvidenceResponse>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state.service.evidence(&identity, &trace_id).await?;
    Ok(Json(response))
}

async fn meta_protocols(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state.service.protocols(&identity)?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

async fn meta_policy_bundle(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let identity = identity_from_headers(&headers, &state)?;
    let response = state.service.policy_bundle(&identity)?;
    Ok(Json(serde_json::to_value(response).unwrap_or_default()))
}

fn identity_from_headers(headers: &HeaderMap, state: &AppState) -> Result<Identity, ApiError> {
    authenticate(headers, &state.service.settings).map_err(ApiError::from)
}
