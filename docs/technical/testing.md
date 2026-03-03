# Testing Strategy

Sentinel MCP uses layered verification from unit tests through an end-to-end pre-release gate.

## Test Pyramid

| Layer | Scope | Primary Commands |
|---|---|---|
| Unit | Pure logic + policy helpers + UI components | `pytest`, `npm run test`, `cargo test` |
| API/Integration | Endpoint behavior, tenant boundaries, replay/approval flows | `cargo test --test v2_api` |
| Regression suites | Security vectors and performance constraints | `cargo test --test security_regression`, `cargo test --test performance_gate` |
| Release gate | Full repository quality gate with report artifact | `make v2-release-gate` |

## v2 Critical Suites

- `apps/control-plane-v2/tests/v2_api.rs`
- `apps/control-plane-v2/tests/bootstrap.rs`
- `apps/control-plane-v2/tests/attestation_integrity.rs`
- `apps/control-plane-v2/tests/attestation_verifier_cli.rs`
- `apps/control-plane-v2/tests/performance_gate.rs`
- `apps/control-plane-v2/tests/security_regression.rs`

Fixture-backed inputs:
- `apps/control-plane-v2/tests/fixtures/mixed_load_cases.json`
- `apps/control-plane-v2/tests/fixtures/security_vectors.json`

## Release Gate Contract

`make v2-release-gate` executes:
1. Rust formatting and clippy checks
2. Performance and security regression suites
3. Independent attestation verifier CLI test
4. Complete Rust test suite
5. Admin console lint/test/build
6. Root Python pytest suite
7. JSON report generation (`latest.json`)

A passing gate is required for “ready-to-review” quality.

## Independent Provenance Verification

Use CLI verifier:

```bash
cd apps/control-plane-v2
cargo run --bin attestation_verify -- \
  --mode local \
  --secret "$SENTINEL_V2_DSSE_SIGNING_SECRET" \
  --envelope /path/to/envelope.json
```

## Recommended CI Requirements

- Require green status for:
  - Rust lint/tests
  - Frontend lint/test/build
  - Python test suite
  - Release-gate artifact upload
- Keep historical `latest.json` artifacts for regression auditing.

## Failure-Mode Expectations

The following conditions should be exercised regularly:
- Kill-switch precedence over otherwise-allowed policy decisions
- Replay-token reuse rejection
- Cross-tenant access denial on decision/evidence/provenance paths
- Tamper detection for attestation payload/signature mismatch
