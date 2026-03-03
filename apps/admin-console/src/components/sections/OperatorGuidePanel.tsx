import React from "react";

import Panel from "../ui/Panel";

type JourneyDurations = {
  decisionMs: number | null;
  approvalMs: number | null;
  provenanceMs: number | null;
  evidenceMs: number | null;
};

type OperatorGuidePanelProps = {
  tenant: string;
  currentTrace: string;
  journeyStartedAt: string | null;
  journeyDurations: JourneyDurations;
  journeyComplete: boolean;
  onLoadDemoTrace: () => void;
};

const TERMS = [
  {
    term: "Kill switch",
    definition: "An operator override that denies tool actions regardless of policy allow output.",
  },
  {
    term: "Approval interrupt",
    definition: "A human or automated checkpoint that pauses execution until explicit resolution.",
  },
  {
    term: "Attestation",
    definition: "A signed envelope connecting decision intent, execution metadata, and audit lineage.",
  },
  {
    term: "Evidence replay",
    definition: "Trace-based reconstruction of all decisions, approvals, controls, and provenance events.",
  },
];

function formatDuration(value: number | null): string {
  if (value === null) {
    return "--";
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

const OperatorGuidePanel = ({
  tenant,
  currentTrace,
  journeyStartedAt,
  journeyDurations,
  journeyComplete,
  onLoadDemoTrace,
}: OperatorGuidePanelProps) => {
  return (
    <Panel
      id="operator-guide"
      wide
      title="Operator Guide"
      subtitle="Canonical journey: decide, interrupt, attest, and replay evidence in under two minutes."
      actions={
        <button type="button" className="button--ghost" onClick={onLoadDemoTrace}>
          Load current trace
        </button>
      }
    >
      <ol className="guide-list">
        <li>Authorize a request and inspect reason codes.</li>
        <li>Use kill switch to validate precedence behavior.</li>
        <li>Request and resolve approval for high-risk paths.</li>
        <li>Attest and verify provenance artifact integrity.</li>
        <li>Load evidence by trace ID and export findings.</li>
      </ol>

      <div className="trust-markers" role="note" aria-label="Trust markers">
        <span>Tenant scope: {tenant}</span>
        <span>Trace: {currentTrace || "Not created"}</span>
        <span>Attestation lineage: DSSE + transparency log</span>
      </div>

      <div className="guide-metrics" role="status" aria-live="polite">
        <span>Started: {journeyStartedAt ? new Date(journeyStartedAt).toLocaleTimeString() : "--"}</span>
        <span>Decision: {formatDuration(journeyDurations.decisionMs)}</span>
        <span>Approval: {formatDuration(journeyDurations.approvalMs)}</span>
        <span>Provenance: {formatDuration(journeyDurations.provenanceMs)}</span>
        <span>Evidence: {formatDuration(journeyDurations.evidenceMs)}</span>
        <span>Journey complete: {journeyComplete ? "Yes" : "No"}</span>
      </div>

      <div className="guide-links" aria-label="Role-based documentation links">
        <a href="https://modelcontextprotocol.io/specification/versioning" target="_blank" rel="noreferrer">
          Protocol references
        </a>
        <a href="https://openai.com/safety/evaluations-hub/" target="_blank" rel="noreferrer">
          Safety evaluation patterns
        </a>
        <a href="https://docs.sigstore.dev/" target="_blank" rel="noreferrer">
          Provenance verification guide
        </a>
      </div>

      <details className="glossary" open>
        <summary>Glossary</summary>
        <dl>
          {TERMS.map((item) => (
            <React.Fragment key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.definition}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>
    </Panel>
  );
};

export default OperatorGuidePanel;
