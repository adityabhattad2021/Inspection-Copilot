.PHONY: help install start android ios prebuild build-android-apk install-android-apk clean reverse-android unreverse-android watchman

ROOT_DIR := $(abspath $(CURDIR)/..)
BACKEND_PORT ?= 8000
PROD_API_BASE_URL ?= http://65.0.101.246
APK_PATH := android/app/build/outputs/apk/release/app-release.apk
APK_DIST_PATH := dist/jockey-copilot-release.apk

help:
	@echo "Mobile commands:"
	@echo "  make install                    - install npm dependencies"
	@echo "  make start                      - start Expo dev server for dev client"
	@echo "  make android                    - build/run Android dev client"
	@echo "  make ios                        - build/run iOS dev client"
	@echo "  make prebuild                   - generate native folders"
	@echo "  make build-android-apk          - local release APK using deployed backend"
	@echo "  make install-android-apk        - install local release APK on connected Android"
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

build-android-apk:
	cd android && NODE_ENV=production EXPO_PUBLIC_API_BASE_URL="$(PROD_API_BASE_URL)" EXPO_PUBLIC_INSPECTION_FLOW_LOG=0 ./gradlew :app:assembleRelease
	@mkdir -p dist
	cp "$(APK_PATH)" "$(APK_DIST_PATH)"
	@echo "Wrote $(APK_DIST_PATH)"

install-android-apk: build-android-apk
	adb install -r "$(APK_DIST_PATH)"

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
