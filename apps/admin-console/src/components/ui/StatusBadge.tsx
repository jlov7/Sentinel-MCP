import React from "react";

type Status = "checking" | "online" | "offline";

type StatusBadgeProps = {
  status: Status;
  endpoint: string;
  lastCheck: string;
};

const statusText: Record<Status, string> = {
  checking: "Checking",
  online: "Online",
  offline: "Offline",
};

const StatusBadge = ({ status, endpoint, lastCheck }: StatusBadgeProps) => {
  const dotClass = `status-dot status-dot--${status}`;

  return (
    <aside className="status-card" aria-live="polite" aria-label="System health status">
      <div className="status-card__row">
        <span className={dotClass} />
        <strong>{statusText[status]}</strong>
      </div>
      <div className="status-card__meta">Endpoint: {endpoint}</div>
      <div className="status-card__meta">Last check: {lastCheck}</div>
    </aside>
  );
};

export default StatusBadge;
