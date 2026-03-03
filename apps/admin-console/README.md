# Sentinel MCP Admin Console (Mission Control v2)

Operator UI for Sentinel MCP v2 governance workflows.

## Run

```bash
npm install
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8082 npm run dev
```

Optional default bearer token for local development:

```bash
NEXT_PUBLIC_CONTROL_PLANE_BEARER_TOKEN=<jwt>
```

## What the v2 console supports

- Authenticated `/v2/decisions/authorize` and `/v2/replay/decision`
- Kill-switch activation/restore via `/v2/control/kill-switch*`
- Approval request/resolve workflows
- Provenance attestation and verification
- Trace-based evidence lookup plus protocol/policy metadata views

The token can be pasted into the UI and is persisted in local storage for local R&D use.
