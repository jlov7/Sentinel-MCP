import Head from "next/head";
import React, { useEffect, useMemo, useState } from "react";

import Breadcrumbs from "../components/layout/Breadcrumbs";
import JourneyChecklist from "../components/layout/JourneyChecklist";
import MissionHeader from "../components/layout/MissionHeader";
import OnboardingTour from "../components/layout/OnboardingTour";
import SectionNav, { NavItem } from "../components/layout/SectionNav";
import AccessBoundaryPanel from "../components/sections/AccessBoundaryPanel";
import ApprovalPanel from "../components/sections/ApprovalPanel";
import ControlPanel from "../components/sections/ControlPanel";
import DecisionPanel from "../components/sections/DecisionPanel";
import EvidencePanel from "../components/sections/EvidencePanel";
import FeedbackPanel from "../components/sections/FeedbackPanel";
import OperatorGuidePanel from "../components/sections/OperatorGuidePanel";
import ProvenancePanel from "../components/sections/ProvenancePanel";
import MetricStrip from "../components/ui/MetricStrip";
import MessageCallout from "../components/ui/MessageCallout";
import ToastStack from "../components/ui/ToastStack";
import { CONTROL_PLANE_URL } from "../lib/api";
import { trackUiEvent } from "../lib/telemetry";
import { useMissionControl } from "../lib/useMissionControl";

const NAV_ITEMS: NavItem[] = [
  { id: "operator-guide", label: "Guide" },
  { id: "access-boundary", label: "Access" },
  { id: "decision-orchestrator", label: "Decisions" },
  { id: "control-overrides", label: "Controls" },
  { id: "approval-interrupts", label: "Approvals" },
  { id: "provenance-attestation", label: "Provenance" },
  { id: "evidence-replay", label: "Evidence" },
  { id: "operator-feedback", label: "Feedback" },
];

const ONBOARDING_KEY = "sentinel-v2-onboarding-dismissed";
const FEEDBACK_KEY = "sentinel-v2-feedback";

const EVENT_NEXT_STEPS: Record<string, string> = {
  authorize: "Review reason codes and continue to approval or provenance.",
  replay: "Compare replay output with the initial decision trace.",
  kill_switch_activate: "Re-run authorize to confirm precedence behavior.",
  kill_switch_restore: "Validate normal decision flow is restored.",
  approval_request: "Resolve the approval request using explicit note text.",
  approval_resolve: "Proceed to provenance verification for audit continuity.",
  attest: "Verify attestation integrity and transparency-link evidence.",
  attestation_verify: "Load evidence replay for full incident reconstruction.",
  evidence_lookup: "Filter events and export artifacts for incident package.",
  health_check: "If offline persists, validate service endpoint and credentials.",
};

function canUseStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return typeof window.localStorage?.getItem === "function";
}

function readFeedbackCount(): number {
  if (!canUseStorage()) {
    return 0;
  }
  const rawFeedback = window.localStorage.getItem(FEEDBACK_KEY);
  if (!rawFeedback) {
    return 0;
  }
  try {
    const parsed = JSON.parse(rawFeedback) as Array<{ created_at: string; score: number; note: string }>;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

const Home = () => {
  const {
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
  } = useMissionControl();

  const [activeSectionId, setActiveSectionId] = useState<string>(NAV_ITEMS[0].id);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);

  useEffect(() => {
    if (!canUseStorage()) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setShowOnboarding(window.localStorage.getItem(ONBOARDING_KEY) !== "true");
      setFeedbackCount(readFeedbackCount());
    });

    const params = new URLSearchParams(window.location.search);
    const traceParam = params.get("trace");
    if (traceParam) {
      setTraceLookup(traceParam);
    }

    return () => window.cancelAnimationFrame(frame);
  }, [setTraceLookup]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visible?.target?.id) {
          setActiveSectionId(visible.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0.2, 0.4, 0.6],
      }
    );

    NAV_ITEMS.forEach((item) => {
      const target = document.getElementById(item.id);
      if (target) {
        observer.observe(target);
      }
    });

    return () => observer.disconnect();
  }, []);

  const dismissOnboarding = () => {
    if (canUseStorage()) {
      window.localStorage.setItem(ONBOARDING_KEY, "true");
    }
    setShowOnboarding(false);
    trackUiEvent({ name: "onboarding_dismiss", success: true });
  };

  const submitFeedback = (score: number, note: string) => {
    if (!canUseStorage()) {
      return;
    }

    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    let current: Array<{ created_at: string; score: number; note: string }> = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Array<{ created_at: string; score: number; note: string }>;
        current = Array.isArray(parsed) ? parsed : [];
      } catch {
        current = [];
      }
    }

    const next = [
      ...current,
      {
        created_at: new Date().toISOString(),
        score,
        note: note.trim(),
      },
    ].slice(-200);

    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    setFeedbackCount(next.length);
    trackUiEvent({ name: "feedback_submit", success: true, detail: `score:${score}` });
  };

  const jumpToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.location.hash = sectionId;
  };

  const metrics = useMemo(() => {
    const total = state.uiEvents.length;
    const successes = state.uiEvents.filter((entry) => entry.success).length;
    const failures = total - successes;
    const successRate = total ? `${Math.round((successes / total) * 100)}%` : "--";

    return [
      { label: "UI events", value: String(total) },
      { label: "Success rate", value: successRate },
      { label: "Failures", value: String(failures) },
      {
        label: "Time to evidence",
        value: state.journeyDurations.evidenceMs
          ? `${(state.journeyDurations.evidenceMs / 1000).toFixed(1)}s`
          : "--",
      },
    ];
  }, [state.journeyDurations.evidenceMs, state.uiEvents]);

  const latestEvent = state.uiEvents.length ? state.uiEvents[state.uiEvents.length - 1] : null;

  const latestOutcome = latestEvent
    ? `Latest event: ${latestEvent.name} (${latestEvent.success ? "success" : "failure"}).`
    : "No UI events yet. Start with Authorize.";

  const nextStep = latestEvent ? EVENT_NEXT_STEPS[latestEvent.name] ?? "Continue to the next workflow stage." : "";

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeSectionId)?.label ?? "Guide";

  return (
    <>
      <Head>
        <title>Sentinel MCP Mission Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <main className="mission" id="main-content">
        <MissionHeader status={state.status} endpoint={CONTROL_PLANE_URL} lastCheck={state.lastCheck} />
        <Breadcrumbs activeLabel={activeLabel} />
        <OnboardingTour visible={showOnboarding} onDismiss={dismissOnboarding} onJumpTo={jumpToSection} />

        <MetricStrip metrics={metrics} />

        <div className="layout-grid">
          <aside className="layout-sidebar">
            <SectionNav
              items={NAV_ITEMS}
              compact={state.navVariant === "compact"}
              activeId={activeSectionId}
            />
            <JourneyChecklist
              decisionReady={Boolean(state.decision)}
              approvalReady={Boolean(state.approvalRecord)}
              attestationReady={Boolean(state.attestationVerification)}
              evidenceReady={Boolean(state.evidence)}
            />
          </aside>

          <div className="layout-main">
            <MessageCallout tone={latestEvent?.success === false ? "error" : "info"}>{latestOutcome}</MessageCallout>
            {nextStep ? <MessageCallout tone="ok">Next step: {nextStep}</MessageCallout> : null}
            {state.status === "offline" ? (
              <MessageCallout tone="error">
                Control plane is offline. Actions may fail-closed until connectivity is restored.
              </MessageCallout>
            ) : null}

            <OperatorGuidePanel
              tenant={state.tenant}
              currentTrace={currentTrace}
              journeyStartedAt={state.journeyStartedAt}
              journeyDurations={state.journeyDurations}
              journeyComplete={state.journeyComplete}
              onLoadDemoTrace={() => setTraceLookup(currentTrace)}
            />

            <AccessBoundaryPanel token={state.token} onTokenChange={setToken} />

            <section className="grid">
              <DecisionPanel
                tenant={state.tenant}
                toolName={state.toolName}
                action={state.action}
                purpose={state.purpose}
                usage={state.usage}
                contextJson={state.contextJson}
                contextValidationError={state.contextValidationError}
                replayToken={state.replayToken}
                decisionBusy={state.decisionBusy}
                decisionError={state.decisionError}
                decision={state.decision}
                onTenantChange={setTenant}
                onToolNameChange={setToolName}
                onActionChange={setAction}
                onPurposeChange={setPurpose}
                onUsageChange={setUsage}
                onContextJsonChange={setContextJson}
                onReplayTokenChange={setReplayToken}
                onAuthorize={() => runDecision("authorize")}
                onReplay={() => runDecision("replay")}
              />

              <ControlPanel
                controlReason={state.controlReason}
                controlMessage={state.controlMessage}
                controlError={state.controlError}
                killSwitchBusy={state.killSwitchBusy}
                onReasonChange={setControlReason}
                onActivate={() => runKillSwitch(true)}
                onRestore={() => runKillSwitch(false)}
              />

              <ApprovalPanel
                approvalReason={state.approvalReason}
                approvalTtl={state.approvalTtl}
                approvalId={state.approvalId}
                approvalNote={state.approvalNote}
                approvalError={state.approvalError}
                approvalRecord={state.approvalRecord}
                approvalBusy={state.approvalBusy}
                onReasonChange={setApprovalReason}
                onTtlChange={setApprovalTtl}
                onApprovalIdChange={setApprovalId}
                onNoteChange={setApprovalNote}
                onRequest={runApprovalRequest}
                onApprove={() => runApprovalResolve(true)}
                onDeny={() => runApprovalResolve(false)}
              />

              <ProvenancePanel
                requestHash={state.requestHash}
                responseHash={state.responseHash}
                outcome={state.outcome}
                attestationIdInput={state.attestationIdInput}
                provenanceError={state.provenanceError}
                provenanceBusy={state.provenanceBusy}
                attestation={state.attestation}
                attestationDetail={state.attestationDetail}
                attestationVerification={state.attestationVerification}
                onRequestHashChange={setRequestHash}
                onResponseHashChange={setResponseHash}
                onOutcomeChange={setOutcome}
                onAttestationIdInputChange={setAttestationIdInput}
                onAttest={runAttest}
                onVerify={runVerifyAttestation}
              />
            </section>

            <EvidencePanel
              traceLookup={state.traceLookup}
              currentTrace={currentTrace}
              currentDecisionId={currentDecisionId}
              evidence={state.evidence}
              evidenceError={state.evidenceError}
              evidenceBusy={state.evidenceBusy}
              evidenceDegraded={state.evidenceDegraded}
              protocols={state.protocols}
              bundle={state.bundle}
              onTraceLookupChange={setTraceLookup}
              onSubmitLookup={runEvidenceLookup}
            />

            <FeedbackPanel feedbackCount={feedbackCount} onSubmitFeedback={submitFeedback} />
          </div>
        </div>

        <ToastStack toasts={state.toasts} onDismiss={dismissToast} />
      </main>
    </>
  );
};

export default Home;
