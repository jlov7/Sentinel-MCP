CREATE TABLE IF NOT EXISTS v2_events (
    id UUID PRIMARY KEY,
    trace_id TEXT NOT NULL,
    tenant_slug TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_events_trace_created_at
    ON v2_events (trace_id, created_at);

CREATE TABLE IF NOT EXISTS v2_tenant_kill_switches (
    tenant_slug TEXT PRIMARY KEY,
    disabled BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS v2_tool_kill_switches (
    tenant_slug TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    disabled BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (tenant_slug, tool_name)
);

CREATE TABLE IF NOT EXISTS v2_replay_tokens (
    token TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_replay_tokens_expires_at
    ON v2_replay_tokens (expires_at);

CREATE TABLE IF NOT EXISTS v2_approvals (
    approval_id UUID PRIMARY KEY,
    tenant_slug TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    decision_id UUID NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'denied', 'expired')),
    reason TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    resolved_by TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_v2_approvals_trace_id
    ON v2_approvals (trace_id);

CREATE TABLE IF NOT EXISTS v2_attestations (
    attestation_id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    envelope JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v2_attestations_trace_id
    ON v2_attestations (trace_id);
