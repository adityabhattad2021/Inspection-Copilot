from html import escape
from typing import Any


def build_report_payload(
    *,
    report_id: str,
    session: dict[str, Any],
    evidence: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    ai_interventions: list[dict[str, Any]],
    generated_at: str,
) -> dict[str, Any]:
    session_id = session["sessionId"]
    steps = session["plan"]["steps"]
    completed_step_count = sum(1 for step in steps if step["status"] == "complete")
    total_step_count = len(steps)
    completion_score = _rounded_ratio(completed_step_count, total_step_count)
    media_quality_score = _media_quality_score(evidence)
    pricing_risk = _pricing_risk(observations, evidence)
    report_json_url = f"/sessions/{session_id}/report"
    report_html_url = f"/sessions/{session_id}/report.html"

    report_json = {
        "reportId": report_id,
        "sessionId": session_id,
        "generatedAt": generated_at,
        "vehicle": session["vehicle"],
        "summary": {
            "status": "ready",
            "completedStepCount": completed_step_count,
            "totalStepCount": total_step_count,
            "completionScore": completion_score,
            "mediaQualityScore": media_quality_score,
            "pricingRisk": pricing_risk,
            "acceptedEvidenceCount": sum(1 for item in evidence if item["accepted"]),
            "retakeCount": sum(1 for item in evidence if not item["accepted"]),
        },
        "steps": [_report_step(step) for step in steps],
        "evidence": evidence,
        "observations": observations,
        "aiInterventions": ai_interventions,
        "auditTrail": _audit_trail(evidence, observations, ai_interventions),
    }

    return {
        "reportId": report_id,
        "sessionId": session_id,
        "status": "ready",
        "completionScore": completion_score,
        "mediaQualityScore": media_quality_score,
        "pricingRisk": pricing_risk,
        "reportJson": report_json,
        "reportHtmlPath": report_html_url,
        "reportJsonUrl": report_json_url,
        "reportHtmlUrl": report_html_url,
        "downloadUrl": report_html_url,
        "createdAt": generated_at,
        "updatedAt": generated_at,
    }


def report_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "reportId": payload["reportId"],
        "sessionId": payload["sessionId"],
        "status": payload["status"],
        "completionScore": payload["completionScore"],
        "mediaQualityScore": payload["mediaQualityScore"],
        "pricingRisk": payload["pricingRisk"],
        "reportJsonUrl": f"/sessions/{payload['sessionId']}/report",
        "reportHtmlUrl": f"/sessions/{payload['sessionId']}/report.html",
        "downloadUrl": f"/sessions/{payload['sessionId']}/report.html",
        "createdAt": payload["createdAt"],
        "updatedAt": payload["updatedAt"],
    }


def render_report_html(report: dict[str, Any]) -> str:
    vehicle = report["vehicle"]
    summary = report["summary"]
    title = "AI Inspection Quality Report"
    vehicle_name = (
        f"{vehicle['year']} {vehicle['make']} {vehicle['model']} "
        f"{vehicle['variant']}"
    )
    steps = "".join(
        f"""
        <tr>
          <td>{escape(step["fieldName"])}</td>
          <td>{escape(step["section"])}</td>
          <td>{escape(_title(step["status"]))}</td>
        </tr>
        """
        for step in report["steps"]
    )
    evidence = "".join(
        f"""
        <tr>
          <td>{escape(_title(item["stepId"]))}</td>
          <td>{escape(item["kind"])}</td>
          <td>{item["qualityScore"]:.2f}</td>
          <td>{escape("Accepted" if item["accepted"] else "Retake")}</td>
        </tr>
        """
        for item in report["evidence"]
    )
    observations = "".join(_observation_html(item) for item in report["observations"])
    interventions = "".join(
        f"<li><strong>{escape(_title(item['stepId']))}:</strong> "
        f"{escape(item['message'])}</li>"
        for item in report["aiInterventions"]
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{title} - {escape(vehicle["registrationNumber"])}</title>
  <style>
    body {{
      color: #172026;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.5;
      margin: 32px;
    }}
    h1, h2 {{
      color: #111827;
      margin-bottom: 8px;
    }}
    .muted {{
      color: #52606d;
    }}
    .summary {{
      border: 1px solid #d7dde4;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin: 24px 0;
      padding: 16px;
    }}
    .metric-label {{
      color: #52606d;
      font-size: 12px;
      text-transform: uppercase;
    }}
    .metric-value {{
      font-size: 22px;
      font-weight: 700;
    }}
    table {{
      border-collapse: collapse;
      margin: 12px 0 24px;
      width: 100%;
    }}
    th, td {{
      border-bottom: 1px solid #d7dde4;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: #f5f7fa;
    }}
    ul {{
      padding-left: 20px;
    }}
  </style>
</head>
<body>
  <h1>{title}</h1>
  <p class="muted">{escape(vehicle_name)} | {escape(vehicle["registrationNumber"])}</p>
  <section class="summary">
    <div>
      <div class="metric-label">Completion</div>
      <div class="metric-value">{summary["completionScore"]:.0%}</div>
    </div>
    <div>
      <div class="metric-label">Media Quality</div>
      <div class="metric-value">{summary["mediaQualityScore"]:.2f}</div>
    </div>
    <div>
      <div class="metric-label">Pricing Risk</div>
      <div class="metric-value">{escape(_title(summary["pricingRisk"]))}</div>
    </div>
    <div>
      <div class="metric-label">Evidence</div>
      <div class="metric-value">{summary["acceptedEvidenceCount"]}</div>
    </div>
  </section>
  <h2>Checklist</h2>
  <table>
    <thead><tr><th>Field</th><th>Section</th><th>Status</th></tr></thead>
    <tbody>{steps}</tbody>
  </table>
  <h2>Evidence</h2>
  <table>
    <thead><tr><th>Step</th><th>Kind</th><th>Quality</th><th>Decision</th></tr></thead>
    <tbody>{evidence}</tbody>
  </table>
  <h2>Structured Observations</h2>
  <ul>{observations or "<li>No structured observations recorded.</li>"}</ul>
  <h2>AI Interventions</h2>
  <ul>{interventions or "<li>No AI interventions recorded.</li>"}</ul>
</body>
</html>"""


def _report_step(step: dict[str, Any]) -> dict[str, Any]:
    return {
        "stepId": step["id"],
        "fieldId": step["fieldId"],
        "fieldName": step["fieldName"],
        "section": step["section"],
        "kind": step["kind"],
        "status": step["status"],
    }


def _rounded_ratio(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 2)


def _media_quality_score(evidence: list[dict[str, Any]]) -> float:
    accepted = [item for item in evidence if item["accepted"]]
    if not accepted:
        return 0.0
    return round(
        sum(item["qualityScore"] for item in accepted) / len(accepted),
        2,
    )


def _pricing_risk(
    observations: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
) -> str:
    severe_values = {
        str(item.get("severity", "")).casefold()
        for item in observations
        if item.get("severity")
    }
    issues = {
        str(item.get("issue", "")).casefold()
        for item in observations
        if item.get("issue")
    }
    sample_keys = {
        str(item.get("metadata", {}).get("sampleKey", "")).casefold()
        for item in evidence
    }
    if severe_values.intersection({"major", "critical"}):
        return "high"
    if "minor" in severe_values or any(issue not in {"", "none"} for issue in issues):
        return "medium"
    if any("scratch" in sample_key for sample_key in sample_keys):
        return "medium"
    return "low"


def _audit_trail(
    evidence: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    ai_interventions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    entries = []
    entries.extend(
        {
            "createdAt": item["createdAt"],
            "kind": "evidence",
            "stepId": item["stepId"],
            "message": (
                "Evidence accepted" if item["accepted"] else "Evidence needs retake"
            ),
        }
        for item in evidence
    )
    entries.extend(
        {
            "createdAt": item["createdAt"],
            "kind": "observation",
            "stepId": item["stepId"],
            "message": item.get("issue") or "Structured observation recorded",
        }
        for item in observations
    )
    entries.extend(
        {
            "createdAt": item["createdAt"],
            "kind": "ai_intervention",
            "stepId": item["stepId"],
            "message": item["message"],
        }
        for item in ai_interventions
    )
    return sorted(entries, key=lambda item: item["createdAt"])


def _observation_html(item: dict[str, Any]) -> str:
    fields = ", ".join(
        f"{_title(key)}: {_display_value(value)}"
        for key, value in item["structuredFields"].items()
    )
    issue = item.get("issue") or "Observation"
    return (
        f"<li><strong>{escape(_title(issue))}:</strong> "
        f"{escape(fields or item.get('transcript') or 'Recorded')}</li>"
    )


def _display_value(value: Any) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)


def _title(value: str) -> str:
    return value.replace("-", " ").replace("_", " ").title()
