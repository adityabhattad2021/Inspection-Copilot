.PHONY: help install dev test check clean

BACKEND_PORT ?= 8000
BACKEND_HOST ?= 0.0.0.0
BACKEND_URL ?= http://localhost:$(BACKEND_PORT)

help:
	@echo "Backend commands:"
	@echo "  make install - install dependencies with uv"
	@echo "  make dev     - run FastAPI backend"
	@echo "  make test    - run pytest"
	@echo "  make check   - verify /health"
	@echo "  make clean   - remove backend caches"

install:
	uv sync

dev:
	uv run uvicorn app.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT) --reload

test:
	uv run pytest -v

check:
	@echo "Checking backend at $(BACKEND_URL)/health ..."
	@curl -fsS $(BACKEND_URL)/health >/dev/null \
		&& echo "Backend is live at $(BACKEND_URL)" \
		|| (echo "Backend is not responding. Start it with: make dev" && exit 1)

clean:
	@rm -rf .pytest_cache .ruff_cache .local
	@echo "Removed backend caches."
