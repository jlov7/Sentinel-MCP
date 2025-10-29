"""Application configuration."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Dict

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed configuration."""

    postgres_url: str = "postgresql+psycopg://localhost:5432/sentinel"
    redis_url: str = "redis://localhost:6379/0"
    opa_url: str = "http://localhost:8181"
    signing_key: str = "dev-signing-key"
    otel_exporter_otlp_endpoint: str | None = None
    enable_trace_export: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def telemetry_enabled(self) -> bool:
        return self.enable_trace_export and bool(self.otel_exporter_otlp_endpoint)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "postgres_url": self.postgres_url,
            "redis_url": self.redis_url,
            "opa_url": self.opa_url,
            "signing_key": "***redacted***",
            "otel_exporter_otlp_endpoint": self.otel_exporter_otlp_endpoint,
            "enable_trace_export": self.enable_trace_export,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
