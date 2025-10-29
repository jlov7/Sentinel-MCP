from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from sentinel_control_plane.main import app
from sentinel_control_plane.dependencies import db_session


class _SessionStub:
    def __init__(self, results):
        self._results = list(results)

    def execute(self, statement):  # pylint: disable=unused-argument
        if not self._results:
            raise AssertionError("Unexpected execute call")
        return self._results.pop(0)

    def flush(self):  # pragma: no cover
        return None


class _ScalarResult:
    def __init__(self, values):
        self._values = list(values)

    def scalars(self):
        return self

    def all(self):
        return list(self._values)

    def scalar_one_or_none(self):
        if not self._values:
            return None
        return self._values.pop(0)


client = TestClient(app)


@pytest.fixture
def tenants():
    return [
        SimpleNamespace(id=uuid.uuid4(), slug="b-team", display_name="B Team", created_at=1),
        SimpleNamespace(id=uuid.uuid4(), slug="a-team", display_name="A Team", created_at=2),
    ]


@pytest.fixture
def tools(tenants):
    tenant = tenants[0]
    return [
        SimpleNamespace(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="tool-b",
            url="https://example.com/b",
            owner="owner-b",
            scopes=["read"],
            extra_metadata={},
            is_active=True,
            created_at=1,
            updated_at=1,
        ),
        SimpleNamespace(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            name="tool-a",
            url="https://example.com/a",
            owner="owner-a",
            scopes=["write"],
            extra_metadata={},
            is_active=True,
            created_at=2,
            updated_at=2,
        ),
    ]


def _override_session(results):
    session = _SessionStub(results)

    def generator():
        yield session

    return generator


def test_list_tenants_sorted(tenants):
    app.dependency_overrides[db_session] = _override_session([_ScalarResult(sorted(tenants, key=lambda t: t.slug))])
    try:
        response = client.get("/register/tenants")
        assert response.status_code == 200
        body = response.json()
        assert [t["slug"] for t in body] == sorted([t.slug for t in tenants])
    finally:
        app.dependency_overrides.pop(db_session, None)


def test_list_tools_preserves_order(tenants, tools):
    tenant = tenants[0]
    app.dependency_overrides[db_session] = _override_session([
        _ScalarResult([tenant]),
        _ScalarResult(tools),
    ])
    try:
        response = client.get(f"/register?tenant_slug={tenant.slug}")
        assert response.status_code == 200
        body = response.json()
        assert [t["name"] for t in body] == [tool.name for tool in tools]
    finally:
        app.dependency_overrides.pop(db_session, None)
