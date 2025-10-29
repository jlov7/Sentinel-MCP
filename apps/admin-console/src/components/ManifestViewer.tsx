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
    <section style={{ marginTop: "2rem" }}>
      <h2>Provenance manifest viewer</h2>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Manifest id
          <input
            type="text"
            value={manifestId}
            onChange={(event) => setManifestId(event.target.value)}
            placeholder="paste manifest signature"
          />
        </label>
        <button type="button" onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying…" : "Verify"}
        </button>
      </div>
      {error ? <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p> : null}
      {verified !== null ? (
        <p style={{ color: verified ? "green" : "orange" }}>
          {verified ? "Manifest verified" : "Manifest failed verification"}
        </p>
      ) : null}
      {result ? (
        <pre
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "4px",
            maxHeight: "220px",
            overflow: "auto",
            background: "#fafafa",
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </section>
  );
};
