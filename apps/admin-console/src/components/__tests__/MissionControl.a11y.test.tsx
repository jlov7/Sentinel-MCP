import React from "react";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { vi } from "vitest";

import Home from "../../pages/index";

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

describe("Mission Control accessibility", () => {
  it("has no detectable accessibility violations on initial render", async () => {
    const { container } = render(<Home />);

    await screen.findByRole("heading", { name: /mission control/i });

    const results = await axe(container, {
      rules: {
        region: { enabled: false },
      },
    });

    expect(results).toHaveNoViolations();
  });
});
