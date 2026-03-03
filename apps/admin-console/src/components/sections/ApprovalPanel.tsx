import React from "react";

import { ApprovalRecord } from "../../lib/api";
import EmptyState from "../ui/EmptyState";
import JsonBlock from "../ui/JsonBlock";
import MessageCallout from "../ui/MessageCallout";
import Panel from "../ui/Panel";

type ApprovalPanelProps = {
  approvalReason: string;
  approvalTtl: number;
  approvalId: string;
  approvalNote: string;
  approvalError: string | null;
  approvalRecord: ApprovalRecord | null;
  approvalBusy: boolean;
  onReasonChange: (value: string) => void;
  onTtlChange: (value: number) => void;
  onApprovalIdChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onRequest: () => void;
  onApprove: () => void;
  onDeny: () => void;
};

const ApprovalPanel = ({
  approvalReason,
  approvalTtl,
  approvalId,
  approvalNote,
  approvalError,
  approvalRecord,
  approvalBusy,
  onReasonChange,
  onTtlChange,
  onApprovalIdChange,
  onNoteChange,
  onRequest,
  onApprove,
  onDeny,
}: ApprovalPanelProps) => {
  return (
    <Panel
      id="approval-interrupts"
      title="Approval Interrupts"
      subtitle="Resolve high-risk decisions with explicit, TTL-bound approval controls."
    >
      <label className="field__label" htmlFor="approval-reason">
        Request reason
      </label>
      <input
        id="approval-reason"
        className="field__input"
        value={approvalReason}
        onChange={(event) => onReasonChange(event.target.value)}
      />

      <label className="field__label" htmlFor="approval-ttl">
        TTL (seconds)
      </label>
      <input
        id="approval-ttl"
        type="number"
        min={30}
        className="field__input"
        value={approvalTtl}
        onChange={(event) => onTtlChange(Number(event.target.value))}
      />

      <button type="button" onClick={onRequest} disabled={approvalBusy}>
        {approvalBusy ? "Requesting..." : "Request approval"}
      </button>

      <hr />

      <label className="field__label" htmlFor="approval-id">
        Approval ID
      </label>
      <input
        id="approval-id"
        className="field__input"
        value={approvalId}
        onChange={(event) => onApprovalIdChange(event.target.value)}
      />

      <label className="field__label" htmlFor="approval-note">
        Resolution note
      </label>
      <input
        id="approval-note"
        className="field__input"
        value={approvalNote}
        onChange={(event) => onNoteChange(event.target.value)}
      />

      <div className="actions">
        <button type="button" onClick={onApprove} disabled={approvalBusy}>
          {approvalBusy ? "Resolving..." : "Approve"}
        </button>
        <button type="button" onClick={onDeny} className="button--danger" disabled={approvalBusy}>
          {approvalBusy ? "Resolving..." : "Deny"}
        </button>
      </div>

      {approvalError ? <MessageCallout tone="error">{approvalError}</MessageCallout> : null}
      {approvalError ? (
        <div className="actions">
          <button type="button" className="button--ghost" onClick={onRequest}>
            Retry request
          </button>
        </div>
      ) : null}

      {approvalRecord ? (
        <JsonBlock value={approvalRecord} label="Approval Record" />
      ) : (
        <EmptyState
          title="No approval record yet"
          hint="Request approval after a decision requiring interrupt semantics."
        />
      )}
    </Panel>
  );
};

export default ApprovalPanel;
