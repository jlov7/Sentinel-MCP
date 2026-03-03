"""Mock C2PA-style signer for provenance manifests."""

from __future__ import annotations

import hashlib
import time
from typing import Any, Dict

from .storage import ManifestStorage


class ProvenanceSigner:
    """Produces signed manifests to describe agent tool actions."""

    def __init__(self, storage: ManifestStorage, signing_key: str) -> None:
        self._storage = storage
        self._signing_key = signing_key

    def sign_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Attach a pseudo-signature to an action manifest."""
        timestamp = int(time.time() * 1000)
        signature = self._hash_payload(action, timestamp)
        manifest = {
            "action": action,
            "timestamp": timestamp,
            "signature": signature,
            "signing_key_hint": self._signing_key[:8],
        }
        manifest_id = signature
        self._storage.write(manifest_id, manifest)
        return manifest

    def _hash_payload(self, action: Dict[str, Any], timestamp: int) -> str:
        payload = f"{action}|{timestamp}|{self._signing_key}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
