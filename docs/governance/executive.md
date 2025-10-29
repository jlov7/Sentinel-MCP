# Executive Brief

## Problem statement

Enterprise agent stacks amplify productivity but expand the attack surface:
- Tools proliferate without central inventory.
- Policies and rate limits are inconsistent across vendors.
- There is no provable audit trail tying actions to authorized identities.
- Kill switches require bespoke scripts, creating MTTR risk.

## Sentinel MCP value

- **Single source of truth** for all MCP servers/skills with health, ownership, and scopes.
- **Policy brain** combining identity, tool metadata, purpose, and budgets via OPA.
- **Kill-switch orchestration** across AgentKit, LangGraph, Claude Skills, and custom adapters.
- **Signed provenance** for every action, supporting compliance and incident response.

## Adoption guide

1. **Day 0 – Discovery:** inventory existing tools with the registry API; map owners and scopes.
2. **Day 1 – Policy pilot:** deploy OPA bundles for a single business unit; monitor denies and adjust quotas.
3. **Day 2 – Enterprise rollout:** integrate adapters across agent frameworks, enforce provenance mandates, and publish kill-switch runbook.

## Metrics to track

- % of tools inventoried vs estimated total.
- Policy violations caught and resolved (MTTR < 5 minutes goal).
- % of actions with verified provenance manifests.
- Kill-switch drill success rate (disabled + restored within SLA).

## Next steps

- Approve R&D spike for 2 weeks to productionize the prototype.
- Engage Platform Engineering and AppSec to co-own policy governance.
- Identify lighthouse teams (FinOps, Support) for co-design of policy templates.

