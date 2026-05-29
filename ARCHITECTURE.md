# ARCHITECTURE: Cars24 Jockey Copilot

This document describes the current implementation state of the hackathon app.

The backend demo deployment is an EC2-hosted FastAPI Docker service backed by DynamoDB and an S3 evidence bucket. The code still contains local SQLite/filesystem adapters for local development and tests, but the current backend architecture should be read as EC2 + DynamoDB + S3.

## Decision Map

| Area | Current Choice | Why It Exists |
|---|---|---|
| Mobile app | Expo React Native Android development build | Native Android demo with microphone, camera, WebRTC, and a custom frame-capture module |
| Navigation | Expo Router | Small route surface: onboarding, lookup, vehicle confirmation, inspection |
| Camera | Pipecat Small WebRTC local camera track rendered with `RTCView` | The realtime voice session owns camera/mic transport, and the app captures the visible RTC view when needed |
| Frame capture | Android native `RealtimeFrameCaptureModule` | Captures the rendered realtime camera frame as a JPEG for photo review and evidence |
| Backend hosting | FastAPI in Docker on EC2 | Simple deployed backend service, no Lambda/Mangum/API Gateway in the current deployment |
| Persistence | DynamoDB backend adapter | EC2 service remains stateless; session, plan, evidence metadata, observations, interventions, profiles, and reports live in DynamoDB |
| Media storage | S3 evidence bucket | Stores photo evidence when `JOCKEY_COPILOT_S3_BUCKET` is configured; presigned uploads are also available |
| Voice runtime | Pipecat Small WebRTC backend bot | Keeps realtime LLM keys on the backend and streams voice/camera through the backend-controlled runtime |
| Voice LLM | Gemini Live by default, OpenAI Realtime rollback | Backend can switch providers through `VOICE_LLM_PROVIDER` without changing mobile code |
| Vehicle data | Seeded demo vehicles | Stable hackathon path with the same interface a real RC/Cars24 provider could replace |
| Report output | FastAPI report JSON/HTML endpoints backed by DynamoDB | Completion creates report metadata and serves pricing/audit report views from the backend |

## Deployment Architecture

```mermaid
flowchart LR
  Mobile["Mobile app"] -->|REST + Small WebRTC| Backend["FastAPI Docker service<br/>on EC2"]

  subgraph AWS["AWS managed storage"]
    DDB["DynamoDB<br/>inspection state"]
    S3["S3<br/>photo evidence"]
  end

  subgraph AI["Realtime AI"]
    Provider["Gemini Live by default<br/>OpenAI Realtime fallback"]
  end

  Backend --> DDB
  Backend --> S3
  Backend --> Provider
```

## System Architecture

```mermaid
flowchart LR
  subgraph Field["Inspection site"]
    J["Car Jockey"]
    Car["Used car"]
  end

  subgraph Mobile["Expo React Native Android app"]
    Onboarding["Onboarding<br/>name + language"]
    Lookup["Vehicle lookup"]
    Found["Vehicle-found screen<br/>3D model + plan preview"]
    Inspection["Inspection screen<br/>voice, camera, progress, engine Q&A"]
    ApiClient["Typed API client<br/>src/api/client.ts"]
    VoiceBoundary["Pipecat voice boundary<br/>Small WebRTC client"]
    FrameCapture["Android frame capture module"]
    Cache["AsyncStorage<br/>cached profile"]
    DebugClient["Dev flow logger"]
  end

  subgraph Backend["FastAPI on EC2"]
    Profiles["/profiles"]
    Vehicles["/vehicles"]
    Sessions["/sessions"]
    AIHelpers["/ai helpers"]
    Evidence["/evidence/photo"]
    Uploads["/uploads/presign"]
    VoiceConfig["/voice/config"]
    WebRTC["/start + /api/offer"]
    Debug["/debug/inspection-flow-log"]
    Bot["Pipecat realtime bot"]
  end

  subgraph Storage["Backend storage"]
    DDB["DynamoDB"]
    S3["S3 evidence bucket"]
    Reports["Report JSON/HTML<br/>served by FastAPI"]
    Logs["Debug NDJSON logs<br/>dev only"]
  end

  subgraph LLM["Voice and reasoning layer"]
    Gemini["Gemini Live"]
    OpenAI["OpenAI Realtime"]
  end

  J --> Onboarding
  J --> Lookup
  J --> Inspection
  Car --> Inspection
  Onboarding <--> Cache
  Lookup --> Found
  Found --> Inspection
  Onboarding --> ApiClient
  Lookup --> ApiClient
  Found --> ApiClient
  Inspection --> ApiClient
  Inspection <--> VoiceBoundary
  Inspection --> FrameCapture
  DebugClient --> Debug

  ApiClient --> Profiles
  ApiClient --> Vehicles
  ApiClient --> Sessions
  ApiClient --> AIHelpers
  ApiClient --> Evidence
  ApiClient --> VoiceConfig
  VoiceBoundary --> WebRTC

  WebRTC --> Bot
  Bot <--> Gemini
  Bot <--> OpenAI
  Bot --> DDB
  Bot --> S3

  Profiles --> DDB
  Vehicles --> DDB
  Sessions --> DDB
  AIHelpers --> DDB
  Evidence --> DDB
  Evidence --> S3
  Uploads --> S3
  Sessions --> Reports
  Reports --> DDB
  Debug --> Logs
```

## App Surface Map

```mermaid
flowchart TD
  Launch["app/index.tsx"] --> CacheCheck{"Cached profile?"}
  CacheCheck -->|No| OnboardingRoute["app/onboarding.tsx"]
  CacheCheck -->|Yes| ProfileAPI["GET /profiles/{profileId}"]
  OnboardingRoute --> CreateProfile["POST /profiles"]
  CreateProfile --> SaveCache["AsyncStorage save"]
  SaveCache --> Launch
  ProfileAPI --> Lookup["VehicleLookupScreen"]

  Lookup --> LookupAPI["POST /vehicles/lookup"]
  LookupAPI --> VehicleFoundRoute["app/vehicle-found.tsx"]
  VehicleFoundRoute --> VehicleFound["VehicleFoundScreen<br/>3D model + vehicle identity"]
  VehicleFound --> CreateSession["POST /sessions"]
  CreateSession --> InspectionRoute["app/inspection/[sessionId].tsx"]

  InspectionRoute --> InspectionScreen["InspectionScreen"]
  InspectionScreen --> VoiceRuntime["GET /voice/config<br/>connect Pipecat"]
  InspectionScreen --> StartSession["POST /sessions/{id}/start"]
  InspectionScreen --> RealtimeCamera["RealtimeCameraScreen<br/>RTCView"]
  InspectionScreen --> EngineCheck["EngineGuidedCheck"]
  InspectionScreen --> Complete["POST /sessions/{id}/complete"]
  RealtimeCamera --> NativeCapture["captureRealtimeFrame(viewTag)"]
  Complete --> BackToLookup["Return to lookup"]
```

## Mobile Module Map

```mermaid
flowchart LR
  subgraph Routes["mobile/app"]
    OnboardingRoute["onboarding.tsx"]
    IndexRoute["index.tsx"]
    VehicleFoundRoute["vehicle-found.tsx"]
    InspectionRoute["inspection/[sessionId].tsx"]
  end

  subgraph Features["mobile/src/features"]
    Onboarding["onboarding/*<br/>profile setup + storage"]
    Lookup["lookup/*<br/>registration lookup + 3D model"]
    Inspection["inspection/inspection-screen.tsx"]
    VoiceBoundary["inspection/pipecat-voice-boundary.ts"]
    CameraScreen["inspection/realtime-camera-screen.tsx"]
    FrameCapture["inspection/realtime-frame-capture.ts"]
    Engine["inspection/engine-guided-check.tsx"]
    DebugLog["inspection/inspection-debug-log.ts"]
  end

  subgraph Core["mobile/src"]
    Api["api/client.ts"]
    Media["data/live-inspection-media.ts"]
    UI["components/ui/*"]
  end

  OnboardingRoute --> Onboarding
  IndexRoute --> Onboarding
  IndexRoute --> Lookup
  VehicleFoundRoute --> Lookup
  InspectionRoute --> Inspection
  Inspection --> VoiceBoundary
  Inspection --> CameraScreen
  Inspection --> FrameCapture
  Inspection --> Engine
  Inspection --> DebugLog
  Inspection --> Media
  Lookup --> Api
  Onboarding --> Api
  Inspection --> Api
  Lookup --> UI
  Inspection --> UI
```

## Backend Module Map

```mermaid
flowchart LR
  Main["app/main.py<br/>FastAPI route wiring"]

  subgraph Routes["app/routes"]
    Profiles["profiles.py"]
    Vehicles["vehicles.py"]
    Sessions["sessions.py"]
    AI["ai.py"]
    Evidence["evidence.py"]
    Uploads["uploads.py"]
    Debug["debug.py"]
    Voice["voice.py"]
  end

  subgraph VoiceRuntime["app/voice"]
    WebRTC["webrtc.py"]
    Bot["realtime_bot.py"]
    Config["config.py"]
    Prompts["prompts.py"]
    Tools["tools.py"]
  end

  subgraph Persistence["app/database"]
    Adapter["__init__.py<br/>deployed backend selects DynamoDB"]
    Dynamo["dynamodb_backend.py"]
    Seed["seed_data.py + seed_queries.py"]
  end

  subgraph Services["app/services + app/storage"]
    AIStub["ai_stub.py"]
    Engine["engine_check.py"]
    Report["report_generator.py"]
    S3Store["storage/s3_store.py"]
  end

  Main --> Profiles
  Main --> Vehicles
  Main --> Sessions
  Main --> AI
  Main --> Evidence
  Main --> Uploads
  Main --> Debug
  Main --> Voice
  Main --> WebRTC

  Profiles --> Adapter
  Vehicles --> Adapter
  Sessions --> Adapter
  AI --> Adapter
  Evidence --> Adapter
  Uploads --> S3Store
  Evidence --> S3Store
  Sessions --> Report
  AI --> AIStub
  AI --> Engine

  Adapter --> Dynamo
  Seed --> Dynamo

  Voice --> Config
  WebRTC --> Bot
  Bot --> Config
  Bot --> Prompts
  Bot --> Tools
  Tools --> Adapter
  Tools --> S3Store
```

## End-To-End Runtime Sequence

```mermaid
sequenceDiagram
  autonumber
  actor J as Car Jockey
  participant App as Expo Android app
  participant Cache as AsyncStorage
  participant API as FastAPI on EC2
  participant Voice as Pipecat bot
  participant LLM as Gemini Live or OpenAI Realtime
  participant DDB as DynamoDB
  participant S3 as S3 bucket

  J->>App: Open app
  App->>Cache: Read cached profile
  alt No cached profile
    App-->>J: Ask name and instruction language
    App->>API: POST /profiles
    API->>DDB: Save PROFILE item
    API-->>App: Profile payload
    App->>Cache: Save profile locally
  else Cached profile found
    App->>API: GET /profiles/{profileId}
    API->>DDB: Load PROFILE item
    API-->>App: Fresh profile
  end

  J->>App: Enter registration number
  App->>API: POST /vehicles/lookup
  API->>DDB: Load VEHICLE item
  API-->>App: Demo vehicle profile
  App-->>J: Show vehicle-found screen and 3D model

  J->>App: Start inspection
  App->>API: POST /sessions
  API->>DDB: Select PLAN_TEMPLATE and write SESSION partition
  API-->>App: sessionId, vehicle, four-step plan

  App->>API: GET /voice/config
  API-->>App: provider, model, voice, startUrl, ready
  App->>API: POST /sessions/{sessionId}/start
  API->>DDB: Mark first step active
  API-->>App: activeStep and greeting metadata

  App->>Voice: Small WebRTC signaling through /start and /api/offer
  Voice->>DDB: Load session and active inspection plan
  Voice->>LLM: Start Saarthi prompt with voice tools
  LLM-->>App: Spoken greeting and guidance

  loop Photo steps: front-main, rear-main, dashboard-odometer
    App->>Voice: STEP_CHANGED hidden control event
    Voice->>LLM: Step instructions and expected parts
    LLM-->>App: Short spoken framing instruction
    J->>App: Tap capture
    App->>App: Capture RTCView frame through native Android module
    App->>Voice: CAPTURED_PHOTO_REVIEW with JPEG data chunks
    Voice->>LLM: Review captured still photo
    alt Photo is acceptable
      LLM->>Voice: accept_photo tool call
      Voice->>S3: Store photo evidence when bucket is configured
      Voice->>DDB: Save evidence and advance active step
      Voice-->>App: photo_acceptance server message
      App-->>J: Continue to next step
    else Retake required
      LLM-->>App: One physical retake fix
      App-->>J: Retake the photo
    end
  end

  App-->>J: Guided engine phases and Q&A
  J->>App: Submit engine answers
  App->>API: POST /ai/engine-check phase=final
  API->>DDB: Save structured engine observation
  API->>DDB: Set session ready_for_submission
  API-->>App: Updated session

  App->>API: POST /sessions/{sessionId}/complete
  API->>DDB: Load session, evidence, observations, interventions
  API->>API: Build report payload and render report HTML on demand
  API->>DDB: Save REPORT item
  API-->>App: completed status and report links
  App-->>J: Thank-you message, then return to lookup
```

## Realtime Photo Review Sequence

```mermaid
sequenceDiagram
  autonumber
  participant App as InspectionScreen
  participant RTC as RTCView camera preview
  participant Native as Android frame capture
  participant VoiceClient as Pipecat client
  participant Bot as FastAPI Pipecat bot
  participant LLM as Gemini/OpenAI realtime model
  participant DDB as DynamoDB
  participant S3 as S3 bucket

  App->>VoiceClient: send STEP_CHANGED
  VoiceClient->>Bot: inspection-control message
  Bot->>LLM: Inject lifecycle text
  LLM-->>VoiceClient: Speak next camera action
  App-->>RTC: Render local camera track
  App->>Native: captureVideoViewFrame(viewTag)
  Native-->>App: JPEG uri, bytes, width, height, dataUrl
  App->>VoiceClient: Send image chunks + CAPTURED_PHOTO_REVIEW
  VoiceClient->>Bot: inspection-control-photo-chunk messages
  Bot->>Bot: Reassemble data URL and keep pending photo by stepId
  Bot->>LLM: Inject captured image for review
  alt Accepted
    LLM->>Bot: accept_photo(stepId, visibleParts, guidance)
    Bot->>S3: Upload/store sessions/{sessionId}/photos/{stepId}.jpg
    Bot->>DDB: Save EVIDENCE item and complete step
    Bot-->>VoiceClient: photo_acceptance session update
    VoiceClient-->>App: Update session and progress rail
  else Needs retake
    LLM-->>VoiceClient: Speak one retake instruction
    VoiceClient-->>App: Keep same active step
  end
```

## Sample Fallback Sequence

The realtime path above is the primary demo path. The app and backend also keep deterministic sample-frame endpoints for reliable local demos and tests.

```mermaid
sequenceDiagram
  autonumber
  participant App as Mobile app
  participant API as FastAPI on EC2
  participant DDB as DynamoDB

  App->>API: POST /ai/analyze-live-frame<br/>sessionId, stepId, sampleKey
  API->>API: Look up canned response in ai_stub.py
  API->>DDB: Save AI_INTERVENTION item
  API-->>App: adjust or hold guidance
  alt readyToCapture true
    App->>API: POST /evidence/photo<br/>sampleKey, localUri
    API->>DDB: Save EVIDENCE item and advance step
    API-->>App: Updated session
  else adjustment required
    App-->>App: Show next sample frame
  end
```

## DynamoDB Logical Layout

```mermaid
erDiagram
  VEHICLE ||--o{ INSPECTION_SESSION : starts
  PROFILE ||--o{ INSPECTION_SESSION : used_by
  PLAN_TEMPLATE ||--o{ PLAN_STEP : defines
  INSPECTION_SESSION ||--o{ SESSION_STEP : snapshots
  INSPECTION_SESSION ||--o{ EVIDENCE_ITEM : stores
  INSPECTION_SESSION ||--o{ AI_INTERVENTION : logs
  INSPECTION_SESSION ||--o{ STRUCTURED_OBSERVATION : records
  INSPECTION_SESSION ||--|| REPORT : produces

  VEHICLE {
    string PK "VEHICLE#registration"
    string SK "META"
    string make
    string model
    string fuelType
    string transmission
  }

  PROFILE {
    string PK "PROFILE#profileId"
    string SK "META"
    string name
    string languageCode
  }

  PLAN_TEMPLATE {
    string PK "PLAN_TEMPLATE#templateId"
    string SK "META"
    string bodyType
    string fuelType
    string transmission
  }

  PLAN_STEP {
    string PK "PLAN_TEMPLATE#templateId"
    string SK "STEP#sortOrder"
    string fieldName
    string kind
  }

  INSPECTION_SESSION {
    string PK "SESSION#sessionId"
    string SK "META"
    string status
    object vehicle
    string planName
  }

  SESSION_STEP {
    string PK "SESSION#sessionId"
    string SK "STEP#sortOrder"
    string stepId
    string status
  }

  EVIDENCE_ITEM {
    string PK "SESSION#sessionId"
    string SK "EVIDENCE#createdAt#id"
    string objectKey
    float qualityScore
  }

  AI_INTERVENTION {
    string PK "SESSION#sessionId"
    string SK "AI#createdAt#id"
    string type
    string message
  }

  STRUCTURED_OBSERVATION {
    string PK "SESSION#sessionId"
    string SK "OBS#createdAt#id"
    string issue
    string severity
  }

  REPORT {
    string PK "SESSION#sessionId"
    string SK "REPORT"
    float completionScore
    float mediaQualityScore
    string pricingRisk
  }
```

## S3 Object Layout

```mermaid
flowchart TD
  Bucket["S3 evidence bucket"] --> Sessions["sessions/{sessionId}/"]
  Sessions --> Photos["photos/{stepId}.jpg"]
  Sessions --> Audio["audio/engine.m4a<br/>optional presigned upload path"]
```

Current report JSON and HTML are generated from DynamoDB-backed report payloads and served by FastAPI at `/sessions/{sessionId}/report` and `/sessions/{sessionId}/report.html`.

## Current Demo Inspection Plan

```mermaid
flowchart TD
  Vehicle["KA03MX2147<br/>2020 Hyundai Creta SX Petrol Automatic"] --> Plan["SUV Petrol Automatic Inspection Plan"]
  Plan --> Front["1. Front Main<br/>photo"]
  Front --> Rear["2. Rear Main<br/>photo"]
  Rear --> Dash["3. Dashboard and odometer reading<br/>photo"]
  Dash --> Engine["4. Engine sound condition<br/>engine-guided"]
  Engine --> Submit["Submit inspection"]
  Submit --> Report["AI Inspection Quality Report<br/>JSON + downloadable HTML"]
```

## API Surface

| Endpoint | Owner | Current role |
|---|---|---|
| `GET /health` | `app/main.py` | EC2/container health check |
| `POST /profiles` | `routes/profiles.py` | Create Jockey profile |
| `GET /profiles` | `routes/profiles.py` | List profiles |
| `GET /profiles/{profileId}` | `routes/profiles.py` | Refresh cached mobile profile |
| `POST /vehicles/lookup` | `routes/vehicles.py` | Lookup seeded demo registration |
| `GET /vehicles` | `routes/vehicles.py` | List seeded demo vehicles |
| `POST /sessions` | `routes/sessions.py` | Create session and snapshot dynamic plan |
| `POST /sessions/{sessionId}/start` | `routes/sessions.py` | Activate first step and return greeting metadata |
| `GET /sessions/{sessionId}` | `routes/sessions.py` | Load session state |
| `POST /sessions/{sessionId}/complete` | `routes/sessions.py` | Validate completion and create report |
| `POST /sessions/{sessionId}/report` | `routes/sessions.py` | Create report without marking completion again |
| `GET /sessions/{sessionId}/report` | `routes/sessions.py` | Return report JSON |
| `GET /sessions/{sessionId}/report.html` | `routes/sessions.py` | Return downloadable report HTML |
| `POST /ai/analyze-live-frame` | `routes/ai.py` | Deterministic sample-frame guidance |
| `POST /ai/structure-observation` | `routes/ai.py` | Structure a transcript for a step that needs observation |
| `POST /ai/engine-check` | `routes/ai.py` | Structure engine Q&A and mark ready for submission |
| `POST /evidence/photo` | `routes/evidence.py` | Store photo evidence and advance photo step |
| `POST /uploads/presign` | `routes/uploads.py` | Create S3 presigned upload URL |
| `GET /voice/config` | `routes/voice.py` | Return Pipecat provider/model/voice readiness |
| `POST /voice/transcript-turn` | `routes/voice.py` | Fallback transcript-to-session update path |
| `POST /start` | `voice/webrtc.py` | Start Small WebRTC session |
| `POST /api/offer` | `voice/webrtc.py` | WebRTC offer endpoint |
| `PATCH /api/offer` | `voice/webrtc.py` | WebRTC ICE candidate endpoint |
| `POST /debug/inspection-flow-log` | `routes/debug.py` | Dev-only NDJSON inspection flow log |

## Environment Contract

| Variable | Used by | Meaning |
|---|---|---|
| `JOCKEY_COPILOT_STORAGE_BACKEND=dynamodb` | `app.database.__init__` | Selects the deployed DynamoDB adapter |
| `JOCKEY_COPILOT_DDB_TABLE` | `dynamodb_backend.py` | DynamoDB table name |
| `JOCKEY_COPILOT_S3_BUCKET` | `storage/s3_store.py`, `routes/evidence.py`, `routes/uploads.py` | Evidence bucket name |
| `AWS_REGION` | boto3 clients | DynamoDB/S3 region |
| `VOICE_LLM_PROVIDER` | `voice/config.py` | `gemini` default or `openai` rollback |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Gemini Live runtime | Required for Gemini voice readiness |
| `OPENAI_API_KEY` | OpenAI Realtime runtime | Required only when `VOICE_LLM_PROVIDER=openai` |
| `JOCKEY_COPILOT_VOICE_BASE_URL` | mobile voice config | Base URL returned by `/voice/config` |
| `JOCKEY_COPILOT_ICE_SERVERS_JSON` | Small WebRTC | Optional STUN/TURN override |
| `JOCKEY_COPILOT_FLOW_LOG_PATH` | debug route | Dev-only local NDJSON flow log path |

## Current Boundaries

- The backend is not currently a Lambda/Mangum service. It is a Dockerized FastAPI service running on EC2.
- The deployed backend state is DynamoDB-backed. SQLite is a local/test adapter, not the deployed architecture.
- S3 is the backend media bucket for evidence objects and presigned upload URLs.
- The mobile app does not hold AI provider keys. Voice provider configuration and readiness are resolved by the backend.
- The realtime photo-review path uses the Pipecat voice bot and tool calls to accept evidence. The `/ai/analyze-live-frame` path is a deterministic sample fallback used by tests and local demo flows.
- The current seeded plan has four steps: `front-main`, `rear-main`, `dashboard-odometer`, and `engine-sound`.
