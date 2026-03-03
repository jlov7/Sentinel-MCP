import React from "react";

import MessageCallout from "../ui/MessageCallout";
import Panel from "../ui/Panel";

type ControlPanelProps = {
  controlReason: string;
  controlMessage: string | null;
  controlError: string | null;
  killSwitchBusy: boolean;
  onReasonChange: (value: string) => void;
  onActivate: () => void;
  onRestore: () => void;
};

const ControlPanel = ({
  controlReason,
  controlMessage,
  controlError,
  killSwitchBusy,
  onReasonChange,
  onActivate,
  onRestore,
}: ControlPanelProps) => {
  const activateWithConfirmation = () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Activate kill-switch? This overrides policy allows until restored."
      );
      if (!confirmed) {
        return;
      }
    }
    onActivate();
  };

  return (
    <Panel
      id="control-overrides"
      title="Control Overrides"
      subtitle="Kill switch takes strict precedence over policy allow outcomes."
    >
      <label className="field__label" htmlFor="control-reason">
        Disable reason
      </label>
      <input
        id="control-reason"
        className="field__input"
        value={controlReason}
        onChange={(event) => onReasonChange(event.target.value)}
      />
      <div className="actions">
        <button type="button" onClick={activateWithConfirmation} disabled={killSwitchBusy}>
          {killSwitchBusy ? "Applying..." : "Activate kill-switch"}
        </button>
        <button
          type="button"
          onClick={onRestore}
          className="button--ghost"
          disabled={killSwitchBusy}
        >
          {killSwitchBusy ? "Applying..." : "Restore tool"}
        </button>
      </div>

      {controlError ? <MessageCallout tone="error">{controlError}</MessageCallout> : null}
      {controlError ? (
        <div className="actions">
          <button type="button" className="button--ghost" onClick={onRestore}>
            Retry restore
          </button>
        </div>
      ) : null}
      {controlMessage ? <MessageCallout tone="ok">{controlMessage}</MessageCallout> : null}
    </Panel>
  );
};

export default ControlPanel;
