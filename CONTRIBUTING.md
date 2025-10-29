# Contributing to Sentinel MCP (Personal R&D)

**⚠️ Project Context:** This is a personal R&D exploration project, not a commercial product. I am not seeking to develop this into a product or commercialize it. This project represents my passion for AI governance and continuous exploration of how to make autonomous systems safer and more controllable.

Thanks for exploring this experimental control-plane project. Contributions keep the R&D momentum going and are always welcome—whether code, documentation, ideas, or feedback.

## Getting started

1. Clone the repo and create a virtual environment (`python -m venv .venv`).
2. Install the control plane package in editable mode: `pip install -e apps/control-plane[dev]`.
3. Install and run pre-commit: `pre-commit install`.
4. Run `make lint` and `make test` before opening a pull request.

## Coding guidelines

- Python 3.11+, FastAPI for the control plane, Ruff for linting, Black for formatting.
- Type hints required for new Python code; keep functions small and testable.
- Favor dependency injection for adapters, policy clients, and storage abstractions.
- Use TODO comments sparingly and include owner/intent (e.g., `# TODO(jason): tighten quota logic`).
- Keep documentation up to date with code changes.

## Tests

- Unit tests live under `tests/unit`, agent/e2e flows under `tests/e2e`, chaos drills under `tests/chaos`.
- Prefer pytest fixtures for database and adapter mocks.
- Include regression cases for policy enforcement, kill-switch propagation, and provenance signatures when touching those areas.

## Commit messages & branches

- Conventional commits (`feat:`, `fix:`, `chore:`) help keep the history readable.
- Feature branches encouraged (`feature/policy-graph`).

## Contact

Open an issue or start a discussion in GitHub if something is unclear – this is a passion project with plenty of room for ideas.
