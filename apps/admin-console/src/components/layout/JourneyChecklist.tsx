import React from "react";

type JourneyChecklistProps = {
  decisionReady: boolean;
  approvalReady: boolean;
  attestationReady: boolean;
  evidenceReady: boolean;
};

const JourneyChecklist = ({
  decisionReady,
  approvalReady,
  attestationReady,
  evidenceReady,
}: JourneyChecklistProps) => {
  const items = [
    { label: "Authorize request", done: decisionReady },
    { label: "Handle approval interrupt", done: approvalReady },
    { label: "Verify attestation", done: attestationReady },
    { label: "Replay evidence trace", done: evidenceReady },
  ];

  return (
    <section className="journey-checklist" aria-label="Operator journey progress">
      <h2>Runbook Progress</h2>
      <ul>
        {items.map((item) => (
          <li key={item.label} className={item.done ? "is-done" : ""}>
            <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default JourneyChecklist;
