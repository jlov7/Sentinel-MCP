# Demo Walkthrough

This walkthrough showcases policy checks, the kill switch, and provenance verification using the local stack.

## Prerequisites

- Docker running
- `.env` configured at the repo root
- Dependencies installed: `make install`

## 1) Start the stack

```bash
./scripts/dev_up.sh
```

This starts Postgres, Redis, OPA, and the control plane, then seeds demo tools.

## 2) Open the Admin Console

```bash
cd apps/admin-console
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev
```

Visit http://localhost:3000.

## 3) Explore inventory and kill switch

- Select a tenant and confirm tools load.
- Click **Kill Switch** to disable a tool.
- Click **Enable** to restore it.

## 4) Run a policy probe

In the **Policy Probe** panel, try:

- Tenant: `platform-eng`
- Tool: `langsmith-docs-search`
- Purpose: `support`
- Usage: `10`

You should see an **ALLOW** decision.

## 5) Verify provenance

Use the **Provenance** panel to verify a manifest ID printed by the seed script, or create one:

```bash
curl -X POST http://localhost:8000/provenance/sign \
  -H "Content-Type: application/json" \
  -d '{"tenant_slug":"platform-eng","tool_name":"langsmith-docs-search","action":"invoke","payload":{"note":"demo"}}'
```

Then paste the returned `manifest_id` into the UI and verify.

## 6) Optional CLI probes

```bash
curl -X POST http://localhost:8000/policy/check \
  -H "Content-Type: application/json" \
  -d '{"tenant_slug":"platform-eng","tool_name":"langsmith-docs-search","action":"invoke","purpose":"support","usage":10}'
```

```bash
curl -X POST http://localhost:8000/kill \
  -H "Content-Type: application/json" \
  -d '{"tenant_slug":"platform-eng","tool_name":"langsmith-docs-search","reason":"demo"}'
```

## Troubleshooting

- If the API is down, check `docker compose ps` and `docker compose logs control-plane`.
- If policy checks deny unexpectedly, verify `opa/data.json` aligns with seeded tools.
