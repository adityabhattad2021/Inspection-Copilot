# PRD: Inspection Copilot

## Product Summary

Inspection Copilot is a real-time voice-and-vision assistant for used-car field inspections. It helps an inspector complete a structured inspection checklist hands-free, validates photo evidence while the car is still in front of them, guides engine-sound inspection, and produces a cleaner report for pricing and audit workflows outside the mobile app.

The demo build focuses on a live mobile inspection flow, not a full replacement for a production inspection platform.

## Problem

Vehicle inspections directly affect final seller offers, dealer confidence, resale margins, and buyer trust. The existing inspection workflow is structured, but quality still depends on the car inspector's training, attention, camera discipline, and ability to fill many fields accurately while physically inspecting the car.

Bad inspection data can show up as:

- blurry or cropped photos
- missed required angles
- defects recorded without supporting evidence
- defects visible in media but not marked in the form
- inconsistent engine-sound observations and optional audio evidence quality
- delayed quality feedback after the inspector has already moved on
- inconsistent observations across inspectors and cities

The opportunity is to move quality control from after-the-fact audit to real-time in-field guidance.

## Target User

Primary user: a field inspector performing seller-side vehicle inspection.

Secondary users:

- Pricing team: receives cleaner, more complete inspection inputs.
- Quality/audit team: reviews AI-backed evidence and intervention trail.
- Operations managers: monitor inspection quality and training gaps.
- Seller: receives a fairer final offer based on better evidence.
- Buyer/dealer ecosystem: benefits from more trustworthy inspection reports.

## User Story

A car inspector reaches a seller's home and opens the inspection app. They enter the vehicle registration number. The app fetches or simulates vehicle details, such as make, model, year, fuel type, transmission, body type, and variant.

The app converts the vehicle profile into an inspection plan based on a sample inspection schema. The AI copilot starts guiding the inspector:

"Inspection started for a 2020 Hyundai Creta SX Petrol Automatic. We'll begin with Exterior & Tyres. Field 21: Front Main. Show the full front bumper, bonnet line, headlight, and front-left tyre."

The inspector points the camera at the car. The copilot watches the frame and responds in real time:

"Move two steps back. The front bumper is cropped."

Once the framing is acceptable:

"Good. Hold steady."

The app automatically captures the photo after the frame remains correct and stable for a short hold window.

"Front Main accepted."

The copilot continues through selected checklist fields. It detects capture-quality issues, requests retakes when needed, and captures photo evidence for the exterior checklist:

- Section: Exterior & Tyres
- Field: LHS front door
- Evidence: image attached

For engine sound, the copilot guides the inspector through the actual inspection: start the engine, listen at idle, briefly rev, listen near the bonnet and exhaust, then answer targeted questions such as whether there is knocking, rattling, abnormal vibration, smoke, or delayed start. The app can optionally record audio as an evidence artifact, and AI can mark whether that recording is usable, but the primary inspection signal is the inspector's guided observation.

At the end, the mobile app submits the inspection. The backend produces an AI Inspection Quality Report as `report.html` and `report.json` for an ops dashboard, and can optionally send the report link by email. The mobile app only needs to show submission status and report-link metadata.

## Product Goals

- Make the inspection feel like a senior car inspector is coaching every inspector in real time.
- Use realistic inspection categories rather than inventing a generic checklist.
- Demonstrate live voice, camera, image analysis, guided engine inspection, optional audio evidence, and structured report generation in one end-to-end flow.
- Demonstrate live framing guidance with auto-capture when the car angle is correct.
- Show business impact for inspection operations: fewer re-inspections, better evidence, better pricing confidence, and more consistent inspections across locations.
- Build a complete, reliable portfolio demo as a compact end-to-end prototype.

## Non-Goals

- Do not build a full 133-field production inspection app.
- Do not claim full mechanical diagnosis.
- Do not train a dent/scratch detection model from scratch.
- Do not integrate with real VAHAN or internal APIs for the portfolio prototype.
- Do not build buyer-side PDI, payment, RC transfer, or auction workflows.
- Do not build a full native production release pipeline.

## Inspection Schema Anchor

The portfolio prototype keeps a focused sample inspection schema in `backend/app/database/seed_data.py`. It models realistic vehicle-inspection sections across:

- Car Details
- Exterior & Tyres
- Interior & Electricals
- Engine
- AC
- SSB: Steering, Suspension, Brakes
- Additional options

The portfolio demo should use a focused subset of this schema:

### Car Details

- Vehicle registration number
- Owner number
- RC original
- Duplicate key
- Insurance validity

### Exterior & Tyres

- Field 18: Car Condition - Scratches / Dent / Rust / Holes
- Field 21: Front Main
- Field 24: Front LHS Main
- Field 28: Front bumper
- Field 43: LHS front wheel and tyre
- Field 45: LHS front door
- Field 56: Rear Main

### Interior & Electricals

- Field 83: Dashboard
- Field 92: Instrument cluster
- Field 93: Odometer reading
- Field 89: Reverse camera
- Field 85: Count of power windows

### Engine

- Field 99: Car running condition
- Field 100: OBD connection
- Field 104: Engine sound condition
- Field 108: Engine Sound Exhaust
- Field 109: Clutch
- Field 110: Transmission & gear shifting
- Field 113: Coolant
- Field 114: Battery & alternator

### AC / SSB

- Field 119: AC cooling
- Field 126: Steering
- Field 127: Brake
- Field 128: Suspension

For the live demo, complete only the critical path fields needed to show the copilot loop: front exterior, rear exterior, dashboard/odometer, and guided engine sound check.

## Core Features

### 1. Vehicle Lookup And Dynamic Inspection Plan

The inspector enters a registration number. The app returns a mocked vehicle profile:

- make
- model
- year
- variant
- fuel type
- transmission
- body type
- registration city/state

The app generates an inspection plan from the vehicle profile.

Example:

`KA03MX2147 -> Hyundai Creta 2020 SX Petrol AT -> SUV petrol automatic plan`

The plan affects:

- which checklist fields appear
- the wording of AI prompts
- which body angles are required
- which engine/transmission questions are asked

Production note: this can later connect to a valuation stack, RC lookup, or approved VAHAN/RC verification providers.

### 2. Live Voice Copilot

The copilot speaks instructions and listens to the inspector hands-free.

Required behaviors:

- announce current section and field
- guide camera movement
- ask inspection questions
- accept spoken answers
- convert speech into structured form fields
- advance the inspection sequence
- summarize what was captured

Example prompts:

- "Move two steps back. The bumper is cropped."
- "Tilt slightly down. Rear bumper is not fully visible."
- "Start the engine and listen near the bonnet for ten seconds. Tell me if you hear knocking, rattling, or abnormal vibration."

### 3. Vision QA

The app analyzes sampled live camera frames and captured images.

Checks:

- blur
- brightness
- glare
- framing
- required part visibility
- missing angle
- possible visible damage

Implementation approach:

- local heuristics for fast checks: blur, brightness, glare, stability
- OpenAI vision snapshot critique for semantic checks: bumper visible, tyre visible, dashboard visible, possible scratch
- live guidance endpoint for short movement prompts before capture
- final capture endpoint for higher-confidence accepted/retake decisions

The app should use strict JSON responses from AI where possible.

Example:

```json
{
  "step_passed": false,
  "visible_parts": ["left headlight", "bonnet"],
  "problems": ["front bumper cropped"],
  "next_instruction": "Move two steps back and center the bumper",
  "confidence": 0.82
}
```

For live guidance, the model returns short directional instructions:

```json
{
  "guidance": "Move a little to the left. I cannot see the front-left tyre.",
  "status": "adjust",
  "readyToCapture": false,
  "confidence": 0.78
}
```

When ready:

```json
{
  "guidance": "Good. Hold still.",
  "status": "hold",
  "readyToCapture": true,
  "confidence": 0.93
}
```

### 4. Voice-To-Form Filling

During the guided engine check, the inspector can answer in natural language. The app converts the utterance into fields from the inspection schema.

Example:

Inspector says: "No knocking, no rattling, mild vibration, exhaust normal."

Structured result:

```json
{
  "section": "Engine & Transmission",
  "field": "Engine sound",
  "knocking": false,
  "rattling": false,
  "idleVibration": "mild",
  "exhaustSound": "normal",
  "confidence": 0.91
}
```

### 5. Guided Engine Sound Check

The app guides the inspector through engine-sound inspection and turns the inspector's answers into structured engine fields.

Guided phases:

- start engine and confirm startup behavior
- listen near bonnet at idle for 8-10 seconds
- briefly rev and return to idle
- listen near exhaust
- answer targeted questions about knocking, rattling, abnormal vibration, smoke, or unusual exhaust sound

Optional audio evidence:

- record engine sound while the inspector listens
- check duration, volume, clipping, and background noise
- attach recording to the inspection as evidence
- do not block the inspection if audio recording is unavailable

The app does not claim complete engine diagnosis. It standardizes how the inspector listens, what they look for, and how those observations are captured.

Example outputs:

- "Listen at idle for ten seconds. Do you hear knocking or metallic rattling?"
- "Now rev once gently and return to idle."
- "Engine sound marked normal. Optional audio evidence attached."
- "Audio evidence is noisy, but inspector answers are saved."

### 6. AI Inspection Quality Report

At the end of the demo, the mobile app submits the inspection and the backend generates the report for external consumption.

Delivery options:

- ops dashboard report page
- S3-hosted `report.html`
- `report.json` for future system integration
- optional email with report link

Report sections:

- vehicle profile
- completed checklist fields
- accepted media
- rejected/retaken media
- detected issues
- voice-filled observations
- guided engine-sound answers
- optional engine audio evidence status
- quality score
- pricing-risk notes
- AI intervention audit trail

The report should make the business value obvious to product reviewers without requiring the mobile app to become a report viewer.

## Technical Approach

### Recommended Product Stack

- Expo React Native app for the mobile inspection experience.
- React Native VisionCamera for live guidance camera and auto-capture.
- Lightweight FastAPI backend for API calls and secrets.
- OpenAI Realtime API for live voice agent if implementation time permits.
- OpenAI Responses API with vision-capable model for frame/image critique.
- Browser/device local heuristics for image and audio quality checks.
- AWS S3 for storing captured images, optional audio evidence, `report.html`, and `report.json`.
- AWS Lambda/API Gateway for backend deployment.

### Fallback Stack

If native camera/audio setup blocks progress, switch to a mobile-first web/PWA version with:

- React/Next.js
- `getUserMedia`
- MediaRecorder
- Web Audio API
- canvas-based frame analysis

The demo and product story remain the same.

## Demo Flow

1. Open app.
2. Enter registration number: `KA03MX2147`.
3. App loads vehicle profile: 2020 Hyundai Creta SX Petrol Automatic.
4. Copilot generates "SUV Petrol Automatic Inspection Plan."
5. Front Main:
   - inspector points camera at car
   - copilot says "move a little left" or "step back"
   - when the correct angle is visible, copilot says "good, hold still"
   - app auto-captures and accepts
6. Rear Main:
   - copilot guides angle and auto-captures
7. Dashboard/Odometer:
   - copilot asks to increase light or move closer
   - app accepts odometer evidence
8. Guided Engine Sound Check:
   - copilot tells inspector how long to listen and where
   - inspector answers knocking/rattling/vibration questions
   - optional audio evidence is attached
9. Submit Inspection:
   - mobile app shows submitted status
   - backend creates dashboard/email report link
10. External Report:
   - dashboard or HTML report shows quality score
   - shows intervention trail
   - shows structured checklist fields
   - shows business impact summary

## Success Metrics For Demo

- A reviewer can understand the user and business problem in under 60 seconds.
- Live copilot visibly intervenes at least 3 times.
- At least one voice answer becomes a structured checklist field.
- At least one image is rejected and then accepted after guidance.
- Engine-sound check guides the inspector and structures their answers.
- External report maps back to inspection categories.
- Demo works reliably without depending on unstable external vehicle lookup.

## Risks And Mitigations

### Risk: Realtime voice integration takes too long.

Mitigation: use push-to-talk voice input plus text-to-speech fallback. Keep the agent loop intact.

### Risk: Live camera analysis is unreliable.

Mitigation: support demo frames/images for deterministic bad/good cases.

### Risk: Vision model latency hurts "real-time" feel.

Mitigation: run local heuristics instantly and call AI vision on capture or every few seconds.

### Risk: Engine sound diagnosis is overclaimed.

Mitigation: position it as guided human inspection with optional audio evidence, not full mechanical diagnosis from sound alone.

### Risk: Native app setup blocks progress.

Mitigation: keep PWA fallback ready with the same product story.

## Open Questions

- Will the demo be shown on a physical phone, emulator, or laptop mirrored phone viewport?
- Do we have guaranteed OpenAI API quota for Realtime and vision calls?
- Do we want email delivery in the first demo, or only dashboard/S3 report link?
- Do we want a real RC verification provider integration, or keep lookup mocked?
