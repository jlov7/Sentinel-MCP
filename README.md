# Sentinel MCP

Governance control plane for AI agents and MCP tools. Enforce policy, budgets, and provenance every time a tool is invoked.

[![CI](https://github.com/jlov7/Sentinel-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/jlov7/Sentinel-MCP/actions/workflows/ci.yml)

**Project context:** Personal R&D prototype for exploring AI agent governance patterns. Not a commercial product.

## What it does

Sentinel MCP sits between AI agents and the tools they use. Every tool invocation is authorized, logged, and signed.

**Core capabilities**
- **Registry + inventory** for MCP servers and tools
- **Policy engine** (OPA/Rego) with purpose checks and quotas
- **Kill switch** to disable tools system-wide in seconds
- **Provenance manifests** with cryptographic signatures
- **Adapters** for AgentKit, LangGraph, Claude Skills, and custom frameworks

## Quickstart (local)

```bash
# Clone and configure

git clone https://github.com/jlov7/Sentinel-MCP.git
cd Sentinel-MCP
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

Admin console: http://localhost:3000
API docs: http://localhost:8000/docs

## Guided demo (10 minutes)

1. **Seed demo data** (already done by `dev_up.sh`, but safe to rerun):
   ```bash
   make seed
   ```

2. **Try a policy check:**
   ```bash
   curl -X POST http://localhost:8000/policy/check \
     -H "Content-Type: application/json" \
     -d '{"tenant_slug":"platform-eng","tool_name":"langsmith-docs-search","action":"invoke","purpose":"support","usage":10}'
   ```

3. **Trigger the kill switch:**
   ```bash
   curl -X POST http://localhost:8000/kill \
     -H "Content-Type: application/json" \
     -d '{"tenant_slug":"platform-eng","tool_name":"langsmith-docs-search","reason":"demo"}'
   ```

4. **Verify provenance:**
   ```bash
   curl http://localhost:8000/provenance/verify/<manifest-id>
   ```

Or use the Admin Console to flip the kill switch, probe policies, and verify manifests visually.

## Documentation

- **Overview:** `docs/index.md`
- **Executive brief:** `docs/governance/executive.md`
- **Architecture:** `docs/technical/architecture.md`
- **Setup guide:** `docs/technical/setup.md`
- **Demo walkthrough:** `docs/demo.md`
- **Policy playbook:** `docs/governance/policy-playbook.md`

## Architecture snapshot

```
AI Agent
   |
   v
Adapter (AgentKit/LangGraph/Claude)
   |
   v
Sentinel MCP Control Plane
  - Registry
  - Policy Engine (OPA)
  - Kill Switch
  - Provenance Signer
   |
   v
Tools / MCP Servers
```

## Project status

**Working today**
- Control plane API (FastAPI)
- OPA-backed policy checks
- Kill switch API + audit logs
- Provenance signing/verification
- Admin console (Next.js)

**Near-term upgrades**
- Authn/authz for control plane endpoints
- Sigstore/KMS-backed signing
- Rate limiting + usage counters
- Richer observability exports

## Contributing

Contributions welcome. See `CONTRIBUTING.md` for guidelines.

## License

Apache 2.0. See `LICENSE` for details.
