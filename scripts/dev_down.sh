#!/usr/bin/env bash
set -euo pipefail

COMPOSE="docker compose -f docker-compose.dev.yml"
$COMPOSE down
