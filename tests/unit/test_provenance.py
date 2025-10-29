from __future__ import annotations

from pathlib import Path

from sentinel_provenance.signer import ProvenanceSigner
from sentinel_provenance.storage import ManifestStorage
from sentinel_provenance.verifier import ProvenanceVerifier


def test_sign_and_verify(tmp_path: Path):
    storage = ManifestStorage(tmp_path)
    signer = ProvenanceSigner(storage=storage, signing_key="dev-key")
    verifier = ProvenanceVerifier(storage=storage, signer=signer)

    manifest = signer.sign_action({"tenant": "demo", "tool": "demo-tool", "action": "call"})
    assert "signature" in manifest

    verified = verifier.verify(manifest["signature"])
    assert verified["verified"] is True
