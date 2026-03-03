import React from "react";

import StatusBadge from "../ui/StatusBadge";

type Status = "checking" | "online" | "offline";

type MissionHeaderProps = {
  status: Status;
  endpoint: string;
  lastCheck: string;
};

const MissionHeader = ({ status, endpoint, lastCheck }: MissionHeaderProps) => {
  return (
    <header className="masthead" id="top">
      <div>
        <p className="eyebrow">Sentinel MCP v2</p>
        <h1>Mission Control</h1>
        <p>
          Frontier governance interface for deterministic decisions, human interrupts, and signed
          evidence replay.
        </p>
      </div>
      <StatusBadge status={status} endpoint={endpoint} lastCheck={lastCheck} />
    </header>
  );
};

export default MissionHeader;
