# Sentinel MCP Admin Console (Prototype)

Personal R&D front-end for managing tool inventory, policies, and kill-switch actions.

## Scripts

- `npm install`
- `NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev`

### What works today

- Tenant selector populated from `/register/tenants`.
- Tool inventory table with kill-switch button invoking `/kill` and enable button using `/kill/restore`.
- Policy probe form calling `/policy/check` for the selected tenant.

The console will evolve into a policy IDE with provenance dashboards.
