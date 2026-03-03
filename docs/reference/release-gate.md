# Release Gate Reference

The Sentinel MCP v2 release gate is a deterministic quality check used before merge/release decisions.

## Command

```bash
make v2-release-gate
```

## Gate Stages

1. `rust_fmt`
2. `rust_clippy`
3. `rust_perf_gate`
4. `rust_security_gate`
5. `rust_attestation_cli_gate`
6. `rust_all_tests`
7. `admin_lint`
8. `admin_test`
9. `admin_build`
10. `repo_pytest`

## Output

- Timestamped report:
  - `apps/control-plane-v2/eval/reports/release-gate-<timestamp>.json`
- Latest pointer:
  - `apps/control-plane-v2/eval/reports/latest.json`

## Pass Criteria

- Every stage status equals `pass`
- No skipped critical gate stages
- Report artifact generated and retained in CI

## Data Fixtures

- `apps/control-plane-v2/tests/fixtures/mixed_load_cases.json`
- `apps/control-plane-v2/tests/fixtures/security_vectors.json`

## What This Proves

- Lint/type/build hygiene
- Deterministic decision and tenant-boundary behavior
- Security regression resistance for known vectors
- Performance constraints under mixed load
- Independent attestation verification path health
