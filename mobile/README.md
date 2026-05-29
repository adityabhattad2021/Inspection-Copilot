# Cars24 Jockey Copilot Mobile App

Expo React Native app for the Cars24 Jockey Copilot hackathon prototype. The app is an Android-first development build that walks a Car Jockey through onboarding, vehicle lookup, a 3D vehicle confirmation screen, realtime voice/camera inspection, structured door-damage observation, guided engine-sound capture, and final submission.

## Current App Flow

1. `app/onboarding.tsx`
   - Creates a jockey profile with name and instruction language.
   - Supported languages are English, Hindi, Kannada, and Hinglish.
   - Saves the profile locally with AsyncStorage and verifies it through the backend on launch.

2. `app/index.tsx`
   - Loads the cached profile.
   - Shows the registration lookup screen.
   - Defaults to the demo registration `KA03MX2147`.

3. `app/vehicle-found.tsx`
   - Looks up the vehicle profile.
   - Shows the vehicle identity and inspection plan with the matching bundled 3D model.
   - Creates an inspection session before entering the inspection route.

4. `app/inspection/[sessionId].tsx`
   - Starts the backend inspection session.
   - Loads voice runtime configuration from `/voice/config`.
   - Runs the realtime voice-guided inspection screen.
   - Captures accepted photo evidence, structures the LHS door observation, runs the guided engine check, and submits the session.

## Main Mobile Surfaces

- `src/api/client.ts` owns the typed backend client and `EXPO_PUBLIC_API_BASE_URL` handling.
- `src/features/onboarding/*` owns jockey profile setup and persistence.
- `src/features/lookup/*` owns registration lookup, vehicle-found navigation, and 3D model display.
- `src/features/inspection/inspection-screen.tsx` owns the live inspection workflow.
- `src/features/inspection/pipecat-voice-boundary.ts` owns the Pipecat realtime voice boundary.
- `src/features/inspection/realtime-frame-capture.ts` bridges native Android frame capture.
- `src/features/inspection/inspection-debug-log.ts` persists dev-only inspection flow logs to the backend.
- `src/data/live-inspection-media.ts` contains deterministic sample frames for the sample fallback flow.
- `src/components/ui/*` contains shared operational UI primitives.

## Backend Dependency

Start the backend from the repository root before running the app:

```bash
make backend-install
make backend-db-reset
make backend-dev
```

In another terminal, confirm the backend is reachable:

```bash
make backend-check
```

The mobile client defaults to `http://localhost:8000`. For an Android device or emulator, keep the root backend port reversed:

```bash
make android-ready
```

## Mobile Setup

Run mobile commands from the repository root unless you are intentionally working inside `mobile/`.

```bash
make mobile-install
make mobile-start
```

To build and run the Android development client:

```bash
make mobile-android
```

The app uses Expo SDK 54, Expo Router, React Native 0.81, Daily/Pipecat realtime voice packages, and a local Android native module for realtime frame capture. Expo Go is not sufficient for the full camera/voice demo because this app needs native modules and dev-client configuration.

## Environment Variables

Mobile:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_INSPECTION_FLOW_LOG=0
```

- `EXPO_PUBLIC_API_BASE_URL` overrides the backend URL used by `src/api/client.ts`.
- `EXPO_PUBLIC_INSPECTION_FLOW_LOG=0` disables dev-only flow logging. In development, logging is enabled by default.

Backend variables used by the mobile flow:

```bash
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_VOICE=alloy
JOCKEY_COPILOT_VOICE_BASE_URL=http://localhost:8000
JOCKEY_COPILOT_FLOW_LOG_PATH=backend/.local/inspection-flow.ndjson
JOCKEY_COPILOT_EVIDENCE_DIR=backend/.local/evidence
```

- `OPENAI_API_KEY` is required for the realtime voice runtime to report ready.
- `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, and `JOCKEY_COPILOT_VOICE_BASE_URL` customize `/voice/config`.
- `JOCKEY_COPILOT_FLOW_LOG_PATH` controls where `/debug/inspection-flow-log` writes NDJSON.
- `JOCKEY_COPILOT_EVIDENCE_DIR` controls where realtime uploaded photo evidence is stored.

Do not commit real secrets.

## Realtime Voice And Camera Notes

The inspection screen talks to the backend voice runtime through Pipecat Small WebRTC. The backend sends server messages for frame interventions and capture commands. The mobile boundary handles these events, speaks the exact guidance through `SYSTEM_GUIDANCE`, and triggers capture when the backend reports a hold/ready decision.

The Android frame capture module stores captured realtime frames locally and uploads them as multipart evidence to:

```text
POST /evidence/photo
```

Sample media mode still uses the same typed API client path where possible, but deterministic sample keys drive the fallback guidance:

- `front-main-bad-cropped`
- `front-main-good`
- `dashboard-dark`
- `dashboard-good`

## Debug Inspection Flow Logs

In development, `inspection-debug-log.ts` posts screen state, voice runtime events, frame ticks, capture attempts, observation submissions, and engine completion events to:

```text
POST /debug/inspection-flow-log
```

The backend writes:

```text
backend/.local/inspection-flow/{sessionId}.ndjson
```

Events without a session ID fall back to the configured base log path. Use `EXPO_PUBLIC_INSPECTION_FLOW_LOG=0` when the extra logging is too noisy.

## Useful Commands

```bash
make help
make doctor
make backend-test
make mobile-start
make mobile-android
make android-ready
```

Inside `mobile/`, the local Make targets are:

```bash
make install
make start
make android
make ios
make reverse-android
make unreverse-android
```

## Demo Path

1. Start the backend and Android reverse mapping.
2. Run the Android dev client.
3. Create or reuse a jockey profile.
4. Look up `KA03MX2147`.
5. Confirm the vehicle-found screen and start inspection.
6. Follow realtime voice guidance for Front Main, Rear Main, LHS front door, Dashboard/Odometer, and Engine Sound.
7. Submit the inspection when the engine check completes.

The mobile app ends at submission and returns to lookup. External report generation is a backend/dashboard concern, not a mobile route in the current code.
