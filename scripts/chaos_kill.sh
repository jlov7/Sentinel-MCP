#!/usr/bin/env bash
set -u
set -o pipefail

usage() {
  cat <<'USAGE'
Usage: chaos_kill.sh [options] <tenant_slug> <tool_name>

Options:
  -c, --cycles N    Number of kill/restore cycles (default: 5)
  -d, --delay N     Base delay in seconds between actions (default: 1)
  -j, --jitter N    Add up to N seconds of random jitter to the delay (default: 0)
  -l, --log FILE    Append output to FILE as well as stdout
  -h, --help        Show this message
Environment:
  CONTROL_PLANE_URL (default: http://localhost:8000)
USAGE
}

cycles=5
delay=1
jitter=0
log_file=""
tenant=""
tool=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--cycles)
      cycles="$2"; shift 2;;
    -d|--delay)
      delay="$2"; shift 2;;
    -j|--jitter)
      jitter="$2"; shift 2;;
    -l|--log)
      log_file="$2"; shift 2;;
    -h|--help)
      usage; exit 0;;
    -*)
      echo "Unknown option: $1" >&2; usage; exit 1;;
    *)
      if [[ -z "$tenant" ]]; then
        tenant="$1"
      elif [[ -z "$tool" ]]; then
        tool="$1"
      else
        echo "Too many positional arguments" >&2
        usage
        exit 1
      fi
      shift;;
  esac
done

if [[ -z "$tenant" || -z "$tool" ]]; then
  usage
  exit 1
fi

if [[ -n "$log_file" ]]; then
  mkdir -p "$(dirname "$log_file")"
  touch "$log_file"
fi

log() {
  local msg="$1"
  echo "$msg"
  if [[ -n "$log_file" ]]; then
    echo "$msg" >> "$log_file"
  fi
}

random_sleep() {
  local base="$1"
  local jitter_max="$2"
  local total="$base"
  if [[ "$jitter_max" -gt 0 ]]; then
    extra=$(( RANDOM % (jitter_max + 1) ))
    total=$(( base + extra ))
  fi
  sleep "$total"
}

CONTROL_PLANE_URL=${CONTROL_PLANE_URL:-http://localhost:8000}

disable_success=0
disable_fail=0
restore_success=0
restore_fail=0

for ((i=1; i<=cycles; i++)); do
  timestamp=$(date -Is)
  log "[$timestamp][cycle $i] Disabling $tenant/$tool"
  if curl -sf -X POST "$CONTROL_PLANE_URL/kill" \
    -H 'Content-Type: application/json' \
    -d "{\"tenant_slug\":\"$tenant\",\"tool_name\":\"$tool\",\"reason\":\"chaos cycle $i\"}" >/dev/null; then
    disable_success=$((disable_success + 1))
  else
    disable_fail=$((disable_fail + 1))
    log "[cycle $i] Disable request failed"
  fi

  random_sleep "$delay" "$jitter"

  timestamp=$(date -Is)
  log "[$timestamp][cycle $i] Restoring $tenant/$tool"
  if curl -sf -X POST "$CONTROL_PLANE_URL/kill/restore" \
    -H 'Content-Type: application/json' \
    -d "{\"tenant_slug\":\"$tenant\",\"tool_name\":\"$tool\"}" >/dev/null; then
    restore_success=$((restore_success + 1))
  else
    restore_fail=$((restore_fail + 1))
    log "[cycle $i] Restore request failed"
  fi

  random_sleep "$delay" "$jitter"
done

log "Chaos drill completed: disable_success=$disable_success disable_fail=$disable_fail restore_success=$restore_success restore_fail=$restore_fail"

if [[ $disable_fail -gt 0 || $restore_fail -gt 0 ]]; then
  exit 1
fi
