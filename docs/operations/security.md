# Security & Compliance

Sentinel MCP security posture centers on governed execution, tenant isolation, fail-closed controls, and verifiable provenance.

## Trust Boundaries

1. Agent/runtime boundary (untrusted execution intent)
2. Control-plane authorization boundary (trusted policy decision point)
3. Tool execution boundary (external systems and data)
4. Evidence/provenance verification boundary (integrity and audit)

## Core Controls

- Scoped JWT authz on all v2 endpoints
- Tenant boundary checks on write and read paths
- Kill-switch precedence regardless of policy allow
- Replay-token protections
- Event-sourced decision/evidence ledger
- DSSE attestations with optional Sigstore/Rekor linkage

## Threats and Mitigations

| Threat | Primary Mitigation |
|---|---|
| Prompt-injection tool abuse | Policy + risk gate + scoped authz |
| Cross-tenant data access | Enforced tenant checks on all sensitive paths |
| Replay/reuse of privileged request | Replay-token reservation + TTL |
| Provenance tampering | Signature verification + bundle checks |
| Policy service outage | Fail-closed decision behavior |

## Hardening Checklist (Production)

- Use external identity issuer for service tokens (OIDC/JWT)
- Enable strict attestation mode for high-risk classes
- Use Postgres with TLS and backup/restore drills
- Restrict admin console access behind SSO and least privilege
- Ship structured logs and traces to centralized observability stack
- Enforce dependency update cadence with security advisories

## Compliance and Audit Readiness

Evidence expectations:
- every decision tied to `trace_id`
- attestation linkage for authorized tool calls
- replayable incident trail via event ledger

Recommended retention controls:
- policy and evidence event retention policy
- immutable storage for provenance artifacts where required
- documented data handling boundaries for tenant metadata

## Verification Controls

Run pre-release gate for reproducible quality evidence:

```bash
make v2-release-gate
```

Independent attestation verification:

```bash
cd apps/control-plane-v2
cargo run --bin attestation_verify -- --mode local --secret "$SENTINEL_V2_DSSE_SIGNING_SECRET" --envelope /path/to/envelope.json
```

## Security Positioning

Sentinel MCP is a personal R&D project and should be treated as a high-quality reference implementation, not an out-of-the-box compliance product.
