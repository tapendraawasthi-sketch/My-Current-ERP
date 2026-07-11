-- OIP Phase 1.5 — Quality Gate module

CREATE TABLE IF NOT EXISTS oip_quality_evaluations (
    evaluation_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    branch_id TEXT,
    conversation_id TEXT,
    correlation_id TEXT NOT NULL,
    status TEXT NOT NULL,
    minimum_gate TEXT NOT NULL,
    l3_enabled INTEGER NOT NULL DEFAULT 0,
    execution_result_json TEXT NOT NULL,
    gate_runs_json TEXT NOT NULL DEFAULT '[]',
    rules_json TEXT NOT NULL DEFAULT '[]',
    findings_json TEXT NOT NULL DEFAULT '[]',
    violations_json TEXT NOT NULL DEFAULT '[]',
    evidence_json TEXT NOT NULL DEFAULT '[]',
    budget_json TEXT,
    risk_json TEXT,
    score_json TEXT,
    recommendations_json TEXT NOT NULL DEFAULT '[]',
    decision_json TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    rejected_at TEXT,
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evaluations_tenant_company
    ON oip_quality_evaluations (tenant_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evaluations_tenant
    ON oip_quality_evaluations (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evaluations_conversation
    ON oip_quality_evaluations (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evaluations_request
    ON oip_quality_evaluations (request_id);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evaluations_execution
    ON oip_quality_evaluations (execution_id);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evaluations_decision
    ON oip_quality_evaluations (tenant_id, decision_json, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_quality_findings (
    finding_id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    level TEXT NOT NULL,
    severity TEXT NOT NULL,
    code TEXT NOT NULL,
    message TEXT NOT NULL,
    field_path TEXT,
    violation_kind TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (evaluation_id) REFERENCES oip_quality_evaluations (evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_quality_findings_evaluation
    ON oip_quality_findings (evaluation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_quality_findings_tenant
    ON oip_quality_findings (tenant_id, level, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_quality_rules (
    rule_id TEXT PRIMARY KEY,
    rule_code TEXT NOT NULL UNIQUE,
    level TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    mandatory INTEGER NOT NULL DEFAULT 1,
    enabled INTEGER NOT NULL DEFAULT 1,
    jurisdiction TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_quality_rules_level
    ON oip_quality_rules (level, enabled);

CREATE TABLE IF NOT EXISTS oip_quality_evidence (
    evidence_id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    source TEXT NOT NULL,
    authority TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    snapshot_version TEXT NOT NULL DEFAULT '',
    effective_date TEXT,
    ttl_seconds INTEGER NOT NULL DEFAULT 300,
    age_seconds REAL NOT NULL DEFAULT 0,
    complete INTEGER NOT NULL DEFAULT 1,
    verified INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (evaluation_id) REFERENCES oip_quality_evaluations (evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evidence_evaluation
    ON oip_quality_evidence (evaluation_id);

CREATE INDEX IF NOT EXISTS idx_oip_quality_evidence_hash
    ON oip_quality_evidence (content_hash);

CREATE TABLE IF NOT EXISTS oip_quality_risks (
    risk_id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    level TEXT NOT NULL DEFAULT 'low',
    factors_json TEXT NOT NULL DEFAULT '[]',
    escalated INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (evaluation_id) REFERENCES oip_quality_evaluations (evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_quality_risks_tenant
    ON oip_quality_risks (tenant_id, score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_quality_risks_risk
    ON oip_quality_risks (level, escalated, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_quality_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    evaluations_started INTEGER NOT NULL DEFAULT 0,
    evaluations_passed INTEGER NOT NULL DEFAULT 0,
    evaluations_pass_with_warning INTEGER NOT NULL DEFAULT 0,
    evaluations_review_required INTEGER NOT NULL DEFAULT 0,
    evaluations_failed INTEGER NOT NULL DEFAULT 0,
    evaluations_blocked INTEGER NOT NULL DEFAULT 0,
    evaluations_approved INTEGER NOT NULL DEFAULT 0,
    evaluations_rejected INTEGER NOT NULL DEFAULT 0,
    total_findings INTEGER NOT NULL DEFAULT 0,
    total_warnings INTEGER NOT NULL DEFAULT 0,
    avg_risk_score REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_oip_quality_metrics_created
    ON oip_quality_metrics (tenant_id, metric_date DESC);
