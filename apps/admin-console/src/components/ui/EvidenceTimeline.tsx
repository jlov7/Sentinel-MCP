import React, { useMemo } from "react";

import { EventRecord } from "../../lib/api";

type EvidenceTimelineProps = {
  events: EventRecord[];
};

function inferStatus(eventType: string): "success" | "error" | "neutral" {
  if (eventType.includes("deny") || eventType.includes("error") || eventType.includes("fail")) {
    return "error";
  }
  if (eventType.includes("allow") || eventType.includes("approved") || eventType.includes("success")) {
    return "success";
  }
  return "neutral";
}

const EvidenceTimeline = ({ events }: EvidenceTimelineProps) => {
  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const left = Date.parse(a.created_at);
      const right = Date.parse(b.created_at);
      return left - right;
    });
  }, [events]);

  return (
    <ul className="timeline" aria-label="Evidence timeline">
      {sorted.map((event, index) => {
        const status = inferStatus(event.event_type);
        return (
          <li key={event.id} className={`timeline__item timeline__item--${status}`}>
            <div className="timeline__head">
              <strong>
                {index + 1}. {event.event_type}
              </strong>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
            </div>
            <div className="timeline__meta">
              <span>Tenant: {event.tenant_slug}</span>
              <span>Trace: {event.trace_id}</span>
              <span>Status: {status}</span>
              <span>Payload keys: {Object.keys(event.payload ?? {}).join(", ") || "none"}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default EvidenceTimeline;
