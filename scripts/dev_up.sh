#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  echo "[dev_up] Missing .env. Copy .env.example and set secrets." >&2
  exit 1
fi

set -a
source .env
set +a

COMPOSE="docker compose -f docker-compose.dev.yml"

$COMPOSE up -d
$COMPOSE exec control-plane alembic upgrade head
source .venv/bin/activate && make seed

cat <<'MSG'

Stack is ready:
- API: http://localhost:8000
- Admin console: run "NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev" in apps/admin-console
MSG
