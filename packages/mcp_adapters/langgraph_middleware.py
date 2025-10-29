"""LangGraph middleware to guard tool invocations with Sentinel policies."""

from __future__ import annotations

from typing import Any, Callable, Dict

import httpx


class LangGraphMiddleware:
    """Provides before/after hooks for LangGraph edges."""

    def __init__(self, control_plane_url: str, tenant_slug: str) -> None:
        self._base = control_plane_url.rstrip("/")
        self._tenant = tenant_slug
        self._client = httpx.Client(timeout=2.0)

    def tool_guard(self, tool_name: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        """Decorator for LangGraph tool callables."""

        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            def wrapper(*args: Any, **kwargs: Any) -> Any:
                payload = {
                    "tenant_slug": self._tenant,
                    "tool_name": tool_name,
                    "action": "invoke",
                    "usage": kwargs.get("usage", 0),
                    "context": kwargs.get("context", {}),
                }
                response = self._client.post(f"{self._base}/policy/check", json=payload)
                decision = response.json()
                if not decision.get("allow"):
                    raise PermissionError(decision.get("reason", "policy denied tool call"))
                return func(*args, **kwargs)

            return wrapper

        return decorator
