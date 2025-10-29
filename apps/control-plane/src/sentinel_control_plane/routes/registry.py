"""Tool registry endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..dependencies import db_session
from ..models import Tenant, Tool
from ..schemas import TenantResponse, ToolRegisterRequest, ToolResponse

router = APIRouter()


@router.get("", response_model=list[ToolResponse])
def list_tools(
    tenant_slug: str | None = None,
    session: Session = Depends(db_session),
) -> list[ToolResponse]:
    query = select(Tool)
    tenant = None
    if tenant_slug:
        tenant = session.execute(select(Tenant).where(Tenant.slug == tenant_slug)).scalar_one_or_none()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{tenant_slug}' not found",
            )
        query = query.where(Tool.tenant_id == tenant.id)
    tools = session.execute(query).scalars().all()
    tools_response = [
        ToolResponse(
            id=tool.id,
            tenant_id=tool.tenant_id,
            name=tool.name,
            url=tool.url,
            owner=tool.owner,
            scopes=list(tool.scopes or []),
            metadata=tool.extra_metadata,
            is_active=tool.is_active,
            created_at=tool.created_at,
            updated_at=tool.updated_at,
        )
        for tool in tools
    ]
    return tools_response


@router.get("/tenants", response_model=list[TenantResponse])
def list_tenants(session: Session = Depends(db_session)) -> list[TenantResponse]:
    tenants = session.execute(select(Tenant).order_by(Tenant.slug)).scalars().all()
    return [
        TenantResponse(
            id=tenant.id,
            slug=tenant.slug,
            display_name=tenant.display_name,
            created_at=tenant.created_at,
        )
        for tenant in tenants
    ]


@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
def register_tool(
    payload: ToolRegisterRequest,
    session: Session = Depends(db_session),
) -> ToolResponse:
    tenant = _get_or_create_tenant(session, payload.tenant_slug)
    tool = (
        session.execute(
            select(Tool).where(Tool.tenant_id == tenant.id, Tool.name == payload.name)
        )
        .scalar_one_or_none()
    )
    if tool:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Tool '{payload.name}' already registered for tenant '{payload.tenant_slug}'",
        )

    tool = Tool(
        tenant_id=tenant.id,
        name=payload.name,
        url=payload.url,
        owner=payload.owner,
        scopes=payload.scopes,
        extra_metadata=payload.metadata,
    )
    session.add(tool)
    session.flush()
    return ToolResponse(
        id=tool.id,
        tenant_id=tool.tenant_id,
        name=tool.name,
        url=tool.url,
        owner=tool.owner,
        scopes=list(tool.scopes or []),
        metadata=tool.extra_metadata,
        is_active=tool.is_active,
        created_at=tool.created_at,
        updated_at=tool.updated_at,
    )


def _get_or_create_tenant(session: Session, slug: str) -> Tenant:
    tenant = session.execute(select(Tenant).where(Tenant.slug == slug)).scalar_one_or_none()
    if tenant:
        return tenant
    tenant = Tenant(slug=slug, display_name=slug.replace("-", " ").title())
    session.add(tenant)
    session.flush()
    return tenant
