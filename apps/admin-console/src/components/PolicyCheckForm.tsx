import { FormEvent, useState } from "react";
import { PolicyDecision, evaluatePolicy } from "../lib/api";

type Props = {
  tenant: string | null;
};

export const PolicyCheckForm = ({ tenant }: Props) => {
  const [toolName, setToolName] = useState("");
  const [purpose, setPurpose] = useState("");
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
      });
      setDecision(result);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2>Policy probe</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: "1rem", alignItems: "flex-end" }}
      >
        <label style={{ display: "flex", flexDirection: "column" }}>
          Tool name
          <input
            type="text"
            value={toolName}
            onChange={(event) => setToolName(event.target.value)}
            placeholder="langsmith-docs-search"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Purpose
          <input
            type="text"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="support"
          />
        </label>
        <button type="submit">Evaluate</button>
      </form>
      {error ? <p style={{ color: "red" }}>{error}</p> : null}
      {decision ? (
        <p>
          Result: <strong>{decision.allow ? "ALLOW" : "DENY"}</strong>
          {decision.reason ? ` — ${decision.reason}` : null}
        </p>
      ) : null}
    </section>
  );
};
