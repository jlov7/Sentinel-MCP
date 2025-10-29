#!/usr/bin/env python
"""Seed Sentinel MCP control plane with sample tenants and tools."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

import httpx
import yaml

DEFAULT_BASE_URL = "http://localhost:8000"
SAMPLE_TOOLS_PATH = Path("config/sample-tools.yaml")


class Seeder:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=5.0)
        self._wait_for_health()

    @property
    def max_attempts(self) -> int:
        return int(os.getenv("SENTINEL_SEED_MAX_ATTEMPTS", "5"))

    @property
    def retry_delay(self) -> float:
        return float(os.getenv("SENTINEL_SEED_RETRY_DELAY", "2.0"))

    def _wait_for_health(self) -> None:
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = self.client.get(f"{self.base_url}/healthz")
                if response.status_code == 200:
                    return
            except httpx.RequestError:
                pass
            time.sleep(self.retry_delay)
        raise RuntimeError(
            f"Control plane health check failed after {self.max_attempts} attempts."
        )

    def register_tools(self, tools: List[Dict[str, Any]]) -> None:
        for tool in tools:
            payload = {
                "tenant_slug": tool["owner"],
                "name": tool["name"],
                "url": tool["url"],
                "owner": tool["owner"],
                "scopes": tool.get("scopes", []),
                "metadata": tool.get("metadata", {}),
            }
            response = self._post_with_retry("/register", payload, action="register")
            if response.status_code == 201:
                print(f"registered {payload['name']} for tenant {payload['tenant_slug']}")
            elif response.status_code == 409:
                print(f"{payload['name']} already registered")
            else:
                print(
                    f"failed to register {payload['name']}: {response.status_code} {response.text}"
                )

    def run_policy_checks(self, checks: List[Dict[str, Any]]) -> None:
        for check in checks:
            response = self._post_with_retry("/policy/check", check, action="policy check")
            if response.status_code != 200:
                print(f"policy check failed: {response.status_code} {response.text}")
                continue
            result = response.json()
            print(
                f"policy decision for {check['tenant_slug']}/{check['tool_name']}: "
                f"{'ALLOW' if result.get('allow') else 'DENY'} ({result.get('reason')})"
            )

    def emit_provenance(self, actions: List[Dict[str, Any]]) -> None:
        for action in actions:
            response = self._post_with_retry(
                "/provenance/sign", action, action="provenance sign", expected_status=201
            )
            if response.status_code == 201:
                print(
                    f"manifest created for {action['tenant_slug']}/{action['tool_name']} -> "
                    f"{response.json()['manifest_id']}"
                )
            else:
                print(
                    f"failed to sign manifest: {response.status_code} {response.text}"
                )

    def _post_with_retry(
        self,
        path: str,
        payload: Dict[str, Any],
        *,
        action: str,
        expected_status: int | None = None,
    ) -> httpx.Response:
        last_exc: Exception | None = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = self.client.post(f"{self.base_url}{path}", json=payload)
                if expected_status is None or response.status_code == expected_status:
                    return response
                if response.status_code >= 500:
                    time.sleep(self.retry_delay)
                    continue
                return response
            except httpx.RequestError as exc:
                last_exc = exc
                time.sleep(self.retry_delay)
        raise RuntimeError(
            f"{action} failed after {self.max_attempts} attempts: {last_exc}"
        )


def load_yaml(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        print(f"missing sample tools YAML at {path}", file=sys.stderr)
        return []
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--tools", type=Path, default=SAMPLE_TOOLS_PATH)
    args = parser.parse_args()

    tools = load_yaml(args.tools)
    if not tools:
        print("no tools to register; aborting")
        return

    seeder = Seeder(args.base_url)
    seeder.register_tools(tools)

    checks = []
    for tool in tools:
        metadata = tool.get("metadata", {})
        checks.append(
            {
                "tenant_slug": tool["owner"],
                "tool_name": tool["name"],
                "action": "invoke",
                "purpose": metadata.get("default_purpose", "support"),
                "usage": 10,
                "context": {"sample": True},
            }
        )
    seeder.run_policy_checks(checks)

    actions = [
        {
            "tenant_slug": tool["owner"],
            "tool_name": tool["name"],
            "action": "invoke",
            "payload": {"args": [], "kwargs": {}, "note": "seed run"},
        }
        for tool in tools
    ]
    seeder.emit_provenance(actions)


if __name__ == "__main__":
    main()
