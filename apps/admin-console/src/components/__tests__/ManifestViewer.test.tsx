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

describe("Mission Control evidence flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads evidence and metadata by trace id", async () => {
    vi.mocked(api.fetchEvidence).mockResolvedValue({
      trace_id: "trace-xyz",
      events: [
        {
          id: "event-1",
          trace_id: "trace-xyz",
          tenant_slug: "platform-eng",
          event_type: "decision.allowed",
          created_at: "2026-03-03T10:00:00Z",
          payload: { a: 1 },
        },
      ],
    });
    vi.mocked(api.fetchProtocols).mockResolvedValue({
      mcp_spec_revision: "2025-11-25",
      a2a_spec_revision: "latest",
    });
    vi.mocked(api.fetchPolicyBundle).mockResolvedValue({
      policy_package: "sentinel/policy",
      bundle_version: "2026.03.02",
      bundle_sha256: "abc",
    });

    render(<Home />);

    await userEvent.type(screen.getByPlaceholderText(/trace id/i), "trace-xyz");
    await userEvent.click(screen.getByRole("button", { name: /load evidence/i }));

    await waitFor(() => expect(api.fetchEvidence).toHaveBeenCalledWith("", "trace-xyz"));
    expect(await screen.findByText(/"event_type": "decision.allowed"/i)).toBeInTheDocument();
  });
});
