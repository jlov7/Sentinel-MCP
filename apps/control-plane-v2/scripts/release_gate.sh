#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
V2_DIR="$ROOT_DIR/apps/control-plane-v2"
ADMIN_DIR="$ROOT_DIR/apps/admin-console"
REPORT_DIR="$V2_DIR/eval/reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP_COMPACT="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_PATH="$REPORT_DIR/release-gate-$STAMP_COMPACT.json"
TMP_RESULTS="$(mktemp)"

cleanup() {
  rm -f "$TMP_RESULTS"
}
trap cleanup EXIT

run_step() {
  local name="$1"
  shift

  local started ended duration status
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local start_epoch
  start_epoch="$(date +%s)"

  if "$@"; then
    status="pass"
  else
    status="fail"
  fi

  ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration="$(( $(date +%s) - start_epoch ))"

  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$status" "$started" "$ended" "$duration" >> "$TMP_RESULTS"

  if [[ "$status" == "fail" ]]; then
    echo "Release gate failed at step: $name" >&2
    return 1
  fi
}

cd "$V2_DIR"

run_step "rust_fmt" cargo fmt -- --check
run_step "rust_clippy" cargo clippy --all-targets --all-features -- -D warnings
run_step "rust_perf_gate" cargo test --test performance_gate -- --nocapture
run_step "rust_security_gate" cargo test --test security_regression -- --nocapture
run_step "rust_attestation_cli_gate" cargo test --test attestation_verifier_cli -- --nocapture
run_step "rust_all_tests" cargo test

cd "$ADMIN_DIR"
run_step "admin_lint" npm run lint
run_step "admin_test" npm run test
run_step "admin_build" npm run build

cd "$ROOT_DIR"
run_step "repo_pytest" make test

PYTHON_BIN="python3"
if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

"$PYTHON_BIN" - <<'PY' "$TMP_RESULTS" "$REPORT_PATH" "$TIMESTAMP"
import json
import sys

rows_path, report_path, timestamp = sys.argv[1], sys.argv[2], sys.argv[3]
steps = []
with open(rows_path, "r", encoding="utf-8") as handle:
    for line in handle:
        name, status, started, ended, duration = line.rstrip("\n").split("\t")
        steps.append(
            {
                "name": name,
                "status": status,
                "started_at": started,
                "ended_at": ended,
                "duration_seconds": int(duration),
            }
        )

report = {
    "release_gate": "sentinel_mcp_v2",
    "generated_at": timestamp,
    "status": "pass" if all(step["status"] == "pass" for step in steps) else "fail",
    "datasets": [
        "tests/fixtures/mixed_load_cases.json",
        "tests/fixtures/security_vectors.json",
    ],
    "steps": steps,
}

with open(report_path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)

print(f"wrote {report_path}")
PY

cp "$REPORT_PATH" "$REPORT_DIR/latest.json"
echo "Release gate passed. Report: $REPORT_PATH"
