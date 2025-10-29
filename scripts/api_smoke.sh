#!/usr/bin/env bash
set -euo pipefail

if [[ ! -d .venv ]]; then
  echo "[api_smoke] Virtual environment (.venv) not found. Run 'make install' first." >&2
  exit 1
fi

if ! curl -sf ${CONTROL_PLANE_URL:-http://localhost:8000}/healthz >/dev/null; then
  echo "[api_smoke] Control plane not reachable at ${CONTROL_PLANE_URL:-http://localhost:8000}. Start it with ./scripts/dev_up.sh." >&2
  exit 1
fi

source .venv/bin/activate
pytest tests/api/test_control_plane.py
