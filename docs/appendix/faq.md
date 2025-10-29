# FAQ

**Is Sentinel MCP production-ready?**
> No. It is an R&D prototype intended to explore control-plane patterns.

**Can I use SQLite instead of Postgres?**
> Not currently; the schema relies on Postgres-specific types (JSONB). Future work could add an abstraction for testing.

**How fast is the kill switch?**
> Local drills complete in milliseconds for state change; adapters must also revoke credentials. Target MTTR is < 5 seconds in production.

**Where are provenance manifests stored?**
> Locally under `.data/provenance`. Replace with object storage or immutable logs (S3 + Glacier, append-only database) for production.

**Do policies support hierarchical budgets?**
> Today only tenant-tool quotas exist. Extend OPA data to include nested budget policies.

**How is authentication handled?**
> Prototype has no auth. Add API keys/OIDC before exposing outside trusted network.

**Can I integrate with SIEM/alerts?**
> Yes—structured logs capture kill events. Ship them to your log pipeline; add webhooks for real-time notifications.

