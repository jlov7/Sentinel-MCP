export type Tenant = {
  id: string;
  slug: string;
  display_name: string;
  created_at: string;
};

export type Tool = {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  owner: string;
  scopes: string[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PolicyDecision = {
  allow: boolean;
  reason?: string | null;
  quota_remaining?: number | null;
};

export type ManifestVerification = {
  manifest_id: string;
  verified: boolean;
  manifest: Record<string, unknown>;
};

export type HealthStatus = {
  status: string;
};

const baseUrl =
  process.env.NEXT_PUBLIC_CONTROL_PLANE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const CONTROL_PLANE_URL = baseUrl;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function fetchTenants(): Promise<Tenant[]> {
  return api<Tenant[]>("/register/tenants");
}

export async function fetchTools(tenant?: string): Promise<Tool[]> {
  const query = tenant ? `?tenant_slug=${encodeURIComponent(tenant)}` : "";
  return api<Tool[]>(`/register${query}`);
}

export async function disableTool(payload: {
  tenant_slug: string;
  tool_name?: string;
  reason: string;
}): Promise<void> {
  await api(`/kill`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function enableTool(payload: {
  tenant_slug: string;
  tool_name?: string;
}): Promise<void> {
  await api(`/kill/restore`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyManifest(manifestId: string): Promise<ManifestVerification> {
  return api<ManifestVerification>(`/provenance/verify/${manifestId}`);
}

export async function fetchHealth(): Promise<HealthStatus> {
  return api<HealthStatus>("/healthz");
}

export async function evaluatePolicy(payload: {
  tenant_slug: string;
  tool_name: string;
  action: string;
  purpose?: string;
  usage?: number;
  context?: Record<string, unknown>;
}): Promise<PolicyDecision> {
  return api<PolicyDecision>(`/policy/check`, {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      usage: payload.usage ?? 0,
      context: payload.context ?? {},
    }),
  });
}
