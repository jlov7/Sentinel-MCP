import React from "react";

type OnboardingTourProps = {
  visible: boolean;
  onDismiss: () => void;
  onJumpTo: (sectionId: string) => void;
};

const OnboardingTour = ({ visible, onDismiss, onJumpTo }: OnboardingTourProps) => {
  if (!visible) {
    return null;
  }

  return (
    <section className="onboarding" aria-label="First-run onboarding">
      <div>
        <p className="eyebrow">First run</p>
        <h2>Operator walkthrough</h2>
        <p>
          Complete these five steps to validate the full governance flow from authorization to
          evidence replay.
        </p>
      </div>
      <ol>
        <li>
          <button type="button" onClick={() => onJumpTo("decision-orchestrator")}>
            1. Run authorization
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onJumpTo("control-overrides")}>
            2. Validate kill-switch precedence
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onJumpTo("approval-interrupts")}>
            3. Resolve approval interrupt
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onJumpTo("provenance-attestation")}>
            4. Verify attestation
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onJumpTo("evidence-replay")}>
            5. Replay trace evidence
          </button>
        </li>
      </ol>
      <button type="button" className="button--ghost" onClick={onDismiss}>
        Dismiss walkthrough
      </button>
    </section>
  );
};

export default OnboardingTour;
