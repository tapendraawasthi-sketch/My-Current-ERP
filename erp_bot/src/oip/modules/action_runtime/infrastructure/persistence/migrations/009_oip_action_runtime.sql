-- OIP Phase 1.6 — Action Runtime module

CREATE TABLE IF NOT EXISTS oip_action_executions (
    action_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    evaluation_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    conversation_id TEXT,
    correlation_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT 'system',
    status TEXT NOT NULL,
    action_type TEXT NOT NULL,
    quality_decision TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    proposal_json TEXT,
    materialization_json TEXT,
    approvals_json TEXT NOT NULL DEFAULT '[]',
    snapshot_json TEXT,
    evidence_json TEXT NOT NULL DEFAULT '[]',
    permission_json TEXT,
    capability_json TEXT,
    budget_json TEXT,
    risk_json TEXT,
    confirmation_json TEXT,
    result_json TEXT,
    failure_json TEXT,
    compensation_json TEXT,
    payload_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    executed_at TEXT,
    cancelled_at TEXT,
    archived_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_action_executions_idempotency
    ON oip_action_executions (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_oip_action_executions_tenant
    ON oip_action_executions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_action_executions_execution
    ON oip_action_executions (execution_id);

CREATE INDEX IF NOT EXISTS idx_oip_action_executions_evaluation
    ON oip_action_executions (evaluation_id);

CREATE INDEX IF NOT EXISTS idx_oip_action_executions_request
    ON oip_action_executions (request_id);

CREATE INDEX IF NOT EXISTS idx_oip_action_executions_status
    ON oip_action_executions (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_action_proposals (
    proposal_id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    evaluation_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    quality_decision TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    proposed_at TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (action_id) REFERENCES oip_action_executions (action_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_action_proposals_tenant
    ON oip_action_proposals (tenant_id, proposed_at DESC);

CREATE TABLE IF NOT EXISTS oip_action_confirmations (
    confirmation_id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    erp_reference TEXT NOT NULL,
    erp_command_id TEXT NOT NULL,
    confirmed_at TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (action_id) REFERENCES oip_action_executions (action_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_action_confirmations_erp
    ON oip_action_confirmations (erp_reference);

CREATE TABLE IF NOT EXISTS oip_action_compensations (
    compensation_id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    reversal_action_id TEXT NOT NULL,
    reversal_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    erp_reference TEXT,
    compensated_at TEXT NOT NULL,
    FOREIGN KEY (action_id) REFERENCES oip_action_executions (action_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_action_compensations_action
    ON oip_action_compensations (action_id);

CREATE TABLE IF NOT EXISTS oip_action_snapshots (
    action_snapshot_id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    version TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 300,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    fiscal_period_id TEXT,
    validated_at TEXT NOT NULL,
    FOREIGN KEY (action_id) REFERENCES oip_action_executions (action_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_action_snapshots_hash
    ON oip_action_snapshots (content_hash);

CREATE TABLE IF NOT EXISTS oip_action_approvals (
    approval_id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    approver_id TEXT,
    reason TEXT NOT NULL DEFAULT '',
    stage INTEGER NOT NULL DEFAULT 1,
    decided_at TEXT,
    FOREIGN KEY (action_id) REFERENCES oip_action_executions (action_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_action_approvals_action
    ON oip_action_approvals (action_id, stage);

CREATE TABLE IF NOT EXISTS oip_action_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    actions_proposed INTEGER NOT NULL DEFAULT 0,
    actions_executed INTEGER NOT NULL DEFAULT 0,
    actions_failed INTEGER NOT NULL DEFAULT 0,
    actions_rejected INTEGER NOT NULL DEFAULT 0,
    actions_cancelled INTEGER NOT NULL DEFAULT 0,
    actions_compensated INTEGER NOT NULL DEFAULT 0,
    actions_blocked INTEGER NOT NULL DEFAULT 0,
    idempotency_hits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_oip_action_metrics_tenant
    ON oip_action_metrics (tenant_id, metric_date DESC);
