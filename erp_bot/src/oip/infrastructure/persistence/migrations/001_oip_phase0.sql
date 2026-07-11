-- OIP Phase 0 — OIDP OLTP schema (SQLite / PostgreSQL compatible subset)
-- Constitution: outbox, inbox, audit hash chain, lineage DAG

CREATE TABLE IF NOT EXISTS oip_outbox (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    partition_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    published_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_outbox_unpublished
    ON oip_outbox (published_at, created_at);

CREATE TABLE IF NOT EXISTS oip_inbox (
    consumer_group TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    processed_at TEXT NOT NULL,
    PRIMARY KEY (consumer_group, idempotency_key)
);

CREATE TABLE IF NOT EXISTS oip_audit (
    record_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    payload_redacted_json TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    record_hash TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_audit_tenant_request
    ON oip_audit (tenant_id, request_id, occurred_at);

CREATE TABLE IF NOT EXISTS oip_lineage (
    node_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    parent_node_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_lineage_request
    ON oip_lineage (tenant_id, request_id, created_at);

CREATE TABLE IF NOT EXISTS oip_idempotency (
    tenant_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    command_type TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, idempotency_key)
);
