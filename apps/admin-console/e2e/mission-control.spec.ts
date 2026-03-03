import { expect, test } from "@playwright/test";

test("canonical operator journey completes", async ({ page }) => {
  await page.route("**/healthz", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", service: "sentinel-control-plane-v2" }),
    });
  });

  await page.route("**/v2/decisions/authorize", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        decision_id: "dec-1",
        trace_id: "trace-1",
        allow: true,
        reason_code: "ALLOW_POLICY",
        reason: "allow",
        quota_remaining: 98,
        risk_score: 0.12,
        risk_reason_codes: ["LOW_RISK"],
        requires_approval: true,
        attestation_id: null,
      }),
    });
  });

  await page.route("**/v2/approvals/request", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        approval_id: "appr-1",
        tenant_slug: "platform-eng",
        trace_id: "trace-1",
        decision_id: "dec-1",
        state: "pending",
        reason: "manual check",
        requested_by: "operator",
        note: null,
        created_at: "2026-03-03T10:00:00Z",
        expires_at: "2026-03-03T10:10:00Z",
      }),
    });
  });

  await page.route("**/v2/approvals/appr-1/resolve", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        approval_id: "appr-1",
        tenant_slug: "platform-eng",
        trace_id: "trace-1",
        decision_id: "dec-1",
        state: "approved",
        reason: "manual check",
        requested_by: "operator",
        resolved_by: "operator",
        note: "validated",
        created_at: "2026-03-03T10:00:00Z",
        expires_at: "2026-03-03T10:10:00Z",
        resolved_at: "2026-03-03T10:01:00Z",
      }),
    });
  });

  await page.route("**/v2/provenance/attest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        attestation_id: "att-1",
        trace_id: "trace-1",
        issued_at: "2026-03-03T10:01:10Z",
        rekor_log_index: 123,
        rekor_uuid: "uuid-1",
        rekor_log_id: "log-1",
      }),
    });
  });

  await page.route("**/v2/provenance/att-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        attestation: {
          payload_type: "application/vnd.in-toto+json",
          payload: "e30=",
          signatures: [{ keyid: "kid-1", sig: "sig-1" }],
          attestation_id: "att-1",
          trace_id: "trace-1",
          tenant_slug: "platform-eng",
          issued_at: "2026-03-03T10:01:10Z",
          rekor_log_index: 123,
          rekor_uuid: "uuid-1",
          rekor_log_id: "log-1",
          signer_identity: "operator@example.com",
          signer_issuer: "https://issuer.example.com",
        },
      }),
    });
  });

  await page.route("**/v2/provenance/att-1/verify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ attestation_id: "att-1", verified: true, trace_id: "trace-1" }),
    });
  });

  await page.route("**/v2/evidence/trace-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        trace_id: "trace-1",
        events: [
          {
            id: "evt-1",
            trace_id: "trace-1",
            tenant_slug: "platform-eng",
            event_type: "decision.allowed",
            created_at: "2026-03-03T10:00:00Z",
            payload: { reason_code: "ALLOW_POLICY" },
          },
        ],
      }),
    });
  });

  await page.route("**/v2/meta/protocols", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mcp_spec_revision: "2025-11-25", a2a_spec_revision: "latest" }),
    });
  });

  await page.route("**/v2/meta/policy-bundle", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        policy_package: "sentinel/policy",
        bundle_version: "2026.03.03",
        bundle_sha256: "sha256:abc",
      }),
    });
  });

  await page.goto("/");

  await page.getByRole("button", { name: /^Authorize$/ }).click();
  await expect(page.getByText(/"decision_id": "dec-1"/)).toBeVisible();

  await page.getByRole("button", { name: /Request approval/i }).click();
  await expect(page.getByText(/"approval_id": "appr-1"/)).toBeVisible();

  await page.getByRole("button", { name: /^Approve$/ }).click();
  await expect(page.getByText(/"state": "approved"/)).toBeVisible();

  await page.getByRole("button", { name: /^Attest$/ }).click();
  await expect(page.getByText(/"attestation_id": "att-1"/)).toBeVisible();

  await page.getByRole("button", { name: /Verify \+ Load/ }).click();
  await expect(page.getByText(/"verified": true/)).toBeVisible();

  await page.getByRole("button", { name: /Load evidence/i }).click();
  await expect(page.locator(".timeline__item").first()).toContainText("decision.allowed");
  await expect(page.getByText(/Journey complete: Yes/i)).toBeVisible();
});
