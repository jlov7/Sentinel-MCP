from __future__ import annotations

import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient

from sentinel_control_plane.main import app
from sentinel_control_plane.dependencies import db_session


class _ScalarOneResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _ScalarListResult:
    def __init__(self, items):
        self._items = list(items)

    def scalars(self):
        return self

    def all(self):
        return list(self._items)


class _SessionStub:
    def __init__(self, queue):
        self._queue = list(queue)
        self.updated = []

    def execute(self, statement):
        if self._queue:
            return self._queue.pop(0)
        self.updated.append(statement)
        return SimpleNamespace(rowcount=1)

    def flush(self):
        return None


client = TestClient(app)


def _override_session(results):
    session = _SessionStub(results)

    def generator():
        yield session

    return session, generator


def _tenant_and_tool():
    tenant = SimpleNamespace(id=uuid.uuid4(), slug="demo")
    tool = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant.id, name="demo-tool")
    return tenant, tool


def test_kill_switch_disable():
    tenant, tool = _tenant_and_tool()
    session, override = _override_session([
        _ScalarOneResult(tenant),
        _ScalarListResult([tool])
    ])
    app.dependency_overrides[db_session] = override
    try:
        response = client.post(
            "/kill",
            json={
                "tenant_slug": tenant.slug,
                "tool_name": tool.name,
                "reason": "test",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "disabled"
        assert session.updated, "expected update statement to be executed"
    finally:
        app.dependency_overrides.pop(db_session, None)


def test_kill_switch_restore():
    tenant, tool = _tenant_and_tool()
    session, override = _override_session([
        _ScalarOneResult(tenant),
        _ScalarListResult([tool])
    ])
    app.dependency_overrides[db_session] = override
    try:
        response = client.post(
            "/kill/restore",
            json={
                "tenant_slug": tenant.slug,
                "tool_name": tool.name,
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "enabled"
        assert session.updated, "expected update statement to be executed"
    finally:
        app.dependency_overrides.pop(db_session, None)
