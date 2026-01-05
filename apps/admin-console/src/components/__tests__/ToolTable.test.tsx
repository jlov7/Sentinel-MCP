import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ToolTable } from "../ToolTable";
import * as api from "../../lib/api";

vi.mock("../../lib/api");

describe("ToolTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows toggling kill-switch and enable actions", async () => {
    const toolActive = {
      id: "tool-1",
      tenant_id: "tenant-1",
      name: "demo-tool",
      url: "https://example.com/demo",
      owner: "tenant-1",
      scopes: ["read"],
      metadata: {},
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    const toolDisabled = { ...toolActive, is_active: false };

    const mockFetchTools = vi.mocked(api.fetchTools);
    const mockDisableTool = vi.mocked(api.disableTool);
    const mockEnableTool = vi.mocked(api.enableTool);

    mockFetchTools
      .mockResolvedValueOnce([toolActive])
      .mockResolvedValueOnce([toolDisabled])
      .mockResolvedValueOnce([toolActive]);

    mockDisableTool.mockResolvedValue(undefined);
    mockEnableTool.mockResolvedValue(undefined);

    render(<ToolTable tenant={"tenant-1"} />);

    const killSwitchButton = await screen.findByRole("button", { name: /kill switch/i });
    await userEvent.click(killSwitchButton);

    await waitFor(() => expect(mockDisableTool).toHaveBeenCalledTimes(1));
    const enableButton = await screen.findByRole("button", { name: /enable/i });

    await userEvent.click(enableButton);
    await waitFor(() => expect(mockEnableTool).toHaveBeenCalledTimes(1));

    expect(mockFetchTools).toHaveBeenCalledTimes(3);
  });
});
