import React from "react";

import { AttestationDetail, AttestationResponse, AttestationVerification } from "../../lib/api";
import EmptyState from "../ui/EmptyState";
import JsonBlock from "../ui/JsonBlock";
import MessageCallout from "../ui/MessageCallout";
import Panel from "../ui/Panel";

type ProvenancePanelProps = {
  requestHash: string;
  responseHash: string;
  outcome: string;
  attestationIdInput: string;
  provenanceError: string | null;
  provenanceBusy: boolean;
  attestation: AttestationResponse | null;
  attestationDetail: AttestationDetail | null;
  attestationVerification: AttestationVerification | null;
  onRequestHashChange: (value: string) => void;
  onResponseHashChange: (value: string) => void;
  onOutcomeChange: (value: string) => void;
  onAttestationIdInputChange: (value: string) => void;
  onAttest: () => void;
  onVerify: () => void;
};

function downloadJson(filename: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const ProvenancePanel = ({
  requestHash,
  responseHash,
  outcome,
  attestationIdInput,
  provenanceError,
  provenanceBusy,
  attestation,
  attestationDetail,
  attestationVerification,
  onRequestHashChange,
  onResponseHashChange,
  onOutcomeChange,
  onAttestationIdInputChange,
  onAttest,
  onVerify,
}: ProvenancePanelProps) => {
  const copyAttestationId = async () => {
    if (!attestationIdInput.trim() || typeof navigator === "undefined") {
      return;
    }
    try {
      await navigator.clipboard.writeText(attestationIdInput.trim());
    } catch {
      // noop for unsupported clipboard environments
    }
  };

  return (
    <Panel
      id="provenance-attestation"
      title="Provenance Attestation"
      subtitle="Generate and verify DSSE evidence envelopes with transparency metadata."
    >
      <label className="field__label" htmlFor="request-hash">
        Request hash
      </label>
      <input
        id="request-hash"
        className="field__input"
        value={requestHash}
        onChange={(event) => onRequestHashChange(event.target.value)}
      />

      <label className="field__label" htmlFor="response-hash">
        Response hash
      </label>
      <input
        id="response-hash"
        className="field__input"
        value={responseHash}
        onChange={(event) => onResponseHashChange(event.target.value)}
      />

      <label className="field__label" htmlFor="outcome">
        Outcome
      </label>
      <input
        id="outcome"
        className="field__input"
        value={outcome}
        onChange={(event) => onOutcomeChange(event.target.value)}
      />

      <div className="actions">
        <button type="button" onClick={onAttest} disabled={provenanceBusy}>
          {provenanceBusy ? "Attesting..." : "Attest"}
        </button>
      </div>

      <label className="field__label" htmlFor="attestation-id">
        Attestation ID
      </label>
      <input
        id="attestation-id"
        className="field__input"
        value={attestationIdInput}
        onChange={(event) => onAttestationIdInputChange(event.target.value)}
      />
      <div className="actions">
        <button type="button" onClick={onVerify} disabled={provenanceBusy}>
          {provenanceBusy ? "Verifying..." : "Verify + Load"}
        </button>
        <button type="button" className="button--ghost" onClick={copyAttestationId}>
          Copy ID
        </button>
        {attestationDetail ? (
          <button
            type="button"
            className="button--ghost"
            onClick={() => downloadJson(`attestation-${attestationIdInput || "artifact"}.json`, attestationDetail)}
          >
            Export JSON
          </button>
        ) : null}
      </div>

      {provenanceError ? <MessageCallout tone="error">{provenanceError}</MessageCallout> : null}
      {provenanceError ? (
        <div className="actions">
          <button type="button" className="button--ghost" onClick={onVerify}>
            Retry verify
          </button>
        </div>
      ) : null}

      {attestation ? <JsonBlock value={attestation} label="Attestation Result" /> : null}
      {attestationVerification ? (
        <JsonBlock value={attestationVerification} label="Verification Result" />
      ) : null}
      {attestationDetail ? <JsonBlock value={attestationDetail} label="Attestation Envelope" /> : null}

      {!attestation && !attestationVerification && !attestationDetail ? (
        <EmptyState
          title="No provenance artifacts loaded"
          hint="Attest first, then verify and load details for audit evidence."
        />
      ) : null}
    </Panel>
  );
};

export default ProvenancePanel;
