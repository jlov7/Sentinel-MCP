# Architecture Deep Dive

## High-level flow

1. **Agents & adapters** (AgentKit, LangGraph, Claude Skills) register with Sentinel MCP, sending tool metadata and health.
2. **Control plane** (FastAPI) persists tenants, tools, and policy logs in Postgres, caches rate data in Redis, and proxies policy requests to OPA.
3. **Policy engine** (OPA) evaluates Rego policies using tenant/tool context, quota counters, and purpose metadata, returning allow/deny along with reasoning.
4. **Kill-switch orchestration** updates tool state, revokes credentials via adapter hooks, and emits structured logs with OpenTelemetry spans.
5. **Provenance signer** emits a signed manifest (Sigstore-compatible stub today) for every approved action and exposes verification endpoints + UI widget.

## Components

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Control plane API | FastAPI, SQLAlchemy | Tool registry, policy evaluation proxy, kill/restore orchestration, provenance endpoints |
| Database | Postgres | Tenants, tools, policy audit logs |
| Cache / queues | Redis | Future rate limiting queues, kill broadcasts |
| Policy engine | OPA sidecar | Evaluates Rego policies (allow/deny, quota enforcement, scoped secrets) |
| Provenance services | Custom module | Hash/sign manifests, provide verification |
| Admin console | Next.js + React | Inventory UI, kill switch controls, policy probes, manifest viewer |
| Tests | Pytest, Vitest | Unit, integration, UI smoke tests |

## Telemetry

- Structured logs provided via Structlog (`kill_switch.disabled/restored`).
- OpenTelemetry spans wrap kill/restore handlers with tenant/tool metadata; extendable to policy/provenance routes.
- Future work: export OTLP traces to an APM (Tempo, Honeycomb) and ship logs to a SIEM.

## Data model snapshot

- **Tenant**: `id`, `slug`, `display_name`, `created_at`.
- **Tool**: `id`, `tenant_id`, `name`, `url`, `owner`, `scopes`, `extra_metadata`, `is_active`, timestamps.
- **PolicyLog**: `id`, `tenant_id`, `tool_id`, `decision`, `reason`, `event_metadata`, timestamps.

## Sequence: tool invocation

```mermaid
dialogue
  participant Agent
  participant Adapter
  participant ControlPlane
  participant OPA
  participant Provenance

  Agent->>Adapter: Invoke tool
  Adapter->>ControlPlane: POST /policy/check
  ControlPlane->>OPA: Evaluate policy (tenant/tool context)
  OPA-->>ControlPlane: Allow + quota remaining
  ControlPlane-->>Adapter: Allow
  Adapter->>Agent: Continue execution
  Adapter->>ControlPlane: POST /provenance/sign
  ControlPlane->>Provenance: Sign manifest (hash + store)
  Provenance-->>Adapter: Manifest id
```

(If policy denies, the adapter gets the reason and blocks the tool.)

## Deployment modes

- **Local dev**: `docker-compose.dev.yml` spins Postgres, Redis, OPA, control plane, admin console.
- **Staging/prod**: use Terraform modules under `infra/terraform` (stub today) targeting managed Postgres, Redis, HashiCorp Vault, and container orchestrator (ECS/Kubernetes). OPA sidecar can be co-located per control plane pod.

