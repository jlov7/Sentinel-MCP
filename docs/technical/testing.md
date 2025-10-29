# Testing Strategy

## Layers

| Layer | Tooling | Coverage |
|-------|---------|----------|
| Unit | Pytest, Vitest | Business logic, policy client stubs, UI components |
| API | Pytest TestClient | Policy allow/deny, kill/restore responses |
| Integration (opt-in) | docker-compose | End-to-end health, seeding, provenance verification |
| UI smoke | Vitest + Testing Library (future: Playwright) | Kill/restore toggle, manifest verification |
| Chaos (future) | custom scripts | OPA outage, rate-limit spikes, kill-switch drills |

## Current suites

- `tests/unit/test_policy_client.py`: OPA client happy/error paths.
- `tests/unit/test_policy_route.py`: allow/deny behaviour without live OPA.
- `tests/unit/test_provenance.py`: sign/verify round-trip.
- `tests/unit/test_agentkit_adapter.py`: adapter enforces allow before provenance.
- `tests/api/test_control_plane.py`: end-to-end register → policy → kill/restore → provenance (skips if control plane not running).
- Admin console: `ToolTable` and `ManifestViewer` components.

## Recommended additions

- Database constraint tests (unique tool names, tenant slug case sensitivity).
- Chaos harness verifying kill-switch MTTR and quota exhaustion.
- UI e2e using Playwright to exercise full flows.

## Testing commands

```bash
source .venv/bin/activate
pytest
# API smoke (requires stack running)
make api-test
make coverage
cd apps/admin-console
npm run lint
npm run test
```

## Quality gates

- Branch protection should require backend lint/tests (`pytest`) and frontend lint/tests (`npm run lint && npm run test`).
- Nightly integration pipeline (`.github/workflows/nightly-e2e.yml`) spins up the compose stack, seeds, and runs the API smoke suite.
- Dependabot updates must include test runs before merge.

## Chaos drills

- Script: `./scripts/chaos_kill.sh [--cycles N] [--delay N] [--jitter N] [--log FILE] <tenant_slug> <tool_name>` for quick kill/restore loops.
- Track structured logs and spans to ensure kill MTTR < 5 seconds.
- Extend with rate-limit spikes and OPA outage simulations (future).
