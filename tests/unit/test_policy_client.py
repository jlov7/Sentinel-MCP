from __future__ import annotations

from typing import Any, Dict

import httpx
import pytest

from sentinel_policy.client import PolicyClient, PolicyDecisionError


class DummyTransport(httpx.BaseTransport):
    def __init__(self, status: int, payload: Dict[str, Any]):
        self.status = status
        self.payload = payload

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code=self.status, json=self.payload)


def test_policy_client_returns_decision():
    transport = DummyTransport(200, {"result": {"allow": True}})
    client = PolicyClient("http://opa.local", timeout=0.1)
    client._client = httpx.Client(transport=transport)  # type: ignore[attr-defined]

    result = client.evaluate("sentinel/policy", {"tenant": "demo"})
    assert result["allow"] is True


def test_policy_client_raises_on_error_status():
    transport = DummyTransport(500, {"error": "boom"})
    client = PolicyClient("http://opa.local", timeout=0.1)
    client._client = httpx.Client(transport=transport)  # type: ignore[attr-defined]

    with pytest.raises(PolicyDecisionError):
        client.evaluate("sentinel/policy", {"tenant": "demo"})


def test_policy_client_raises_on_missing_result():
    transport = DummyTransport(200, {})
    client = PolicyClient("http://opa.local", timeout=0.1)
    client._client = httpx.Client(transport=transport)  # type: ignore[attr-defined]

    with pytest.raises(PolicyDecisionError):
        client.evaluate("sentinel/policy", {"tenant": "demo"})
