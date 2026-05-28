# GOALS: Cars24 Jockey Copilot Hack

## Hack Thesis

Cars24 already has a structured vehicle inspection process. The hack is to make that process live, voice-guided, and AI-audited while the Car Jockey is still standing next to the car.

The product should feel like:

> Every Car Jockey now has the best senior inspector on the team riding along in their pocket.

## What We Are Building

A mobile inspection copilot that:

- starts from a vehicle registration number
- loads a vehicle profile
- generates a car-specific inspection plan
- guides the Jockey through key Cars24 inspection fields
- watches camera captures
- gives real-time movement and retake instructions
- auto-captures evidence when the frame is correct and stable
- accepts natural voice observations
- guides engine-sound checks and structures the Jockey's answers
- can attach engine audio as optional evidence
- creates an external AI inspection quality report for dashboard/email

## Winning Angle

This should not be pitched as "we built another inspection checklist."

The pitch is:

> Cars24 already standardizes what to inspect. Jockey Copilot standardizes how well it gets captured in the field.

That is the business wedge.

## Cars24 Business Impact

### Direct Impact

- Cleaner inspection inputs for pricing.
- Fewer missed defects.
- Fewer bad photos and re-inspections.
- Faster onboarding for new Car Jockeys.
- More consistent inspection quality across cities.
- Better audit trail for disputed valuations.
- Higher dealer trust in photo-backed reports.

### Strategic Impact

- Makes Cars24 look like the AI-native used-car company.
- Turns a human-heavy field process into a guided AI workflow.
- Creates reusable multimodal infrastructure for future buyer-side PDI, warranty, claims, and refurbishment workflows.

## Technical Wow Factor

The demo should prove multimodal intelligence, not just a chat wrapper.

Must show:

- camera feed or captured frame analysis
- live AI coaching
- auto-capture after "good, hold still"
- speech-to-structured-inspection fields
- guided engine-sound inspection
- optional audio evidence QA
- dynamic inspection plan based on vehicle profile
- external report with audit trail

Nice-to-have:

- OpenAI Realtime voice agent
- AWS S3 evidence archive
- QR code or phone demo build

## Scope For 24 Hours

### Must Have

- Mobile-first inspection app UI.
- React Native VisionCamera-based live inspection camera.
- Vehicle number input.
- Mock vehicle lookup with at least 2 sample cars.
- Dynamic inspection plan.
- Five-step live demo:
  - Front Main
  - Rear Main
  - LHS Door Damage
  - Dashboard/Odometer
  - Guided Engine Sound Check
- AI or heuristic feedback for bad/good capture.
- Live guidance and auto-capture for at least one exterior photo.
- Voice or push-to-talk observation input.
- Structured checklist fields populated from user answer.
- External AI Inspection Quality Report.

### Should Have

- Local blur/brightness/glare checks.
- OpenAI vision critique for captured frames.
- Optional audio waveform/volume/noise indicator.
- Retake history.
- Confidence scores.
- Audit timeline.

### Could Have

- OpenAI Realtime voice conversation.
- AWS S3 storage for media, report HTML, and report JSON.
- Admin/ops report dashboard.
- Real RC verification provider integration.

### Won't Have

- Full 133-field inspection.
- Real VAHAN/Cars24 internal integration.
- Full dent detection ML model.
- Real mechanical diagnosis from engine sound.
- Dealer auction flow.
- Seller payment or RC transfer flow.

## Demo Script

### Opening

"Cars24's final offer depends on inspection quality. But field inspection is hard: the Jockey is handling the car, customer, camera, app, checklist, and judgment at the same time. We built Jockey Copilot: a live senior-inspector agent inside the inspection app."

### Step 1: Vehicle Lookup

Enter `KA03MX2147`.

App shows:

- Hyundai Creta
- 2020
- SX Petrol Automatic
- SUV
- Bengaluru RTO

Copilot says:

"I found a 2020 Hyundai Creta SX Petrol Automatic. Loading SUV petrol automatic inspection plan."

### Step 2: Front Main

Show a bad/cropped image or camera angle.

Copilot says:

"Move a little to the left. I cannot see the front-left tyre."

Show corrected frame.

Copilot says:

"Good. Hold still."

App auto-captures.

Copilot confirms:

"Front Main accepted."

### Step 3: Rear Main

Copilot guides:

"Show the full rear bumper and boot line."

Accept or ask for small adjustment.

### Step 4: Door Damage

Copilot asks:

"I see a possible mark near the left front door handle. Is this scratch, dent, rust, or dirt?"

User says:

"Minor scratch, no dent."

App fills:

- Section: Exterior & Tyres
- Field: LHS front door
- Issue: scratch
- Severity: minor
- Dent: no

### Step 5: Dashboard/Odometer

Copilot asks:

"Open the driver door and show dashboard and odometer."

If dark:

"Dashboard is too dark. Move closer or turn on cabin light."

Accept after correction.

### Step 6: Guided Engine Sound Check

Copilot says:

"Start the engine. Listen near the bonnet for ten seconds. Tell me if you hear knocking, rattling, or abnormal vibration."

Jockey answers:

"No knocking. Mild vibration at idle. Exhaust sounds normal."

Copilot follows up:

"Now rev once gently and return to idle. Did the sound become harsh or metallic?"

Optional evidence:

"Audio evidence attached, but the engine fields are based on the guided Jockey answers."

### Step 7: Submit And External Report

Mobile app shows:

"Inspection submitted. Report generated for pricing and audit."

Dashboard/email report shows:

- checklist completion
- media quality score
- retake count
- AI interventions
- confirmed scratch
- guided engine-sound answers
- optional engine audio evidence status
- pricing-risk notes
- audit trail

Close:

"This is not replacing the Jockey. It makes every Jockey perform like the best Jockey on the team."

## Product Principles

- Live beats post-mortem.
- Assist the Jockey, do not replace the Jockey.
- Use Cars24's schema; do not invent a fantasy inspection process.
- Be honest about AI limits.
- Make the demo deterministic where reliability matters.
- Optimize for judge comprehension and business believability.

## Technical Principles

- Local checks first, AI checks second.
- Voice should be hands-free where possible, push-to-talk if needed.
- Use strict JSON for AI outputs.
- Keep the backend thin.
- Mock vehicle lookup, but design the interface like a real provider.
- Prefer reliable demo flow over fragile over-integration.

## Suggested Architecture

```text
Mobile App
  -> vehicle lookup provider
  -> inspection plan generator
  -> camera capture
  -> guided engine check
  -> optional audio evidence capture
  -> local image/audio evidence QA
  -> backend AI endpoints
  -> submit inspection

Backend
  -> FastAPI Python API on AWS
  -> OpenAI vision critique
  -> OpenAI speech/agent endpoint
  -> S3 evidence and report storage
  -> external report generation
  -> dashboard/email report delivery
```

## API Choices

### Core

- OpenAI Responses API for vision and structured reasoning.
- OpenAI Realtime API if we can implement low-latency voice safely.
- FastAPI with Pydantic for backend routes and schemas.

### Optional

- AWS S3 for evidence and report storage.
- AWS Lambda/API Gateway for API deployment.

### Mocked

- Vehicle registration lookup.
- Cars24 internal inspection API.
- Pricing system integration.

## 24-Hour Sprint Plan

### Sprint 1: Product Shell

- Set up app.
- Create vehicle lookup screen.
- Add mock vehicle profiles.
- Create inspection plan data from selected Cars24 fields.
- Build basic stepper and submission state.

### Sprint 2: Camera And Evidence

- Add camera or image-capture flow.
- Add deterministic demo media.
- Add local blur/brightness/framing checks.
- Add accepted/rejected capture state.

### Sprint 3: Copilot Loop

- Add agent prompt panel and spoken/text prompts.
- Add OpenAI vision critique endpoint.
- Add movement guidance.
- Add voice/push-to-talk answer capture.
- Convert observations into structured fields.

### Sprint 4: Engine Check And Report

- Add guided engine-sound check.
- Structure engine answers into Cars24 fields.
- Add optional audio evidence recording and quality marker.
- Generate external HTML/JSON report.

### Sprint 5: Demo Polish

- Add polished mobile UI.
- Add intervention timeline.
- Add business impact summary.
- Test full demo path repeatedly.
- Prepare fallback demo media.

## Success Criteria

The hack succeeds if:

- The demo feels like a live copilot, not a static analyzer.
- The app visibly uses Cars24 inspection-question fields.
- The AI interrupts the flow with useful guidance.
- The app auto-captures at least one photo after the AI says "good, hold still."
- Voice input fills at least one structured field.
- Guided engine-sound check is demonstrated.
- External report clearly improves Cars24's pricing/audit workflow.
- The build runs reliably in front of judges.

## Key Risks

### Too Much Native Complexity

Use Expo development build with VisionCamera first. If camera/audio evidence setup blocks progress, keep guided questions working and use demo media for evidence.

### Realtime Voice Takes Too Long

Fallback to push-to-talk and text-to-speech.

### Vision Model Latency

Use local checks immediately and AI critique on capture.

### Demo Data Fails

Keep curated bad/good sample images and optional audio files.

### Overclaiming

Always say "guided inspection and evidence validation" before saying "diagnosis."

## Final Positioning

Jockey Copilot is the real-time AI quality layer for Cars24 inspections.

It turns a static checklist into an active field coach.

It helps every inspector capture better evidence, fill cleaner data, and complete inspections with senior-level consistency.
