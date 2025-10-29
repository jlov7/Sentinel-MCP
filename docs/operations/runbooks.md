# Operations Runbooks

## 1. Control plane health check fails

**Symptoms:** `/healthz` returns non-200, agents report tool registry unavailable.

1. `docker compose ps` (or orchestrator equivalent) – ensure control-plane/OPA/Postgres are running.
2. Check structlog output for `control_plane.startup` errors.
3. Run `alembic current` to verify database migrations.
4. Re-run `make seed` to validate registry operations.
5. If OPA unreachable, inspect `opa` container logs or policy bundle path.

## 2. Policy denies expected action

1. Query recent policy log via database (`SELECT decision, reason FROM policy_logs ORDER BY created_at DESC LIMIT 10`).
2. Run `pytest tests/unit/test_policy_route.py::test_policy_check_deny` to ensure deny flow behaves.
3. Verify OPA data (`opa eval --data opa/data.json --input <input.json> 'data.sentinel.policy'`).
4. Update policies (Rego) and redeploy bundle.

## 3. Kill switch stuck (tool remains disabled)

1. Check structlog events `kill_switch.disabled` and `kill_switch.restored`.
2. Confirm adapters acknowledged disable (AgentKit logs, LangGraph middleware).
3. Run `curl /register?tenant_slug=...` to confirm `is_active` status.
4. Use `/kill/restore` endpoint or Admin UI enable button.
5. If tool remains disabled, inspect adapter credentials and cached tokens; rotate secrets via Vault.

## 4. Provenance verification failure

1. Use new manifest viewer (`npm run dev` -> UI) or CLI: `curl /provenance/verify/<id>`.
2. Compare manifest payload vs expected action; confirm timestamp/time skew.
3. If signature mismatch, check signing key rotation; update `.env` `SIGNING_KEY` and redeploy.
4. Consider re-signing using Sigstore when production signer introduced.

## 5. Seeding script fails

1. Ensure stack is running: `docker compose up -d`.
2. Seed script now waits for `/healthz`; review logs for `Control plane health check failed`.
3. Validate environment variables (`POSTGRES_PASSWORD`, `OPA_URL`).
4. Run `pytest tests/api/test_control_plane.py` against live stack to reproduce.

## Escalation & notifications

- Structured logs: forward to SIEM/Observability stack to trigger alerts on `kill_switch.*` events.
- Add future webhook integration to notify Slack/PagerDuty on kill/restore operations.

## 6. Chaos drill (kill/restore)

1. Ensure the stack is running (`./scripts/dev_up.sh`).
2. Execute `make chaos` (invokes `hostname_check.sh` + `chaos_kill.sh`) or run `./scripts/chaos_kill.sh [options] <tenant> <tool>` manually (`--cycles`, `--delay`, `--jitter`, `--log`).
3. Monitor logs for `kill_switch.disabled` / `kill_switch.restored` and corresponding OTel spans.
4. Verify tool state via `/register?tenant_slug=...` and the Admin console.
5. Review provenance manifests and policy logs covering the drill window.
> **NOTE:** Local chaos drill automation (`make chaos`, etc.) is configured for developer machines. Do not run in shared staging/production environments without approval.

