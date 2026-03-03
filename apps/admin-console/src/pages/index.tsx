import Head from "next/head";
import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ApprovalRecord,
  AttestationDetail,
  AttestationResponse,
  AttestationVerification,
  AuthorizationDecision,
  CONTROL_PLANE_URL,
  DEFAULT_BEARER_TOKEN,
  EvidenceResponse,
  PolicyBundleMetadata,
  ProtocolMetadata,
  attest,
  authorizeDecision,
  enableKillSwitch,
  fetchEvidence,
  fetchHealth,
  fetchPolicyBundle,
  fetchProtocols,
  getAttestation,
  replayDecision,
  requestApproval,
  resolveApproval,
  restoreKillSwitch,
  verifyAttestation,
} from "../lib/api";

type Status = "checking" | "online" | "offline";

const Home = () => {
  const [status, setStatus] = useState<Status>("checking");
  const [lastCheck, setLastCheck] = useState<string>("--");

  const [token, setToken] = useState<string>(DEFAULT_BEARER_TOKEN);
  const [tenant, setTenant] = useState("platform-eng");
  const [toolName, setToolName] = useState("langsmith-docs-search");
  const [action, setAction] = useState("invoke");
  const [purpose, setPurpose] = useState("support");
  const [usage, setUsage] = useState(10);
  const [contextJson, setContextJson] = useState('{"channel":"ops"}');
  const [replayToken, setReplayToken] = useState("");

  const [decision, setDecision] = useState<AuthorizationDecision | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const [controlReason, setControlReason] = useState("operator-triggered stop");
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const [approvalReason, setApprovalReason] = useState("risk threshold exceeded; manual verification");
  const [approvalTtl, setApprovalTtl] = useState(600);
  const [approvalId, setApprovalId] = useState("");
  const [approvalNote, setApprovalNote] = useState("validated by operator");
  const [approvalRecord, setApprovalRecord] = useState<ApprovalRecord | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [requestHash, setRequestHash] = useState("sha256:req-demo");
  const [responseHash, setResponseHash] = useState("sha256:resp-demo");
  const [outcome, setOutcome] = useState("success");
  const [attestationIdInput, setAttestationIdInput] = useState("");
  const [attestation, setAttestation] = useState<AttestationResponse | null>(null);
  const [attestationDetail, setAttestationDetail] = useState<AttestationDetail | null>(null);
  const [attestationVerification, setAttestationVerification] = useState<AttestationVerification | null>(
    null
  );
  const [provenanceError, setProvenanceError] = useState<string | null>(null);

  const [traceLookup, setTraceLookup] = useState("");
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [protocols, setProtocols] = useState<ProtocolMetadata | null>(null);
  const [bundle, setBundle] = useState<PolicyBundleMetadata | null>(null);

  useEffect(() => {
    let mounted = true;

    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.getItem === "function"
    ) {
      const persisted = window.localStorage.getItem("sentinel-v2-token");
      if (persisted && !DEFAULT_BEARER_TOKEN) {
        setToken(persisted);
      }
    }

    const checkHealth = async () => {
      try {
        const result = await fetchHealth();
        if (!mounted) return;
        setStatus(result.status === "ok" ? "online" : "offline");
      } catch {
        if (!mounted) return;
        setStatus("offline");
      } finally {
        if (mounted) {
          setLastCheck(new Date().toLocaleTimeString());
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.localStorage &&
      typeof window.localStorage.setItem === "function"
    ) {
      window.localStorage.setItem("sentinel-v2-token", token);
    }
  }, [token]);

  const currentTrace = useMemo(() => {
    if (decision?.trace_id) {
      return decision.trace_id;
    }
    if (approvalRecord?.trace_id) {
      return approvalRecord.trace_id;
    }
    if (attestation?.trace_id) {
      return attestation.trace_id;
    }
    return "";
  }, [approvalRecord?.trace_id, attestation?.trace_id, decision?.trace_id]);

  const currentDecisionId = decision?.decision_id ?? "";

  const parseContext = (): Record<string, unknown> => {
    if (!contextJson.trim()) {
      return {};
    }
    try {
      return JSON.parse(contextJson) as Record<string, unknown>;
    } catch {
      throw new Error("Context must be valid JSON");
    }
  };

  const runDecision = async (mode: "authorize" | "replay") => {
    setDecisionBusy(true);
    setDecisionError(null);
    setDecision(null);
    try {
      const payload = {
        tenant_slug: tenant,
        tool_name: toolName,
        action,
        purpose: purpose || undefined,
        usage,
        context: parseContext(),
        replay_token: replayToken || undefined,
      };

      const result =
        mode === "authorize"
          ? await authorizeDecision(token, payload)
          : await replayDecision(token, payload);
      setDecision(result);
      setTraceLookup(result.trace_id);
    } catch (error) {
      setDecisionError((error as Error).message);
    } finally {
      setDecisionBusy(false);
    }
  };

  const runKillSwitch = async (disable: boolean) => {
    setControlError(null);
    setControlMessage(null);
    try {
      const result = disable
        ? await enableKillSwitch(token, {
            tenant_slug: tenant,
            tool_name: toolName || undefined,
            reason: controlReason,
          })
        : await restoreKillSwitch(token, {
            tenant_slug: tenant,
            tool_name: toolName || undefined,
          });
      setControlMessage(`${result.status.toUpperCase()} -> ${result.affected_tools.join(", ")}`);
    } catch (error) {
      setControlError((error as Error).message);
    }
  };

  const runApprovalRequest = async () => {
    if (!decision) {
      setApprovalError("Run a decision first.");
      return;
    }
    setApprovalError(null);
    try {
      const result = await requestApproval(token, {
        tenant_slug: tenant,
        trace_id: decision.trace_id,
        decision_id: decision.decision_id,
        reason: approvalReason,
        ttl_seconds: approvalTtl,
      });
      setApprovalRecord(result);
      setApprovalId(result.approval_id);
    } catch (error) {
      setApprovalError((error as Error).message);
    }
  };

  const runApprovalResolve = async (approved: boolean) => {
    if (!approvalId.trim()) {
      setApprovalError("Approval ID is required.");
      return;
    }
    setApprovalError(null);
    try {
      const result = await resolveApproval(token, approvalId.trim(), {
        approved,
        note: approvalNote || undefined,
      });
      setApprovalRecord(result);
    } catch (error) {
      setApprovalError((error as Error).message);
    }
  };

  const runAttest = async () => {
    if (!decision) {
      setProvenanceError("Run a decision first.");
      return;
    }
    setProvenanceError(null);
    setAttestation(null);
    try {
      const result = await attest(token, {
        tenant_slug: tenant,
        tool_name: toolName,
        action,
        trace_id: decision.trace_id,
        decision_id: decision.decision_id,
        decision_allow: decision.allow,
        request_hash: requestHash,
        response_hash: responseHash || undefined,
        outcome: outcome || undefined,
      });
      setAttestation(result);
      setAttestationIdInput(result.attestation_id);
    } catch (error) {
      setProvenanceError((error as Error).message);
    }
  };

  const runVerifyAttestation = async () => {
    if (!attestationIdInput.trim()) {
      setProvenanceError("Attestation ID is required.");
      return;
    }
    setProvenanceError(null);
    try {
      const [detail, verification] = await Promise.all([
        getAttestation(token, attestationIdInput.trim()),
        verifyAttestation(token, attestationIdInput.trim()),
      ]);
      setAttestationDetail(detail);
      setAttestationVerification(verification);
    } catch (error) {
      setProvenanceError((error as Error).message);
    }
  };

  const runEvidenceLookup = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!traceLookup.trim()) {
      setEvidenceError("Trace ID is required.");
      return;
    }
    setEvidenceError(null);
    try {
      const [evidencePayload, protocolPayload, bundlePayload] = await Promise.all([
        fetchEvidence(token, traceLookup.trim()),
        fetchProtocols(token),
        fetchPolicyBundle(token),
      ]);
      setEvidence(evidencePayload);
      setProtocols(protocolPayload);
      setBundle(bundlePayload);
    } catch (error) {
      setEvidenceError((error as Error).message);
    }
  };

  const statusClass =
    status === "online"
      ? "status-dot status-dot--online"
      : status === "offline"
      ? "status-dot status-dot--offline"
      : "status-dot status-dot--checking";

  return (
    <>
      <Head>
        <title>Sentinel MCP Mission Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="mission">
        <header className="masthead">
          <div>
            <h1>Sentinel Mission Control v2</h1>
            <p>
              Governance runtime for frontier tool-use. Every decision, interrupt, and attestation
              links into a replayable evidence graph.
            </p>
          </div>
          <div className="status-card">
            <div className="status-card__row">
              <span className={statusClass} />
              <strong>{status.toUpperCase()}</strong>
            </div>
            <div className="status-card__meta">Endpoint: {CONTROL_PLANE_URL}</div>
            <div className="status-card__meta">Last check: {lastCheck}</div>
          </div>
        </header>

        <section className="panel panel--wide">
          <h2>Access Boundary</h2>
          <p>All `/v2/*` control APIs require authenticated identity and scoped claims.</p>
          <label className="field__label" htmlFor="bearer-token">
            Bearer token
          </label>
          <textarea
            id="bearer-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="field__input field__input--mono"
            rows={3}
            placeholder="Paste JWT with v2 scopes"
          />
        </section>

        <section className="grid">
          <article className="panel">
            <h2>Decision Orchestrator</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                runDecision("authorize");
              }}
              className="form"
            >
              <label className="field__label" htmlFor="tenant">
                Tenant
              </label>
              <input
                id="tenant"
                className="field__input"
                value={tenant}
                onChange={(event) => setTenant(event.target.value)}
              />

              <label className="field__label" htmlFor="tool-name">
                Tool name
              </label>
              <input
                id="tool-name"
                className="field__input"
                value={toolName}
                onChange={(event) => setToolName(event.target.value)}
              />

              <label className="field__label" htmlFor="action">
                Action
              </label>
              <input
                id="action"
                className="field__input"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              />

              <label className="field__label" htmlFor="purpose">
                Purpose
              </label>
              <input
                id="purpose"
                className="field__input"
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
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
                onChange={(event) => setUsage(Number(event.target.value))}
              />

              <label className="field__label" htmlFor="context-json">
                Context JSON
              </label>
              <textarea
                id="context-json"
                className="field__input field__input--mono"
                rows={3}
                value={contextJson}
                onChange={(event) => setContextJson(event.target.value)}
              />

              <label className="field__label" htmlFor="replay-token">
                Replay token (optional)
              </label>
              <input
                id="replay-token"
                className="field__input"
                value={replayToken}
                onChange={(event) => setReplayToken(event.target.value)}
              />

              <div className="actions">
                <button type="submit" disabled={decisionBusy}>
                  {decisionBusy ? "Authorizing..." : "Authorize"}
                </button>
                <button
                  type="button"
                  onClick={() => runDecision("replay")}
                  disabled={decisionBusy}
                  className="button--ghost"
                >
                  Replay
                </button>
              </div>
            </form>
            {decisionError ? <p className="error">{decisionError}</p> : null}
            {decision ? (
              <pre className="output">{JSON.stringify(decision, null, 2)}</pre>
            ) : null}
          </article>

          <article className="panel">
            <h2>Control Overrides</h2>
            <p>Kill-switch takes precedence over policy allow outcomes.</p>
            <label className="field__label" htmlFor="control-reason">
              Disable reason
            </label>
            <input
              id="control-reason"
              className="field__input"
              value={controlReason}
              onChange={(event) => setControlReason(event.target.value)}
            />
            <div className="actions">
              <button type="button" onClick={() => runKillSwitch(true)}>
                Activate kill-switch
              </button>
              <button type="button" onClick={() => runKillSwitch(false)} className="button--ghost">
                Restore tool
              </button>
            </div>
            {controlError ? <p className="error">{controlError}</p> : null}
            {controlMessage ? <p className="ok">{controlMessage}</p> : null}
          </article>

          <article className="panel">
            <h2>Approval Interrupts</h2>
            <p>Use this when a decision returns `requires_approval = true`.</p>
            <label className="field__label" htmlFor="approval-reason">
              Request reason
            </label>
            <input
              id="approval-reason"
              className="field__input"
              value={approvalReason}
              onChange={(event) => setApprovalReason(event.target.value)}
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
              onChange={(event) => setApprovalTtl(Number(event.target.value))}
            />
            <button type="button" onClick={runApprovalRequest}>
              Request approval
            </button>

            <hr />

            <label className="field__label" htmlFor="approval-id">
              Approval ID
            </label>
            <input
              id="approval-id"
              className="field__input"
              value={approvalId}
              onChange={(event) => setApprovalId(event.target.value)}
            />
            <label className="field__label" htmlFor="approval-note">
              Resolution note
            </label>
            <input
              id="approval-note"
              className="field__input"
              value={approvalNote}
              onChange={(event) => setApprovalNote(event.target.value)}
            />
            <div className="actions">
              <button type="button" onClick={() => runApprovalResolve(true)}>
                Approve
              </button>
              <button type="button" onClick={() => runApprovalResolve(false)} className="button--danger">
                Deny
              </button>
            </div>
            {approvalError ? <p className="error">{approvalError}</p> : null}
            {approvalRecord ? <pre className="output">{JSON.stringify(approvalRecord, null, 2)}</pre> : null}
          </article>

          <article className="panel">
            <h2>Provenance Attestation</h2>
            <p>Generate and verify DSSE envelopes with transparency-log linkage metadata.</p>
            <label className="field__label" htmlFor="request-hash">
              Request hash
            </label>
            <input
              id="request-hash"
              className="field__input"
              value={requestHash}
              onChange={(event) => setRequestHash(event.target.value)}
            />
            <label className="field__label" htmlFor="response-hash">
              Response hash
            </label>
            <input
              id="response-hash"
              className="field__input"
              value={responseHash}
              onChange={(event) => setResponseHash(event.target.value)}
            />
            <label className="field__label" htmlFor="outcome">
              Outcome
            </label>
            <input
              id="outcome"
              className="field__input"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
            <div className="actions">
              <button type="button" onClick={runAttest}>
                Attest
              </button>
            </div>

            <label className="field__label" htmlFor="attestation-id">
              Attestation ID
            </label>
            <input
              id="attestation-id"
              className="field__input"
              value={attestationIdInput}
              onChange={(event) => setAttestationIdInput(event.target.value)}
            />
            <button type="button" onClick={runVerifyAttestation}>
              Verify + Load
            </button>

            {provenanceError ? <p className="error">{provenanceError}</p> : null}
            {attestation ? <pre className="output">{JSON.stringify(attestation, null, 2)}</pre> : null}
            {attestationVerification ? (
              <pre className="output">{JSON.stringify(attestationVerification, null, 2)}</pre>
            ) : null}
            {attestationDetail ? <pre className="output">{JSON.stringify(attestationDetail, null, 2)}</pre> : null}
          </article>
        </section>

        <section className="panel panel--wide">
          <h2>Evidence Graph Replay</h2>
          <p>Jump from trace ID to full decision/provenance/control event sequence.</p>
          <form onSubmit={runEvidenceLookup} className="form-inline">
            <input
              className="field__input"
              placeholder="Trace ID"
              value={traceLookup}
              onChange={(event) => setTraceLookup(event.target.value)}
            />
            <button type="submit">Load evidence</button>
          </form>
          <div className="chips">
            <span className="chip">Current Trace: {currentTrace || "--"}</span>
            <span className="chip">Current Decision: {currentDecisionId || "--"}</span>
          </div>
          {evidenceError ? <p className="error">{evidenceError}</p> : null}
          {protocols ? <pre className="output">{JSON.stringify(protocols, null, 2)}</pre> : null}
          {bundle ? <pre className="output">{JSON.stringify(bundle, null, 2)}</pre> : null}
          {evidence ? <pre className="output">{JSON.stringify(evidence, null, 2)}</pre> : null}
        </section>
      </main>
    </>
  );
};

export default Home;
