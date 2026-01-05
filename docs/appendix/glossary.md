# Glossary

## Core Concepts

### Sentinel MCP

**Control plane for AI agents** that provides governance, security, and compliance. Sits between AI agents and tools, enforcing policies, tracking provenance, and enabling instant control through kill switches.

**Think of it as:** Air traffic control for your AI tool ecosystem.

### Control Plane

A centralized system that manages policy enforcement, tool inventory, and audit logging. All agent-to-tool interactions flow through the control plane, ensuring consistent governance.

**Why it matters:** Enables runtime governance for autonomous systems where traditional security models don't work.

### AI Agent

An autonomous software system that can make decisions, use tools, and take actions without human intervention for each step. Examples include ChatGPT Actions, Claude Tools, and LangGraph workflows.

**Key characteristics:**
- Autonomous decision-making
- Tool usage capabilities
- Unpredictable behavior
- Infinitely scalable

### Model-Context Protocol (MCP)

A protocol for agent tools/skills to register capabilities and exchange structured context. Enables dynamic tool discovery and integration.

**Relevance:** Sentinel MCP governs MCP servers and skills, ensuring they're used safely and compliantly.

## Policy & Governance

### Policy Engine

The component that evaluates authorization requests against policies. Sentinel MCP uses Open Policy Agent (OPA) as its policy engine.

**How it works:**
1. Receives authorization request with context
2. Evaluates policies written in Rego
3. Returns allow/deny decision with reasoning

### Rego

The policy language used by Open Policy Agent. Declarative language for expressing authorization policies.

**Example:**
```rego
allow {
    input.tool in data.allowed_tools[input.tenant]
    input.usage < data.quotas[input.tenant][input.tool]
}
```

**Why Rego:**
- Policy-as-code (version control, testing)
- Declarative (describe "what" not "how")
- Fast evaluation (microseconds)

### Policy-as-Code

Storing policies as code files (e.g., Rego files) rather than configuration UIs or databases.

**Benefits:**
- Version control (Git)
- Automated testing
- GitOps deployment
- Consistency across environments

### RBAC (Role-Based Access Control)

Access control based on roles assigned to users/agents. Example: "Only agents with 'admin' role can use 'delete-user' tool."

**In Sentinel MCP:** Policies can check roles as part of authorization decisions.

### ABAC (Attribute-Based Access Control)

Access control based on attributes (properties) of the request, user, resource, or environment. Example: "Agents can only use 'customer-api' during business hours."

**In Sentinel MCP:** Policies can check any attribute (tenant, tool, purpose, time, context).

### Quota

A limit on resource usage, typically enforced per tenant, tool, and time period. Example: "Maximum 1,000 API calls per day per team."

**Purpose:** Prevent budget overruns and resource exhaustion.

**In Sentinel MCP:** Quotas are enforced through policy evaluation.

## Security & Compliance

### Kill Switch

An emergency mechanism to instantly disable a tool system-wide. When triggered, the tool is marked inactive, credentials are revoked, and all future requests are denied.

**Target MTTR:** < 5 seconds from trigger to system-wide disablement.

**Use cases:**
- Security incidents
- Budget emergencies
- Compliance violations
- Testing and drills

### Provenance

A cryptographically signed record proving that an action occurred, who performed it, when it happened, and whether it was authorized.

**Components:**
- Action metadata (what, who, when)
- Cryptographic signature (non-repudiation)
- Authorization proof (policy decision)

**Use cases:**
- Compliance audits
- Forensic investigations
- Accountability
- Trust verification

### Provenance Manifest

A structured document containing provenance information for a specific action. Cryptographically signed to ensure integrity.

**Structure:**
```json
{
  "id": "manifest-uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant": "platform-eng",
  "tool": "customer-api",
  "action": "invoke",
  "authorized": true,
  "signature": "..."
}
```

### C2PA (Coalition for Content Provenance and Authenticity)

A standard for content provenance, specifying how to create and verify provenance manifests. Sentinel MCP uses C2PA-style manifests.

**Why it matters:** Industry-standard format ensures interoperability and compliance.

### Non-Repudiation

A cryptographic property ensuring that an action cannot be denied. Cryptographic signatures provide non-repudiation—you can prove who signed what.

**In Sentinel MCP:** Provenance manifests are cryptographically signed, providing non-repudiation.

### Audit Trail

A chronological record of all actions and decisions, stored for compliance and investigation purposes.

**In Sentinel MCP:**
- Policy decisions logged
- Kill-switch events logged
- Provenance manifests stored
- Structured logs for querying

## Technology Stack

### Open Policy Agent (OPA)

Open-source policy engine used by Sentinel MCP. Evaluates policies written in Rego and returns authorization decisions.

**Key features:**
- Fast evaluation (microseconds)
- Language-agnostic (REST API)
- Policy-as-code support
- Proven at scale

### FastAPI

Modern Python web framework used for the Sentinel MCP control plane API.

**Why FastAPI:**
- Async/await support
- Automatic OpenAPI documentation
- Type hints and validation
- High performance

### SQLAlchemy

Python SQL toolkit and ORM used for database operations in Sentinel MCP.

**Why SQLAlchemy:**
- Database abstraction
- Migration support (Alembic)
- Type safety
- Mature ecosystem

### PostgreSQL

Relational database used by Sentinel MCP for storing tenants, tools, policy logs, and audit data.

**Why PostgreSQL:**
- JSONB support (flexible metadata)
- ACID compliance (critical for audit logs)
- Mature ecosystem
- Production-ready

### Redis

In-memory data store used for caching and future rate limiting in Sentinel MCP.

**Planned uses:**
- Rate limit counters
- Kill-switch broadcast cache
- Policy decision cache

### Structlog

Python structured logging library used by Sentinel MCP for queryable, JSON-formatted logs.

**Benefits:**
- Structured output (JSON)
- Context preservation
- Queryable logs
- SIEM integration

### OpenTelemetry (OTel)

Observability framework for generating traces, metrics, and logs. Sentinel MCP uses OTel for distributed tracing.

**Benefits:**
- Standardized observability
- Vendor-agnostic
- Rich context propagation

### Sigstore

Open-source signing infrastructure providing public-key infrastructure for software signing. Future target for Sentinel MCP provenance.

**Components:**
- Cosign (signing tool)
- Rekor (transparency log)
- Fulcio (certificate authority)

**Why Sigstore:**
- Public-key infrastructure
- Transparency logs
- Industry standard

## Agent Frameworks

### AgentKit (OpenAI)

OpenAI's framework for building AI agents with tool usage capabilities.

**In Sentinel MCP:** `agentkit_adapter.py` integrates AgentKit agents with Sentinel MCP governance.

### LangGraph

A framework for building stateful, multi-actor applications with LLMs.

**In Sentinel MCP:** `langgraph_middleware.py` provides middleware for LangGraph applications.

### Claude Skills

Anthropic's framework for extending Claude with custom capabilities.

**In Sentinel MCP:** `skills_hook.ts` provides a TypeScript hook for Claude Skills integration.

### MCP Server

A server implementing the Model-Context Protocol, exposing tools and capabilities to agents.

**In Sentinel MCP:** MCP servers are registered and governed through the control plane.

## Operations

### MTTR (Mean Time To Recovery)

The average time to recover from an incident. For kill switches, Sentinel MCP targets < 5 seconds MTTR.

**Components:**
- Detection time
- Response time
- Recovery time

### Chaos Engineering

The practice of intentionally introducing failures to test system resilience.

**In Sentinel MCP:** `chaos_kill.sh` performs kill-switch drills to verify system behavior.

### Shadow IT

Technology solutions deployed by teams without central IT approval or oversight.

**Problem:** Creates security blind spots and compliance gaps.

**Solution:** Sentinel MCP's registry discovers and governs all tools, eliminating shadow IT.

### GitOps

A methodology for managing infrastructure and applications using Git as the source of truth.

**In Sentinel MCP:** Policies can be managed via GitOps workflows, with automated testing and deployment.

## Compliance & Governance

### SOC 2

A compliance framework for security, availability, processing integrity, confidentiality, and privacy.

**Relevance:** Sentinel MCP's audit trails and provenance support SOC 2 compliance.

### HIPAA

Health Insurance Portability and Accountability Act, governing healthcare data protection.

**Relevance:** Sentinel MCP can enforce policies preventing unauthorized access to patient data.

### Compliance Audit

A review process to verify adherence to regulations and standards.

**How Sentinel MCP helps:**
- Complete audit trails
- Cryptographic proof of actions
- Policy enforcement evidence
- Usage tracking and reporting

### RBAC vs ABAC

**RBAC:** Role-based (simpler, less flexible)
**ABAC:** Attribute-based (more flexible, more complex)

**In Sentinel MCP:** Policies can implement both RBAC and ABAC patterns, or combine them.

## AI/ML Terms

### LLM (Large Language Model)

A type of AI model trained on vast amounts of text data. Examples: GPT-4, Claude, Llama.

**Relevance:** LLMs power AI agents, which Sentinel MCP governs.

### Multi-Agent System

A system where multiple AI agents collaborate to accomplish tasks.

**Challenge:** Requires coordination and governance.

**Solution:** Sentinel MCP provides centralized governance for multi-agent systems.

### Tool Calling

The capability of AI agents to invoke external tools (APIs, functions, scripts) to extend their capabilities.

**In Sentinel MCP:** All tool calls are governed through policy enforcement.

### Prompt Injection

A security vulnerability where malicious input tricks an AI system into unintended behavior.

**Mitigation:** Sentinel MCP's policy enforcement sits between agents and tools, preventing unauthorized actions regardless of prompt content.

### Hallucination

When an AI model generates incorrect or fabricated information.

**Relevance:** While Sentinel MCP doesn't prevent hallucinations, it ensures that even hallucinated tool calls are properly governed.

### Fine-Tuning

The process of training an AI model on additional data to improve performance on specific tasks.

**Note:** Sentinel MCP operates at the runtime governance layer, independent of model training.

## Architecture Terms

### Sidecar Pattern

A deployment pattern where a helper container runs alongside the main application container.

**In Sentinel MCP:** OPA can run as a sidecar alongside the control plane for reduced latency.

### Microservices

An architectural approach where applications are built as small, independent services.

**In Sentinel MCP:** Control plane is designed as a microservice, enabling horizontal scaling.

### Service Mesh

A dedicated infrastructure layer for managing service-to-service communication.

**Future:** Sentinel MCP could integrate with service meshes for mTLS and advanced routing.

### API Gateway

A service that sits between clients and backend services, providing routing, authentication, rate limiting, etc.

**Difference:** Sentinel MCP is agent-aware and policy-driven, whereas traditional API gateways are user-focused.

## Metrics & Observability

### P50, P95, P99

Percentiles indicating latency distribution:
- **P50:** Median latency (50% of requests)
- **P95:** 95th percentile (95% of requests faster)
- **P99:** 99th percentile (99% of requests faster)

**In Sentinel MCP:** Policy check latency targets < 10ms p95.

### Throughput

The number of requests processed per second.

**In Sentinel MCP:** Target: 1000+ policy checks/second per instance.

### Latency

The time taken to process a request.

**In Sentinel MCP:** Policy check adds < 10ms typically.

---

**Need more terms?** Check the [full documentation](../index.md) or open an issue on GitHub.
