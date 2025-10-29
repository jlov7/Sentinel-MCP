from __future__ import annotations

import os
import uuid

import httpx
import pytest


BASE_URL = os.getenv("SENTINEL_CONTROL_PLANE_URL", "http://localhost:8000").rstrip("/")


@pytest.fixture(scope="module")
def client() -> httpx.Client:
    with httpx.Client(base_url=BASE_URL, timeout=5.0) as client:
        try:
            response = client.get("/healthz")
            response.raise_for_status()
        except Exception as exc:  # pylint: disable=broad-except
            pytest.skip(f"control plane not reachable at {BASE_URL}: {exc}")
        yield client


def test_register_kill_restore_and_provenance(client: httpx.Client) -> None:
    tenant_slug = f"test-tenant-{uuid.uuid4().hex[:8]}"
    tool_name = f"test-tool-{uuid.uuid4().hex[:8]}"

    register_payload = {
        "tenant_slug": tenant_slug,
        "name": tool_name,
        "url": "https://example.org/tool",
        "owner": tenant_slug,
        "scopes": ["read:demo"],
        "metadata": {"default_purpose": "support"},
    }
    register_response = client.post("/register", json=register_payload)
    assert register_response.status_code == 201, register_response.text

    policy_payload = {
        "tenant_slug": tenant_slug,
        "tool_name": tool_name,
        "action": "invoke",
        "purpose": "support",
        "usage": 1,
        "context": {"test": True},
    }
    policy_response = client.post("/policy/check", json=policy_payload)
    assert policy_response.status_code == 200
    decision = policy_response.json()
    assert "allow" in decision

    kill_payload = {
        "tenant_slug": tenant_slug,
        "tool_name": tool_name,
        "reason": "test",
    }
    kill_response = client.post("/kill", json=kill_payload)
    assert kill_response.status_code == 200
    assert kill_response.json()["status"] == "disabled"

    restore_payload = {
        "tenant_slug": tenant_slug,
        "tool_name": tool_name,
    }
    restore_response = client.post("/kill/restore", json=restore_payload)
    assert restore_response.status_code == 200
    assert restore_response.json()["status"] == "enabled"

    sign_payload = {
        "tenant_slug": tenant_slug,
        "tool_name": tool_name,
        "action": "invoke",
        "payload": {"args": [], "kwargs": {}, "note": "api-test"},
    }
    sign_response = client.post("/provenance/sign", json=sign_payload)
    assert sign_response.status_code == 201
    manifest_id = sign_response.json()["manifest_id"]

    verify_response = client.get(f"/provenance/verify/{manifest_id}")
    assert verify_response.status_code == 200
    assert verify_response.json()["verified"] is True
