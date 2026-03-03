# Glossary

## Agent Runtime
System that plans and executes actions using tools (for example MCP/A2A-aware frameworks).

## Control Plane
Central policy enforcement boundary between agents and tools.

## Decision Trace
Full chain of decision-related events identified by a shared `trace_id`.

## DSSE
Dead Simple Signing Envelope format used for cryptographically signed attestation payloads.

## Provenance Attestation
Signed record that links intent, decision, and outcome metadata.

## Rekor
Transparency log used to anchor signing events and support independent verification.

## Rekor UUID
Identifier for a transparency log entry when available.

## Rekor Log ID
Identifier for the transparency log key identity (`log_id.key_id`) captured in keyless bundle metadata.

## OPA / Rego
Policy engine and language used for deterministic authorization logic.

## Kill Switch
Operator control that denies tool invocation regardless of policy allow.

## Approval Workflow
Human or automated interrupt path for high-risk actions requiring explicit resolution.

## Replay Token
Nonce-like token used to prevent duplicate decision replays.

## Fail-Closed
Security posture where uncertain or degraded states default to deny.

## Release Gate
Deterministic pre-release quality pipeline with machine-readable report output.
