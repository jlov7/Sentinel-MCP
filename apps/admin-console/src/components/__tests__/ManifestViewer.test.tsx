import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ManifestViewer } from "../ManifestViewer";
import * as api from "../../lib/api";

vi.mock("../../lib/api");

const mockVerifyManifest = vi.mocked(api.verifyManifest);

describe("ManifestViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls verify endpoint and renders response", async () => {
    mockVerifyManifest.mockResolvedValue({
      manifest_id: "abc",
      verified: true,
      manifest: { hello: "world" },
    });

    render(<ManifestViewer />);

    await userEvent.type(screen.getByLabelText(/manifest id/i), "abc");
    await userEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => expect(mockVerifyManifest).toHaveBeenCalledWith("abc"));
    expect(await screen.findByText(/manifest verified/i)).toBeInTheDocument();
    expect(screen.getByText(/"hello": "world"/i)).toBeInTheDocument();
  });
});
