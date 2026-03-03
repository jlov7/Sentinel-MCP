import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import Home from "../../pages/index";
import * as api from "../../lib/api";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return {
    ...actual,
    CONTROL_PLANE_URL: "http://localhost:8082",
    DEFAULT_BEARER_TOKEN: "",
    fetchHealth: vi.fn().mockResolvedValue({ status: "ok", service: "sentinel-control-plane-v2" }),
    authorizeDecision: vi.fn(),
    replayDecision: vi.fn(),
    enableKillSwitch: vi.fn(),
    restoreKillSwitch: vi.fn(),
    requestApproval: vi.fn(),
    resolveApproval: vi.fn(),
    attest: vi.fn(),
    getAttestation: vi.fn(),
    verifyAttestation: vi.fn(),
    fetchEvidence: vi.fn(),
    fetchProtocols: vi.fn(),
    fetchPolicyBundle: vi.fn(),
  };
});

describe("Mission Control decision flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits authorization request and renders decision", async () => {
    vi.mocked(api.authorizeDecision).mockResolvedValue({
      decision_id: "dec-1",
      trace_id: "trace-1",
      allow: true,
      reason_code: null,
      reason: null,
      quota_remaining: 99,
      risk_score: 0.1,
      risk_reason_codes: ["LOW_RISK"],
      requires_approval: false,
    });

    render(<Home />);

    await userEvent.click(await screen.findByRole("button", { name: /authorize/i }));

    await waitFor(() => expect(api.authorizeDecision).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/"decision_id": "dec-1"/i)).toBeInTheDocument();
  });
});
