# Policy Playbook

This playbook defines practical policy design patterns for Sentinel MCP.

## Policy Objectives

A strong policy set should be:
- deterministic (same input => same decision)
- explainable (stable reason codes)
- reviewable (versioned as code)
- testable (fixture-backed regression cases)

## Minimal Input Contract

Authorization input should include:
- `tenant`
- `tool`
- `action`
- `purpose`
- `usage`
- `context`

These fields are evaluated by OPA and then enriched by risk scoring in v2.

## Baseline Rego Pattern

```rego
package sentinel.policy

default allow := false

tenant := input.tenant
tool := input.tool

allow {
  data.allowlist[tenant][tool]
  input.usage <= data.quotas[tenant][tool]
  input.purpose == data.required_purpose[tenant][tool]
}

deny_reason := "POLICY_DENY" {
  not allow
}
```

## High-Value Policy Patterns

## 1. Purpose Binding

Bind sensitive tools to explicit business purpose domains. Avoid wildcard purpose matching for high-impact tools.

## 2. Quota Controls

Set explicit tenant/tool budgets and include warning thresholds externally in observability.

## 3. Environment Segmentation

Stricter allowlists in production; broader experimentation in sandbox tenants.

## 4. Break-Glass Procedure

Use explicit, time-bound emergency exceptions with mandatory ticket IDs and post-incident review.

## Decision Code Hygiene

Keep deny semantics stable. Example reason code families:
- `POLICY_DENY`
- `POLICY_UNAVAILABLE`
- `APPROVAL_REQUIRED`
- `RISK_GATE_BLOCKED`
- `KILL_SWITCH_ACTIVE`
- `ATTESTATION_FAILED`

## Policy QA Checklist

- [ ] Golden allow/deny fixture cases are updated
- [ ] Rego tests cover each new branch condition
- [ ] Reason-code outputs are deterministic
- [ ] Policy bundle metadata updated and tracked
- [ ] Rollback plan documented

## Governance Cadence

- Weekly policy review with platform/security
- Monthly review of deny and approval trends
- Quarterly kill-switch and incident replay drill
