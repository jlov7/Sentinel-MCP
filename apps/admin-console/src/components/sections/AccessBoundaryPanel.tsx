import React from "react";

import Panel from "../ui/Panel";

type AccessBoundaryPanelProps = {
  token: string;
  onTokenChange: (value: string) => void;
};

const AccessBoundaryPanel = ({ token, onTokenChange }: AccessBoundaryPanelProps) => {
  const tokenState = token.trim() ? "Provided" : "Missing";

  return (
    <Panel
      id="access-boundary"
      wide
      title="Access Boundary"
      subtitle="All /v2 control APIs require authenticated identity and scoped claims."
    >
      <label className="field__label" htmlFor="bearer-token">
        Bearer token
      </label>
      <textarea
        id="bearer-token"
        value={token}
        onChange={(event) => onTokenChange(event.target.value)}
        className="field__input field__input--mono"
        rows={3}
        placeholder="Paste JWT with v2 scopes"
        aria-describedby="bearer-token-help"
      />
      <p className="helper" id="bearer-token-help">
        Token is stored in local storage for local R&D only. Required scopes: `decision:write`,
        `control:write`, `approval:write`, `provenance:write`, `evidence:read`.
      </p>

      <div className="trust-markers" role="status" aria-live="polite">
        <span>Identity state: {tokenState}</span>
        <span>Boundary mode: fail-closed</span>
        <span>Tenant isolation: enforced</span>
      </div>
    </Panel>
  );
};

export default AccessBoundaryPanel;
