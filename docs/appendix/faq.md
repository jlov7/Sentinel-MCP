# FAQ

## Is Sentinel MCP a commercial product?

No. Sentinel MCP is a personal R&D project focused on frontier governance patterns for agent tool use.

## What is the core idea?

Insert a governance runtime between agents and tools so every invocation is policy-checked, traceable, and verifiable.

## What is the difference between v1 and v2?

- v1: FastAPI baseline and legacy reference path
- v2: Rust control plane with scoped authz, event-sourced evidence, interop adapters, and hardened provenance workflows

## Is v2 production-ready?

v2 is a strong reference implementation with rigorous quality gates. For production deployment, teams should still apply environment-specific hardening (identity, secret management, SSO boundaries, and operational controls).

## Does Sentinel support MCP and A2A flows?

Yes. v2 includes first-class interop authorization endpoints for MCP and A2A payloads.

## How does Sentinel handle prompt-injection-mediated tool abuse?

The control plane evaluates structured execution intent, not raw model confidence. Policy, kill-switch controls, and security regression suites enforce guardrails independent of prompt text.

## How do I verify provenance independently?

Use the standalone verifier:

```bash
cd apps/control-plane-v2
cargo run --bin attestation_verify -- --mode local --secret "$SENTINEL_V2_DSSE_SIGNING_SECRET" --envelope /path/to/envelope.json
```

## What does the release gate cover?

It validates lint/build/tests across Rust, frontend, and Python plus performance/security regression suites and attestation verifier coverage.

## Where should new contributors start?

1. `README.md`
2. `docs/technical/setup.md`
3. `docs/demo.md`
4. `docs/technical/architecture-v2.md`
