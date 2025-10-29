"""Shared FastAPI dependencies."""

from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from fastapi import Depends
from sqlalchemy.orm import Session

from sentinel_policy.client import PolicyClient
from sentinel_provenance.signer import ProvenanceSigner
from sentinel_provenance.storage import ManifestStorage
from sentinel_provenance.verifier import ProvenanceVerifier

from .config import Settings, get_settings
from .database import get_session


def settings_provider() -> Settings:
    return get_settings()


def db_session() -> Generator[Session, None, None]:
    with get_session() as session:
        yield session


def policy_client(settings: Settings = Depends(settings_provider)) -> Generator[PolicyClient, None, None]:
    client = PolicyClient(settings.opa_url)
    try:
        yield client
    finally:
        client.close()


def provenance_signer(settings: Settings = Depends(settings_provider)) -> ProvenanceSigner:
    storage = ManifestStorage(base_path=_provenance_path())
    return ProvenanceSigner(storage=storage, signing_key=settings.signing_key)


def provenance_verifier(
    settings: Settings = Depends(settings_provider),
) -> ProvenanceVerifier:
    storage = ManifestStorage(base_path=_provenance_path())
    signer = ProvenanceSigner(storage=storage, signing_key=settings.signing_key)
    return ProvenanceVerifier(storage=storage, signer=signer)


def _provenance_path() -> Path:
    path = Path(".data/provenance")
    path.mkdir(parents=True, exist_ok=True)
    return path
