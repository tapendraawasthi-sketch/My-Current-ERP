-- OIP Phase 1.4 — Provider Runtime module

CREATE TABLE IF NOT EXISTS oip_executions (
    execution_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    conversation_id TEXT,
    correlation_id TEXT NOT NULL,
    status TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    edition TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    fallback_providers_json TEXT NOT NULL DEFAULT '[]',
    selected_tools_json TEXT NOT NULL DEFAULT '[]',
    context_json TEXT,
    capability_token_json TEXT,
    limits_json TEXT NOT NULL DEFAULT '{}',
    budget_json TEXT,
    usage_json TEXT,
    result_json TEXT,
    failure_json TEXT,
    streaming_json TEXT,
    cancellation_json TEXT,
    health_snapshot_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    timed_out_at TEXT,
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_executions_tenant_company
    ON oip_executions (tenant_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_executions_request
    ON oip_executions (request_id);

CREATE INDEX IF NOT EXISTS idx_oip_executions_conversation
    ON oip_executions (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_executions_route
    ON oip_executions (route_id);

CREATE INDEX IF NOT EXISTS idx_oip_executions_plan
    ON oip_executions (plan_id);

CREATE INDEX IF NOT EXISTS idx_oip_executions_status
    ON oip_executions (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_executions_provider
    ON oip_executions (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_provider_invocations (
    invocation_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    attempt INTEGER NOT NULL DEFAULT 1,
    success INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    retry_class TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (execution_id) REFERENCES oip_executions (execution_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_provider_invocations_execution
    ON oip_provider_invocations (execution_id, attempt);

CREATE INDEX IF NOT EXISTS idx_oip_provider_invocations_provider
    ON oip_provider_invocations (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_execution_usage (
    usage_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    reasoning_tokens INTEGER NOT NULL DEFAULT 0,
    cache_hits INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    cost_micros INTEGER NOT NULL DEFAULT 0,
    retries INTEGER NOT NULL DEFAULT 0,
    streaming_duration_ms INTEGER NOT NULL DEFAULT 0,
    tool_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (execution_id) REFERENCES oip_executions (execution_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_execution_usage_provider
    ON oip_execution_usage (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_execution_artifacts (
    artifact_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    blob_pointer TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    encrypted INTEGER NOT NULL DEFAULT 1,
    ttl_seconds INTEGER NOT NULL DEFAULT 86400,
    provider_id TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    encrypted_blob BLOB,
    created_at TEXT NOT NULL,
    FOREIGN KEY (execution_id) REFERENCES oip_executions (execution_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_execution_artifacts_execution
    ON oip_execution_artifacts (execution_id);

CREATE INDEX IF NOT EXISTS idx_oip_execution_artifacts_hash
    ON oip_execution_artifacts (content_hash);

CREATE TABLE IF NOT EXISTS oip_stream_chunks (
    chunk_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    provisional INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (execution_id) REFERENCES oip_executions (execution_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_stream_chunks_sequence
    ON oip_stream_chunks (execution_id, sequence_no);

CREATE TABLE IF NOT EXISTS oip_capability_tokens (
    token_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    conversation_id TEXT,
    company_id TEXT,
    expires_at TEXT NOT NULL,
    allowed_tools_json TEXT NOT NULL DEFAULT '[]',
    allowed_erp_actions_json TEXT NOT NULL DEFAULT '[]',
    maximum_calls INTEGER NOT NULL DEFAULT 10,
    read_scope_json TEXT NOT NULL DEFAULT '[]',
    write_scope_json TEXT NOT NULL DEFAULT '[]',
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_capability_tokens_request
    ON oip_capability_tokens (request_id);

CREATE INDEX IF NOT EXISTS idx_oip_capability_tokens_tenant
    ON oip_capability_tokens (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_execution_checkpoints (
    checkpoint_id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    state_snapshot_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (execution_id) REFERENCES oip_executions (execution_id)
);

CREATE TABLE IF NOT EXISTS oip_execution_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    executions_started INTEGER NOT NULL DEFAULT 0,
    executions_completed INTEGER NOT NULL DEFAULT 0,
    executions_failed INTEGER NOT NULL DEFAULT 0,
    executions_cancelled INTEGER NOT NULL DEFAULT 0,
    executions_timed_out INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_micros INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);
