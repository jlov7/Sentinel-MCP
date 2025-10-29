# Sentinel MCP (Personal R&D build)

Sentinel MCP is my personal R&D passion project exploring how to govern Model-Context Protocol (MCP) servers and agent skills with policies, budgets, and verifiable provenance.

> **Status:** Early research spike – not a commercial product. Expect sharp edges while the control plane, adapters, and policy graph take shape.

## Quickstart (WIP)

```bash
git clone <repo-url>
cd sentinel-mcp
cp .env.example .env   # set POSTGRES_PASSWORD before continuing
make install           # sets up .venv and installs editable packages
source .venv/bin/activate
pytest                 # run unit tests (policy client, provenance, adapters)
cd apps/admin-console && npm install && npm run lint && npm run test
cd ..
./scripts/dev_up.sh    # compose up, migrations, seed (requires Docker)
./scripts/dev_down.sh  # teardown when finished
make chaos CHAOS_CYCLES=3  # optional kill/restore drill (override CHAOS_* vars)
make api-test            # API smoke tests (requires running stack)
make coverage            # backend coverage report
```

## What you get (planned)

- MCP/Skills registry with health checks.
- Policy engine (OPA + graph context) for allow/deny, quotas, scoped secrets.
- Kill-switch API to revoke credentials and halt adapters.
- Restore API to re-enable tools after drills (`POST /kill/restore`).
- Provenance signer (C2PA-style manifests) with verification widget.
- Agent adapters for OpenAI AgentKit, LangGraph, and Claude Skills.
- Admin console stub (Next.js) for inventory, kill-switch, and policy probes.
- Chaos/eval harness for drills and rate-limit bursts.

## Architecture sketch

```
              ┌───────────────────────────────┐
              │  Sentinel MCP Control Plane   │
              │  - Registry (MCP/Skills)      │
              │  - Policy Graph (RBAC+ABAC)   │
Agents ──────▶│  - Rate/Quota Gov + Budgets   │◀── Admin Console
              │  - Kill-Switch Orchestrator   │
              │  - Provenance Signer (C2PA)   │
              │  - Audit Log (OTel + C2PA)    │
              └──────────┬───────────┬────────┘
                         │           │
                  ┌──────▼─────┐ ┌───▼────────┐
                  │ MCP Client │ │ Skills Svc │
                  │ Gatekeeper │ │ (SDK Hooks)│
                  └──────┬─────┘ └────┬───────┘
                         │            │
              ┌──────────▼────────┐  ┌▼───────────┐
              │ MCP Servers/Tools │  │ Code Exec   │
              └──────────┬────────┘  └────┬────────┘
                         │                │
                  ┌──────▼─────┐   ┌─────▼──────┐
                  │ KMS/Vault │   │ Observability│
                  └───────────┘   └──────────────┘
```

## Roadmap snapshot

- [x] FastAPI control plane skeleton with /register, /policy/check, /kill, /provenance endpoints.
- [x] Postgres models + Alembic migrations.
- [x] OPA wrapper + starter policies.
- [x] Provenance signer/verifier (Sigstore-backed prototype).
- [x] Adapters for AgentKit, LangGraph, and Claude Skills (R&D shims).
- [x] Admin console (Next.js) inventory table, kill-switch, policy probe.
- [x] Chaos drills, evaluation harness, OTel traces.
- [x] CI hardening (lint, tests, dependabot, SCA).

## Dev stack

- `docker-compose.dev.yml` (requires Docker) spins up Postgres 16, Redis 7, OPA, and the FastAPI control plane.
- `scripts/dev_up.sh` / `scripts/dev_down.sh` wrap common lifecycle commands.
- `scripts/chaos_kill.sh` runs repeatable kill/restore drills against a tool.
- `scripts/seed.py` registers sample tools, runs representative policy checks, and emits provenance manifests.
- OPA loads policies from `opa/` (mirrors `config/sample-policies.rego`) and data from `opa/data.json`; adjust to match your tenants/tools.
- Admin console runs with `NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev` inside `apps/admin-console`.
  - Supports kill-switches for active tools and one-click re-enables via the new restore endpoint.
- Compose expects `POSTGRES_PASSWORD` in `.env`; populate it with a strong secret before launching.

## Documentation

- Full documentation lives under `/docs` and can be served locally with `mkdocs serve`.
- Readable sections include:
  - Executive brief and policy playbook (for non-technical stakeholders).
  - Architecture, setup/deployment, and testing guides (for engineers).
  - Runbooks and security guidance (for operations/AppSec).
  - Glossary and FAQ.

## Tips

- See the *Setup & Deployment* guide in `/docs/technical/setup.md`.
- Use `./scripts/dev_up.sh` to start the local stack (includes migrations + seeding) and `./scripts/dev_down.sh` to tear down.
- Admin console manifest viewer lets you paste manifest IDs (e.g., from `make seed`) and verify provenance.
- Build docs with `make docs-build` or serve locally via `make docs-serve`.


## Contributing

Contributions welcome to this learning project! See `CONTRIBUTING.md` for setup and coding standards.

## License

Apache License 2.0 unless stated otherwise (see `LICENSE`).
