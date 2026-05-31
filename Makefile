.PHONY: help doctor backend-install backend-dev backend-test backend-check backend-db-seed backend-db-clear backend-db-reset backend-deploy backend-deploy-fast backend-deploy-seed backend-deploy-reset mobile-install mobile-start mobile-android mobile-ios mobile-build-android-apk mobile-install-android-apk android-check android-reverse android-unreverse android-ready clean

ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
BACKEND_DIR := $(ROOT_DIR)backend
MOBILE_DIR := $(ROOT_DIR)mobile
BACKEND_PORT ?= 8000
BACKEND_HOST ?= 0.0.0.0
BACKEND_URL ?= http://localhost:$(BACKEND_PORT)

help:
	@echo "Inspection Copilot commands:"
	@echo "  make doctor            - quick backend + Android status"
	@echo "  make backend-install   - install backend dependencies with uv"
	@echo "  make backend-dev       - run FastAPI backend"
	@echo "  make backend-test      - run backend tests"
	@echo "  make backend-check     - verify backend /health"
	@echo "  make backend-db-seed   - seed local SQLite demo data"
	@echo "  make backend-db-clear  - clear local SQLite database"
	@echo "  make backend-db-reset  - clear and reseed local SQLite database"
	@echo "  make backend-deploy    - test, deploy, restart, and health-check AWS backend"
	@echo "  make backend-deploy-fast - deploy AWS backend without running tests"
	@echo "  make backend-deploy-seed - deploy AWS backend and run app.seed seed"
	@echo "  make backend-deploy-reset - deploy AWS backend and run app.seed reset"
	@echo "  make android-check     - show connected Android devices"
	@echo "  make android-reverse   - map Android localhost:$(BACKEND_PORT) to computer"
	@echo "  make android-unreverse - remove backend reverse mapping"
	@echo "  make android-ready     - check backend + device, then apply adb reverse"
	@echo "  make mobile-install    - install mobile dependencies"
	@echo "  make mobile-start      - start Expo dev-client server"
	@echo "  make mobile-android    - build/run Android dev client"
	@echo "  make mobile-ios        - build/run iOS dev client"
	@echo "  make mobile-build-android-apk - local release APK using deployed backend"
	@echo "  make mobile-install-android-apk - build and install local release APK on Android"
	@echo "  make clean             - remove local caches/build artifacts"

backend-install:
	cd $(BACKEND_DIR) && uv sync

backend-dev:
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --host $(BACKEND_HOST) --port $(BACKEND_PORT) --reload

backend-test:
	cd $(BACKEND_DIR) && uv run pytest -v

backend-check:
	@echo "Checking backend at $(BACKEND_URL)/health ..."
	@curl -fsS $(BACKEND_URL)/health >/dev/null \
		&& echo "Backend is live at $(BACKEND_URL)" \
		|| (echo "Backend is not responding. Start it with: make backend-dev" && exit 1)

backend-db-seed:
	cd $(BACKEND_DIR) && uv run python -m app.seed seed

backend-db-clear:
	cd $(BACKEND_DIR) && uv run python -m app.seed clear

backend-db-reset:
	cd $(BACKEND_DIR) && uv run python -m app.seed reset

backend-deploy:
	$(ROOT_DIR)deploy/aws/deploy-backend.sh

backend-deploy-fast:
	$(ROOT_DIR)deploy/aws/deploy-backend.sh --skip-tests

backend-deploy-seed:
	$(ROOT_DIR)deploy/aws/deploy-backend.sh --seed

backend-deploy-reset:
	$(ROOT_DIR)deploy/aws/deploy-backend.sh --reset-seed

android-check:
	@echo "Connected Android devices:"
	@adb devices

android-reverse:
	adb reverse tcp:$(BACKEND_PORT) tcp:$(BACKEND_PORT)
	@echo "Android localhost:$(BACKEND_PORT) now points to your computer's localhost:$(BACKEND_PORT)"

android-unreverse:
	adb reverse --remove tcp:$(BACKEND_PORT)
	@echo "Removed Android reverse port mapping for $(BACKEND_PORT)"

android-ready: backend-check android-check
	@adb get-state >/dev/null 2>&1 \
		&& $(MAKE) --no-print-directory android-reverse \
		&& echo "Android is ready. In the app, use backend URL: http://localhost:$(BACKEND_PORT)" \
		|| (echo "No Android device is ready. Connect a phone/emulator, then rerun make android-ready" && exit 1)

mobile-install:
	cd $(MOBILE_DIR) && npm install

mobile-start:
	cd $(MOBILE_DIR) && $(MAKE) start

mobile-android:
	cd $(MOBILE_DIR) && $(MAKE) android

mobile-ios:
	cd $(MOBILE_DIR) && $(MAKE) ios

mobile-build-android-apk:
	cd $(MOBILE_DIR) && $(MAKE) build-android-apk

mobile-install-android-apk:
	cd $(MOBILE_DIR) && $(MAKE) install-android-apk

doctor:
	@echo ""
	@echo "== Backend =="
	@$(MAKE) --no-print-directory backend-check || true
	@echo ""
	@echo "== Android =="
	@adb devices || true
	@echo ""
	@echo "Next:"
	@echo "  make backend-install"
	@echo "  make backend-dev"
	@echo "  make android-ready"
	@echo "  make mobile-start"

clean:
	@rm -rf $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/.ruff_cache $(BACKEND_DIR)/.local
	@rm -rf $(MOBILE_DIR)/.expo $(MOBILE_DIR)/node_modules/.cache
	@echo "Removed local caches."
