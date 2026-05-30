# Admin Report Dashboard And Rich Report Design

## Context

Cars24 Jockey Copilot already generates report metadata and serves report JSON/HTML from FastAPI after an inspection is completed. The current report is useful but basic: it exposes completion, media quality, pricing risk, evidence, observations, interventions, and an audit trail without enough visual hierarchy or admin workflow polish.

The next enhancement should make the generated report feel demo-ready for pricing and audit teams, and add a small admin-only dashboard where generated reports can be reviewed and downloaded.

## Goals

- Make each generated report highly informative and visually impressive for the hackathon demo.
- Add a lightweight React admin dashboard for listing generated reports.
- Allow reports to be opened/downloaded from the dashboard as HTML or JSON.
- Show clear report metadata badges, including low pricing risk, needs review, and evidence complete.
- Keep the solution backend-served and easy to deploy on the existing EC2 FastAPI service.
- Protect the dashboard with a simple admin token configured through environment.

## Non-Goals

- Do not add email delivery in this iteration.
- Do not add a separate Vite or Expo admin app.
- Do not add real user management, roles, or OAuth.
- Do not change the mobile inspection flow unless needed to keep API contracts aligned.
- Do not introduce new external dependencies unless the existing stack cannot cover the implementation.

## Recommended Approach

Serve a small React dashboard directly from the FastAPI backend at `/admin/reports`. The page can load React from a CDN and call backend admin JSON endpoints. This avoids a new frontend build/deploy pipeline while still satisfying the need for a React admin surface.

The admin routes should require `JOCKEY_COPILOT_ADMIN_TOKEN`. A request is authorized if the token is supplied either as a bearer token or as a query parameter for demo convenience. If the env var is missing, admin routes should fail closed with a clear server-side configuration error.

## Backend API Design

Add admin endpoints:

- `GET /admin/reports`
  - Returns the React dashboard HTML shell.
  - Requires admin token.
- `GET /admin/reports.json`
  - Returns a list of generated report metadata.
  - Requires admin token.

The list payload should include:

- `reportId`
- `sessionId`
- `vehicle`
- `generatedAt` or `createdAt`
- `completionScore`
- `mediaQualityScore`
- `pricingRisk`
- `acceptedEvidenceCount`
- `expectedEvidenceCount`
- `retakeCount`
- `badge`
- `reportJsonUrl`
- `reportHtmlUrl`
- `downloadUrl`

Add database support for listing reports:

- SQLite adapter: list rows from `reports`, parse `report_json`, sort newest first.
- DynamoDB adapter: query or scan report items by `entityType = report`, sort newest first.

## Rich Report Payload Design

Extend the existing report JSON without breaking current fields. Add a `presentation` or equivalent section containing derived, dashboard-ready insights:

- `headline`: concise executive summary for pricing/audit.
- `badges`: normalized badge objects with label, tone, and reason.
- `pricingNotes`: actionable review notes for the pricing team.
- `auditNotes`: evidence and process notes for audit reviewers.
- `evidenceSummary`: accepted count, expected photo count, retake count, missing steps, completeness boolean.
- `qualitySignals`: strongest positives and review warnings.
- `engineSummary`: structured engine check outcome and severity.

Keep existing top-level report fields stable:

- `summary`
- `steps`
- `evidence`
- `observations`
- `aiInterventions`
- `auditTrail`

## Badge Rules

Use deterministic rules so the demo is reliable:

- `Low pricing risk`
  - Show when `pricingRisk` is `low`.
- `Needs review`
  - Show when `pricingRisk` is `medium` or `high`.
  - Also show when media quality is below the chosen threshold or evidence is incomplete.
- `Evidence complete`
  - Show when all expected photo steps have accepted evidence.

The admin dashboard can display one primary badge and additional supporting chips. The rich report HTML should display all relevant badges with short reasons.

## Report HTML Design

Replace the current plain document styling with a premium, dashboard-like report:

- Strong top header with vehicle identity, registration, report timestamp, and risk badge.
- Score cards for completion, media quality, accepted evidence, retakes, and pricing risk.
- Evidence completeness strip with expected versus accepted photo evidence.
- Pricing review panel with concise notes.
- Engine inspection panel showing knocking, rattling, vibration, exhaust status, and severity.
- Checklist table grouped by Cars24 section.
- Evidence table with quality score and decision.
- AI intervention timeline with timestamps, step names, messages, and confidence.
- Audit trail section for traceability.

The report must remain a single downloadable HTML file and should not require external assets to render properly.

## Admin Dashboard UI Design

The dashboard should be operational and compact, not a marketing page:

- Header: "Reports Admin" with count of reports and refresh action.
- Search/filter: registration number, vehicle, or risk text.
- Report cards or table rows showing:
  - vehicle name and registration
  - generated time
  - completion score
  - media quality score
  - primary badge
  - evidence badge
  - open HTML button
  - download JSON button
- Empty state: tells the admin no reports have been generated yet.
- Error state: tells the admin when the token is invalid or the backend cannot load reports.

Use simple, responsive CSS embedded in the admin HTML. Cards should stay compact and readable on desktop and mobile.

## Security Design

Admin access is intentionally lightweight for the hackathon:

- Require `JOCKEY_COPILOT_ADMIN_TOKEN`.
- Accept `Authorization: Bearer <token>` for API calls.
- Accept `?token=<token>` for opening the HTML dashboard during demos.
- The dashboard should keep the token in memory and include it in API calls.
- Do not store secrets in mobile code or committed files.
- Do not expose admin endpoints without a valid token.

## Error Handling

- Missing admin env token: return `500` with a clear configuration message.
- Invalid/missing request token: return `401`.
- Empty report list: return an empty list and show an admin-friendly empty state.
- Malformed historical report JSON: skip only the malformed derived fields where possible, while preserving basic metadata.

## Testing

Backend tests should cover:

- Rich report JSON contains new derived sections while preserving existing fields.
- HTML report includes risk badge, evidence completeness, pricing notes, and engine section.
- Admin report list returns generated reports newest first.
- Admin endpoints reject missing/invalid tokens.
- Admin endpoints allow a valid bearer token or query token.

Run the smallest relevant acceptance command once after implementation:

```bash
make backend-test
```

## Open Decisions

- The exact admin token value is deployment configuration and should not be committed.
- Email delivery remains deferred until after the dashboard/report upgrade.
