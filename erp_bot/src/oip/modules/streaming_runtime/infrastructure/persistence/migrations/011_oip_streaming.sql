-- OIP Phase 1.8 — Streaming Runtime module

CREATE TABLE IF NOT EXISTS oip_stream_sessions (
    stream_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    conversation_id TEXT,
    execution_id TEXT,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    client_id TEXT NOT NULL,
    status TEXT NOT NULL,
    protocol TEXT NOT NULL,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    replay_position INTEGER NOT NULL DEFAULT 0,
    connection_id TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    connected_at TEXT,
    disconnected_at TEXT,
    closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_stream_sessions_tenant
    ON oip_stream_sessions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_stream_sessions_workflow
    ON oip_stream_sessions (tenant_id, workflow_id);

CREATE INDEX IF NOT EXISTS idx_oip_stream_sessions_conversation
    ON oip_stream_sessions (tenant_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_oip_stream_sessions_status
    ON oip_stream_sessions (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_stream_events (
    event_id TEXT PRIMARY KEY,
    stream_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    conversation_id TEXT,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    sequence INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    checksum TEXT NOT NULL,
    delivered INTEGER NOT NULL DEFAULT 0,
    acked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (stream_id) REFERENCES oip_stream_sessions (stream_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_stream_events_workflow_sequence
    ON oip_stream_events (tenant_id, workflow_id, sequence);

CREATE INDEX IF NOT EXISTS idx_oip_stream_events_tenant
    ON oip_stream_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_stream_events_workflow
    ON oip_stream_events (workflow_id, sequence);

CREATE INDEX IF NOT EXISTS idx_oip_stream_events_conversation
    ON oip_stream_events (tenant_id, conversation_id);

CREATE TABLE IF NOT EXISTS oip_stream_offsets (
    offset_id TEXT PRIMARY KEY,
    stream_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (stream_id) REFERENCES oip_stream_sessions (stream_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_stream_offsets_client
    ON oip_stream_offsets (stream_id, client_id);

CREATE INDEX IF NOT EXISTS idx_oip_stream_offsets_tenant
    ON oip_stream_offsets (stream_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS oip_stream_replays (
    replay_id TEXT PRIMARY KEY,
    stream_id TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    from_sequence INTEGER NOT NULL,
    to_sequence INTEGER NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (stream_id) REFERENCES oip_stream_sessions (stream_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_stream_replays_workflow
    ON oip_stream_replays (workflow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_stream_replays_tenant_stream
    ON oip_stream_replays (stream_id, started_at DESC);

CREATE TABLE IF NOT EXISTS oip_stream_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    streams_opened INTEGER NOT NULL DEFAULT 0,
    streams_closed INTEGER NOT NULL DEFAULT 0,
    events_published INTEGER NOT NULL DEFAULT 0,
    replays_started INTEGER NOT NULL DEFAULT 0,
    replays_completed INTEGER NOT NULL DEFAULT 0,
    heartbeats_sent INTEGER NOT NULL DEFAULT 0,
    transport_failures INTEGER NOT NULL DEFAULT 0,
    reconnects INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_oip_stream_metrics_tenant
    ON oip_stream_metrics (tenant_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS oip_stream_replay_buffer (
    buffer_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    event_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_stream_replay_buffer_workflow
    ON oip_stream_replay_buffer (workflow_id, sequence);

CREATE INDEX IF NOT EXISTS idx_oip_stream_replay_buffer_created
    ON oip_stream_replay_buffer (created_at DESC);
