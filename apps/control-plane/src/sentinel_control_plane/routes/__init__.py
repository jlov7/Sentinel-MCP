"""Route registration helpers."""

from fastapi import APIRouter

from .kill_switch import router as kill_router
from .policy import router as policy_router
from .provenance import router as provenance_router
from .registry import router as registry_router


def include_routes(api: APIRouter) -> None:
    api.include_router(registry_router, prefix="/register", tags=["registry"])
    api.include_router(policy_router, prefix="/policy", tags=["policy"])
    api.include_router(kill_router, prefix="/kill", tags=["kill-switch"])
    api.include_router(provenance_router, prefix="/provenance", tags=["provenance"])
