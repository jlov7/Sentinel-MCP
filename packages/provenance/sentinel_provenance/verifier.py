"""Verification helper for provenance manifests."""

from __future__ import annotations

from typing import Any, Dict

from .signer import ProvenanceSigner
from .storage import ManifestStorage


class ProvenanceVerifier:
    """Verifies stored manifests using the signer hashing routine."""

    def __init__(self, storage: ManifestStorage, signer: ProvenanceSigner) -> None:
        self._storage = storage
        self._signer = signer

    def verify(self, manifest_id: str) -> Dict[str, Any]:
        manifest = self._storage.read(manifest_id)
        action = manifest["action"]
        timestamp = manifest["timestamp"]
        expected_signature = self._signer._hash_payload(action, timestamp)  # pylint: disable=protected-access
        manifest["verified"] = manifest["signature"] == expected_signature
        return manifest
