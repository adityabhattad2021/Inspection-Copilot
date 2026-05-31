from html import escape
from typing import Any

MEDIA_REVIEW_THRESHOLD = 0.85


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
    evidence_summary = _evidence_summary(steps, evidence)
    engine_summary = _engine_summary(observations)
    report_evidence = [_report_evidence_item(session_id, item) for item in evidence]
    presentation = _presentation_insights(
        completion_score=completion_score,
        media_quality_score=media_quality_score,
        pricing_risk=pricing_risk,
        evidence_summary=evidence_summary,
        engine_summary=engine_summary,
        observations=observations,
        ai_interventions=ai_interventions,
    )
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
            "expectedEvidenceCount": evidence_summary["expectedEvidenceCount"],
            "retakeCount": sum(1 for item in evidence if not item["accepted"]),
        },
        "presentation": presentation,
        "steps": [_report_step(step) for step in steps],
        "evidence": report_evidence,
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
    report_json = payload.get("reportJson", {})
    summary = report_json.get("summary", {})
    return {
        "reportId": payload["reportId"],
        "sessionId": payload["sessionId"],
        "status": payload["status"],
        "completionScore": payload["completionScore"],
        "mediaQualityScore": payload["mediaQualityScore"],
        "pricingRisk": payload["pricingRisk"],
        "acceptedEvidenceCount": summary.get("acceptedEvidenceCount", 0),
        "expectedEvidenceCount": summary.get("expectedEvidenceCount", 0),
        "retakeCount": summary.get("retakeCount", 0),
        "reportJsonUrl": f"/sessions/{payload['sessionId']}/report",
        "reportHtmlUrl": f"/sessions/{payload['sessionId']}/report.html",
        "downloadUrl": f"/sessions/{payload['sessionId']}/report.html",
        "createdAt": payload["createdAt"],
        "updatedAt": payload["updatedAt"],
    }


def render_report_html(report: dict[str, Any]) -> str:
    vehicle = report["vehicle"]
    summary = report["summary"]
    presentation = report.get("presentation", {})
    if not presentation:
        evidence_summary = _evidence_summary(
            report.get("steps", []),
            report.get("evidence", []),
        )
        engine_summary = _engine_summary(report.get("observations", []))
        presentation = _presentation_insights(
            completion_score=summary.get("completionScore", 0.0),
            media_quality_score=summary.get("mediaQualityScore", 0.0),
            pricing_risk=summary.get("pricingRisk", "low"),
            evidence_summary=evidence_summary,
            engine_summary=engine_summary,
            observations=report.get("observations", []),
            ai_interventions=report.get("aiInterventions", []),
        )
    else:
        evidence_summary = presentation.get("evidenceSummary", {})
        engine_summary = presentation.get("engineSummary", {})
    accepted_evidence_count = evidence_summary.get(
        "acceptedEvidenceCount",
        summary.get("acceptedEvidenceCount", 0),
    )
    expected_evidence_count = evidence_summary.get(
        "expectedEvidenceCount",
        summary.get("expectedEvidenceCount", 0),
    )
    title = "AI Inspection Quality Report"
    vehicle_name = (
        f"{vehicle['year']} {vehicle['make']} {vehicle['model']} "
        f"{vehicle['variant']}"
    )
    download_url = f"/sessions/{report['sessionId']}/report.html"
    badges = "".join(
        f'<span class="badge badge-{escape(badge["tone"])}">'
        f'{escape(badge["label"])}</span>'
        for badge in presentation.get("badges", [])
    )
    pricing_notes = "".join(
        f"<li>{escape(note)}</li>" for note in presentation.get("pricingNotes", [])
    )
    audit_notes = "".join(
        f"<li>{escape(note)}</li>" for note in presentation.get("auditNotes", [])
    )
    positives = "".join(
        f"<li>{escape(note)}</li>"
        for note in presentation.get("qualitySignals", {}).get("positives", [])
    )
    warnings = "".join(
        f"<li>{escape(note)}</li>"
        for note in presentation.get("qualitySignals", {}).get("warnings", [])
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
    evidence_photos = "".join(
        _evidence_photo_html(report["sessionId"], item)
        for item in report["evidence"]
        if item.get("kind") == "photo"
    )
    interventions = "".join(
        f"""
        <li>
          <span>{escape(_format_timestamp(item["createdAt"]))}</span>
          <strong>{escape(_title(item['stepId']))}</strong>
          {escape(item['message'])}
          <em>{item.get("confidence", 0.0):.0%} confidence</em>
        </li>
        """
        for item in report["aiInterventions"]
    )
    audit_trail = "".join(
        f"""
        <li>
          <span>{escape(_format_timestamp(item["createdAt"]))}</span>
          <strong>{escape(_title(item["kind"]))}</strong>
          {escape(_title(item["stepId"]))}: {escape(item["message"])}
        </li>
        """
        for item in report["auditTrail"]
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{title} - {escape(vehicle["registrationNumber"])}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {{
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
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      background: var(--background);
      color: var(--text);
      font-family: "JetBrains Mono", monospace;
      line-height: 1.5;
      margin: 0;
    }}
    main {{
      margin: 0 auto;
      max-width: 1180px;
      padding: 28px;
    }}
    h1, h2, h3 {{
      margin: 0;
    }}
    .muted {{
      color: var(--text-muted);
    }}
    .hero {{
      background: var(--camera);
      border: 1px solid rgba(247, 250, 239, 0.12);
      border-radius: 8px;
      color: var(--text-on-dark);
      margin-bottom: 18px;
      padding: 28px;
    }}
    .hero-top {{
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }}
    .hero-actions {{
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }}
    .report-button {{
      background: var(--ai);
      border: 1.5px solid var(--ai-text);
      border-radius: 8px;
      color: var(--ai-text);
      display: inline-block;
      font-weight: 700;
      padding: 9px 12px;
      text-decoration: none;
    }}
    .hero h1 {{
      font-size: 34px;
      letter-spacing: 0;
      line-height: 1.05;
      margin-top: 18px;
    }}
    .hero p {{
      color: var(--text-on-dark);
      margin: 10px 0 0;
      max-width: 760px;
    }}
    .summary {{
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin: 18px 0;
    }}
    .panel, .metric {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 8px 22px rgba(17, 22, 17, 0.08);
      padding: 16px;
    }}
    .metric-label {{
      color: var(--text-muted);
      font-size: 12px;
      text-transform: uppercase;
    }}
    .metric-value {{
      font-size: 22px;
      font-weight: 700;
    }}
    .badge-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }}
    .badge {{
      border-radius: 999px;
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 10px;
    }}
    .badge-success {{
      background: var(--success-soft);
      border: 1px solid var(--success);
      color: var(--success);
    }}
    .badge-warning {{
      background: var(--warning-soft);
      border: 1px solid var(--warning);
      color: var(--warning);
    }}
    .badge-danger {{
      background: var(--danger-soft);
      border: 1px solid var(--danger);
      color: var(--danger);
    }}
    .badge-info {{
      background: var(--surface-muted);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }}
    .grid {{
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: 18px 0;
    }}
    .section {{
      margin-top: 18px;
    }}
    .section h2 {{
      font-size: 20px;
      margin-bottom: 10px;
    }}
    .evidence-strip {{
      align-items: center;
      background: var(--ai-soft);
      border: 1px solid var(--ai);
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      padding: 14px 16px;
    }}
    .photo-grid {{
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }}
    .photo-card {{
      background: var(--surface-muted);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }}
    .photo-card img {{
      aspect-ratio: 4 / 3;
      background: var(--camera);
      display: block;
      object-fit: cover;
      width: 100%;
    }}
    .photo-copy {{
      padding: 12px;
    }}
    .photo-copy strong {{
      display: block;
      margin-bottom: 4px;
    }}
    .photo-copy span {{
      color: var(--text-muted);
      display: block;
      font-size: 12px;
      line-height: 16px;
    }}
    table {{
      border-collapse: collapse;
      margin: 12px 0 24px;
      width: 100%;
    }}
    th, td {{
      border-bottom: 1px solid var(--border);
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: var(--surface-muted);
    }}
    ul, ol {{
      margin: 10px 0 0;
      padding-left: 20px;
    }}
    .timeline {{
      list-style: none;
      padding-left: 0;
    }}
    .timeline li {{
      border-left: 3px solid var(--ai);
      margin-bottom: 10px;
      padding-left: 12px;
    }}
    .timeline span {{
      color: var(--text-muted);
      display: block;
      font-size: 12px;
    }}
    .timeline em {{
      color: var(--text-muted);
      display: block;
      font-size: 12px;
      font-style: normal;
    }}
    @media (max-width: 820px) {{
      main {{
        padding: 14px;
      }}
      .summary, .grid {{
        grid-template-columns: 1fr;
      }}
      .hero h1 {{
        font-size: 28px;
      }}
    }}
  </style>
</head>
<body>
<main>
  <section class="hero">
    <div class="hero-top">
      <strong>Inspection Copilot</strong>
      <div class="hero-actions">
        <span>{escape(_format_timestamp(report["generatedAt"]))}</span>
        <a class="report-button" href="{escape(download_url)}">Download HTML</a>
      </div>
    </div>
    <h1>{title}</h1>
    <p>{escape(vehicle_name)} | {escape(vehicle["registrationNumber"])}</p>
    <p>{escape(presentation.get("headline", "Inspection report ready for review."))}</p>
    <div class="badge-row">{badges}</div>
  </section>
  <section class="summary">
    <div class="metric">
      <div class="metric-label">Completion</div>
      <div class="metric-value">{summary["completionScore"]:.0%}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Media Quality</div>
      <div class="metric-value">{summary["mediaQualityScore"]:.2f}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Pricing Risk</div>
      <div class="metric-value">{escape(_title(summary["pricingRisk"]))}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Evidence</div>
      <div class="metric-value">{accepted_evidence_count}/{expected_evidence_count}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Retakes</div>
      <div class="metric-value">{summary["retakeCount"]}</div>
    </div>
  </section>
  <section class="evidence-strip">
    <strong>{escape("Evidence complete" if evidence_summary.get("isComplete") else "Evidence needs review")}</strong>
    <span>{evidence_summary.get("acceptedEvidenceCount", 0)} of {evidence_summary.get("expectedEvidenceCount", 0)} required photos accepted</span>
  </section>
  <section class="grid">
    <div class="panel">
      <h2>Pricing review</h2>
      <ul>{pricing_notes or "<li>No pricing review notes.</li>"}</ul>
    </div>
    <div class="panel">
      <h2>Engine inspection</h2>
      <p><strong>Severity:</strong> {escape(_title(str(engine_summary.get("severity", "normal"))))}</p>
      <p><strong>Issue:</strong> {escape(_title(str(engine_summary.get("issue") or "none")))}</p>
      <ul>
        <li>Knocking: {escape(_display_value(engine_summary.get("fields", {}).get("knocking", False)))}</li>
        <li>Rattling: {escape(_display_value(engine_summary.get("fields", {}).get("rattling", False)))}</li>
        <li>Vibration: {escape(_display_value(engine_summary.get("fields", {}).get("abnormalVibration", "not observed")))}</li>
        <li>Exhaust: {escape(_display_value(engine_summary.get("fields", {}).get("exhaustSound", "not recorded")))}</li>
      </ul>
    </div>
  </section>
  <section class="grid">
    <div class="panel">
      <h2>Quality signals</h2>
      <h3>Strengths</h3>
      <ul>{positives or "<li>No positive signals recorded.</li>"}</ul>
      <h3>Warnings</h3>
      <ul>{warnings or "<li>No warnings recorded.</li>"}</ul>
    </div>
    <div class="panel">
      <h2>Audit notes</h2>
      <ul>{audit_notes or "<li>No audit notes recorded.</li>"}</ul>
    </div>
  </section>
  <section class="panel section">
    <h2>Checklist</h2>
    <table>
      <thead><tr><th>Field</th><th>Section</th><th>Status</th></tr></thead>
      <tbody>{steps}</tbody>
    </table>
  </section>
  <section class="panel section">
    <h2>Evidence photos</h2>
    <div class="photo-grid">{evidence_photos or "<p>No captured photo evidence available.</p>"}</div>
  </section>
  <section class="panel section">
    <h2>Evidence</h2>
    <table>
      <thead><tr><th>Step</th><th>Kind</th><th>Quality</th><th>Decision</th></tr></thead>
      <tbody>{evidence}</tbody>
    </table>
  </section>
  <section class="panel section">
    <h2>Structured Observations</h2>
    <ul>{observations or "<li>No structured observations recorded.</li>"}</ul>
  </section>
  <section class="panel section">
    <h2>AI Interventions</h2>
    <ol class="timeline">{interventions or "<li>No AI interventions recorded.</li>"}</ol>
  </section>
  <section class="panel section">
    <h2>Audit Trail</h2>
    <ol class="timeline">{audit_trail or "<li>No audit events recorded.</li>"}</ol>
  </section>
</main>
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


def _report_evidence_item(session_id: str, item: dict[str, Any]) -> dict[str, Any]:
    report_item = {**item}
    if item.get("kind") == "photo" and item.get("id"):
        report_item["imageUrl"] = f"/sessions/{session_id}/evidence/{item['id']}"
    return report_item


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


def _evidence_summary(
    steps: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    expected_step_ids = [
        step.get("id") or step.get("stepId")
        for step in steps
        if step.get("kind") == "photo"
    ]
    accepted_step_ids = {
        item["stepId"]
        for item in evidence
        if item.get("kind") == "photo" and item.get("accepted")
    }
    expected_step_ids = [step_id for step_id in expected_step_ids if step_id]
    missing_step_ids = [
        step_id for step_id in expected_step_ids if step_id not in accepted_step_ids
    ]
    return {
        "acceptedEvidenceCount": len(
            [step_id for step_id in expected_step_ids if step_id in accepted_step_ids]
        ),
        "expectedEvidenceCount": len(expected_step_ids),
        "isComplete": not missing_step_ids,
        "missingStepIds": missing_step_ids,
        "retakeCount": sum(1 for item in evidence if not item.get("accepted")),
    }


def _engine_summary(observations: list[dict[str, Any]]) -> dict[str, Any]:
    observation = next(
        (
            item
            for item in observations
            if item.get("stepId") == "engine-sound"
        ),
        None,
    )
    if observation is None:
        return {
            "confidence": 0.0,
            "fields": {},
            "issue": None,
            "severity": "not recorded",
            "transcript": "",
        }
    return {
        "confidence": observation.get("confidence", 0.0),
        "fields": observation.get("structuredFields", {}),
        "issue": observation.get("issue"),
        "severity": observation.get("severity") or "normal",
        "transcript": observation.get("transcript") or "",
    }


def _presentation_insights(
    *,
    completion_score: float,
    media_quality_score: float,
    pricing_risk: str,
    evidence_summary: dict[str, Any],
    engine_summary: dict[str, Any],
    observations: list[dict[str, Any]],
    ai_interventions: list[dict[str, Any]],
) -> dict[str, Any]:
    badges = _badges(pricing_risk, media_quality_score, evidence_summary)
    pricing_notes = _pricing_notes(
        pricing_risk=pricing_risk,
        media_quality_score=media_quality_score,
        evidence_summary=evidence_summary,
        engine_summary=engine_summary,
        observations=observations,
    )
    audit_notes = _audit_notes(evidence_summary, ai_interventions)
    quality_signals = _quality_signals(
        completion_score=completion_score,
        media_quality_score=media_quality_score,
        evidence_summary=evidence_summary,
        ai_interventions=ai_interventions,
    )
    if pricing_risk == "low" and evidence_summary["isComplete"]:
        headline = "Low pricing risk with complete photo evidence ready for audit."
    else:
        headline = (
            "Pricing review recommended because the inspection includes "
            f"{_title(pricing_risk)} risk signals."
        )
    return {
        "headline": headline,
        "badges": badges,
        "pricingNotes": pricing_notes,
        "auditNotes": audit_notes,
        "evidenceSummary": evidence_summary,
        "qualitySignals": quality_signals,
        "engineSummary": engine_summary,
    }


def _badges(
    pricing_risk: str,
    media_quality_score: float,
    evidence_summary: dict[str, Any],
) -> list[dict[str, str]]:
    badges = []
    needs_review = (
        pricing_risk in {"medium", "high"}
        or media_quality_score < MEDIA_REVIEW_THRESHOLD
        or not evidence_summary["isComplete"]
    )
    if needs_review:
        badges.append(
            {
                "label": "Needs review",
                "reason": "Pricing, media, or evidence signals need human review.",
                "tone": "warning" if pricing_risk != "high" else "danger",
            }
        )
    else:
        badges.append(
            {
                "label": "Low pricing risk",
                "reason": "No major pricing risk signals were recorded.",
                "tone": "success",
            }
        )
    if evidence_summary["isComplete"]:
        badges.append(
            {
                "label": "Evidence complete",
                "reason": "All required photo evidence has been accepted.",
                "tone": "success",
            }
        )
    return badges


def _pricing_notes(
    *,
    pricing_risk: str,
    media_quality_score: float,
    evidence_summary: dict[str, Any],
    engine_summary: dict[str, Any],
    observations: list[dict[str, Any]],
) -> list[str]:
    notes = []
    if pricing_risk in {"medium", "high"}:
        notes.append(f"{_title(pricing_risk)} pricing risk flagged for reviewer attention.")
    engine_issue = engine_summary.get("issue")
    if engine_issue:
        notes.append(
            f"Engine check flagged {engine_issue}; verify impact before final offer."
        )
    if media_quality_score < MEDIA_REVIEW_THRESHOLD:
        notes.append("Media quality is below the review threshold; inspect evidence manually.")
    if not evidence_summary["isComplete"]:
        missing = ", ".join(_title(step_id) for step_id in evidence_summary["missingStepIds"])
        notes.append(f"Missing accepted evidence for: {missing}.")
    for observation in observations:
        issue = observation.get("issue")
        if issue and issue not in {"none", engine_issue}:
            notes.append(f"{_title(issue)} observed in {_title(observation['stepId'])}.")
    if not notes:
        notes.append("No material pricing risk signals were recorded.")
    return notes


def _audit_notes(
    evidence_summary: dict[str, Any],
    ai_interventions: list[dict[str, Any]],
) -> list[str]:
    notes = [
        (
            f"{evidence_summary['acceptedEvidenceCount']} of "
            f"{evidence_summary['expectedEvidenceCount']} required photo evidence "
            "items were accepted."
        )
    ]
    if evidence_summary["retakeCount"]:
        notes.append(f"{evidence_summary['retakeCount']} retake events are present.")
    else:
        notes.append("No retake evidence was recorded in the final report.")
    if ai_interventions:
        notes.append(
            f"{len(ai_interventions)} AI coaching interventions are available in the trail."
        )
    return notes


def _quality_signals(
    *,
    completion_score: float,
    media_quality_score: float,
    evidence_summary: dict[str, Any],
    ai_interventions: list[dict[str, Any]],
) -> dict[str, list[str]]:
    positives = []
    warnings = []
    if completion_score == 1.0:
        positives.append("All required inspection steps are complete.")
    if evidence_summary["isComplete"]:
        positives.append("Evidence complete across required photo steps.")
    if media_quality_score >= MEDIA_REVIEW_THRESHOLD:
        positives.append(f"Media quality score is strong at {media_quality_score:.2f}.")
    else:
        warnings.append(f"Media quality score is {media_quality_score:.2f}.")
    if not evidence_summary["isComplete"]:
        warnings.append("Some required photo evidence is missing.")
    if ai_interventions:
        positives.append("AI coaching trail is available for audit traceability.")
    return {"positives": positives, "warnings": warnings}


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


def _evidence_photo_html(session_id: str, item: dict[str, Any]) -> str:
    image_url = item.get("imageUrl")
    if not image_url and item.get("id"):
        image_url = f"/sessions/{session_id}/evidence/{item['id']}"
    if not image_url:
        return ""

    metadata = item.get("metadata", {})
    visible_parts = metadata.get("visibleParts") or []
    caption = ", ".join(visible_parts)
    if not caption:
        caption = "Accepted" if item.get("accepted") else "Needs retake"
    decision = "Accepted" if item.get("accepted") else "Retake"
    quality_score = float(item.get("qualityScore") or 0.0)
    step_name = _title(str(item.get("stepId", "Evidence photo")))
    return f"""
    <article class="photo-card">
      <img src="{escape(image_url)}" alt="{escape(step_name)} photo evidence">
      <div class="photo-copy">
        <strong>{escape(step_name)}</strong>
        <span>Quality {quality_score:.2f} | {escape(decision)}</span>
        <span>{escape(caption)}</span>
      </div>
    </article>
    """


def _display_value(value: Any) -> str:
    if isinstance(value, bool):
        return "Yes" if value else "No"
    return str(value)


def _title(value: str) -> str:
    return value.replace("-", " ").replace("_", " ").title()


def _format_timestamp(value: str) -> str:
    return value.replace("T", " ").replace("Z", " UTC")
