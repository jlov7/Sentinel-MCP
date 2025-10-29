"""Kill-switch orchestration endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

import structlog
from opentelemetry import trace

from ..dependencies import db_session
from ..models import Tenant, Tool
from ..schemas import KillSwitchRequest, KillSwitchResponse, KillSwitchRestoreRequest

router = APIRouter()
logger = structlog.get_logger(__name__)
tracer = trace.get_tracer(__name__)


@router.post("", response_model=KillSwitchResponse)
def trigger_kill_switch(
    payload: KillSwitchRequest,
    session: Session = Depends(db_session),
) -> KillSwitchResponse:
    with tracer.start_as_current_span("kill_switch.disable") as span:
        span.set_attribute("sentinel.tenant", payload.tenant_slug)
        span.set_attribute("sentinel.tool", payload.tool_name or "*")
        span.set_attribute("sentinel.reason", payload.reason)

        tenant = session.execute(select(Tenant).where(Tenant.slug == payload.tenant_slug)).scalar_one_or_none()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{payload.tenant_slug}' not found",
            )

        query = select(Tool).where(Tool.tenant_id == tenant.id)
        if payload.tool_name:
            query = query.where(Tool.name == payload.tool_name)
        tools = session.execute(query).scalars().all()

        if not tools:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No matching tools found to disable",
            )

        tool_ids: List[str] = [str(tool.id) for tool in tools]
        session.execute(
            update(Tool)
            .where(Tool.id.in_([tool.id for tool in tools]))
            .values(is_active=False)
        )
        session.flush()
        logger.info(
            "kill_switch.disabled",
            tenant=payload.tenant_slug,
            tool=payload.tool_name,
            affected_tools=tool_ids,
            reason=payload.reason,
        )

        span.set_attribute("sentinel.affected_count", len(tool_ids))

    return KillSwitchResponse(status="disabled", affected_tools=tool_ids)


@router.post("/restore", response_model=KillSwitchResponse)
def restore_tools(
    payload: KillSwitchRestoreRequest,
    session: Session = Depends(db_session),
) -> KillSwitchResponse:
    with tracer.start_as_current_span("kill_switch.restore") as span:
        span.set_attribute("sentinel.tenant", payload.tenant_slug)
        span.set_attribute("sentinel.tool", payload.tool_name or "*")

        tenant = session.execute(select(Tenant).where(Tenant.slug == payload.tenant_slug)).scalar_one_or_none()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{payload.tenant_slug}' not found",
            )

        query = select(Tool).where(Tool.tenant_id == tenant.id)
        if payload.tool_name:
            query = query.where(Tool.name == payload.tool_name)
        tools = session.execute(query).scalars().all()

        if not tools:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No matching tools found to restore",
            )

        tool_ids: List[str] = [str(tool.id) for tool in tools]
        session.execute(
            update(Tool)
            .where(Tool.id.in_([tool.id for tool in tools]))
            .values(is_active=True)
        )
        session.flush()
        logger.info(
            "kill_switch.restored",
            tenant=payload.tenant_slug,
            tool=payload.tool_name,
            affected_tools=tool_ids,
        )

        span.set_attribute("sentinel.affected_count", len(tool_ids))

    return KillSwitchResponse(status="enabled", affected_tools=tool_ids)
