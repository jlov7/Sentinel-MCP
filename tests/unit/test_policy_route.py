from __future__ import annotations

import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

from sentinel_control_plane.main import app
from sentinel_control_plane.routes.policy import policy_check
from sentinel_control_plane.dependencies import db_session, policy_client


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _SessionQueue:
    def __init__(self, results):
        self._results = list(results)

    def execute(self, _statement):
        if not self._results:
            raise AssertionError("Unexpected execute call")
        return self._results.pop(0)

    def flush(self) -> None:  # pragma: no cover - not used but kept for parity
        return None


class _StubPolicyClient:
    def __init__(self, reply):
        self._reply = reply

    def evaluate(self, package: str, input_data):
        self.last_package = package
        self.last_input = input_data
        return self._reply

    def close(self):  # pragma: no cover - compatibility
        return None


client = TestClient(app)


def _override_session(tenant, tool):
    session = _SessionQueue([_FakeResult(tenant), _FakeResult(tool)])

    def _session_override():
        yield session

    return _session_override


def _override_policy(decision):
    stub = _StubPolicyClient(decision)

    def _policy_override():
        yield stub

    return stub, _policy_override


def _build_objects():
    tenant = SimpleNamespace(id=uuid.uuid4(), slug="demo-tenant")
    tool = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant.id, name="demo-tool")
    return tenant, tool


def test_policy_check_allow():
    tenant, tool = _build_objects()
    app.dependency_overrides[db_session] = _override_session(tenant, tool)
    stub, policy_override = _override_policy({"allow": True, "quota_remaining": 4})
    app.dependency_overrides[policy_client] = policy_override
    try:
        response = client.post(
            "/policy/check",
            json={
                "tenant_slug": tenant.slug,
                "tool_name": tool.name,
                "action": "invoke",
                "purpose": "support",
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["allow"] is True
        assert body["quota_remaining"] == 4
        assert stub.last_package == "sentinel/policy"
        assert stub.last_input["tenant"] == tenant.slug
    finally:
        app.dependency_overrides.pop(db_session, None)
        app.dependency_overrides.pop(policy_client, None)


def test_policy_check_deny():
    tenant, tool = _build_objects()
    app.dependency_overrides[db_session] = _override_session(tenant, tool)
    stub, policy_override = _override_policy({"allow": False, "deny_reason": ["quota exceeded"]})
    app.dependency_overrides[policy_client] = policy_override
    try:
        response = client.post(
            "/policy/check",
            json={
                "tenant_slug": tenant.slug,
                "tool_name": tool.name,
                "action": "invoke",
                "purpose": "support",
            },
        )

        assert response.status_code == 200
        body = response.json()
        assert body["allow"] is False
        assert body["reason"] == "quota exceeded"
    finally:
        app.dependency_overrides.pop(db_session, None)
        app.dependency_overrides.pop(policy_client, None)
