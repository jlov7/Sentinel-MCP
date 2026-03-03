use std::env;

#[derive(Clone, Debug)]
pub struct Settings {
    pub port: u16,
    pub jwt_secret: String,
    pub opa_url: String,
    pub policy_package: String,
    pub policy_bundle_version: String,
    pub policy_bundle_sha256: String,
    pub mcp_spec_revision: String,
    pub a2a_spec_revision: String,
    pub enable_trace_export: bool,
    pub require_approval_above_risk: f64,
    pub enforce_risk_gate: bool,
    pub replay_token_ttl_seconds: i64,
    pub dsse_signing_secret: String,
    pub store_backend: String,
    pub database_url: Option<String>,
    pub run_migrations: bool,
    pub attestation_mode: String,
    pub rekor_url: Option<String>,
    pub strict_rekor: bool,
    pub sigstore_environment: String,
    pub sigstore_identity_token: Option<String>,
    pub sigstore_required_identity: Option<String>,
    pub sigstore_required_issuer: Option<String>,
    pub sigstore_fulcio_url: Option<String>,
    pub sigstore_tsa_url: Option<String>,
    pub sigstore_allow_ambient_credentials: bool,
}

impl Settings {
    pub fn from_env() -> Self {
        Self {
            port: read_parse("SENTINEL_V2_PORT", 8082),
            jwt_secret: read_string("SENTINEL_V2_JWT_SECRET", "dev-v2-jwt-secret"),
            opa_url: read_string("SENTINEL_V2_OPA_URL", "http://localhost:8181"),
            policy_package: read_string("SENTINEL_V2_POLICY_PACKAGE", "sentinel/policy"),
            policy_bundle_version: read_string("SENTINEL_V2_POLICY_BUNDLE_VERSION", "2026.03.02"),
            policy_bundle_sha256: read_string("SENTINEL_V2_POLICY_BUNDLE_SHA256", "not-configured"),
            mcp_spec_revision: read_string("SENTINEL_V2_MCP_SPEC", "2025-11-25"),
            a2a_spec_revision: read_string("SENTINEL_V2_A2A_SPEC", "latest"),
            enable_trace_export: read_bool("SENTINEL_V2_ENABLE_TRACE_EXPORT", false),
            require_approval_above_risk: read_parse("SENTINEL_V2_APPROVAL_THRESHOLD", 0.7),
            enforce_risk_gate: read_bool("SENTINEL_V2_ENFORCE_RISK_GATE", false),
            replay_token_ttl_seconds: read_parse("SENTINEL_V2_REPLAY_TOKEN_TTL_SECONDS", 300),
            dsse_signing_secret: read_string("SENTINEL_V2_DSSE_SIGNING_SECRET", "dev-dsse-secret"),
            store_backend: read_string("SENTINEL_V2_STORE_BACKEND", "memory"),
            database_url: read_optional_string("SENTINEL_V2_DATABASE_URL"),
            run_migrations: read_bool("SENTINEL_V2_RUN_MIGRATIONS", true),
            attestation_mode: read_string("SENTINEL_V2_ATTESTATION_MODE", "local"),
            rekor_url: read_optional_string("SENTINEL_V2_REKOR_URL"),
            strict_rekor: read_bool("SENTINEL_V2_STRICT_REKOR", false),
            sigstore_environment: read_string("SENTINEL_V2_SIGSTORE_ENVIRONMENT", "production"),
            sigstore_identity_token: read_optional_string("SENTINEL_V2_SIGSTORE_IDENTITY_TOKEN"),
            sigstore_required_identity: read_optional_string(
                "SENTINEL_V2_SIGSTORE_REQUIRED_IDENTITY",
            ),
            sigstore_required_issuer: read_optional_string("SENTINEL_V2_SIGSTORE_REQUIRED_ISSUER"),
            sigstore_fulcio_url: read_optional_string("SENTINEL_V2_SIGSTORE_FULCIO_URL"),
            sigstore_tsa_url: read_optional_string("SENTINEL_V2_SIGSTORE_TSA_URL"),
            sigstore_allow_ambient_credentials: read_bool(
                "SENTINEL_V2_SIGSTORE_ALLOW_AMBIENT_CREDENTIALS",
                true,
            ),
        }
    }

    pub fn telemetry_enabled(&self) -> bool {
        self.enable_trace_export
    }
}

fn read_string(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_string())
}

fn read_bool(name: &str, default: bool) -> bool {
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<bool>().ok())
        .unwrap_or(default)
}

fn read_optional_string(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn read_parse<T>(name: &str, default: T) -> T
where
    T: std::str::FromStr,
{
    env::var(name)
        .ok()
        .and_then(|value| value.parse::<T>().ok())
        .unwrap_or(default)
}
