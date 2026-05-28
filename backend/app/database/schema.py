SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS vehicles (
    registration_number TEXT PRIMARY KEY,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    variant TEXT NOT NULL,
    fuel_type TEXT NOT NULL,
    transmission TEXT NOT NULL,
    body_type TEXT NOT NULL,
    registration_city TEXT NOT NULL,
    registration_state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jockey_profiles (
    profile_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    language_code TEXT NOT NULL,
    language_label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection_plan_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    body_type TEXT,
    fuel_type TEXT,
    transmission TEXT,
    version INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection_plan_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    field_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    section TEXT NOT NULL,
    kind TEXT NOT NULL,
    instructions TEXT NOT NULL,
    expected_parts_json TEXT NOT NULL,
    auto_capture_enabled INTEGER,
    auto_capture_hold_ms INTEGER,
    sort_order INTEGER NOT NULL,
    UNIQUE(template_id, step_id),
    FOREIGN KEY(template_id)
        REFERENCES inspection_plan_templates(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inspection_sessions (
    session_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    registration_number TEXT NOT NULL,
    plan_template_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(registration_number)
        REFERENCES vehicles(registration_number),
    FOREIGN KEY(plan_template_id)
        REFERENCES inspection_plan_templates(id)
);

CREATE TABLE IF NOT EXISTS inspection_session_steps (
    session_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    field_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    section TEXT NOT NULL,
    kind TEXT NOT NULL,
    instructions TEXT NOT NULL,
    expected_parts_json TEXT NOT NULL,
    status TEXT NOT NULL,
    auto_capture_enabled INTEGER,
    auto_capture_hold_ms INTEGER,
    sort_order INTEGER NOT NULL,
    PRIMARY KEY(session_id, step_id),
    FOREIGN KEY(session_id)
        REFERENCES inspection_sessions(session_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_items (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    object_key TEXT,
    local_uri TEXT,
    quality_score REAL,
    accepted INTEGER,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id)
        REFERENCES inspection_sessions(session_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS structured_observations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    field_id INTEGER NOT NULL,
    transcript TEXT,
    issue TEXT,
    severity TEXT,
    confidence REAL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id)
        REFERENCES inspection_sessions(session_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_interventions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    confidence REAL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(session_id)
        REFERENCES inspection_sessions(session_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    report_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    completion_score REAL,
    media_quality_score REAL,
    pricing_risk TEXT,
    report_json TEXT NOT NULL,
    report_html_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(session_id)
        REFERENCES inspection_sessions(session_id)
        ON DELETE CASCADE
);
"""
