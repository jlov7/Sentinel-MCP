use sentinel_control_plane_v2::infra::config::Settings;
use sentinel_control_plane_v2::service_with_settings;

#[tokio::test]
async fn postgres_backend_requires_database_url() {
    let mut settings = Settings::from_env();
    settings.store_backend = "postgres".to_string();
    settings.database_url = None;

    let message = match service_with_settings(settings).await {
        Ok(_) => panic!("postgres mode without db url should fail"),
        Err(error) => error.to_string(),
    };
    assert!(message.contains("SENTINEL_V2_DATABASE_URL"));
}

#[tokio::test]
async fn rejects_unknown_store_backend() {
    let mut settings = Settings::from_env();
    settings.store_backend = "something-weird".to_string();

    let message = match service_with_settings(settings).await {
        Ok(_) => panic!("unknown store backend should fail"),
        Err(error) => error.to_string(),
    };
    assert!(message.contains("unsupported SENTINEL_V2_STORE_BACKEND"));
}

#[tokio::test]
async fn rejects_unknown_attestation_mode() {
    let mut settings = Settings::from_env();
    settings.store_backend = "memory".to_string();
    settings.attestation_mode = "mystery".to_string();

    let message = match service_with_settings(settings).await {
        Ok(_) => panic!("unknown attestation mode should fail"),
        Err(error) => error.to_string(),
    };
    assert!(message.contains("unsupported SENTINEL_V2_ATTESTATION_MODE"));
}
