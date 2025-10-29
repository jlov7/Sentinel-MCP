"""Pydantic schemas for FastAPI."""

from __future__ import annotations

import uuid as uuid_pkg
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TenantCreate(BaseModel):
    slug: str
    display_name: str


class TenantResponse(BaseModel):
    id: uuid_pkg.UUID
    slug: str
    display_name: str
    created_at: datetime


class ToolHealthCheck(BaseModel):
    method: str = "GET"
    path: str
    interval_seconds: int = Field(default=60, ge=10)
    body: Optional[Dict[str, Any]] = None


class ToolRegisterRequest(BaseModel):
    tenant_slug: str
    name: str
    url: str
    owner: str
    scopes: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    healthcheck: Optional[ToolHealthCheck] = None


class ToolResponse(BaseModel):
    id: uuid_pkg.UUID
    tenant_id: uuid_pkg.UUID
    name: str
    url: str
    owner: str
    scopes: List[str]
    metadata: Dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PolicyCheckRequest(BaseModel):
    tenant_slug: str
    tool_name: str
    action: str
    purpose: str | None = None
    usage: int = 0
    context: Dict[str, Any] = Field(default_factory=dict)


class PolicyDecision(BaseModel):
    allow: bool
    reason: Optional[str] = None
    quota_remaining: Optional[int] = None


class KillSwitchRequest(BaseModel):
    tenant_slug: str
    tool_name: Optional[str] = None
    reason: str


class KillSwitchResponse(BaseModel):
    status: str
    affected_tools: List[str]


class KillSwitchRestoreRequest(BaseModel):
    tenant_slug: str
    tool_name: Optional[str] = None


class ProvenanceSignRequest(BaseModel):
    tenant_slug: str
    tool_name: str
    action: str
    payload: Dict[str, Any]


class ProvenanceResponse(BaseModel):
    manifest_id: str
    signature: str
    timestamp: int


class ProvenanceVerifyResponse(BaseModel):
    manifest_id: str
    verified: bool
    manifest: Dict[str, Any]
