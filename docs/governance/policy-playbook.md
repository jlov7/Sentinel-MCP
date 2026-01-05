# Policy Playbook

This playbook covers the core policy primitives, data inputs, and a few high-value policy patterns for Sentinel MCP.

## Policy primitives

- **Allow/deny rules:** map tenant + tool + purpose to permitted actions.
- **Quotas:** limit usage per tool/team over time.
- **Scoped secrets:** inject credentials only when policy allows (future integration).
- **Kill overrides:** emergency disable regardless of other rules.

## Recommended data model

Keep policy data explicit and testable:

```json
{
  "allowlist": {
    "platform-eng": {
      "langsmith-docs-search": true
    }
  },
  "quotas": {
    "platform-eng": {
      "langsmith-docs-search": 1000
    }
  },
  "required_purpose": {
    "platform-eng": {
      "langsmith-docs-search": "support"
    }
  }
}
```

## Baseline policy (Rego)

```rego
package sentinel.policy

default allow := false

tenant := input.tenant
tool := input.tool
quota := data.quotas[tenant][tool]

allow {
  tool_allowed
  within_quota
  purpose_ok
}

tool_allowed {
  data.allowlist[tenant][tool]
}

within_quota {
  quota > input.usage
}

purpose_ok {
  required := data.required_purpose[tenant][tool]
  input.purpose == required
}

deny_reason[msg] {
  not tool_allowed
  msg := sprintf("tool %s denied for tenant %s", [tool, tenant])
}

deny_reason[msg] {
  not within_quota
  msg := sprintf("quota exceeded for tool %s tenant %s", [tool, tenant])
}

deny_reason[msg] {
  not purpose_ok
  msg := sprintf("purpose %s not allowed for tool %s tenant %s", [input.purpose, tool, tenant])
}
```

## Common patterns

**1) Cost guardrail**
- Set aggressive quotas for high-cost tools.
- Add automated alerts when usage approaches 80%.

**2) Purpose gating**
- Require approved purposes for sensitive tools.
- Treat new purposes as a change request.

**3) Break-glass access**
- Add a time-bound override flag for incident response.
- Log every break-glass use with a ticket ID.

**4) Environment-aware rules**
- Require stricter policies in production (no experimental tools).
- Allow broader access in sandbox tenants.

## Policy testing

- Validate allow/deny cases with unit tests (Rego + conftest).
- Keep a small set of golden inputs per tenant.
- Treat policy changes like code: review, test, and deploy.

## Governance cadence

- Weekly policy review (Platform + Security).
- Monthly usage report (violations, kills, provenance coverage).
- Quarterly tabletop exercise for kill-switch drills and audit trails.
