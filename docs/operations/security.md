# Security & Compliance Guidance

## Threat model highlights

- **Unauthorized tool invocation:** mitigated by policy enforcement at the control plane with deny-by-default rules and purpose checks.
- **Compromised adapter credentials:** kill-switch immediately disables tools and provenance manifests provide forensic trail.
- **Policy bypass via prompt injection:** guardrails sit between agent and tool, enforcing policies irrespective of prompt content.
- **Provenance tampering:** manifests are signed; move to Sigstore or KMS-backed signing for production.

## Controls in place

- Per-tool activation state (`is_active`) with rapid kill/restore flow.
- Rate/usage data captured in policy client (future: move to Redis counters for rate limiting).
- Structured logging with tenant/tool context for auditing.
- Signed manifests for every approved action (+ verification endpoint & UI).

## Recommended hardening

1. **Secrets management:** move `SIGNING_KEY`, database credentials, and API tokens to Vault; rotate on a schedule.
2. **TLS everywhere:** enforce TLS for OPA, Postgres, Redis; pin certificates in adapters.
3. **Sigstore integration:** replace hash-only signer with `sigstore` library, store Rekor entries.
4. **OPA policy reviews:** maintain policy-as-code repo with PR reviews and automated unit tests (rego, conftest).
5. **Dependency updates:** rely on Dependabot/renovate; treat critical advisories as break-glass.
6. **Static analysis:** add Bandit (`bandit -r apps/control-plane/src`) and ESLint security rules.
7. **Authentication/authorization:** add API keys or OIDC tokens for control plane endpoints before production.

## Compliance pointers

- **Audit logging:** send `kill_switch.*` and policy decision logs to SIEM for retention & analytics.
- **Data retention:** configure Postgres retention policy for policy logs (e.g., 180 days) respecting privacy requirements.
- **PII handling:** tool metadata should avoid sensitive data; if necessary, pseudonymize owner fields.
- **Access control:** restrict who can trigger `/kill` and `/kill/restore` via RBAC (future feature).

## Incident response checklist

1. Trigger kill-switch for impacted tool/tenant.
2. Export provenance manifests for incident window.
3. Audit policy logs for suspicious denies/allow events.
4. Rotate secrets and redeploy adapters.
5. Produce post-incident report using docs in Governance section.

