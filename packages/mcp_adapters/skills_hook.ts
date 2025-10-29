export type SkillInvocation = {
  tenantSlug: string;
  skill: string;
  payload: Record<string, unknown>;
};

type Fetcher = typeof fetch;

export class SkillsHook {
  private controlPlaneUrl: string;
  private fetcher: Fetcher;

  constructor(controlPlaneUrl: string, fetcher: Fetcher = fetch) {
    this.controlPlaneUrl = controlPlaneUrl.replace(/\/$/, "");
    this.fetcher = fetcher;
  }

  async intercept(invocation: SkillInvocation): Promise<void> {
    const policyRes = await this.fetcher(`${this.controlPlaneUrl}/policy/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_slug: invocation.tenantSlug,
        tool_name: invocation.skill,
        action: "invoke",
        context: invocation.payload,
      }),
    });

    if (!policyRes.ok) {
      throw new Error(`Policy check failed: ${policyRes.status}`);
    }

    const decision = await policyRes.json();
    if (!decision.allow) {
      throw new Error(decision.reason ?? "Skill invocation denied");
    }
  }
}
