"""Simple storage abstraction for provenance manifests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


class ManifestStorage:
    """Stores provenance manifests locally (placeholder for object storage)."""

    def __init__(self, base_path: Path) -> None:
        self._base_path = base_path
        self._base_path.mkdir(parents=True, exist_ok=True)

    def write(self, manifest_id: str, manifest: Dict[str, Any]) -> Path:
        path = self._base_path / f"{manifest_id}.json"
        path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return path

    def read(self, manifest_id: str) -> Dict[str, Any]:
        path = self._base_path / f"{manifest_id}.json"
        if not path.exists():
            raise FileNotFoundError(f"Manifest {manifest_id} not found")
        return json.loads(path.read_text(encoding="utf-8"))
