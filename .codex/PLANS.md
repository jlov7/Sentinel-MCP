# Sentinel MCP v2 ExecPlan

## Purpose / Big Picture
Build a world-class, frontier-grade v2 governance runtime (Rust core) while preserving v1 as baseline reference. Deliver a functioning v2 control plane slice that demonstrates policy enforcement, kill-switch control, approval orchestration, provenance attestation, replay protections, and auditable evidence.

## Progress
- [x] Create `apps/control-plane-v2` Rust crate with Axum runtime
- [x] Define v2 API endpoints per redesign contract
- [x] Add JWT authn + scoped authz checks
- [x] Implement event-sourced in-memory store abstraction
- [x] Implement OPA policy client abstraction + static policy test engine
- [x] Implement bounded risk-scoring stage
- [x] Implement approval request/resolve flows with TTL handling
- [x] Implement DSSE-style attestation + verification abstraction
- [x] Add integration tests for key governance scenarios
- [x] Add CI and local command integration for Rust checks
- [x] Update docs/README with v2 architecture + explicit non-affiliation disclaimer
- [x] Run verification gates and capture outcomes
- [x] Implement Postgres-backed event ledger and runtime backend selection
- [x] Implement Rekor-backed attestation mode and strict fail-closed option
- [x] Rebuild admin console to mission-control workflows against `/v2/*`
- [x] Implement Sigstore keyless attestation mode with cert-chain/tlog verification
- [x] Enforce tenant isolation for evidence/provenance read paths
- [x] Add MCP/A2A interop authorization adapter endpoints
- [x] Add fixture-driven performance and security regression suites
- [x] Add deterministic release-gate runner with machine-readable report output
- [x] Add CI release-gate job and artifact upload
- [x] Clarify Rekor semantics (`rekor_uuid` vs `rekor_log_id`) for keyless attestations
- [x] Auto-attest allowed decisions with fail-closed fallback on attestation failure
- [x] Add standalone `attestation_verify` CLI and release-gate coverage
- [x] Deliver world-class documentation overhaul (README, diagrams, screenshots, audience-specific docs, API/reference pages)

## Surprises & Discoveries
- Existing repo had no Rust workspace, so v2 was introduced as a parallel app crate to avoid destabilizing v1.
- Next.js production build type-checking surfaced stale v1 UI components after the v2 API client rewrite; removing legacy components resolved drift cleanly.
- Sigstore integration was feasible directly in-process with `sigstore-sign` + `sigstore-verify`, enabling keyless signing/verification without custom crypto logic.
- Preserving compatibility while fixing Rekor semantics was cleaner by adding `rekor_log_id` instead of renaming legacy `rekor_uuid`.
- Visual assets (diagram SVGs + real UI captures) significantly improved comprehension speed versus text-only docs.

## Decision Log
- Event source backend implemented as trait + in-memory default for deterministic local runs; Postgres backend is mode-selectable.
- OPA remains source-of-truth policy engine in v2 design; policy unavailability remains fail-closed.
- Attestation is environment-configurable: `local`, `rekor`, `sigstore_keyless`.
- Allowed authorization decisions now require successful attestation persistence (fail-closed on attestation errors).
- Release gate is codified as executable automation (`apps/control-plane-v2/scripts/release_gate.sh`) and pinned datasets under `tests/fixtures`.
- Repository narrative is intentionally split for non-technical and technical audiences to improve onboarding and decision support.

## Outcomes & Retrospective
- Done: v2 persistence backend, keyless Sigstore verification path, tenant isolation hardening, MCP/A2A interop adapters, fixture-driven security/perf gate, CI release gate artifacts, mission-control UI, automatic allow-decision attestation, standalone verifier CLI, and full documentation/visual presentation overhaul.
- Not done: none in this tranche relative to requested “pre-release gate” scope.
- Lesson: hard quality gates become maintainable once encoded as repeatable scripts + fixtures instead of ad-hoc checks.
