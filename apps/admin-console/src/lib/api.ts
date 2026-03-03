export type HealthStatus = {
  status: string;
  service?: string;
};

export type AuthorizationRequest = {
  tenant_slug: string;
  tool_name: string;
  action: string;
  purpose?: string;
  usage?: number;
  context?: Record<string, unknown>;
  trace_id?: string | null;
  replay_token?: string | null;
};

export type AuthorizationDecision = {
  decision_id: string;
  trace_id: string;
  allow: boolean;
  reason_code?: string | null;
  reason?: string | null;
  quota_remaining?: number | null;
  risk_score: number;
  risk_reason_codes: string[];
  requires_approval: boolean;
};

export type KillSwitchPayload = {
  tenant_slug: string;
  tool_name?: string;
  reason: string;
};

export type KillSwitchRestorePayload = {
  tenant_slug: string;
  tool_name?: string;
};

export type KillSwitchResponse = {
  status: string;
  affected_tools: string[];
};

export type ApprovalRecord = {
  approval_id: string;
  tenant_slug: string;
  trace_id: string;
  decision_id: string;
  state: "pending" | "approved" | "denied" | "expired";
  reason: string;
  requested_by: string;
  resolved_by?: string | null;
  note?: string | null;
  created_at: string;
  expires_at: string;
  resolved_at?: string | null;
};

export type AttestationPayload = {
  tenant_slug: string;
  tool_name: string;
  action: string;
  trace_id: string;
  decision_id: string;
  decision_allow: boolean;
  request_hash: string;
  response_hash?: string;
  outcome?: string;
};

export type AttestationResponse = {
  attestation_id: string;
  trace_id: string;
  issued_at: string;
  rekor_log_index?: number | null;
  rekor_uuid?: string | null;
};

export type AttestationVerification = {
  attestation_id: string;
  verified: boolean;
  trace_id: string;
};

export type AttestationDetail = {
  attestation: {
    payload_type: string;
    payload: string;
    signatures: Array<{ keyid: string; sig: string }>;
    attestation_id: string;
    trace_id: string;
    issued_at: string;
    rekor_log_index?: number | null;
    rekor_uuid?: string | null;
  };
};

export type EventRecord = {
  id: string;
  trace_id: string;
  tenant_slug: string;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown>;
};

export type EvidenceResponse = {
  trace_id: string;
  events: EventRecord[];
};

export type ProtocolMetadata = {
  mcp_spec_revision: string;
  a2a_spec_revision: string;
};

export type PolicyBundleMetadata = {
  policy_package: string;
  bundle_version: string;
  bundle_sha256: string;
};

const baseUrl =
  process.env.NEXT_PUBLIC_CONTROL_PLANE_URL?.replace(/\/$/, "") ?? "http://localhost:8082";

export const CONTROL_PLANE_URL = baseUrl;
export const DEFAULT_BEARER_TOKEN = process.env.NEXT_PUBLIC_CONTROL_PLANE_BEARER_TOKEN ?? "";

function authHeaders(token: string): Record<string, string> {
  return token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {};
}

async function parseErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error ?? text;
  } catch {
    return text;
  }
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await parseErrorBody(response);
    throw new Error(`API ${response.status}: ${message}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const response = await fetch(`${baseUrl}/healthz`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return (await response.json()) as HealthStatus;
}

export function authorizeDecision(token: string, payload: AuthorizationRequest) {
  return api<AuthorizationDecision>("/v2/decisions/authorize", token, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      usage: payload.usage ?? 0,
      context: payload.context ?? {},
      trace_id: payload.trace_id ?? null,
      replay_token: payload.replay_token ?? null,
    }),
  });
}

export function replayDecision(token: string, payload: AuthorizationRequest) {
  return api<AuthorizationDecision>("/v2/replay/decision", token, {
    method: "POST",
    body: JSON.stringify({ request: payload }),
  });
}

export function enableKillSwitch(token: string, payload: KillSwitchPayload) {
  return api<KillSwitchResponse>("/v2/control/kill-switch", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function restoreKillSwitch(token: string, payload: KillSwitchRestorePayload) {
  return api<KillSwitchResponse>("/v2/control/kill-switch/restore", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestApproval(
  token: string,
  payload: {
    tenant_slug: string;
    trace_id: string;
    decision_id: string;
    reason: string;
    ttl_seconds?: number;
  }
) {
  return api<ApprovalRecord>("/v2/approvals/request", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolveApproval(
  token: string,
  approvalId: string,
  payload: { approved: boolean; note?: string }
) {
  return api<ApprovalRecord>(`/v2/approvals/${approvalId}/resolve`, token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function attest(token: string, payload: AttestationPayload) {
  return api<AttestationResponse>("/v2/provenance/attest", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAttestation(token: string, attestationId: string) {
  return api<AttestationDetail>(`/v2/provenance/${attestationId}`, token);
}

export function verifyAttestation(token: string, attestationId: string) {
  return api<AttestationVerification>(`/v2/provenance/${attestationId}/verify`, token);
}

export function fetchEvidence(token: string, traceId: string) {
  return api<EvidenceResponse>(`/v2/evidence/${encodeURIComponent(traceId)}`, token);
}

export function fetchProtocols(token: string) {
  return api<ProtocolMetadata>("/v2/meta/protocols", token);
}

export function fetchPolicyBundle(token: string) {
  return api<PolicyBundleMetadata>("/v2/meta/policy-bundle", token);
}
