-- OIP Phase 1 — Conversation module (OIDP OLTP)

CREATE TABLE IF NOT EXISTS oip_conversations (
    conversation_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    company_id TEXT,
    branch_id TEXT,
    module TEXT NOT NULL,
    status TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_conversations_active_session
    ON oip_conversations (tenant_id, session_id, module)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_oip_conversations_tenant_updated
    ON oip_conversations (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS oip_conversation_messages (
    message_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT,
    request_id TEXT,
    correlation_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES oip_conversations (conversation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_conversation_messages_sequence
    ON oip_conversation_messages (conversation_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_oip_conversation_messages_conversation
    ON oip_conversation_messages (conversation_id, created_at ASC);
