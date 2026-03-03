import React, { FormEvent } from "react";

import { AuthorizationDecision } from "../../lib/api";
import EmptyState from "../ui/EmptyState";
import JsonBlock from "../ui/JsonBlock";
import MessageCallout from "../ui/MessageCallout";
import Panel from "../ui/Panel";

type DecisionPanelProps = {
  tenant: string;
  toolName: string;
  action: string;
  purpose: string;
  usage: number;
  contextJson: string;
  contextValidationError: string | null;
  replayToken: string;
  decisionBusy: boolean;
  decisionError: string | null;
  decision: AuthorizationDecision | null;
  onTenantChange: (value: string) => void;
  onToolNameChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onUsageChange: (value: number) => void;
  onContextJsonChange: (value: string) => void;
  onReplayTokenChange: (value: string) => void;
  onAuthorize: () => void;
  onReplay: () => void;
};

const DecisionPanel = ({
  tenant,
  toolName,
  action,
  purpose,
  usage,
  contextJson,
  contextValidationError,
  replayToken,
  decisionBusy,
  decisionError,
  decision,
  onTenantChange,
  onToolNameChange,
  onActionChange,
  onPurposeChange,
  onUsageChange,
  onContextJsonChange,
  onReplayTokenChange,
  onAuthorize,
  onReplay,
}: DecisionPanelProps) => {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAuthorize();
  };

  return (
    <Panel
      id="decision-orchestrator"
      title="Decision Orchestrator"
      subtitle="Authorize request intent and produce explainable decision semantics."
    >
      <form onSubmit={onSubmit} className="form" noValidate aria-busy={decisionBusy}>
        <label className="field__label" htmlFor="tenant">
          Tenant
        </label>
        <input
          id="tenant"
          className="field__input"
          value={tenant}
          onChange={(event) => onTenantChange(event.target.value)}
          autoComplete="off"
        />

        <label className="field__label" htmlFor="tool-name">
          Tool name
        </label>
        <input
          id="tool-name"
          className="field__input"
          value={toolName}
          onChange={(event) => onToolNameChange(event.target.value)}
          autoComplete="off"
        />

        <label className="field__label" htmlFor="action">
          Action
        </label>
        <input
          id="action"
          className="field__input"
          value={action}
          onChange={(event) => onActionChange(event.target.value)}
          autoComplete="off"
        />

        <label className="field__label" htmlFor="purpose">
          Purpose
        </label>
        <input
          id="purpose"
          className="field__input"
          value={purpose}
          onChange={(event) => onPurposeChange(event.target.value)}
          autoComplete="off"
        />

        <label className="field__label" htmlFor="usage">
          Usage
        </label>
        <input
          id="usage"
          type="number"
          min={0}
          className="field__input"
          value={usage}
          onChange={(event) => onUsageChange(Number(event.target.value))}
        />

        <label className="field__label" htmlFor="context-json">
          Context JSON
        </label>
        <textarea
          id="context-json"
          className="field__input field__input--mono"
          rows={4}
          value={contextJson}
          onChange={(event) => onContextJsonChange(event.target.value)}
          aria-describedby="context-json-hint"
          aria-invalid={contextValidationError ? "true" : "false"}
        />
        <p className="helper" id="context-json-hint">
          Invalid JSON blocks submission and returns inline operator guidance.
        </p>
        {contextValidationError ? <MessageCallout tone="error">{contextValidationError}</MessageCallout> : null}

        <label className="field__label" htmlFor="replay-token">
          Replay token (optional)
        </label>
        <input
          id="replay-token"
          className="field__input"
          value={replayToken}
          onChange={(event) => onReplayTokenChange(event.target.value)}
          autoComplete="off"
        />

        <div className="actions">
          <button type="submit" disabled={decisionBusy}>
            {decisionBusy ? "Authorizing..." : "Authorize"}
          </button>
          <button
            type="button"
            onClick={onReplay}
            disabled={decisionBusy}
            className="button--ghost"
          >
            {decisionBusy ? "Replaying..." : "Replay"}
          </button>
        </div>
      </form>

      {decisionError ? <MessageCallout tone="error">{decisionError}</MessageCallout> : null}

      {decision ? (
        <>
          <article className={`decision-summary ${decision.allow ? "is-allow" : "is-deny"}`}>
            <h3>{decision.allow ? "Allowed" : "Denied"}</h3>
            <p>
              Reason code: <strong>{decision.reason_code ?? "none"}</strong>
            </p>
            <p>Risk score: {decision.risk_score.toFixed(2)}</p>
            <p>Requires approval: {decision.requires_approval ? "Yes" : "No"}</p>
            <p>Attestation: {decision.attestation_id ?? "pending"}</p>
            <p>
              <a href="#approval-interrupts">Go to approvals</a> |{" "}
              <a href="#provenance-attestation">Go to provenance</a> |{" "}
              <a href={`/?trace=${encodeURIComponent(decision.trace_id)}#evidence-replay`}>
                Open trace replay
              </a>
            </p>
          </article>
          <JsonBlock value={decision} label="Decision Output" />
        </>
      ) : (
        <EmptyState
          title="No decision yet"
          hint="Run Authorize to evaluate policy, risk, and attestation linkage."
        />
      )}
    </Panel>
  );
};

export default DecisionPanel;
