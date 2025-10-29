"""Thin wrapper around an OPA sidecar for policy decisions."""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx


class PolicyDecisionError(RuntimeError):
    """Raised when the policy engine cannot produce a decision."""


class PolicyClient:
    """OPA policy client used by the control plane and adapters."""

    def __init__(self, base_url: str, timeout: float = 2.5) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client = httpx.Client(timeout=timeout)

    def evaluate(self, package: str, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a Rego package with the given input."""
        url = f"{self._base_url}/v1/data/{package}"
        response = self._client.post(url, json={"input": input_data})
        if response.status_code != 200:
            raise PolicyDecisionError(
                f"Policy evaluation failed: {response.status_code} {response.text}"
            )
        payload = response.json()
        result = payload.get("result")
        if result is None:
            raise PolicyDecisionError("Policy evaluation returned no result")
        return result

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PolicyClient":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> Optional[bool]:
        self.close()
        return None
