# Sentinel MCP Control Plane v2 (Rust)

Research-grade v2 control plane for governed agent tool execution.

## Highlights

- JWT-authenticated, scope-based `/v2/*` API boundary
- Deterministic authorization pipeline (`/v2/decisions/authorize`)
- Automatic fail-closed decision attestation for allowed authorizations
- Kill-switch controls (`/v2/control/kill-switch*`)
- Approval workflows (`/v2/approvals/*`)
- DSSE-style provenance attest/verify (`/v2/provenance/*`)
- Optional Rekor-backed transparency-log linkage for attestations
- Optional Sigstore keyless mode with Fulcio cert + Rekor/TLog verification
- Standalone attestation verifier CLI (`cargo run --bin attestation_verify -- ...`)
- Replay protections and evidence retrieval (`/v2/replay/decision`, `/v2/evidence/{trace_id}`)
- Protocol + policy metadata endpoints (`/v2/meta/*`)
- Interop authorization adapters:
  - `POST /v2/interop/mcp/authorize`
  - `POST /v2/interop/a2a/authorize`

## Run

```bash
cd apps/control-plane-v2
cargo run
```

Service default: `http://localhost:8082`

## Runtime Modes

### Store backend

- `SENTINEL_V2_STORE_BACKEND=memory` (default)
- `SENTINEL_V2_STORE_BACKEND=postgres` + `SENTINEL_V2_DATABASE_URL=postgres://...`
- `SENTINEL_V2_RUN_MIGRATIONS=true` runs embedded SQL migrations on startup

### Attestation backend

- `SENTINEL_V2_ATTESTATION_MODE=local` (default)
- `SENTINEL_V2_ATTESTATION_MODE=rekor` with `SENTINEL_V2_REKOR_URL`
- `SENTINEL_V2_ATTESTATION_MODE=sigstore_keyless` for keyless signing + full Sigstore verification
- `SENTINEL_V2_SIGSTORE_ENVIRONMENT=production|staging`
- `SENTINEL_V2_SIGSTORE_IDENTITY_TOKEN=<oidc-jwt>` (or ambient credentials when enabled)
- `SENTINEL_V2_SIGSTORE_REQUIRED_IDENTITY=<expected-subject-or-email>` (optional policy constraint)
- `SENTINEL_V2_SIGSTORE_REQUIRED_ISSUER=<expected-issuer>` (optional policy constraint)
- `SENTINEL_V2_SIGSTORE_ALLOW_AMBIENT_CREDENTIALS=true|false`
- `SENTINEL_V2_STRICT_REKOR=true` enforces fail-closed attest/verify behavior when Rekor linkage is unavailable

## Release Gate

Run the reproducible pre-release gate (pinned datasets + perf/security suites + frontend/backend checks):

```bash
make v2-release-gate
```

Report output:
- `apps/control-plane-v2/eval/reports/latest.json`

## Test

```bash
cd apps/control-plane-v2
cargo test
```

Verify an exported envelope independently:

```bash
cd apps/control-plane-v2
cargo run --bin attestation_verify -- --mode local --secret "$SENTINEL_V2_DSSE_SIGNING_SECRET" --envelope /path/to/envelope.json
```
