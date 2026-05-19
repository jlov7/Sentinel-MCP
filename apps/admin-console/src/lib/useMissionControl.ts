import { useEffect, useMemo, useState } from "react";

import {
  ApprovalRecord,
  AttestationDetail,
  AttestationResponse,
  AttestationVerification,
  AuthorizationDecision,
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
} from "./api";
import { detectNavVariant, NavVariant } from "./experiments";
import { readUiEvents, trackUiEvent, UiEvent } from "./telemetry";

type Status = "checking" | "online" | "offline";

const TOKEN_KEY = "sentinel-v2-token";

type JourneyDurations = {
  decisionMs: number | null;
  approvalMs: number | null;
  provenanceMs: number | null;
  evidenceMs: number | null;
};

export type ToastNotice = {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  detail?: string;
  nextStep?: string;
};

function readFromStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const getItem = window.localStorage?.getItem;
  if (typeof getItem !== "function") {
    return null;
  }
  try {
    return getItem.call(window.localStorage, key);
  } catch {
    return null;
  }
}

function writeToStorage(key: string, value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const setItem = window.localStorage?.setItem;
  if (typeof setItem !== "function") {
    return;
  }
  try {
    setItem.call(window.localStorage, key, value);
  } catch {
    // noop: storage is unavailable in some test/sandbox environments
  }
}

export type MissionControlState = {
  status: Status;
  lastCheck: string;
  navVariant: NavVariant;
  token: string;
  tenant: string;
  toolName: string;
  action: string;
  purpose: string;
  usage: number;
  contextJson: string;
  contextValidationError: string | null;
  replayToken: string;
  decision: AuthorizationDecision | null;
  decisionError: string | null;
  decisionBusy: boolean;
  controlReason: string;
  controlMessage: string | null;
  controlError: string | null;
  killSwitchBusy: boolean;
  approvalReason: string;
  approvalTtl: number;
  approvalId: string;
  approvalNote: string;
  approvalRecord: ApprovalRecord | null;
  approvalError: string | null;
  approvalBusy: boolean;
  requestHash: string;
  responseHash: string;
  outcome: string;
  attestationIdInput: string;
  attestation: AttestationResponse | null;
  attestationDetail: AttestationDetail | null;
  attestationVerification: AttestationVerification | null;
  provenanceError: string | null;
  provenanceBusy: boolean;
  traceLookup: string;
  evidence: EvidenceResponse | null;
  evidenceError: string | null;
  evidenceBusy: boolean;
  evidenceDegraded: string[];
  protocols: ProtocolMetadata | null;
  bundle: PolicyBundleMetadata | null;
  uiEvents: UiEvent[];
  toasts: ToastNotice[];
  journeyStartedAt: string | null;
  journeyDurations: JourneyDurations;
  journeyComplete: boolean;
};

export function useMissionControl() {
  const [status, setStatus] = useState<Status>("checking");
  const [lastCheck, setLastCheck] = useState<string>("--");
  const [navVariant] = useState<NavVariant>(() => detectNavVariant("expanded"));

  const [token, setToken] = useState<string>(
    () => DEFAULT_BEARER_TOKEN || readFromStorage(TOKEN_KEY) || ""
  );
  const [tenant, setTenant] = useState("platform-eng");
  const [toolName, setToolName] = useState("langsmith-docs-search");
  const [action, setAction] = useState("invoke");
  const [purpose, setPurpose] = useState("support");
  const [usage, setUsage] = useState(10);
  const [contextJson, setContextJson] = useState('{"channel":"ops"}');
  const [contextValidationError, setContextValidationError] = useState<string | null>(null);
  const [replayToken, setReplayToken] = useState("");

  const [decision, setDecision] = useState<AuthorizationDecision | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);

  const [controlReason, setControlReason] = useState("operator-triggered stop");
  const [controlMessage, setControlMessage] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [killSwitchBusy, setKillSwitchBusy] = useState(false);

  const [approvalReason, setApprovalReason] = useState(
    "risk threshold exceeded; manual verification"
  );
  const [approvalTtl, setApprovalTtl] = useState(600);
  const [approvalId, setApprovalId] = useState("");
  const [approvalNote, setApprovalNote] = useState("validated by operator");
  const [approvalRecord, setApprovalRecord] = useState<ApprovalRecord | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);

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
  const [provenanceBusy, setProvenanceBusy] = useState(false);

  const [traceLookup, setTraceLookup] = useState("");
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceDegraded, setEvidenceDegraded] = useState<string[]>([]);
  const [protocols, setProtocols] = useState<ProtocolMetadata | null>(null);
  const [bundle, setBundle] = useState<PolicyBundleMetadata | null>(null);

  const [uiEvents, setUiEvents] = useState<UiEvent[]>(() => readUiEvents());
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [journeyEpochMs, setJourneyEpochMs] = useState<number | null>(null);
  const [journeyDurations, setJourneyDurations] = useState<JourneyDurations>({
    decisionMs: null,
    approvalMs: null,
    provenanceMs: null,
    evidenceMs: null,
  });

  const addToast = (
    tone: ToastNotice["tone"],
    title: string,
    detail?: string,
    nextStep?: string
  ) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, tone, title, detail, nextStep }].slice(-8));

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 6500);
    }
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const listener = () => {
      setUiEvents(readUiEvents());
    };

    window.addEventListener("sentinel:ui-event", listener as EventListener);
    return () => {
      window.removeEventListener("sentinel:ui-event", listener as EventListener);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      try {
        const result = await fetchHealth();
        if (!mounted) return;
        setStatus(result.status === "ok" ? "online" : "offline");
        trackUiEvent({ name: "health_check", success: true });
      } catch {
        if (!mounted) return;
        setStatus("offline");
        trackUiEvent({ name: "health_check", success: false });
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
    writeToStorage(TOKEN_KEY, token);
  }, [token]);

  const currentTrace = useMemo(() => {
    if (decision?.trace_id) return decision.trace_id;
    if (approvalRecord?.trace_id) return approvalRecord.trace_id;
    if (attestation?.trace_id) return attestation.trace_id;
    return "";
  }, [approvalRecord?.trace_id, attestation?.trace_id, decision?.trace_id]);

  const currentDecisionId = decision?.decision_id ?? "";

  const ensureJourneyStarted = (): number => {
    if (journeyEpochMs === null) {
      const now = Date.now();
      setJourneyEpochMs(now);
      return now;
    }
    return journeyEpochMs;
  };

  const markJourneyMilestone = (key: keyof JourneyDurations, epochMs: number) => {
    setJourneyDurations((current) => {
      if (current[key] !== null) {
        return current;
      }
      return {
        ...current,
        [key]: Math.max(1, Date.now() - epochMs),
      };
    });
  };

  const parseContext = (): Record<string, unknown> => {
    if (!contextJson.trim()) {
      setContextValidationError(null);
      return {};
    }

    try {
      const parsed = JSON.parse(contextJson) as Record<string, unknown>;
      setContextValidationError(null);
      return parsed;
    } catch {
      const message = "Context must be valid JSON";
      setContextValidationError(message);
      throw new Error(message);
    }
  };

  const runDecision = async (mode: "authorize" | "replay") => {
    const epochMs = ensureJourneyStarted();
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
      markJourneyMilestone("decisionMs", epochMs);
      trackUiEvent({ name: mode === "authorize" ? "authorize" : "replay", success: true });
      addToast(
        "success",
        mode === "authorize" ? "Decision authorized" : "Decision replay completed",
        result.allow ? "Policy allows this action." : "Policy denied this action.",
        "Continue with approval or provenance checks."
      );
    } catch (error) {
      const message = (error as Error).message;
      setDecisionError(message);
      trackUiEvent({ name: mode === "authorize" ? "authorize" : "replay", success: false, detail: message });
      addToast("error", "Decision request failed", message, "Fix inputs and retry.");
    } finally {
      setDecisionBusy(false);
    }
  };

  const runKillSwitch = async (disable: boolean) => {
    setControlError(null);
    setControlMessage(null);
    setKillSwitchBusy(true);

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
      trackUiEvent({ name: disable ? "kill_switch_activate" : "kill_switch_restore", success: true });
      addToast(
        "success",
        disable ? "Kill switch activated" : "Kill switch restored",
        `Affected tools: ${result.affected_tools.join(", ")}`,
        disable
          ? "Run an authorize check to validate precedence."
          : "Re-run authorize to confirm recovered behavior."
      );
    } catch (error) {
      const message = (error as Error).message;
      setControlError(message);
      trackUiEvent({
        name: disable ? "kill_switch_activate" : "kill_switch_restore",
        success: false,
        detail: message,
      });
      addToast("error", "Control action failed", message, "Check token scopes and retry.");
    } finally {
      setKillSwitchBusy(false);
    }
  };

  const runApprovalRequest = async () => {
    if (!decision) {
      const message = "Run a decision first.";
      setApprovalError(message);
      addToast("info", "Approval blocked", message, "Authorize a request first.");
      return;
    }

    setApprovalError(null);
    setApprovalBusy(true);

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
      markJourneyMilestone("approvalMs", ensureJourneyStarted());
      trackUiEvent({ name: "approval_request", success: true });
      addToast(
        "success",
        "Approval requested",
        `Approval ID: ${result.approval_id}`,
        "Resolve the approval to continue execution."
      );
    } catch (error) {
      const message = (error as Error).message;
      setApprovalError(message);
      trackUiEvent({ name: "approval_request", success: false, detail: message });
      addToast("error", "Approval request failed", message, "Review TTL and identity claims.");
    } finally {
      setApprovalBusy(false);
    }
  };

  const runApprovalResolve = async (approved: boolean) => {
    if (!approvalId.trim()) {
      const message = "Approval ID is required.";
      setApprovalError(message);
      addToast("info", "Approval resolution blocked", message, "Select a valid approval record.");
      return;
    }

    setApprovalError(null);
    setApprovalBusy(true);

    try {
      const result = await resolveApproval(token, approvalId.trim(), {
        approved,
        note: approvalNote || undefined,
      });
      setApprovalRecord(result);
      markJourneyMilestone("approvalMs", ensureJourneyStarted());
      trackUiEvent({ name: "approval_resolve", success: true });
      addToast(
        "success",
        approved ? "Approval granted" : "Approval denied",
        `State: ${result.state}`,
        approved ? "Proceed to provenance attestation." : "Adjust request context before retry."
      );
    } catch (error) {
      const message = (error as Error).message;
      setApprovalError(message);
      trackUiEvent({ name: "approval_resolve", success: false, detail: message });
      addToast("error", "Approval resolution failed", message, "Retry with a valid approval ID.");
    } finally {
      setApprovalBusy(false);
    }
  };

  const runAttest = async () => {
    if (!decision) {
      const message = "Run a decision first.";
      setProvenanceError(message);
      addToast("info", "Attestation blocked", message, "Authorize a request first.");
      return;
    }

    setProvenanceError(null);
    setAttestation(null);
    setProvenanceBusy(true);

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
      trackUiEvent({ name: "attest", success: true });
      addToast(
        "success",
        "Attestation issued",
        `Attestation ID: ${result.attestation_id}`,
        "Run verify to confirm integrity and transparency linkage."
      );
    } catch (error) {
      const message = (error as Error).message;
      setProvenanceError(message);
      trackUiEvent({ name: "attest", success: false, detail: message });
      addToast("error", "Attestation failed", message, "Check provenance backend health and retry.");
    } finally {
      setProvenanceBusy(false);
    }
  };

  const runVerifyAttestation = async () => {
    if (!attestationIdInput.trim()) {
      const message = "Attestation ID is required.";
      setProvenanceError(message);
      addToast("info", "Verification blocked", message, "Provide an attestation ID.");
      return;
    }

    setProvenanceError(null);
    setProvenanceBusy(true);

    try {
      const [detail, verification] = await Promise.all([
        getAttestation(token, attestationIdInput.trim()),
        verifyAttestation(token, attestationIdInput.trim()),
      ]);
      setAttestationDetail(detail);
      setAttestationVerification(verification);
      markJourneyMilestone("provenanceMs", ensureJourneyStarted());
      trackUiEvent({ name: "attestation_verify", success: true });
      addToast(
        verification.verified ? "success" : "error",
        verification.verified ? "Attestation verified" : "Attestation verification failed",
        `Trace: ${verification.trace_id}`,
        verification.verified
          ? "Load evidence replay for complete timeline analysis."
          : "Investigate signature or transparency-log mismatch."
      );
    } catch (error) {
      const message = (error as Error).message;
      setProvenanceError(message);
      trackUiEvent({ name: "attestation_verify", success: false, detail: message });
      addToast("error", "Verification request failed", message, "Retry after provenance service recovery.");
    } finally {
      setProvenanceBusy(false);
    }
  };

  const runEvidenceLookup = async () => {
    if (!traceLookup.trim()) {
      const message = "Trace ID is required.";
      setEvidenceError(message);
      addToast("info", "Evidence lookup blocked", message, "Provide a trace ID to continue.");
      return;
    }

    setEvidenceError(null);
    setEvidenceDegraded([]);
    setEvidenceBusy(true);

    const traceId = traceLookup.trim();

    try {
      const [evidenceResult, protocolResult, bundleResult] = await Promise.allSettled([
        fetchEvidence(token, traceId),
        fetchProtocols(token),
        fetchPolicyBundle(token),
      ]);

      if (evidenceResult.status === "rejected") {
        throw evidenceResult.reason;
      }

      const degraded: string[] = [];
      setEvidence(evidenceResult.value);

      if (protocolResult.status === "fulfilled") {
        setProtocols(protocolResult.value);
      } else {
        setProtocols(null);
        degraded.push("Protocol metadata unavailable.");
      }

      if (bundleResult.status === "fulfilled") {
        setBundle(bundleResult.value);
      } else {
        setBundle(null);
        degraded.push("Policy bundle metadata unavailable.");
      }

      setEvidenceDegraded(degraded);
      markJourneyMilestone("evidenceMs", ensureJourneyStarted());
      trackUiEvent({
        name: "evidence_lookup",
        success: true,
        detail: degraded.length ? degraded.join(" ") : undefined,
      });

      if (degraded.length) {
        addToast(
          "info",
          "Evidence loaded with degraded dependencies",
          degraded.join(" "),
          "Retry metadata fetch when control plane dependencies recover."
        );
      } else {
        addToast(
          "success",
          "Evidence loaded",
          `Trace ${traceId} is ready for replay analysis.`,
          "Export artifacts for audit package if required."
        );
      }
    } catch (error) {
      const message = (error as Error).message;
      setEvidenceError(message);
      trackUiEvent({ name: "evidence_lookup", success: false, detail: message });
      addToast("error", "Evidence lookup failed", message, "Validate trace ID and retry.");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const journeyStartedAt = journeyEpochMs ? new Date(journeyEpochMs).toISOString() : null;
  const journeyComplete =
    journeyDurations.decisionMs !== null &&
    journeyDurations.approvalMs !== null &&
    journeyDurations.provenanceMs !== null &&
    journeyDurations.evidenceMs !== null;

  const state: MissionControlState = {
    status,
    lastCheck,
    navVariant,
    token,
    tenant,
    toolName,
    action,
    purpose,
    usage,
    contextJson,
    contextValidationError,
    replayToken,
    decision,
    decisionError,
    decisionBusy,
    controlReason,
    controlMessage,
    controlError,
    killSwitchBusy,
    approvalReason,
    approvalTtl,
    approvalId,
    approvalNote,
    approvalRecord,
    approvalError,
    approvalBusy,
    requestHash,
    responseHash,
    outcome,
    attestationIdInput,
    attestation,
    attestationDetail,
    attestationVerification,
    provenanceError,
    provenanceBusy,
    traceLookup,
    evidence,
    evidenceError,
    evidenceBusy,
    evidenceDegraded,
    protocols,
    bundle,
    uiEvents,
    toasts,
    journeyStartedAt,
    journeyDurations,
    journeyComplete,
  };

  return {
    state,
    setToken,
    setTenant,
    setToolName,
    setAction,
    setPurpose,
    setUsage,
    setContextJson,
    setReplayToken,
    setControlReason,
    setApprovalReason,
    setApprovalTtl,
    setApprovalId,
    setApprovalNote,
    setRequestHash,
    setResponseHash,
    setOutcome,
    setAttestationIdInput,
    setTraceLookup,
    runDecision,
    runKillSwitch,
    runApprovalRequest,
    runApprovalResolve,
    runAttest,
    runVerifyAttestation,
    runEvidenceLookup,
    dismissToast,
    currentTrace,
    currentDecisionId,
  };
}
