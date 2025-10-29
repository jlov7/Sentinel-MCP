# Policy Playbook

## Core policy primitives

- **Allow/Deny rules** – map tenant + tool + purpose to permitted actions.
- **Quotas** – limit usage per tool/team (token count, invocations per minute).
- **Scoped secrets** – ensure tool credentials are only injected when policy allows (future integration with Vault).
- **Kill overrides** – emergency disable irrespective of policy (manual trigger or automated via detection systems).

## Sample policies (Rego snippets)

```rego
package sentinel.policy

default allow := false

allow {
  allowed_tool
  within_quota
  purpose_ok
}

allowed_tool {
  data.allowlist[input.tenant][input.tool]
}

within_quota {
  input.usage < data.quotas[input.tenant][input.tool]
}

purpose_ok {
  input.purpose == data.required_purpose[input.tenant][input.tool]
}
```

## Playbook scenarios

| Scenario | Policy action | Follow-up |
|----------|---------------|-----------|
| Budget exceeded | Deny, emit `quota exceeded` reason | Notify FinOps, review quotas |
| Unapproved purpose | Deny, require ticket for new purpose | Governance review |
| Emergency disable | Manual kill switch + audit log | Incident response |
| Tool onboarding | Add to `allowlist`, define scopes, run seed script | Owner sign-off |

## Governance cadence

- Weekly policy review stand-up (Platform Eng + AppSec).
- Monthly metrics dashboard (violations, kills, provenance coverage).
- Quarterly tabletop exercise for kill-switch drills and provenance audits.

