# v2 API Reference

This page summarizes Sentinel MCP v2 control-plane interfaces.

Base URL (local default): `http://localhost:8082`

## Authentication

All `/v2/*` endpoints require `Authorization: Bearer <jwt>` with appropriate scopes.

## Decision APIs

- `POST /v2/decisions/authorize`
  - Scope: `decisions:authorize`
  - Returns decision with `reason_code`, `risk_score`, and `attestation_id` when allowed
- `POST /v2/replay/decision`
  - Scope: `replay:decision`
  - Replays decision flow with replay-token protections

## Interop APIs

- `POST /v2/interop/mcp/authorize`
- `POST /v2/interop/a2a/authorize`

Both map interop payloads into the same deterministic decision pipeline.

## Control APIs

- `POST /v2/control/kill-switch`
- `POST /v2/control/kill-switch/restore`

Kill switch has strict precedence over policy allow.

## Approval APIs

- `POST /v2/approvals/request`
- `POST /v2/approvals/{id}/resolve`

Approvals are TTL-bound and audit logged.

## Provenance APIs

- `POST /v2/provenance/attest`
- `GET /v2/provenance/{attestation_id}`
- `GET /v2/provenance/{attestation_id}/verify`

Attestation metadata fields:
- `attestation_id`
- `trace_id`
- `rekor_log_index`
- `rekor_uuid`
- `rekor_log_id`

## Evidence and Metadata APIs

- `GET /v2/evidence/{trace_id}`
- `GET /v2/meta/protocols`
- `GET /v2/meta/policy-bundle`

## Common Reason Codes

- `KILL_SWITCH_ACTIVE`
- `POLICY_DENY`
- `POLICY_UNAVAILABLE`
- `APPROVAL_REQUIRED`
- `RISK_GATE_BLOCKED`
- `ATTESTATION_FAILED`

## Example Request

```bash
curl -X POST http://localhost:8082/v2/decisions/authorize \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_slug": "platform-eng",
    "tool_name": "langsmith-docs-search",
    "action": "invoke",
    "purpose": "support",
    "usage": 3,
    "context": {"channel": "ops"}
  }'
```
