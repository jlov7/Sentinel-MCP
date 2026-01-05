# Sentinel MCP Documentation

Sentinel MCP is a control plane for AI agents and MCP tools. It enforces policy, budgets, and provenance every time a tool is invoked.

**Project context:** Personal R&D prototype for exploring governance patterns. Not a commercial product.

## Start here

1. **Run the demo:** `demo.md`
2. **Understand the architecture:** `technical/architecture.md`
3. **Set up locally:** `technical/setup.md`

## Who this is for

- **Executives and business leaders:** `governance/executive.md`
- **Platform and security teams:** `operations/security.md`
- **Engineers and builders:** `technical/setup.md`

## Quick navigation

| Goal | Doc |
|------|-----|
| See the system in action | `demo.md` |
| Understand the business case | `governance/executive.md` |
| See how it works technically | `technical/architecture.md` |
| Get set up locally | `technical/setup.md` |
| Write or update policies | `governance/policy-playbook.md` |
| Troubleshoot issues | `operations/runbooks.md` |
| Define key terms | `appendix/glossary.md` |

## Key concepts

- **Control plane model:** Centralized governance between agents and tools.
- **Policy-as-code:** OPA/Rego policies live in version control and can be tested.
- **Provenance:** Every allowed action is signed and verifiable.

## Next steps

- Follow the demo to see kill switch, policy checks, and provenance in action.
- Use the setup guide to run the full stack.
- Use the policy playbook to customize governance rules.
