"""FastAPI application entrypoint."""

from __future__ import annotations

import logging

import structlog
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from .config import get_settings
from .routes import include_routes

logger = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Sentinel MCP Control Plane",
        description="Personal R&D project for governing MCP tools.",
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.telemetry_enabled():
        _configure_tracing(settings.otel_exporter_otlp_endpoint or "")

    api_router = APIRouter()
    include_routes(api_router)
    app.include_router(api_router)

    @app.get("/healthz")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    logger.info("control_plane.startup", settings=settings.as_dict())
    return app


def _configure_tracing(endpoint: str) -> None:
    resource = Resource.create({"service.name": "sentinel-control-plane"})
    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)


app = create_app()
