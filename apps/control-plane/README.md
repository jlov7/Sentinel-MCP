# Sentinel MCP Control Plane (Prototype)

FastAPI service exposing registry, policy check, kill-switch, and provenance endpoints. This is a personal R&D build and will evolve rapidly.

## Setup

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e .[dev]
alembic upgrade head
uvicorn sentinel_control_plane.main:app --reload
```

## Environment

Copy `.env.example` from the repo root and ensure `POSTGRES_URL`, `REDIS_URL`, and `SIGNING_KEY` are populated.
