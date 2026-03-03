# Operations Runbooks

This page defines response playbooks for common Sentinel MCP failure and incident scenarios.

## Operational SLO Anchors

- Kill-switch propagation/enforcement: target under 5 seconds
- Decision endpoint availability: target 99.9%+
- Evidence reconstruction time for a single incident: under 2 minutes

## Severity Framework

- SEV-1: Active security/compliance risk, immediate containment required
- SEV-2: Core governance functionality degraded
- SEV-3: Partial feature degradation or non-critical regressions

## Runbook A: Control Plane Unavailable

Symptoms:
- `/healthz` fails
- Mission Control shows offline status
- Decision requests time out

Actions:
1. Validate process/container status.
2. Check startup logs for configuration/migration failures.
3. Validate dependency reachability (OPA, Postgres if enabled).
4. Restore service and verify health endpoint.
5. Run smoke authorization request.

Exit criteria:
- health endpoint returns `ok`
- at least one authorize request succeeds

## Runbook B: Unexpected Policy Denials

Symptoms:
- spike in denied decisions with policy-related reason codes

Actions:
1. Capture sample request payload + reason codes.
2. Replay policy input directly against OPA bundle.
3. Validate policy-bundle metadata endpoint.
4. Roll back policy bundle if regression confirmed.
5. Document impact window and affected tenants/tools.

Exit criteria:
- expected allow/deny behavior restored
- regression test case added

## Runbook C: Kill Switch Not Enforcing

Symptoms:
- tool remains usable after disable command

Actions:
1. Verify kill-switch API response and event append.
2. Confirm subsequent authorize returns `KILL_SWITCH_ACTIVE`.
3. Check adapter path is invoking control-plane authorization.
4. If bypass path exists, disable adapter deployment path.

Exit criteria:
- kill-switch precedence validated with repeat request

## Runbook D: Provenance Verification Failure

Symptoms:
- attestation verify endpoint returns false/error

Actions:
1. Retrieve attestation envelope.
2. Run standalone verifier CLI on the same envelope.
3. Compare envelope signature/payload consistency.
4. Validate attestation backend mode configuration.
5. For keyless mode, inspect Sigstore bundle and transparency fields.

Exit criteria:
- verifier passes on fresh attestation
- root cause and remediation documented

## Runbook E: Tenant Isolation Incident

Symptoms:
- suspected cross-tenant evidence/provenance data exposure

Actions:
1. Immediately trigger high-risk incident response and restrict access.
2. Reproduce with scoped test token.
3. Confirm denial behavior on evidence/provenance reads.
4. Review audit logs for affected traces.
5. Patch and rerun tenant isolation tests before restore.

Exit criteria:
- cross-tenant access denied in tests and live validation

## Chaos Drill Procedure

1. Execute kill/restore chaos script in non-production environment.
2. Measure observed propagation latency.
3. Validate evidence capture for each cycle.
4. Record drill report with findings and follow-ups.

Command:

```bash
make chaos CHAOS_CYCLES=5 CHAOS_TENANT=platform-eng CHAOS_TOOL=langsmith-docs-search
```

## Incident Artifact Template

For every SEV-1/2 event capture:
- Incident ID and timeline
- Trigger and detection source
- Containment actions
- Trace IDs and attestation IDs involved
- Root cause and permanent fix
- Test/monitoring changes added
