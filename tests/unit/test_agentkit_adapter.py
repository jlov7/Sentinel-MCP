from __future__ import annotations

from typing import Any

import httpx
import pytest

from mcp_adapters.agentkit_adapter import AgentKitAdapter


class DummyClient(httpx.Client):
    def __init__(self, allow: bool = True) -> None:
        super().__init__()
        self.allow = allow
        self.captured = []

    def post(self, url: str, json: Any | None = None, **kwargs: Any):  # type: ignore[override]
        self.captured.append((url, json))
        if "policy/check" in url:
            return httpx.Response(200, json={"allow": self.allow, "reason": "blocked"})
        return httpx.Response(201, json={"manifest_id": "abc", "signature": "abc", "timestamp": 1})


def test_agentkit_adapter_allows_call(monkeypatch: pytest.MonkeyPatch):
    adapter = AgentKitAdapter("http://localhost", "demo")
    client = DummyClient(allow=True)
    monkeypatch.setattr(adapter, "_client", client)

    def run_tool(x: int):
        return x + 1

    wrapped = adapter.wrap("demo-tool", run_tool)
    assert wrapped(5) == 6
    assert any("policy/check" in call[0] for call in client.captured)


def test_agentkit_adapter_blocks_call(monkeypatch: pytest.MonkeyPatch):
    adapter = AgentKitAdapter("http://localhost", "demo")
    client = DummyClient(allow=False)
    monkeypatch.setattr(adapter, "_client", client)

    def run_tool():
        return "ok"

    wrapped = adapter.wrap("demo-tool", run_tool)
    with pytest.raises(PermissionError):
        wrapped()
