use std::net::SocketAddr;

use axum::Router;
use opentelemetry::trace::TracerProvider;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use sentinel_control_plane_v2::app_with_settings;
use sentinel_control_plane_v2::infra::config::Settings;

#[tokio::main]
async fn main() {
    let settings = Settings::from_env();
    init_tracing(&settings);

    let app: Router = app_with_settings(settings.clone())
        .await
        .expect("failed to bootstrap control-plane-v2");

    let addr = SocketAddr::from(([0, 0, 0, 0], settings.port));
    tracing::info!(%addr, "sentinel control-plane v2 starting");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind listener");
    axum::serve(listener, app)
        .await
        .expect("server exited unexpectedly");
}

fn init_tracing(settings: &Settings) {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info,sentinel_control_plane_v2=debug".into());

    let fmt_layer = tracing_subscriber::fmt::layer().json();

    if settings.telemetry_enabled() {
        let exporter = opentelemetry_otlp::SpanExporter::builder()
            .with_http()
            .build()
            .expect("failed to create OTLP exporter");

        let provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
            .with_batch_exporter(exporter)
            .build();
        let tracer = provider.tracer("sentinel-control-plane-v2");

        tracing_subscriber::registry()
            .with(filter)
            .with(fmt_layer)
            .with(tracing_opentelemetry::layer().with_tracer(tracer))
            .init();
    } else {
        tracing_subscriber::registry()
            .with(filter)
            .with(fmt_layer)
            .init();
    }
}
