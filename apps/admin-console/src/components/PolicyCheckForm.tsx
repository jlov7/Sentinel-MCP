import React, { FormEvent, useState } from "react";
import { PolicyDecision, evaluatePolicy } from "../lib/api";

type Props = {
  tenant: string | null;
};

export const PolicyCheckForm = ({ tenant }: Props) => {
  const [toolName, setToolName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [usage, setUsage] = useState(10);
  const [decision, setDecision] = useState<PolicyDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setDecision(null);

    if (!tenant) {
      setError("Select a tenant first");
      return;
    }

    if (!toolName) {
      setError("Provide a tool name");
      return;
    }

    try {
      const result = await evaluatePolicy({
        tenant_slug: tenant,
        tool_name: toolName,
        action: "invoke",
        purpose: purpose || undefined,
        usage,
      });
      setDecision(result);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Policy probe</h2>
      <p className="panel__meta">
        Test an authorization decision before a tool runs. Useful for tightening purpose checks
        and quotas.
      </p>
      <form onSubmit={handleSubmit} className="form-grid form-grid--wide">
        <div className="field">
          <label className="field__label" htmlFor="policy-tool-name">
            Tool name
          </label>
          <div className="field__control">
            <input
              id="policy-tool-name"
              type="text"
              value={toolName}
              onChange={(event) => setToolName(event.target.value)}
              placeholder="langsmith-docs-search"
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="policy-purpose">
            Purpose
          </label>
          <div className="field__control">
            <input
              id="policy-purpose"
              type="text"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="support"
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="policy-usage">
            Usage (units)
          </label>
          <div className="field__control">
            <input
              id="policy-usage"
              type="number"
              min={0}
              value={usage}
              onChange={(event) => setUsage(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <div className="field__label" aria-hidden="true">
            Run check
          </div>
          <button type="submit" className="button">
            Evaluate policy
          </button>
        </div>
      </form>
      {error ? <div className="status-line status-line--error">{error}</div> : null}
      {decision ? (
        <div className={decision.allow ? "decision decision--allow" : "decision decision--deny"}>
          <strong>{decision.allow ? "ALLOW" : "DENY"}</strong>
          {decision.reason ? ` — ${decision.reason}` : null}
          {decision.quota_remaining !== null && decision.quota_remaining !== undefined ? (
            <div>Quota remaining: {decision.quota_remaining}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
