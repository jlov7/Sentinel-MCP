use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::infra::attestation::DsseEnvelope;
use crate::infra::store::EventRecord;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthorizationRequest {
    pub tenant_slug: String,
    pub tool_name: String,
    pub action: String,
    pub purpose: Option<String>,
    #[serde(default)]
    pub usage: u64,
    #[serde(default)]
    pub context: Value,
    pub trace_id: Option<String>,
    pub replay_token: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthorizationDecision {
    pub decision_id: Uuid,
    pub trace_id: String,
    pub allow: bool,
    pub reason_code: Option<String>,
    pub reason: Option<String>,
    pub quota_remaining: Option<i64>,
    pub risk_score: f64,
    pub risk_reason_codes: Vec<String>,
    pub requires_approval: bool,
    pub attestation_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KillSwitchRequest {
    pub tenant_slug: String,
    pub tool_name: Option<String>,
    pub reason: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KillSwitchRestoreRequest {
    pub tenant_slug: String,
    pub tool_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KillSwitchResponse {
    pub status: String,
    pub affected_tools: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApprovalCreateRequest {
    pub tenant_slug: String,
    pub trace_id: String,
    pub decision_id: Uuid,
    pub reason: String,
    pub ttl_seconds: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApprovalResolveRequest {
    pub approved: bool,
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalState {
    Pending,
    Approved,
    Denied,
    Expired,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApprovalRecord {
    pub approval_id: Uuid,
    pub tenant_slug: String,
    pub trace_id: String,
    pub decision_id: Uuid,
    pub state: ApprovalState,
    pub reason: String,
    pub requested_by: String,
    pub resolved_by: Option<String>,
    pub note: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttestationRequest {
    pub tenant_slug: String,
    pub tool_name: String,
    pub action: String,
    pub trace_id: String,
    pub decision_id: Uuid,
    pub decision_allow: bool,
    pub request_hash: String,
    pub response_hash: Option<String>,
    pub outcome: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttestationPayload {
    pub tenant_slug: String,
    pub tool_name: String,
    pub action: String,
    pub decision_id: Uuid,
    pub decision_allow: bool,
    pub request_hash: String,
    pub response_hash: Option<String>,
    pub outcome: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttestationResponse {
    pub attestation_id: String,
    pub trace_id: String,
    pub issued_at: DateTime<Utc>,
    pub rekor_log_index: Option<u64>,
    pub rekor_uuid: Option<String>,
    pub rekor_log_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttestationVerifyResponse {
    pub attestation_id: String,
    pub verified: bool,
    pub trace_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReplayDecisionRequest {
    pub request: AuthorizationRequest,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct McpAuthorizeRequest {
    pub tenant_slug: String,
    pub tool_name: String,
    pub purpose: Option<String>,
    #[serde(default)]
    pub usage: u64,
    #[serde(default)]
    pub call: Value,
    pub replay_token: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct A2aAuthorizeRequest {
    pub tenant_slug: String,
    pub capability: String,
    pub intent: String,
    pub purpose: Option<String>,
    #[serde(default)]
    pub usage: u64,
    #[serde(default)]
    pub payload: Value,
    pub replay_token: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvidenceResponse {
    pub trace_id: String,
    pub events: Vec<EventRecord>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProtocolMetadata {
    pub mcp_spec_revision: String,
    pub a2a_spec_revision: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PolicyBundleMetadata {
    pub policy_package: String,
    pub bundle_version: String,
    pub bundle_sha256: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AttestationDetailResponse {
    pub attestation: DsseEnvelope,
}
