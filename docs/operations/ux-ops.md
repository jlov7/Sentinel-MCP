# UX Operations Playbook

## Purpose
Define a repeatable UX operations loop so interface quality is continuously measured, not guessed.

## Event Taxonomy
Tracked UI events:
- `health_check`
- `authorize`
- `replay`
- `kill_switch_activate`
- `kill_switch_restore`
- `approval_request`
- `approval_resolve`
- `attest`
- `attestation_verify`
- `evidence_lookup`
- `onboarding_dismiss`
- `feedback_submit`

## Core Funnels
1. Decision funnel: `authorize` -> `approval_request` -> `approval_resolve`
2. Provenance funnel: `attest` -> `attestation_verify`
3. Incident funnel: `evidence_lookup` -> export

## UX SLOs
- Time-to-decision: < 30s
- Time-to-attestation verification: < 60s from decision
- Time-to-evidence replay: < 120s from decision
- Recovery success: > 95% retries for transient UI/API failures

## Weekly Ops Cadence
1. Review funnel drop-off and error concentration.
2. Review operator feedback notes and score distribution.
3. Prioritize backlog items that reduce incident analysis time.
4. Re-run canonical e2e journey and a11y/perf gates.
5. Publish score delta and evidence links.

## Required Artifacts Per Review
- CI run links for lint/test/a11y/e2e/perf
- Before/after screenshots or walkthrough GIF
- Updated task tracker status (`T001-T100`)
- Decision log for accepted tradeoffs

## R&D Disclaimer
This process is part of personal R&D and not employer-affiliated.
