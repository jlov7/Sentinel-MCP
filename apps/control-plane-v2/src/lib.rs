pub mod api;
pub mod auth;
pub mod domain;
pub mod infra;

use std::sync::Arc;

use axum::Router;
use thiserror::Error;

use crate::api::routes::build_router;
use crate::domain::service::ControlPlaneService;
use crate::infra::attestation::{
    Attestor, KeylessSigstoreAttestor, KeylessSigstoreAttestorConfig, LocalDsseAttestor,
    SigstoreRekorAttestor,
};
use crate::infra::config::Settings;
use crate::infra::policy::{OpaPolicyEngine, PolicyEngine};
use crate::infra::store::{EventStore, InMemoryEventStore, PgEventStore, StoreError};

#[derive(Debug, Error)]
pub enum BootstrapError {
    #[error("bootstrap configuration error: {0}")]
    Config(String),
    #[error(transparent)]
    Store(#[from] StoreError),
}

pub async fn app_with_settings(settings: Settings) -> Result<Router, BootstrapError> {
    let service = service_with_settings(settings).await?;
    Ok(build_router(service))
}

pub async fn service_with_settings(
    settings: Settings,
) -> Result<ControlPlaneService, BootstrapError> {
    let store_backend = settings.store_backend.trim().to_ascii_lowercase();
    let store: Arc<dyn EventStore> = match store_backend.as_str() {
        "memory" => Arc::new(InMemoryEventStore::default()),
        "postgres" => {
            let database_url = settings.database_url.clone().ok_or_else(|| {
                BootstrapError::Config(
                    "SENTINEL_V2_DATABASE_URL is required when SENTINEL_V2_STORE_BACKEND=postgres"
                        .to_string(),
                )
            })?;
            Arc::new(PgEventStore::connect(&database_url, settings.run_migrations).await?)
        }
        _ => {
            return Err(BootstrapError::Config(format!(
                "unsupported SENTINEL_V2_STORE_BACKEND '{store_backend}'"
            )));
        }
    };

    let policy_engine: Arc<dyn PolicyEngine> =
        Arc::new(OpaPolicyEngine::new(settings.opa_url.clone()));

    let attestation_mode = settings.attestation_mode.trim().to_ascii_lowercase();
    let attestor: Arc<dyn Attestor> = match attestation_mode.as_str() {
        "local" => Arc::new(LocalDsseAttestor::new(settings.dsse_signing_secret.clone())),
        "rekor" | "sigstore_rekor" => {
            let rekor_url = settings
                .rekor_url
                .clone()
                .unwrap_or_else(|| "http://localhost:3000".to_string());
            Arc::new(SigstoreRekorAttestor::new(
                settings.dsse_signing_secret.clone(),
                rekor_url,
                settings.strict_rekor,
            ))
        }
        "keyless" | "sigstore_keyless" => Arc::new(KeylessSigstoreAttestor::new(
            settings.dsse_signing_secret.clone(),
            KeylessSigstoreAttestorConfig {
                environment: settings.sigstore_environment.clone(),
                identity_token: settings.sigstore_identity_token.clone(),
                required_identity: settings.sigstore_required_identity.clone(),
                required_issuer: settings.sigstore_required_issuer.clone(),
                allow_ambient_credentials: settings.sigstore_allow_ambient_credentials,
                strict: settings.strict_rekor,
                rekor_url: settings.rekor_url.clone(),
                fulcio_url: settings.sigstore_fulcio_url.clone(),
                tsa_url: settings.sigstore_tsa_url.clone(),
            },
        )),
        _ => {
            return Err(BootstrapError::Config(format!(
                "unsupported SENTINEL_V2_ATTESTATION_MODE '{attestation_mode}'"
            )));
        }
    };

    Ok(ControlPlaneService::with_components(
        settings,
        store,
        policy_engine,
        attestor,
    ))
}

pub fn app_with_service(service: ControlPlaneService) -> Router {
    build_router(service)
}
