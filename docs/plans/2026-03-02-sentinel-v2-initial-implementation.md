# Sentinel MCP v2 Initial Implementation Plan (Executed Tranche)

## Goal
Deliver the first executable slice of the v2 Rust control plane with the planned API contracts and governance primitives while preserving v1.

## Implemented Scope
- New Rust service at `apps/control-plane-v2`
- Authenticated v2 API surface (`/v2/*`)
- Scoped authorization checks
- Deterministic decision pipeline with OPA policy adapter + risk scoring
- Kill-switch controls
- Approval request/resolve workflow
- DSSE-style attestation + verification endpoints
- Replay token reservation and evidence retrieval
- Protocol/policy metadata endpoints
- Integration tests for core behavior
- CI + Makefile Rust verification hooks

## Deferred for next tranche
- Postgres-backed event persistence implementation details (beyond abstraction)
- Live Sigstore/Rekor integration
- Mission-control frontend redesign
- Benchmark harness and red-team corpus

## Verification Gates
- `cargo fmt -- --check`
- `cargo test`
- root `make rust-lint`
- root `make rust-test`
