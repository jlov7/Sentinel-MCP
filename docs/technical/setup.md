# Setup & Deployment

## Quickstart (local)

```bash
# Clone and configure

git clone <repo>
cd sentinel-mcp
cp .env.example .env  # set POSTGRES_PASSWORD, SIGNING_KEY

# Install dependencies
make install

# Start the stack + seed demo data
./scripts/dev_up.sh

# Run the admin console
cd apps/admin-console
npm install
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev
```

## Common commands

- **Stop the stack:** `./scripts/dev_down.sh`
- **Re-seed demo data:** `make seed`
- **Chaos drill:** `make chaos CHAOS_CYCLES=3 CHAOS_TENANT=platform-eng CHAOS_TOOL=langsmith-docs-search`

## Tests

- Backend: `pytest`
- API smoke (requires running stack): `make api-test`
- Frontend: `cd apps/admin-console && npm run lint && npm run test`
- Docs: `pip install mkdocs-material` then `mkdocs serve` (preview) or `mkdocs build`

## CI recommendations

- Lint & format: `pre-commit run --all-files`
- Python matrix: `pytest` with `sqlite` fallback + compose integration job
- Frontend job: install, lint, vitest
- Docs job: `pip install mkdocs-material` then `mkdocs build`
- Security job: `pip install bandit` and run `bandit -r apps/control-plane/src` plus `npm audit --production`

## Deployment outline

1. **Infrastructure:** provision Postgres (TLS), Redis, Vault/Secrets Manager, and an OPA deployment.
2. **Control plane:** build and push the container (`docker build -f apps/control-plane/Dockerfile .`).
3. **OPA policies:** mount Rego bundles via bucket or GitOps.
4. **Admin console:** build static assets (`npm run build`) and host behind CDN.
5. **Observability:** configure OTLP exporter and structured log pipeline.
6. **Secrets:** supply env vars via Vault injectors or orchestration secrets.
7. **Notifications:** send kill/restore events to Slack/PagerDuty (future work).
