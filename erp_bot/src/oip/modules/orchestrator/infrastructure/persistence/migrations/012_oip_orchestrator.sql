-- OIP Phase 1.9 — Orchestrator Runtime module

CREATE TABLE IF NOT EXISTS oip_workflows (
    workflow_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    conversation_id TEXT,
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    branch_id TEXT,
    user_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL DEFAULT '',
    execution_mode TEXT NOT NULL,
    workflow_state TEXT NOT NULL,
    current_stage TEXT,
    completed_stages_json TEXT NOT NULL DEFAULT '[]',
    failed_stage TEXT,
    rollback_state_json TEXT NOT NULL DEFAULT '{}',
    retry_state_json TEXT NOT NULL DEFAULT '{}',
    module TEXT NOT NULL DEFAULT 'orbix',
    message TEXT NOT NULL DEFAULT '',
    snapshots_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    metrics_json TEXT NOT NULL DEFAULT '{}',
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_workflows_idempotency
    ON oip_workflows (tenant_id, idempotency_key)
    WHERE idempotency_key != '';

CREATE INDEX IF NOT EXISTS idx_oip_workflows_tenant
    ON oip_workflows (tenant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_workflows_state
    ON oip_workflows (tenant_id, workflow_state, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_workflows_request
    ON oip_workflows (request_id);

CREATE TABLE IF NOT EXISTS oip_workflow_stages (
    stage_run_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (workflow_id) REFERENCES oip_workflows (workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_workflow_stages_workflow
    ON oip_workflow_stages (workflow_id, started_at);

CREATE INDEX IF NOT EXISTS idx_oip_workflow_stages_tenant
    ON oip_workflow_stages (tenant_id, started_at DESC);

CREATE TABLE IF NOT EXISTS oip_workflow_failures (
    failure_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES oip_workflows (workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_workflow_failures_workflow
    ON oip_workflow_failures (workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_workflow_retries (
    retry_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES oip_workflows (workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_workflow_retries_workflow
    ON oip_workflow_retries (workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_workflow_rollbacks (
    rollback_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES oip_workflows (workflow_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_workflow_rollbacks_workflow
    ON oip_workflow_rollbacks (workflow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_workflow_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    workflows_started INTEGER NOT NULL DEFAULT 0,
    workflows_completed INTEGER NOT NULL DEFAULT 0,
    workflows_failed INTEGER NOT NULL DEFAULT 0,
    workflows_cancelled INTEGER NOT NULL DEFAULT 0,
    retries_scheduled INTEGER NOT NULL DEFAULT 0,
    rollbacks_performed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_oip_workflow_metrics_tenant
    ON oip_workflow_metrics (tenant_id, metric_date DESC);
