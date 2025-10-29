"""Provenance signing and verification endpoints."""

from __future__ import annotations

import structlog
from opentelemetry import trace
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from sentinel_provenance.signer import ProvenanceSigner
from sentinel_provenance.verifier import ProvenanceVerifier

from ..dependencies import db_session, provenance_signer, provenance_verifier
from ..models import Tenant, Tool
from ..schemas import (
    ProvenanceResponse,
    ProvenanceSignRequest,
    ProvenanceVerifyResponse,
)

router = APIRouter()
logger = structlog.get_logger(__name__)
tracer = trace.get_tracer(__name__)


@router.post("/sign", response_model=ProvenanceResponse, status_code=status.HTTP_201_CREATED)
def sign_action(
    payload: ProvenanceSignRequest,
    session: Session = Depends(db_session),
    signer: ProvenanceSigner = Depends(provenance_signer),
) -> ProvenanceResponse:
    with tracer.start_as_current_span("provenance.sign") as span:
        span.set_attribute("sentinel.tenant", payload.tenant_slug)
        span.set_attribute("sentinel.tool", payload.tool_name)
        span.set_attribute("sentinel.action", payload.action)

        _ensure_tool_exists(session, payload.tenant_slug, payload.tool_name)
        manifest = signer.sign_action(
            {
                "tenant": payload.tenant_slug,
                "tool": payload.tool_name,
                "action": payload.action,
                "payload": payload.payload,
            }
        )
        manifest_id = manifest["signature"]
        logger.info(
            "provenance.signed",
            tenant=payload.tenant_slug,
            tool=payload.tool_name,
            action=payload.action,
            manifest_id=manifest_id,
        )
        span.set_attribute("sentinel.manifest_id", manifest_id)
        return ProvenanceResponse(
            manifest_id=manifest_id,
            signature=manifest_id,
            timestamp=manifest["timestamp"],
        )


@router.get("/verify/{manifest_id}", response_model=ProvenanceVerifyResponse)
def verify_manifest(
    manifest_id: str,
    verifier: ProvenanceVerifier = Depends(provenance_verifier),
) -> ProvenanceVerifyResponse:
    with tracer.start_as_current_span("provenance.verify") as span:
        span.set_attribute("sentinel.manifest_id", manifest_id)
        manifest = verifier.verify(manifest_id)
        logger.info(
            "provenance.verified",
            manifest_id=manifest_id,
            verified=manifest["verified"],
        )
        span.set_attribute("sentinel.verified", manifest["verified"])
        return ProvenanceVerifyResponse(
            manifest_id=manifest_id,
            verified=manifest["verified"],
            manifest=manifest,
        )


def _ensure_tool_exists(session: Session, tenant_slug: str, tool_name: str) -> None:
    tenant = session.execute(select(Tenant).where(Tenant.slug == tenant_slug)).scalar_one_or_none()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant '{tenant_slug}' not found",
        )
    tool = (
        session.execute(
            select(Tool).where(Tool.tenant_id == tenant.id, Tool.name == tool_name)
        )
        .scalar_one_or_none()
    )
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{tool_name}' not registered for tenant '{tenant_slug}'",
        )
