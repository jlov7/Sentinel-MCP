.PHONY: dev seed chaos lint test clean docs-build docs-serve

VENV?=.venv
PYTHON?=$(VENV)/bin/python
PIP?=$(VENV)/bin/pip
COMPOSE?=docker compose
COMPOSE_FILE?=docker-compose.dev.yml

install: venv ## Install local editable packages
	$(PIP) install -e packages/policy_engine/python
	$(PIP) install -e packages/provenance
	$(PIP) install -e apps/control-plane[dev]

venv:
	python -m venv $(VENV)
	$(PIP) install --upgrade pip

dev: ## Launch local stack (compose placeholder)
	$(COMPOSE) -f $(COMPOSE_FILE) up --build

seed: ## Register sample tools and policies
	$(PYTHON) scripts/seed.py

CHAOS_TENANT?=platform-eng
CHAOS_TOOL?=langsmith-docs-search
CHAOS_CYCLES?=5
CHAOS_DELAY?=1
CHAOS_JITTER?=0
CHAOS_LOG?=logs/chaos.log

chaos: ## Run kill/restore chaos drill (override CHAOS_* vars as needed)
	./scripts/hostname_check.sh
	@mkdir -p logs
	./scripts/chaos_kill.sh --cycles $(CHAOS_CYCLES) --delay $(CHAOS_DELAY) --jitter $(CHAOS_JITTER) --log $(CHAOS_LOG) $(CHAOS_TENANT) $(CHAOS_TOOL)


lint:
	$(PYTHON) -m ruff check .
	$(PYTHON) -m mypy apps/control-plane/src packages

test:
	$(PYTHON) -m pytest

clean:
	rm -rf $(VENV) .mypy_cache .pytest_cache */**/__pycache__


docs-build: ## Build MkDocs site
	. $(VENV)/bin/activate && mkdocs build

docs-serve: ## Serve documentation locally
	. $(VENV)/bin/activate && mkdocs serve

api-test: ## Run API smoke tests (requires running stack)
	./scripts/api_smoke.sh

coverage: ## Run coverage report
	$(PYTHON) -m pytest --cov=sentinel_control_plane --cov=sentinel_policy --cov=sentinel_provenance --cov-report=term-missing
