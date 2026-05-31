import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse

from app.database import list_report_payloads
from app.services.report_generator import MEDIA_REVIEW_THRESHOLD

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_token() -> str:
    token = os.environ.get("INSPECTION_COPILOT_ADMIN_TOKEN", "").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="INSPECTION_COPILOT_ADMIN_TOKEN is not configured",
        )
    return token


def _request_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    scheme, _, value = authorization.partition(" ")
    if scheme.casefold() == "bearer" and value:
        return value.strip()
    token = request.query_params.get("token")
    return token.strip() if token else None


def _require_admin(request: Request) -> None:
    if _request_token(request) != _admin_token():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin token is required",
        )


def _admin_report_item(payload: dict[str, Any]) -> dict[str, Any]:
    report_json = payload.get("reportJson", {})
    summary = report_json.get("summary", {})
    presentation = report_json.get("presentation", {})
    badges = presentation.get("badges", [])
    evidence_summary = _admin_evidence_summary(report_json)
    evidence_badge = next(
        (badge for badge in badges if badge.get("label") == "Evidence complete"),
        _fallback_evidence_badge(evidence_summary),
    )
    primary_badge = next(
        (
            badge
            for badge in badges
            if badge.get("label") in {"Needs review", "Low pricing risk"}
        ),
        _fallback_primary_badge(
            evidence_summary=evidence_summary,
            media_quality_score=payload["mediaQualityScore"],
            pricing_risk=payload["pricingRisk"],
        ),
    )
    session_id = payload["sessionId"]
    return {
        "reportId": payload["reportId"],
        "sessionId": session_id,
        "vehicle": report_json.get("vehicle", {}),
        "generatedAt": report_json.get("generatedAt") or payload["createdAt"],
        "createdAt": payload["createdAt"],
        "completionScore": payload["completionScore"],
        "mediaQualityScore": payload["mediaQualityScore"],
        "pricingRisk": payload["pricingRisk"],
        "acceptedEvidenceCount": evidence_summary["acceptedEvidenceCount"],
        "expectedEvidenceCount": evidence_summary["expectedEvidenceCount"],
        "retakeCount": summary.get("retakeCount", 0),
        "badge": primary_badge,
        "evidenceBadge": evidence_badge,
        "reportJsonUrl": f"/sessions/{session_id}/report",
        "reportViewUrl": f"/sessions/{session_id}/report.html?view=1",
        "reportHtmlUrl": f"/sessions/{session_id}/report.html",
        "downloadUrl": f"/sessions/{session_id}/report.html",
    }


def _admin_evidence_summary(report_json: dict[str, Any]) -> dict[str, Any]:
    presentation_summary = report_json.get("presentation", {}).get("evidenceSummary")
    if presentation_summary:
        return {
            "acceptedEvidenceCount": presentation_summary.get(
                "acceptedEvidenceCount",
                0,
            ),
            "expectedEvidenceCount": presentation_summary.get(
                "expectedEvidenceCount",
                0,
            ),
            "isComplete": bool(presentation_summary.get("isComplete")),
        }

    steps = report_json.get("steps", [])
    evidence = report_json.get("evidence", [])
    expected_step_ids = {
        step.get("stepId") or step.get("id")
        for step in steps
        if step.get("kind") == "photo"
    }
    expected_step_ids.discard(None)
    accepted_step_ids = {
        item.get("stepId")
        for item in evidence
        if item.get("kind") == "photo" and item.get("accepted")
    }
    accepted_step_ids.discard(None)
    accepted_count = len(expected_step_ids.intersection(accepted_step_ids))
    expected_count = len(expected_step_ids)
    return {
        "acceptedEvidenceCount": accepted_count,
        "expectedEvidenceCount": expected_count,
        "isComplete": expected_count > 0 and accepted_count == expected_count,
    }


def _fallback_primary_badge(
    *,
    evidence_summary: dict[str, Any],
    media_quality_score: float,
    pricing_risk: str,
) -> dict[str, str]:
    if (
        pricing_risk == "low"
        and media_quality_score >= MEDIA_REVIEW_THRESHOLD
        and evidence_summary["isComplete"]
    ):
        return {
            "label": "Low pricing risk",
            "reason": "No major pricing risk signals were recorded.",
            "tone": "success",
        }
    return {
        "label": "Needs review",
        "reason": "Pricing, media, or evidence signals need human review.",
        "tone": "warning" if pricing_risk != "high" else "danger",
    }


def _fallback_evidence_badge(evidence_summary: dict[str, Any]) -> dict[str, str]:
    if evidence_summary["isComplete"]:
        return {
            "label": "Evidence complete",
            "reason": "All required photo evidence has been accepted.",
            "tone": "success",
        }
    return {
        "label": "Evidence needs review",
        "reason": "Required photo evidence is incomplete.",
        "tone": "warning",
    }


@router.get("/reports", response_class=HTMLResponse)
def admin_reports_dashboard(request: Request) -> HTMLResponse:
    _require_admin(request)
    return HTMLResponse(content=_render_dashboard_html())


@router.get("/reports.json")
def list_admin_reports(request: Request) -> dict[str, Any]:
    _require_admin(request)
    return {
        "reports": [
            _admin_report_item(payload)
            for payload in list_report_payloads()
        ]
    }


def _render_dashboard_html() -> str:
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reports Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: light;
      --background: #F6F7F2;
      --camera: #101820;
      --camera-raised: #17211F;
      --surface: #FFFFFF;
      --surface-muted: #ECEFE8;
      --surface-strong: #DFE6D8;
      --border: #D7DED0;
      --border-strong: #AEB8A5;
      --text: #111611;
      --text-muted: #5E665C;
      --text-subtle: #7B8478;
      --text-on-dark: #F7FAEF;
      --ai: #D7F85C;
      --ai-soft: #EEF9BE;
      --ai-text: #23310B;
      --success: #11845B;
      --success-soft: #DFF4EA;
      --warning: #B7791F;
      --warning-soft: #FFF0C2;
      --danger: #C73D3D;
      --danger-soft: #FCE1DD;
    }
    * {
      box-sizing: border-box;
    }
    body {
      background: var(--background);
      color: var(--text);
      font-family: "JetBrains Mono", monospace;
      margin: 0;
    }
    button, input {
      font: inherit;
    }
    .app {
      margin: 0 auto;
      max-width: 1180px;
      padding: 24px;
    }
    .topbar {
      align-items: center;
      display: flex;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    h1 {
      font-size: 30px;
      letter-spacing: 0;
      line-height: 1.1;
      margin: 0;
    }
    .muted {
      color: var(--text-muted);
    }
    .toolbar {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }
    .search {
      background: var(--surface);
      border: 1.5px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      min-width: 280px;
      padding: 10px 12px;
    }
    .search:focus {
      border-color: var(--camera);
      outline: 2px solid var(--ai-soft);
    }
    .button {
      background: var(--ai);
      border: 1.5px solid var(--ai-text);
      border-radius: 8px;
      color: var(--ai-text);
      cursor: pointer;
      font-weight: 700;
      padding: 10px 12px;
      text-decoration: none;
    }
    .button.secondary {
      background: var(--camera);
      border-color: var(--camera);
      color: var(--text-on-dark);
    }
    .report-list {
      display: grid;
      gap: 10px;
    }
    .report-card {
      align-items: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 8px 22px rgba(17, 22, 17, 0.08);
      display: grid;
      gap: 12px;
      grid-template-columns: 1.6fr 0.8fr 0.8fr 1fr auto;
      padding: 14px;
    }
    .vehicle {
      font-weight: 700;
    }
    .meta {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 3px;
    }
    .metric-label {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
    }
    .metric-value {
      font-size: 20px;
      font-weight: 700;
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge {
      border-radius: 999px;
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 9px;
    }
    .badge-success {
      background: var(--success-soft);
      border: 1px solid var(--success);
      color: var(--success);
    }
    .badge-warning {
      background: var(--warning-soft);
      border: 1px solid var(--warning);
      color: var(--warning);
    }
    .badge-danger {
      background: var(--danger-soft);
      border: 1px solid var(--danger);
      color: var(--danger);
    }
    .badge-info {
      background: var(--surface-muted);
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .state {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
    }
    @media (max-width: 860px) {
      .app {
        padding: 14px;
      }
      .topbar, .toolbar {
        align-items: stretch;
        flex-direction: column;
      }
      .search {
        min-width: 0;
        width: 100%;
      }
      .report-card {
        align-items: stretch;
        grid-template-columns: 1fr;
      }
      .actions {
        justify-content: flex-start;
      }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script>
    const e = React.createElement;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";

    function pct(value) {
      return `${Math.round((Number(value) || 0) * 100)}%`;
    }

    function vehicleTitle(vehicle) {
      if (!vehicle || !vehicle.make) return "Unknown vehicle";
      return `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.variant}`;
    }

    function Badge({ badge }) {
      const tone = badge?.tone || "info";
      return e("span", { className: `badge badge-${tone}` }, badge?.label || "Report");
    }

    function ReportCard({ report }) {
      return e("article", { className: "report-card" },
        e("div", null,
          e("div", { className: "vehicle" }, vehicleTitle(report.vehicle)),
          e("div", { className: "meta" }, `${report.vehicle.registrationNumber || ""} · ${new Date(report.generatedAt).toLocaleString()}`),
          e("div", { className: "badge-row" },
            e(Badge, { badge: report.badge }),
            e(Badge, { badge: report.evidenceBadge })
          )
        ),
        e("div", null,
          e("div", { className: "metric-label" }, "Completion"),
          e("div", { className: "metric-value" }, pct(report.completionScore))
        ),
        e("div", null,
          e("div", { className: "metric-label" }, "Media"),
          e("div", { className: "metric-value" }, Number(report.mediaQualityScore || 0).toFixed(2))
        ),
        e("div", null,
          e("div", { className: "metric-label" }, "Evidence"),
          e("div", { className: "metric-value" }, `${report.acceptedEvidenceCount}/${report.expectedEvidenceCount}`)
        ),
        e("div", { className: "actions" },
          e("a", { className: "button", href: report.reportViewUrl, target: "_blank", rel: "noreferrer" }, "Open"),
          e("a", { className: "button secondary", href: report.downloadUrl, target: "_blank", rel: "noreferrer" }, "Download"),
          e("a", { className: "button secondary", href: report.reportJsonUrl, target: "_blank", rel: "noreferrer" }, "JSON")
        )
      );
    }

    function App() {
      const [reports, setReports] = React.useState([]);
      const [query, setQuery] = React.useState("");
      const [error, setError] = React.useState("");
      const [loading, setLoading] = React.useState(true);

      const loadReports = React.useCallback(() => {
        setLoading(true);
        setError("");
        fetch("/admin/reports.json", {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((response) => {
            if (!response.ok) throw new Error(`Unable to load reports (${response.status})`);
            return response.json();
          })
          .then((data) => setReports(data.reports || []))
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false));
      }, []);

      React.useEffect(loadReports, [loadReports]);

      const normalizedQuery = query.trim().toLowerCase();
      const filtered = reports.filter((report) => {
        const searchable = [
          vehicleTitle(report.vehicle),
          report.vehicle?.registrationNumber,
          report.pricingRisk,
          report.badge?.label,
          report.evidenceBadge?.label
        ].join(" ").toLowerCase();
        return !normalizedQuery || searchable.includes(normalizedQuery);
      });

      return e("main", { className: "app" },
        e("section", { className: "topbar" },
          e("div", null,
            e("h1", null, "Reports Admin"),
            e("div", { className: "muted" }, `${reports.length} generated reports`)
          ),
          e("button", { className: "button", onClick: loadReports }, "Refresh")
        ),
        e("section", { className: "toolbar" },
          e("input", {
            className: "search",
            onChange: (event) => setQuery(event.target.value),
            placeholder: "Search registration, vehicle, risk, badge",
            value: query
          })
        ),
        error
          ? e("section", { className: "state" }, error)
          : loading
            ? e("section", { className: "state" }, "Loading reports...")
            : filtered.length
              ? e("section", { className: "report-list" }, filtered.map((report) => e(ReportCard, { key: report.reportId, report })))
              : e("section", { className: "state" }, "No reports have been generated yet.")
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(e(App));
  </script>
</body>
</html>"""
