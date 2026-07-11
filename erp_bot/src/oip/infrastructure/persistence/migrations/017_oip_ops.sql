-- OIP Phase 2.9 — Operations, observability & reliability

CREATE TABLE IF NOT EXISTS oip_outbox_dlq (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    partition_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    failed_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);

CREATE TABLE IF NOT EXISTS oip_ops_alerts (
    alert_id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    detail_json TEXT NOT NULL DEFAULT '{}',
    tenant_id TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_outbox_dlq_failed ON oip_outbox_dlq(failed_at);
CREATE INDEX IF NOT EXISTS idx_oip_ops_alerts_open ON oip_ops_alerts(resolved_at, created_at);
