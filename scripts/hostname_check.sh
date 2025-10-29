#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOST=${EXPECTED_HOST:-Jasons-MBP-2.attlocal.net}
CURRENT_HOST=$(python3 -c "import platform;print(platform.node())")

if [[ "$CURRENT_HOST" != "$EXPECTED_HOST" ]]; then
  echo "[hostname_check] Hostname mismatch: expected $EXPECTED_HOST but got $CURRENT_HOST" >&2
  exit 1
fi
