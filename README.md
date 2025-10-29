# Sentinel MCP 🛡️

> **Governance for the Age of AI Agents**

[![CI](https://github.com/jlov7/Sentinel-MCP/actions/workflows/ci.yml/badge.svg)](https://github.com/jlov7/Sentinel-MCP/actions/workflows/ci.yml)

Sentinel MCP is a **control plane for AI agents** that brings enterprise-grade governance, security, and auditability to Model-Context Protocol (MCP) servers and agent skills. Think of it as the "air traffic control" for your AI tool ecosystem—ensuring every tool invocation is authorized, monitored, and auditable.

## 🌟 Why This Matters Now

**The AI agent revolution is here.** Organizations are deploying AI agents that can autonomously use tools, access APIs, and make decisions. But there's a critical gap: **who's in control?**

### The Problem We're Solving

In 2024, AI agents are proliferating across enterprises:
- **ChatGPT Actions** and **Claude Tools** enable agents to call APIs automatically
- **OpenAI's AgentKit** and **LangGraph** orchestrate complex multi-tool workflows  
- **MCP servers** expose capabilities that agents can discover and use dynamically

**But what happens when:**
- 🤖 An agent tries to use a tool it shouldn't have access to?
- 💰 Tool usage exceeds budgets, causing unexpected costs?
- 🚨 A security incident requires immediately disabling a tool?
- 📋 Compliance auditors need proof of what actions were taken?

**Traditional security models don't work for AI agents.** Agents aren't human users—they make decisions autonomously, scale instantly, and can't be "trained" like employees. You need **runtime governance** that sits between the agent and the tool.

### What Sentinel MCP Provides

Sentinel MCP solves this by implementing a **policy-driven control plane** that:

✅ **Inventories & Authorizes** – Every tool must register and pass policy checks before use  
✅ **Enforces Budgets** – Prevents runaway costs with quota management  
✅ **Kill Switch Capability** – Disable tools instantly in emergencies  
✅ **Provenance Tracking** – Cryptographic proof of every action for compliance  
✅ **Multi-Framework Support** – Works with AgentKit, LangGraph, Claude Skills, and custom adapters

## 🎯 Who Is This For?

**For Technical Teams:**
- Platform engineers building AI agent infrastructure
- Security teams needing governance for autonomous systems
- DevOps engineers managing agent deployments

**For Business Leaders:**
- CTOs/CIOs evaluating AI agent security
- Risk officers concerned about compliance and auditability
- Product leaders shipping AI-powered features

**For Researchers:**
- AI safety researchers exploring governance patterns
- Organizations prototyping agent systems
- Anyone exploring policy-as-code for AI agents

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/jlov7/Sentinel-MCP.git
cd Sentinel-MCP

# Set up environment
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD

# Install dependencies
make install
source .venv/bin/activate

# Run tests
pytest
cd apps/admin-console && npm install && npm run lint && npm run test

# Start the stack
./scripts/dev_up.sh

# Access the admin console
cd apps/admin-console
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:8000 npm run dev
```

Visit `http://localhost:3000` to see the admin console, or explore the API at `http://localhost:8000/docs`.

## 📖 Documentation

**New to Sentinel MCP?** Start with the [Executive Brief](docs/governance/executive.md) for the business case, or jump into [Architecture](docs/technical/architecture.md) for technical details.

**Full documentation:**
- 📘 [Overview](docs/index.md) – Complete documentation index
- 🏛️ [Executive Brief](docs/governance/executive.md) – Business value and adoption
- 🏗️ [Architecture](docs/technical/architecture.md) – System design and components
- 🔧 [Setup Guide](docs/technical/setup.md) – Installation and deployment
- 📋 [Policy Playbook](docs/governance/policy-playbook.md) – Writing and managing policies
- 🔒 [Security Guide](docs/operations/security.md) – Threat model and hardening
- 🛠️ [Runbooks](docs/operations/runbooks.md) – Operational procedures

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│           AI Agents (AgentKit, LangGraph, etc.)      │
└────────────────────┬──────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │   Sentinel MCP Control     │
         │         Plane              │
         │                            │
         │  • Registry & Inventory    │
         │  • Policy Engine (OPA)     │◀── Admin Console
         │  • Kill Switch             │
         │  • Provenance Signer       │
         │  • Audit Logging           │
         └───────────┬────────────────┘
                     │
         ┌───────────▼───────────┐
         │   Tool/API Layer      │
         │  (MCP Servers, APIs)  │
         └───────────────────────┘
```

**How it works:**
1. **Agent requests tool** → Adapter intercepts
2. **Policy check** → Control plane evaluates permissions
3. **Allow/Deny** → Based on identity, quota, purpose
4. **Provenance signing** → Cryptographic proof created
5. **Audit logging** → Everything recorded

## 🎨 Key Features

### 📋 Registry & Inventory
- Central catalog of all MCP servers and skills
- Health monitoring and status tracking
- Ownership and scope management

### ⚖️ Policy Engine
- **OPA-based** policy evaluation (Rego language)
- **RBAC + ABAC** support (role-based and attribute-based access control)
- **Quota enforcement** – prevent budget overruns
- **Purpose validation** – ensure tools used for intended purpose

### 🚨 Kill Switch
- Instant tool disabling for security incidents
- Credential revocation via adapter hooks
- One-click restore when safe
- Audit trail of all kill/restore operations

### 🔐 Provenance & Compliance
- **C2PA-style manifests** for every action
- Cryptographic signatures
- Verification endpoints and UI widget
- Compliance-ready audit trails

### 🔌 Multi-Framework Adapters
- **OpenAI AgentKit** adapter
- **LangGraph** middleware
- **Claude Skills** hook
- Easy to extend for custom frameworks

## 📊 Current Status

**Status:** 🧪 **R&D Prototype** – Active development

**What's Working:**
- ✅ Control plane API (FastAPI) with core endpoints
- ✅ Policy engine integration with OPA
- ✅ Provenance signer/verifier
- ✅ Agent adapters (AgentKit, LangGraph, Claude Skills)
- ✅ Admin console (Next.js)
- ✅ Test suite (unit, API, E2E)
- ✅ CI/CD workflows
- ✅ Docker Compose development environment

**Roadmap:**
- 🔄 Production hardening (auth, TLS, secrets management)
- 🔄 Advanced policy features (hierarchical budgets, time-based rules)
- 🔄 Enhanced observability (OTel exports, SIEM integration)
- 🔄 Sigstore integration for provenance
- 🔄 Terraform modules for cloud deployment

## 🛠️ Development Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Policy Engine:** Open Policy Agent (OPA)
- **Frontend:** Next.js, React, TypeScript
- **Testing:** Pytest, Vitest
- **Docs:** MkDocs with Material theme

## 🔧 Development Commands

```bash
# Install dependencies
make install

# Run tests
pytest                           # Backend tests
cd apps/admin-console && npm test  # Frontend tests

# Start development stack
./scripts/dev_up.sh              # Start services
./scripts/dev_down.sh            # Stop services

# Run chaos drills
make chaos CHAOS_CYCLES=3        # Kill/restore drills

# Build documentation
make docs-build                  # Build docs
make docs-serve                  # Serve locally

# Generate coverage report
make coverage
```

## 🌍 Real-World Use Cases

**Financial Services:**
- Prevent AI agents from accessing sensitive trading APIs without approval
- Enforce daily spending limits on paid API calls
- Generate compliance reports proving only authorized actions occurred

**Healthcare:**
- Restrict patient data access to authorized AI tools only
- Immediately disable tools if HIPAA violations detected
- Maintain audit trails for regulatory compliance

**Enterprise SaaS:**
- Prevent agents from using expensive APIs during off-hours
- Quickly disable compromised tools during security incidents
- Track tool usage for cost allocation across teams

**AI Research:**
- Safely test experimental agents with strict policy boundaries
- Monitor tool usage patterns for research insights
- Ensure reproducibility with provenance tracking

## 🤝 Contributing

Contributions welcome! This is a learning project exploring governance patterns for AI agents. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Areas we'd love help with:**
- Additional agent framework adapters
- Policy templates for common scenarios
- Enhanced observability and monitoring
- Documentation improvements
- Test coverage expansion

## 📝 License

Apache License 2.0 – See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) – Modern Python web framework
- [Open Policy Agent](https://www.openpolicyagent.org/) – Policy engine
- [Next.js](https://nextjs.org/) – React framework
- And many other open-source projects

## 📬 Questions?

- 📖 Check the [FAQ](docs/appendix/faq.md)
- 📚 Read the [full documentation](docs/index.md)
- 🐛 Open an [issue](https://github.com/jlov7/Sentinel-MCP/issues)

---

**Built with ❤️ to make AI agents safer, more controllable, and more trustworthy.**
