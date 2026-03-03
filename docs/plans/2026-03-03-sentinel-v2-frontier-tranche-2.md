# Sentinel MCP v2 Frontier Tranche 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the highest-impact unfinished v2 objectives: production-grade persistence, transparency-log-backed provenance path, and a v2 mission-control UI.

**Architecture:** Keep v1 intact while extending the Rust v2 runtime. Add configurable backend/attestation modes to support local development defaults and hardened production behavior. Keep API contracts stable while enriching persistence and verification semantics.

**Tech Stack:** Rust (axum, sqlx, tokio), PostgreSQL, Next.js (TypeScript), Vitest.

---

### Task 1: Persistence backend and migrations

**Files:**
- Modify: `apps/control-plane-v2/src/infra/config.rs`
- Modify: `apps/control-plane-v2/src/infra/store.rs`
- Modify: `apps/control-plane-v2/src/lib.rs`
- Modify: `apps/control-plane-v2/src/main.rs`
- Create: `apps/control-plane-v2/migrations/20260303_000001_v2_event_ledger.sql`

**Steps:**
1. Extend settings with backend mode and Postgres URL.
2. Add sqlx migrator and schema for events/kill-switch/replay/approvals/attestations.
3. Implement `EventStore` trait for `PgEventStore`.
4. Build app service from settings with backend switch and migration option.
5. Keep memory mode as deterministic default for tests.

### Task 2: Rekor-backed provenance mode

**Files:**
- Modify: `apps/control-plane-v2/src/infra/config.rs`
- Modify: `apps/control-plane-v2/src/infra/attestation.rs`
- Modify: `apps/control-plane-v2/src/domain/service.rs`
- Modify: `apps/control-plane-v2/tests/v2_api.rs`

**Steps:**
1. Convert attestor interface to async.
2. Add `SigstoreRekorAttestor` with Rekor POST/GET operations and DSSE envelope generation.
3. Add strict Rekor mode option to fail attestation when transparency logging is required but unavailable.
4. Keep local attestor mode for offline development/test runs.
5. Update tests to validate compatibility with async attestor interface.

### Task 3: Mission-control v2 UI

**Files:**
- Modify: `apps/admin-console/src/lib/api.ts`
- Modify: `apps/admin-console/src/pages/index.tsx`
- Modify: `apps/admin-console/src/styles/globals.css`
- Modify: `apps/admin-console/src/components/__tests__/ToolTable.test.tsx`
- Modify: `apps/admin-console/src/components/__tests__/ManifestViewer.test.tsx`
- Create/Modify: `apps/admin-console/src/components/*` (v2 control panels)

**Steps:**
1. Replace v1 API client methods with v2 endpoints and bearer token support.
2. Implement mission-control panels for decisioning, kill-switch, approvals, provenance, and evidence replay.
3. Keep a responsive layout and readable operator workflows.
4. Update/replace component tests to match v2 UI behavior.

### Task 4: Verification and docs

**Files:**
- Modify: `apps/control-plane-v2/README.md`
- Modify: `README.md`
- Modify: `.codex/PLANS.md`
- Modify: `.codex/SCRATCHPAD.md`

**Steps:**
1. Run Rust lint/tests and frontend lint/tests.
2. Run repository test gate(s) affected by changes.
3. Update docs with new env vars and behavior.
4. Record outcomes and open risks in `.codex/PLANS.md`.
