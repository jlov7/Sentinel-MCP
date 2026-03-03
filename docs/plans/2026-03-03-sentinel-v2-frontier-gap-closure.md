# Sentinel MCP v2 Frontier Gap-Closure (Executed)

## Goal
Close remaining v2 frontier gaps and establish a deterministic pre-release gate suitable for independent reproduction.

## Implemented
1. Sigstore keyless attestation mode (`SENTINEL_V2_ATTESTATION_MODE=sigstore_keyless`) with:
   - OIDC identity token support (explicit or ambient)
   - Fulcio/Rekor/TSA configurable endpoints
   - Sigstore bundle embedding in attestation envelope
   - verification via `sigstore-verify` trust roots and policy constraints
2. Tenant isolation hardening:
   - provenance read/verify endpoints now enforce tenant boundaries
   - evidence endpoint now enforces tenant boundaries and returns not-found for empty traces
3. Interop adapters:
   - `POST /v2/interop/mcp/authorize`
   - `POST /v2/interop/a2a/authorize`
4. Benchmark + regression suite:
   - fixture-driven mixed-load performance gate (`tests/fixtures/mixed_load_cases.json`)
   - fixture-driven security regression vectors (`tests/fixtures/security_vectors.json`)
   - integrity regression test for payload tampering
5. Pre-release automation:
   - `apps/control-plane-v2/scripts/release_gate.sh`
   - JSON report output in `apps/control-plane-v2/eval/reports/latest.json`
   - CI release-gate job with artifact upload
6. Decision traceability hardening:
   - allowed decisions now auto-emit signed attestations (`provenance.attested.decision`)
   - attestation failures force fail-closed authorization outcome (`ATTESTATION_FAILED`)
7. Provenance semantic fix:
   - added explicit `rekor_log_id` field for Sigstore keyless bundle metadata
   - preserved `rekor_uuid` for true Rekor entry UUID semantics
8. Independent verifier path:
   - standalone CLI: `cargo run --bin attestation_verify -- ...`
   - release gate now executes `attestation_verifier_cli` coverage

## Verification
- Release-gate script run succeeded locally on 2026-03-03 and generated report:
  - `apps/control-plane-v2/eval/reports/release-gate-20260303T134953Z.json`

## Notes
- Generated report files are runtime artifacts and are gitignored (except `.gitkeep`).
