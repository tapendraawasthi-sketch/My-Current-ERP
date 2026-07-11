-- OIP Phase 1 — Session module

CREATE TABLE IF NOT EXISTS oip_sessions (
    session_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    company_id TEXT,
    branch_id TEXT,
    module TEXT NOT NULL,
    conversation_id TEXT,
    status TEXT NOT NULL,
    erp_context_json TEXT NOT NULL DEFAULT '{}',
    opened_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_sessions_tenant_user
    ON oip_sessions (tenant_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_sessions_conversation
    ON oip_sessions (conversation_id);
