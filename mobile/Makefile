.PHONY: help install start android ios prebuild clean reverse-android unreverse-android watchman

ROOT_DIR := $(abspath $(CURDIR)/..)
BACKEND_PORT ?= 8000

help:
	@echo "Mobile commands:"
	@echo "  make install                    - install npm dependencies"
	@echo "  make start                      - start Expo dev server for dev client"
	@echo "  make android                    - build/run Android dev client"
	@echo "  make ios                        - build/run iOS dev client"
	@echo "  make prebuild                   - generate native folders"
	@echo "  make clean                      - regenerate native folders from scratch"
	@echo "  make reverse-android            - map Android localhost:$(BACKEND_PORT) to computer"
	@echo "  make unreverse-android          - remove backend reverse mapping"
	@echo "  make watchman                   - reset Watchman for this workspace"

install:
	npm install

start:
	npx expo start --dev-client

android:
	npx expo run:android

ios:
	npx expo run:ios

prebuild:
	npx expo prebuild

clean:
	npx expo prebuild --clean

reverse-android:
	adb reverse tcp:$(BACKEND_PORT) tcp:$(BACKEND_PORT)
	@echo "Android localhost:$(BACKEND_PORT) now points to your computer's localhost:$(BACKEND_PORT)"

unreverse-android:
	adb reverse --remove tcp:$(BACKEND_PORT)

watchman:
	watchman watch-del '$(ROOT_DIR)' || true
	watchman watch-project '$(ROOT_DIR)'
