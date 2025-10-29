"""AgentKit adapter to intercept tool calls and enforce Sentinel policies."""

from __future__ import annotations

from typing import Any, Callable, Dict

import httpx


class AgentKitAdapter:
    """Wraps AgentKit tool execution with policy checks and provenance hooks."""

    def __init__(self, control_plane_url: str, tenant_slug: str) -> None:
        self._base = control_plane_url.rstrip("/")
        self._tenant = tenant_slug
        self._client = httpx.Client(timeout=2.0)

    def wrap(self, tool_name: str, func: Callable[..., Any]) -> Callable[..., Any]:
        """Return a wrapped callable enforcing policy allow/deny semantics."""

        def wrapper(*args: Any, **kwargs: Any) -> Any:
            payload = {
                "tenant_slug": self._tenant,
                "tool_name": tool_name,
                "action": "invoke",
                "usage": kwargs.get("usage", 0),
                "context": kwargs.get("context", {}),
            }
            decision = self._client.post(f"{self._base}/policy/check", json=payload).json()
            if not decision.get("allow"):
                raise PermissionError(decision.get("reason", "tool invocation denied"))

            result = func(*args, **kwargs)

            manifest_payload: Dict[str, Any] = {
                "tenant_slug": self._tenant,
                "tool_name": tool_name,
                "action": "invoke",
                "payload": {"args": args, "kwargs": kwargs, "result": result},
            }
            self._client.post(f"{self._base}/provenance/sign", json=manifest_payload)
            return result

        return wrapper
