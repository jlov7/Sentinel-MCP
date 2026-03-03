# Setup & Deployment

This guide gives you two fast onboarding tracks:
- Local evaluation (single-machine, fastest path)
- Production-like mode (persistent store + strict controls)

## Prerequisites

- macOS/Linux shell environment
- Docker (for v1 stack helpers)
- Rust toolchain (`cargo`)
- Node.js + npm (admin console)
- Python virtualenv (`.venv`) for legacy tests

## Track A: Local v2 in 10 Minutes

```bash
git clone https://github.com/jlov7/Sentinel-MCP.git
cd Sentinel-MCP

make install

cd apps/control-plane-v2
cargo run
```

In a second terminal:

```bash
cd apps/admin-console
npm install
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8082 npm run dev
```

Validate:
- `http://localhost:8082/healthz`
- `http://localhost:3000`

## Track B: Production-Like Runtime Modes

Configure v2 runtime via environment variables:

- Store backend:
  - `SENTINEL_V2_STORE_BACKEND=memory|postgres`
  - `SENTINEL_V2_DATABASE_URL=postgres://...` (required for postgres)
  - `SENTINEL_V2_RUN_MIGRATIONS=true`
- Attestation backend:
  - `SENTINEL_V2_ATTESTATION_MODE=local|rekor|sigstore_keyless`
  - `SENTINEL_V2_REKOR_URL=...`
  - `SENTINEL_V2_STRICT_REKOR=true`
  - Sigstore keyless options (`SENTINEL_V2_SIGSTORE_*`)

## One-Command Validation

Run the full release gate:

```bash
make v2-release-gate
```

Report output:
- `apps/control-plane-v2/eval/reports/latest.json`

## Deployment Blueprint

1. Provision Postgres with TLS and backup policy.
2. Deploy v2 control plane (`apps/control-plane-v2`) with scoped JWT issuer.
3. Publish policy bundles and verify hash/version metadata.
4. Configure attestation mode (`sigstore_keyless` recommended for advanced provenance).
5. Deploy admin console behind SSO/authenticated access.
6. Wire CI artifact retention for release-gate reports.

## Troubleshooting

### `healthz` is offline

- Confirm process bind address/port
- Validate env vars for store/attestation modes
- Check startup logs for migration or config errors

### Admin console cannot authorize

- Ensure a valid bearer token is set in UI
- Verify tenant/scopes include required endpoint permissions

### Rekor/Sigstore verification failures

- Verify mode and strictness env vars
- Confirm trust-root environment (`production` vs `staging`)
- Inspect attestation envelope fields (`rekor_log_index`, `rekor_log_id`, `sigstore_bundle`)
