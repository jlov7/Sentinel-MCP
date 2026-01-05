import React, { useState } from "react";
import { verifyManifest } from "../lib/api";

export const ManifestViewer = () => {
  const [manifestId, setManifestId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  const handleVerify = async () => {
    if (!manifestId.trim()) {
      setError("Provide a manifest id");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    setVerified(null);
    try {
      const response = await verifyManifest(manifestId.trim());
      setResult(response.manifest);
      setVerified(response.verified);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Provenance verifier</h2>
      <p className="panel__meta">
        Paste a manifest signature to verify integrity and view the signed payload.
      </p>
      <div className="form-grid">
        <div className="field">
          <label className="field__label" htmlFor="manifest-id">
            Manifest id
          </label>
          <div className="field__control">
            <input
              id="manifest-id"
              type="text"
              value={manifestId}
              onChange={(event) => setManifestId(event.target.value)}
              placeholder="paste manifest signature"
            />
          </div>
        </div>
        <div className="field">
          <div className="field__label" aria-hidden="true">
            Verify
          </div>
          <button
            type="button"
            className="button button--subtle"
            onClick={handleVerify}
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify manifest"}
          </button>
        </div>
      </div>
      {error ? <div className="status-line status-line--error">{error}</div> : null}
      {verified !== null ? (
        <div className={verified ? "decision decision--allow" : "decision decision--deny"}>
          {verified ? "Manifest verified" : "Manifest failed verification"}
        </div>
      ) : null}
      {result ? <pre className="monoblock">{JSON.stringify(result, null, 2)}</pre> : null}
    </section>
  );
};
