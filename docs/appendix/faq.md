# Frequently Asked Questions

## Project Status

### Is this a commercial product?

**No.** This is a **personal R&D exploration project**, not a commercial product. I am **not seeking to develop this into a product** or commercialize it. This project represents my passion for AI governance and continuous exploration of how to make autonomous systems safer and more controllable. It's shared openly for learning, research, and community discussion.

### What's the purpose of this project?

This project is an exploration of governance patterns for AI agents—born from curiosity, passion, and continuous learning. The goal is to advance understanding of how to govern autonomous systems, share ideas with the community, and contribute to the broader conversation about AI agent safety and controllability.

## General Questions

### What is Sentinel MCP?

Sentinel MCP is a **control plane for AI agents** that provides governance, security, and compliance for autonomous systems. It sits between AI agents and the tools they want to use, enforcing policies, tracking provenance, and enabling instant control through kill switches.

**Think of it as:** A security guard, budget manager, and compliance auditor all rolled into one system, specifically designed for AI agents.

### Is Sentinel MCP production-ready?

**Status:** 🧪 **R&D Prototype** – Active development

**What's working:**
- ✅ Core control plane functionality
- ✅ Policy engine integration
- ✅ Kill switch capability
- ✅ Provenance signing
- ✅ Multi-framework adapters
- ✅ Admin console

**What needs work for production:**
- 🔄 Authentication/authorization (currently open)
- 🔄 Production-grade secrets management
- 🔄 Sigstore integration for provenance
- 🔄 Enhanced observability
- 🔄 Performance optimization

**Recommendation:** Use for R&D, pilot projects, and learning. For production deployments, plan for additional hardening (see [Security Guide](operations/security.md)).

### How does Sentinel MCP differ from API gateways?

**API gateways** are designed for human users and traditional applications. Sentinel MCP is designed specifically for **AI agents** with unique challenges:

| Feature | API Gateway | Sentinel MCP |
|---------|-------------|--------------|
| **Designed for** | Human users, traditional apps | AI agents |
| **Policy evaluation** | Basic auth/rate limiting | Rich context-aware policies |
| **Provenance** | Logs only | Cryptographic signatures |
| **Kill switch** | Manual or complex | Instant, system-wide |
| **Agent awareness** | No | Yes (framework adapters) |

**Key difference:** Sentinel MCP understands that agents are autonomous, unpredictable, and need runtime governance.

### Can I use SQLite instead of PostgreSQL?

**Not currently.** The schema relies on PostgreSQL-specific features:
- **JSONB** for flexible metadata storage
- **Advanced indexing** for performance
- **ACID compliance** for audit logs

**For testing:** Consider using PostgreSQL in Docker for local development.

**Future:** Could add SQLite support for testing, but PostgreSQL is recommended for any real usage.

## Real-World Scenarios

### Scenario: "An agent is making too many API calls and exceeding our budget"

**Problem:** Your AI agent is calling an expensive API repeatedly, running up costs.

**Solution:**
1. **Define a quota policy:**
   ```rego
   quota := data.quotas[input.tenant][input.tool]
   input.usage < quota
   ```

2. **Set quotas in OPA data:**
   ```json
   {
     "quotas": {
       "platform-eng": {
         "openai-gpt4": 1000
       }
     }
   }
   ```

3. **Result:** When quota is exceeded, requests are denied with clear messaging.

**Business value:** Prevents budget overruns automatically, no manual intervention needed.

### Scenario: "We need to prove compliance during an audit"

**Problem:** Auditor asks: "Can you prove which actions were authorized?"

**Solution:**
1. **Every action generates a provenance manifest:**
   ```json
   {
     "id": "manifest-123",
     "tenant": "platform-eng",
     "tool": "customer-api",
     "action": "invoke",
     "authorized": true,
     "signature": "...",
     "timestamp": "2024-01-15T10:30:00Z"
   }
   ```

2. **Manifests are cryptographically signed** (non-repudiation)

3. **Export manifests for audit window:**
   ```bash
   # Query database for manifests in date range
   SELECT * FROM provenance_manifests 
   WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31'
   ```

**Business value:** Pass compliance audits with cryptographic proof, not just logs.

### Scenario: "A security incident requires immediately disabling a tool"

**Problem:** Security team detects suspicious activity. Need to block tool access NOW.

**Solution:**
1. **Trigger kill switch:**
   ```bash
   curl -X POST http://control-plane:8000/kill \
     -H "Content-Type: application/json" \
     -d '{"tenant": "platform-eng", "tool": "compromised-tool"}'
   ```

2. **What happens:**
   - Tool marked as `is_active = false` in database (< 100ms)
   - Adapters notified via hooks (< 1s)
   - All future policy checks deny immediately
   - Audit log entry created

3. **Target MTTR:** < 5 seconds from incident to tool disablement

**Business value:** Respond to incidents instantly, reducing breach impact.

### Scenario: "Teams are deploying agents without coordination"

**Problem:** Shadow IT—teams deploying agents and tools without central oversight.

**Solution:**
1. **Register all tools:**
   ```bash
   curl -X POST http://control-plane:8000/register \
     -H "Content-Type: application/json" \
     -d '{
       "tenant": "team-alpha",
       "name": "unsanctioned-tool",
       "url": "https://api.example.com",
       "owner": "team-alpha@company.com"
     }'
   ```

2. **Discover existing tools:**
   ```bash
   curl http://control-plane:8000/register?tenant_slug=team-alpha
   ```

3. **Apply governance:**
   - Write policies for discovered tools
   - Enforce quotas
   - Monitor usage

**Business value:** Eliminate shadow IT, enable proper governance.

## Technical Questions

### How fast is the kill switch?

**Local testing:** < 1 second  
**Production target:** < 5 seconds end-to-end

**Breakdown:**
- Database update: < 100ms
- State propagation: < 1s
- Adapter notification: < 1s
- Full system propagation: < 5s

**Factors affecting speed:**
- Database latency
- Network latency to adapters
- Adapter implementation quality

**Note:** Kill switch speed depends on adapter implementation. Ensure adapters check kill-switch state frequently.

### Where are provenance manifests stored?

**Current (R&D):**
- Local filesystem: `.data/provenance/`
- Simple file-based storage

**Production recommendations:**
- **Immutable storage:** S3 + Glacier for long-term retention
- **Database:** PostgreSQL JSONB column for queryable storage
- **Transparency log:** Sigstore Rekor for public verification

**Why immutable storage matters:**
- Compliance requires non-repudiation
- Can't delete or modify past manifests
- Append-only ensures audit integrity

### Do policies support hierarchical budgets?

**Current:** Flat quotas per tenant-tool pair

**Example:**
```json
{
  "quotas": {
    "platform-eng": {
      "openai-gpt4": 1000
    }
  }
}
```

**Future (planned):**
- Hierarchical budgets (org → team → tool)
- Time-based quotas (per day, per month)
- Shared quotas across tools

**Workaround today:**
- Use Rego policies to implement custom logic
- Track usage in external system
- Pre-aggregate quotas

### How is authentication handled?

**Current:** ❌ No authentication (prototype)

**Production requirements:**
- API keys for service-to-service auth
- OIDC for admin console
- mTLS for service mesh environments

**Security note:** Never expose control plane without authentication in production.

### Can I integrate with SIEM/alerts?

**Yes!** Multiple integration points:

1. **Structured logs:**
   ```json
   {
     "event": "kill_switch.disabled",
     "tenant": "platform-eng",
     "tool": "compromised-tool",
     "reason": "security_incident"
   }
   ```
   Ship these to your SIEM (Splunk, Datadog, etc.)

2. **Policy logs:**
   Query `policy_logs` table for policy decisions

3. **Future webhooks:**
   Real-time notifications for kill-switch events (planned)

**Example integration:**
```python
# Forward logs to SIEM
import structlog
from your_siem import forward_log

logger = structlog.get_logger()
logger.info("kill_switch.disabled", 
           tenant="platform-eng",
           tool="compromised-tool")
# SIEM forwarder picks up structured log
```

### How do I add support for a new agent framework?

**Steps:**

1. **Create adapter:**
   ```python
   # packages/mcp_adapters/my_framework_adapter.py
   class MyFrameworkAdapter:
       async def invoke_tool(self, tool_name, params):
           # Check policy
           decision = await control_plane.check_policy(...)
           if not decision.allow:
               raise PolicyDenied(decision.reason)
           
           # Invoke tool
           result = await actual_tool_call(tool_name, params)
           
           # Sign provenance
           manifest = await control_plane.sign_provenance(...)
           
           return result
   ```

2. **Integrate with framework:**
   - Hook into framework's tool invocation point
   - Use adapter for all tool calls

3. **Test:**
   - Write unit tests
   - Test policy enforcement
   - Test kill-switch behavior

**See existing adapters for examples:**
- `agentkit_adapter.py` – OpenAI AgentKit
- `langgraph_middleware.py` – LangGraph
- `skills_hook.ts` – Claude Skills

## Deployment Questions

### Can I deploy this in Kubernetes?

**Yes!** Sentinel MCP is containerized and Kubernetes-ready.

**Components:**
- Control plane: FastAPI app (Dockerfile included)
- OPA: Sidecar or separate service
- Database: External managed PostgreSQL
- Admin console: Static site on CDN

**See:**
- `apps/control-plane/Dockerfile` for container build
- `infra/terraform/` (stub) for infrastructure as code

**Production considerations:**
- Use managed databases (RDS, Cloud SQL)
- Configure secrets management (Vault, Secrets Manager)
- Set up monitoring and alerting
- Use service mesh for mTLS (optional)

### What are the resource requirements?

**Minimum (development):**
- CPU: 2 cores
- Memory: 4GB
- Storage: 10GB

**Recommended (production):**
- CPU: 4+ cores
- Memory: 8GB+
- Storage: 100GB+ (for audit logs)

**Scaling:**
- Control plane: Horizontal scaling (stateless)
- Database: Read replicas for reporting
- OPA: Scales horizontally (stateless)

### How do I handle secrets in production?

**Current (R&D):**
- Environment variables in `.env`

**Production recommendations:**
- **HashiCorp Vault:** Inject secrets at runtime
- **Cloud Secrets Manager:** AWS Secrets Manager, GCP Secret Manager
- **Kubernetes Secrets:** Use with external secrets operator
- **Rotation:** Automated rotation schedules

**Secrets to manage:**
- Database credentials
- Signing keys
- API keys (if using external services)
- OPA bundle encryption keys

## Policy Questions

### How do I write effective policies?

**Start simple:**
```rego
default allow := false

allow {
    input.tool in data.allowed_tools[input.tenant]
}
```

**Add complexity gradually:**
- Quota checks
- Purpose validation
- Time-based rules
- Context-aware decisions

**See:** [Policy Playbook](governance/policy-playbook.md) for examples and best practices.

### Can policies be tested?

**Yes!** Multiple approaches:

1. **OPA test files:**
   ```rego
   test_allowed {
       allow with input as {
           "tenant": "platform-eng",
           "tool": "allowed-tool"
       }
   }
   ```

2. **Integration tests:**
   ```python
   def test_policy_allows_valid_request():
       response = client.post("/policy/check", json={...})
       assert response.json()["allow"] == True
   ```

3. **Policy probes in admin console:**
   - Test policies before deployment
   - Validate behavior

### How do I update policies?

**Development:**
- Edit Rego files in `opa/`
- Restart OPA container
- Policies reload automatically

**Production (recommended):**
- GitOps workflow
- Policy bundles from Git
- Automated testing before deployment
- Rollback capability

**Process:**
1. Edit policies in Git
2. CI runs tests
3. Bundle created on success
4. Deployed to OPA
5. Verified in staging first

## Performance Questions

### What's the latency impact?

**Policy check overhead:**
- OPA evaluation: < 1ms typically
- Database query: < 5ms typically
- **Total:** < 10ms p95

**For comparison:**
- Typical API call: 50-500ms
- Policy check overhead: ~2-5% of total latency

**Optimization:**
- Policy decision caching (future)
- Database connection pooling
- OPA sidecar (reduces network latency)

### How many policy checks per second?

**Target:** 1000+ policy checks/second per control plane instance

**Scaling:**
- Horizontal scaling (stateless design)
- Load balancer distribution
- Database connection pooling
- OPA scales independently

**Bottlenecks:**
- Database write capacity (policy logs)
- Network bandwidth
- OPA evaluation (rarely)

## Troubleshooting

### Policy denies expected action

**Debugging steps:**

1. **Check policy logs:**
   ```sql
   SELECT decision, reason, created_at 
   FROM policy_logs 
   ORDER BY created_at DESC LIMIT 10;
   ```

2. **Test policy directly:**
   ```bash
   opa eval \
     --data opa/data.json \
     --input input.json \
     'data.sentinel.policy.allow'
   ```

3. **Verify input:**
   - Check tenant/tool names match
   - Verify quotas in OPA data
   - Check purpose values

**See:** [Runbooks](operations/runbooks.md) for detailed troubleshooting.

### Kill switch not working

**Symptoms:** Tool remains accessible after kill-switch trigger

**Check:**
1. Is tool marked as `is_active = false` in database?
2. Are adapters checking kill-switch state?
3. Are adapters receiving kill notifications?
4. Is there cached state?

**Debug:**
```bash
# Check database state
curl http://control-plane:8000/register?tenant_slug=platform-eng

# Check adapter logs
# Look for kill-switch signals

# Verify policy checks
# Should deny when is_active = false
```

**See:** [Runbooks](operations/runbooks.md) for detailed procedures.

## Still Have Questions?

- 📖 Check the [full documentation](index.md)
- 🐛 Open an issue on GitHub
- 💬 Review [Runbooks](operations/runbooks.md) for operational questions
