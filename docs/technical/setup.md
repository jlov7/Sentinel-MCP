# Setup & Deployment

## Prerequisites

- Python 3.11+
- Node 20+
- Docker Desktop (or compatible engine) for local compose
- mkdocs (optional) for building docs: `pip install mkdocs`

## Local development

1. **Clone and bootstrap**
   ```bash
   git clone <repo>
   cd sentinel-mcp
   cp .env.example .env  # update POSTGRES_PASSWORD, SIGNING_KEY, etc.
   make install
   source .venv/bin/activate
   pytest
   cd apps/admin-console && npm install && npm run lint && npm run test
   ```

2. **Bring up the stack**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   docker compose -f docker-compose.dev.yml exec control-plane alembic upgrade head
   source ../.venv/bin/activate && make seed
   ```

3. **Explore the UI**
   ```bash
   NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev
   ```
   - Inventory tools, trigger kill switch, re-enable via restore, and verify manifests.

4. **Tear down**
   ```bash
   docker compose -f docker-compose.dev.yml down
   ```

## Running tests

- Chaos drill: `make chaos CHAOS_CYCLES=3 CHAOS_TENANT=platform-eng CHAOS_TOOL=langsmith-docs-search` (override vars as needed).
- Documentation: `make docs-build` (build) or `make docs-serve` (live preview).

## Running tests

- Backend unit + integration: `pytest`
- API smoke against live control plane: `pytest -m e2e` (future marker).
- Frontend: `npm run lint && npm run test`
- Docs: `mkdocs serve` (live preview) or `mkdocs build` (static output).

## CI recommendations

- Lint & format: `pre-commit run --all-files`
- Python matrix: `pytest` with `sqlite` fallback + `docker-compose` integration job.
- Frontend job: install, lint, vitest.
- Docs job: `pip install mkdocs-material` then `mkdocs build`.
- Security job: `pip install bandit` and run `bandit -r apps/control-plane/src` plus `npm audit --production`.

## Deployment outline

1. **Infrastructure**: provision Postgres (with TLS), Redis, Vault or Secrets Manager, and an OPA deployment.
2. **Control plane**: build container via `docker build -f apps/control-plane/Dockerfile .`, push to registry.
3. **OPA policies**: mount Rego bundles via bucket or GitOps.
4. **Admin console**: build static site (`npm run build`) and host behind CDN.
5. **Observability**: configure OTLP exporter and structure logs to a centralized log pipeline.
6. **Secrets**: supply environment variables via Vault injectors or orchestrator secrets.
7. **Kill/restore notifications**: integrate with Slack/PagerDuty via webhook triggered from Structlog processor or event stream (future work).

