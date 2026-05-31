# Inspection Copilot


Inspection Copilot is a portfolio prototype for a live, voice-and-vision assisted vehicle inspection app. It helps a car inspector move through a focused structured inspection flow, gives realtime camera guidance, captures evidence, structures spoken observations, guides the engine-sound check, and submits the inspection for pricing and audit.

The prototype is intentionally demo-first: local FastAPI backend, Expo React Native Android development build, deterministic demo vehicles and inspection plan, local SQLite state, local evidence files, and realtime voice routed through the backend so mobile never stores AI keys.



## What It Demonstrates

- Inspector onboarding with language selection.
- Demo registration lookup for known vehicles.
- Dynamic five-step inspection plan.
- Realtime voice-guided camera flow.
- Frame intervention events such as adjust, hold, and capture.
- Photo evidence save path for sample and realtime captures.
- Structured LHS door damage observation from natural language.
- Guided engine-sound check based on inspector answers.
- Dev-only inspection flow logging for debugging the live demo.

## Demo Vehicles

The seeded backend currently includes:

- `KA03MX2147` - 2020 Hyundai Creta SX Petrol Automatic, Bengaluru.
- `KA05NB7777` - 2021 Tata Nexon EV XZ Plus Automatic, Bengaluru.
- `DL8CAF5031` - 2019 Honda City VX Petrol Manual, Delhi.

The main pitch/demo path defaults to `KA03MX2147`.

## Inspection Flow

The demo plan has five focused steps:

1. Front Main
2. LHS front door
3. Rear Main
4. Dashboard and odometer reading
5. Engine sound condition

Photo steps can auto-capture after the realtime voice agent reports a hold/ready decision. The LHS front door step captures photo evidence only. The engine step guides the inspector through idle, gentle rev, exhaust listening, and final answer submission.

## Repository Layout

```text
.
|-- backend/                 FastAPI backend, SQLite persistence, voice runtime
|-- mobile/                  Expo React Native app and Android dev client
|-- ARCHITECTURE.md          System and module diagrams
|-- PRD.md                   Product requirements and scope
|-- GOALS.md                 Product goals and demo script
|-- Makefile                 Root commands for backend, mobile, and Android
`-- backend/app/database/seed_data.py  Demo vehicles and sample inspection plan
```

## Backend

The backend is a FastAPI app with local SQLite persistence. It owns vehicle lookup, profiles, sessions, AI stub endpoints, photo evidence, debug flow logs, and the Pipecat realtime voice runtime.

Important backend modules:

- `backend/app/main.py` wires the route modules.
- `backend/app/routes/vehicles.py` handles demo registration lookup.
- `backend/app/routes/profiles.py` handles inspector profile persistence.
- `backend/app/routes/sessions.py` creates, starts, reads, and completes inspection sessions.
- `backend/app/routes/ai.py` handles live-frame analysis, observation structuring, and engine checks.
- `backend/app/routes/evidence.py` stores sample or realtime photo evidence.
- `backend/app/routes/debug.py` stores dev-only inspection flow logs.
- `backend/app/routes/voice.py` exposes realtime voice configuration and transcript fallback.
- `backend/app/voice/*` owns the Pipecat Gemini/OpenAI realtime boundary.
- `backend/app/database/*` owns local SQLite schema, queries, and seed data.

## Mobile

The mobile app is an Expo SDK 54 React Native app intended for an Android development build. Expo Go is not enough for the full demo because the app uses native voice/camera dependencies, including Pipecat/Daily voice transport and React Native VisionCamera.

Important mobile modules:

- `mobile/app/onboarding.tsx` creates the inspector profile.
- `mobile/app/index.tsx` loads the profile and shows registration lookup.
- `mobile/app/vehicle-found.tsx` shows the found vehicle and starts a session.
- `mobile/app/inspection/[sessionId].tsx` renders the live inspection route.
- `mobile/src/api/client.ts` owns typed backend calls.
- `mobile/src/features/inspection/inspection-screen.tsx` owns the live inspection workflow.
- `mobile/src/features/inspection/pipecat-voice-boundary.ts` owns mobile voice runtime events.
- `mobile/src/features/inspection/realtime-camera-screen.tsx` owns the VisionCamera preview and still capture UI.
- `mobile/src/features/inspection/vision-camera-photo-capture.ts` encodes VisionCamera JPEGs for Pipecat photo review.
- `mobile/src/features/inspection/inspection-debug-log.ts` sends dev flow logs to the backend.
- `mobile/src/data/live-inspection-media.ts` contains deterministic sample frames.

See [mobile/README.md](mobile/README.md) for mobile-specific details.

## Prerequisites

- Python 3.11 or 3.12.
- `uv` for backend dependency management.
- Node.js and npm for the Expo app.
- Android Studio, Android SDK, and `adb` for the Android development client.
- An Android device or emulator for the full camera/voice demo.
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` for the default Gemini realtime voice runtime.

## Quick Start

Run commands from the repository root.

```bash
make backend-install
make backend-db-reset
make backend-dev
```

In another terminal:

```bash
make backend-check
make android-ready
make mobile-install
make mobile-start
```

To build and run the Android development client:

```bash
make mobile-android
```

## Environment Variables

Backend variables:

```bash
VOICE_LLM_PROVIDER=gemini
GOOGLE_API_KEY=...
GOOGLE_MODEL=models/gemini-3.1-flash-live-preview
GOOGLE_VOICE_ID=Charon

# One-line rollback:
# VOICE_LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...
# OPENAI_REALTIME_MODEL=gpt-realtime-2
# OPENAI_REALTIME_VOICE=alloy

INSPECTION_COPILOT_VOICE_BASE_URL=http://localhost:8000
INSPECTION_COPILOT_DB_PATH=backend/.local/inspection_copilot.sqlite3
INSPECTION_COPILOT_EVIDENCE_DIR=backend/.local/evidence
INSPECTION_COPILOT_FLOW_LOG_PATH=backend/.local/inspection-flow.ndjson
```

Mobile variables:

```bash
EXPO_PUBLIC_DEV_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_RELEASE_API_BASE_URL=http://65.0.101.246
EXPO_PUBLIC_INSPECTION_FLOW_LOG=0
```

Notes:

- Gemini Live is the default voice LLM provider. Set `VOICE_LLM_PROVIDER=openai` to roll back without changing mobile code.
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` is required for Gemini `/voice/config` to report `ready: true`.
- `OPENAI_API_KEY` is required only when `VOICE_LLM_PROVIDER=openai`.
- Development builds default to `http://localhost:8000` and can be overridden with `EXPO_PUBLIC_DEV_API_BASE_URL`.
- Release builds default to the deployed backend and can be overridden with `EXPO_PUBLIC_RELEASE_API_BASE_URL`.
- `EXPO_PUBLIC_INSPECTION_FLOW_LOG=0` disables dev-only inspection flow logging; the Makefile disables it for normal dev runs.
- Do not commit real secrets.

## Root Commands

```bash
make help              # list root commands
make doctor            # backend health + Android status
make backend-install   # install backend dependencies
make backend-db-reset  # reset and seed local SQLite demo data
make backend-dev       # run FastAPI on port 8000
make backend-test      # run backend tests
make backend-check     # verify /health
make mobile-install    # install mobile dependencies
make mobile-start      # start Expo dev-client server
make mobile-android    # build/run Android dev client
make android-ready     # backend check + adb reverse
```

## API Surface

Current local endpoints include:

- `GET /health`
- `POST /profiles`
- `GET /profiles`
- `GET /profiles/{profileId}`
- `POST /vehicles/lookup`
- `GET /vehicles`
- `POST /sessions`
- `POST /sessions/{sessionId}/start`
- `GET /sessions/{sessionId}`
- `POST /sessions/{sessionId}/complete`
- `POST /ai/analyze-live-frame`
- `POST /ai/structure-observation`
- `POST /ai/engine-check`
- `POST /evidence/photo`
- `GET /voice/config`
- `POST /voice/transcript-turn`
- `POST /debug/inspection-flow-log`
- `POST /start`
- `POST /api/offer`
- `PATCH /api/offer`

## Local Artifacts

Local runtime artifacts live under `backend/.local/` by default:

```text
backend/.local/inspection_copilot.sqlite3
backend/.local/evidence/
backend/.local/inspection-flow/
```

The root clean target removes local backend and mobile caches:

```bash
make clean
```

## Demo Run

1. Start the backend with seeded data.
2. Run `make android-ready` so Android `localhost:8000` points to the computer.
3. Start the Expo dev-client server.
4. Open the Android dev client.
5. Create an inspector profile and choose a language.
6. Look up `KA03MX2147`.
7. Confirm the vehicle and start inspection.
8. Follow the voice guidance through Front Main, LHS front door, Rear Main, Dashboard/Odometer, and Engine Sound.
9. Submit the inspection after the engine answer.

The current mobile app returns to lookup after submission. External report generation is handled by the backend/dashboard surface.

## Verification

Use the relevant acceptance command before claiming a task is done:

```bash
make backend-test
make backend-check
make doctor
```

For Android-specific work, also verify with:

```bash
make android-ready
make mobile-android
```

## Troubleshooting

- Backend is not responding: run `make backend-dev`, then `make backend-check`.
- Android app cannot reach backend: run `make android-ready` and keep the backend on port `8000`.
- Voice config is not ready: set `GOOGLE_API_KEY` in `backend/.env` or the shell running `make backend-dev`; for rollback, set `VOICE_LLM_PROVIDER=openai` and `OPENAI_API_KEY`.
- Dev flow logs are too noisy: start mobile with `EXPO_PUBLIC_INSPECTION_FLOW_LOG=0`.
- Demo data is missing or stale: run `make backend-db-reset`.

## Project Docs

- [GOALS.md](GOALS.md) explains the product thesis and demo script.
- [PRD.md](PRD.md) defines product scope, goals, and non-goals.
- [ARCHITECTURE.md](ARCHITECTURE.md) shows system diagrams and module maps.
- [mobile/README.md](mobile/README.md) documents the mobile app in detail.
