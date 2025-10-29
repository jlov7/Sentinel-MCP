FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy shared tooling configs and packages
COPY pyproject.toml /workspace/pyproject.toml
COPY packages /workspace/packages
COPY config/sample-policies.rego /workspace/config/sample-policies.rego

# Copy control plane sources
COPY apps/control-plane/pyproject.toml ./pyproject.toml
COPY apps/control-plane/src ./src
COPY apps/control-plane/README.md ./README.md
COPY apps/control-plane/alembic.ini ./alembic.ini
COPY apps/control-plane/alembic ./alembic

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e . \
    && pip install --no-cache-dir -e /workspace/packages/policy_engine/python \
    && pip install --no-cache-dir -e /workspace/packages/provenance

EXPOSE 8000

CMD ["uvicorn", "sentinel_control_plane.main:app", "--host", "0.0.0.0", "--port", "8000"]
