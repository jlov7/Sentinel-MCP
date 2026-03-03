import React, { FormEvent, useMemo, useState } from "react";

import { EvidenceResponse, PolicyBundleMetadata, ProtocolMetadata } from "../../lib/api";
import EmptyState from "../ui/EmptyState";
import EvidenceTimeline from "../ui/EvidenceTimeline";
import JsonBlock from "../ui/JsonBlock";
import MessageCallout from "../ui/MessageCallout";
import Panel from "../ui/Panel";

type EvidencePanelProps = {
  traceLookup: string;
  currentTrace: string;
  currentDecisionId: string;
  evidence: EvidenceResponse | null;
  evidenceError: string | null;
  evidenceBusy: boolean;
  evidenceDegraded: string[];
  protocols: ProtocolMetadata | null;
  bundle: PolicyBundleMetadata | null;
  onTraceLookupChange: (value: string) => void;
  onSubmitLookup: () => void;
};

function downloadJson(filename: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function inferStatus(eventType: string): string {
  if (eventType.includes("deny") || eventType.includes("error") || eventType.includes("fail")) {
    return "error";
  }
  if (eventType.includes("allow") || eventType.includes("approved") || eventType.includes("success")) {
    return "success";
  }
  return "neutral";
}

const EvidencePanel = ({
  traceLookup,
  currentTrace,
  currentDecisionId,
  evidence,
  evidenceError,
  evidenceBusy,
  evidenceDegraded,
  protocols,
  bundle,
  onTraceLookupChange,
  onSubmitLookup,
}: EvidencePanelProps) => {
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmitLookup();
  };

  const tenants = useMemo(() => {
    if (!evidence?.events?.length) {
      return [];
    }
    return Array.from(new Set(evidence.events.map((entry) => entry.tenant_slug))).sort();
  }, [evidence?.events]);

  const eventTypes = useMemo(() => {
    if (!evidence?.events?.length) {
      return [];
    }
    return Array.from(new Set(evidence.events.map((entry) => entry.event_type))).sort();
  }, [evidence?.events]);

  const filteredEvents = useMemo(() => {
    if (!evidence?.events?.length) {
      return [];
    }
    const search = searchFilter.trim().toLowerCase();

    return evidence.events.filter((event) => {
      if (eventTypeFilter !== "all" && event.event_type !== eventTypeFilter) {
        return false;
      }
      if (tenantFilter !== "all" && event.tenant_slug !== tenantFilter) {
        return false;
      }
      const status = inferStatus(event.event_type);
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      const payloadText = JSON.stringify(event.payload).toLowerCase();
      return (
        event.event_type.toLowerCase().includes(search) ||
        event.trace_id.toLowerCase().includes(search) ||
        event.tenant_slug.toLowerCase().includes(search) ||
        payloadText.includes(search)
      );
    });
  }, [evidence?.events, eventTypeFilter, searchFilter, statusFilter, tenantFilter]);

  const copyTrace = async () => {
    if (!traceLookup.trim() || typeof navigator === "undefined") {
      return;
    }
    try {
      await navigator.clipboard.writeText(traceLookup.trim());
    } catch {
      // noop for unsupported clipboard environments
    }
  };

  return (
    <Panel
      id="evidence-replay"
      wide
      title="Evidence Graph Replay"
      subtitle="Move from trace ID to complete decision/provenance/control sequence quickly."
    >
      <form onSubmit={onSubmit} className="form-inline" aria-busy={evidenceBusy}>
        <input
          className="field__input"
          placeholder="Trace ID"
          value={traceLookup}
          onChange={(event) => onTraceLookupChange(event.target.value)}
          aria-label="Trace ID"
        />
        <button type="submit" disabled={evidenceBusy}>
          {evidenceBusy ? "Loading..." : "Load evidence"}
        </button>
        <button type="button" className="button--ghost" onClick={copyTrace}>
          Copy trace
        </button>
      </form>

      <div className="chips">
        <span className="chip">Current Trace: {currentTrace || "--"}</span>
        <span className="chip">Current Decision: {currentDecisionId || "--"}</span>
        <span className="chip">Visible events: {filteredEvents.length}</span>
      </div>

      {evidenceDegraded.length ? (
        <MessageCallout tone="info">Degraded mode: {evidenceDegraded.join(" ")}</MessageCallout>
      ) : null}
      {evidenceError ? <MessageCallout tone="error">{evidenceError}</MessageCallout> : null}
      {evidenceError ? (
        <div className="actions">
          <button type="button" className="button--ghost" onClick={onSubmitLookup}>
            Retry lookup
          </button>
        </div>
      ) : null}

      {evidence?.events?.length ? (
        <>
          <fieldset className="filters" aria-label="Evidence filters">
            <legend>Filter evidence events</legend>
            <label className="field__label" htmlFor="event-type-filter">
              Event type
            </label>
            <select
              id="event-type-filter"
              className="field__input"
              value={eventTypeFilter}
              onChange={(event) => setEventTypeFilter(event.target.value)}
            >
              <option value="all">All</option>
              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>

            <label className="field__label" htmlFor="tenant-filter">
              Tenant
            </label>
            <select
              id="tenant-filter"
              className="field__input"
              value={tenantFilter}
              onChange={(event) => setTenantFilter(event.target.value)}
            >
              <option value="all">All</option>
              {tenants.map((tenant) => (
                <option key={tenant} value={tenant}>
                  {tenant}
                </option>
              ))}
            </select>

            <label className="field__label" htmlFor="status-filter">
              Status
            </label>
            <select
              id="status-filter"
              className="field__input"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="neutral">Neutral</option>
            </select>

            <label className="field__label" htmlFor="search-filter">
              Search
            </label>
            <input
              id="search-filter"
              className="field__input"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="reason code, payload key, trace..."
            />
          </fieldset>

          <div className="actions">
            <button
              type="button"
              className="button--ghost"
              onClick={() => downloadJson(`evidence-${traceLookup || currentTrace || "trace"}.json`, evidence)}
            >
              Export evidence JSON
            </button>
          </div>

          <EvidenceTimeline events={filteredEvents} />
        </>
      ) : (
        <EmptyState
          title="No evidence loaded"
          hint="Enter a trace ID to inspect event chronology and metadata."
        />
      )}

      {protocols ? <JsonBlock value={protocols} label="Protocol Metadata" /> : null}
      {bundle ? <JsonBlock value={bundle} label="Policy Bundle Metadata" /> : null}
      {evidence ? <JsonBlock value={evidence} label="Evidence Payload" /> : null}
    </Panel>
  );
};

export default EvidencePanel;
