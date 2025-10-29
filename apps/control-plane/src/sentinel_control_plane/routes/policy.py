"""Policy evaluation endpoints."""

from __future__ import annotations

import structlog
from opentelemetry import trace
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from sentinel_policy.client import PolicyClient, PolicyDecisionError

from ..dependencies import db_session, policy_client
from ..models import Tenant, Tool
from ..schemas import PolicyCheckRequest, PolicyDecision

router = APIRouter()
logger = structlog.get_logger(__name__)
tracer = trace.get_tracer(__name__)


@router.post("/check", response_model=PolicyDecision)
def policy_check(
    payload: PolicyCheckRequest,
    session: Session = Depends(db_session),
    opa: PolicyClient = Depends(policy_client),
) -> PolicyDecision:
    with tracer.start_as_current_span("policy.check") as span:
        span.set_attribute("sentinel.tenant", payload.tenant_slug)
        span.set_attribute("sentinel.tool", payload.tool_name)
        span.set_attribute("sentinel.action", payload.action)
        if payload.purpose:
            span.set_attribute("sentinel.purpose", payload.purpose)

        tenant = session.execute(select(Tenant).where(Tenant.slug == payload.tenant_slug)).scalar_one_or_none()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{payload.tenant_slug}' not found",
            )
        tool = (
            session.execute(
                select(Tool).where(Tool.tenant_id == tenant.id, Tool.name == payload.tool_name)
            )
            .scalar_one_or_none()
        )
        if not tool:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tool '{payload.tool_name}' not registered for tenant '{payload.tenant_slug}'",
            )

        try:
            decision = opa.evaluate(
                "sentinel/policy",
                {
                    "tenant": payload.tenant_slug,
                    "tool": payload.tool_name,
                    "usage": payload.usage,
                    "action": payload.action,
                    "purpose": payload.purpose,
                    "context": payload.context,
                },
            )
        except PolicyDecisionError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

        allow = bool(decision.get("allow", False))
        reasons = decision.get("deny_reason")
        reason = None
        if not allow:
            if isinstance(reasons, list) and reasons:
                reason = reasons[0]
            elif isinstance(reasons, str):
                reason = reasons

        logger.info(
            "policy.decision",
            tenant=payload.tenant_slug,
            tool=payload.tool_name,
            action=payload.action,
            purpose=payload.purpose,
            allow=allow,
            reason=reason,
            quota_remaining=decision.get("quota_remaining"),
        )
        span.set_attribute("sentinel.policy.allow", allow)
        if reason:
            span.set_attribute("sentinel.policy.reason", reason)
        if decision.get("quota_remaining") is not None:
            span.set_attribute("sentinel.policy.quota_remaining", decision["quota_remaining"])

        return PolicyDecision(
            allow=allow,
            reason=reason,
            quota_remaining=decision.get("quota_remaining"),
        )
