-- OIP Phase 2.2 — Production OEC Runtime

CREATE TABLE IF NOT EXISTS oip_connectors (
    connector_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    name TEXT NOT NULL,
    connector_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    config_json TEXT NOT NULL DEFAULT '{}',
    capabilities_json TEXT NOT NULL DEFAULT '[]',
    is_default INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_connectors_tenant ON oip_connectors (tenant_id);
CREATE INDEX IF NOT EXISTS idx_oip_connectors_company ON oip_connectors (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_oip_connectors_type ON oip_connectors (tenant_id, connector_type);
CREATE INDEX IF NOT EXISTS idx_oip_connectors_status ON oip_connectors (tenant_id, status);

CREATE TABLE IF NOT EXISTS oip_connector_capabilities (
    capability_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    mode TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (connector_id) REFERENCES oip_connectors (connector_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_connector_capabilities_connector ON oip_connector_capabilities (connector_id);

CREATE TABLE IF NOT EXISTS oip_connector_health (
    health_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    state TEXT NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    availability REAL NOT NULL DEFAULT 1.0,
    last_check_at TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (connector_id) REFERENCES oip_connectors (connector_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_connector_health_tenant ON oip_connector_health (tenant_id, connector_id);

CREATE TABLE IF NOT EXISTS oip_connector_transactions (
    transaction_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    status TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    committed_at TEXT,
    timeout_at TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (connector_id) REFERENCES oip_connectors (connector_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_connector_transactions_execution ON oip_connector_transactions (execution_id);
CREATE INDEX IF NOT EXISTS idx_oip_connector_transactions_status ON oip_connector_transactions (tenant_id, status);

CREATE TABLE IF NOT EXISTS oip_erp_commands (
    execution_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    branch_id TEXT,
    command_id TEXT NOT NULL,
    command_type TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL,
    erp_reference TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{}',
    response_json TEXT NOT NULL DEFAULT '{}',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NOT NULL DEFAULT '',
    transaction_id TEXT,
    snapshot_id TEXT,
    request_id TEXT NOT NULL DEFAULT '',
    correlation_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (connector_id) REFERENCES oip_connectors (connector_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_erp_commands_idempotency ON oip_erp_commands (tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_oip_erp_commands_tenant ON oip_erp_commands (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_oip_erp_commands_connector ON oip_erp_commands (connector_id, status);
CREATE INDEX IF NOT EXISTS idx_oip_erp_commands_status ON oip_erp_commands (tenant_id, status);

CREATE TABLE IF NOT EXISTS oip_erp_queries (
    query_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    query_type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    response_json TEXT NOT NULL DEFAULT '{}',
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (connector_id) REFERENCES oip_connectors (connector_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_erp_queries_tenant ON oip_erp_queries (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS oip_connector_failures (
    failure_id TEXT PRIMARY KEY,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    execution_id TEXT,
    failure_type TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_connector_failures_tenant ON oip_connector_failures (tenant_id, connector_id);

CREATE TABLE IF NOT EXISTS oip_connector_retries (
    retry_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    attempt INTEGER NOT NULL,
    policy TEXT NOT NULL,
    delay_seconds REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_connector_retries_execution ON oip_connector_retries (execution_id);

CREATE TABLE IF NOT EXISTS oip_connector_metrics (
    tenant_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    latency_ms_avg REAL NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    rollback_rate REAL NOT NULL DEFAULT 0,
    availability REAL NOT NULL DEFAULT 1.0,
    command_throughput INTEGER NOT NULL DEFAULT 0,
    query_throughput INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 1.0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, connector_id, metric_date)
);

CREATE TABLE IF NOT EXISTS oip_connector_dead_letter (
    dead_letter_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    execution_id TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oip_connector_circuit (
    tenant_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'closed',
    failure_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, connector_id)
);

CREATE TABLE IF NOT EXISTS oip_connector_compensations (
    compensation_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    connector_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    reversal_command_id TEXT NOT NULL,
    erp_reference TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_connector_compensations_execution ON oip_connector_compensations (execution_id);
