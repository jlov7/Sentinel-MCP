from __future__ import annotations

import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parents[1]
paths = [
    repo_root / "packages" / "policy_engine" / "python",
    repo_root / "packages" / "provenance",
    repo_root / "packages",
]

for path in paths:
    sys.path.insert(0, str(path))
