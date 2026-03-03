# Sentinel MCP Admin Console (Mission Control v2)

Operator interface for Sentinel MCP v2 governance workflows.

## What it does
- Executes authenticated governance actions across `/v2/*` APIs.
- Guides operators through canonical journeys: decide, control, approve, attest, replay.
- Surfaces explainability, trust markers, degraded-mode warnings, and trace-linked evidence.
- Captures UX telemetry, onboarding completion, and local feedback notes for UX ops.

## Run locally
```bash
npm install
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8082 npm run dev
```

Optional default bearer token:
```bash
NEXT_PUBLIC_CONTROL_PLANE_BEARER_TOKEN=<jwt>
```

## Quality gates
```bash
npm run lint
npm run test
npm run test:a11y
npm run build
npm run perf:budget
npm run test:e2e
npm run verify:frontend
```

`verify:frontend` runs lint + unit/a11y tests + build + performance budget checks.

## UX architecture
- `src/lib/useMissionControl.ts`: single orchestration hook for API actions, deterministic state, toasts, journey timing, degraded-mode handling.
- `src/components/sections/*`: workflow-specific panels with explicit error/recovery states.
- `src/components/layout/*`: onboarding, breadcrumbs, workflow navigation, runbook progress.
- `src/lib/telemetry.ts`: local event capture used for funnel and outcome metrics.

## First-run journey
1. Authorize a request.
2. Validate kill-switch precedence.
3. Request and resolve approval.
4. Attest and verify provenance.
5. Replay evidence by trace ID and export artifacts.

## Testing details
- Unit + integration: Vitest + Testing Library.
- Accessibility: `jest-axe` gate (`MissionControl.a11y.test.tsx`).
- E2E journey: Playwright (`e2e/mission-control.spec.ts`) with mocked control-plane endpoints.
- Performance budget: chunk-size budget script (`scripts/check-performance-budget.mjs`).

## Note
This is a personal R&D interface and is not affiliated with any employer.
