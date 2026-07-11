-- OIP Phase 2.1 — Memory Runtime module

CREATE TABLE IF NOT EXISTS oip_memories (
    memory_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    conversation_id TEXT,
    workflow_id TEXT,
    request_id TEXT NOT NULL,
    memory_type TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    embedding_id TEXT,
    importance TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    freshness TEXT NOT NULL,
    authority REAL NOT NULL DEFAULT 0.5,
    tags_json TEXT NOT NULL DEFAULT '[]',
    entities_json TEXT NOT NULL DEFAULT '[]',
    collection_scope TEXT NOT NULL DEFAULT 'Workflow',
    retention_policy TEXT NOT NULL,
    content_hash TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    lineage_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT,
    archived INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_oip_memories_tenant ON oip_memories (tenant_id);
CREATE INDEX IF NOT EXISTS idx_oip_memories_company ON oip_memories (tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_oip_memories_workflow ON oip_memories (tenant_id, workflow_id);
CREATE INDEX IF NOT EXISTS idx_oip_memories_conversation ON oip_memories (tenant_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_oip_memories_importance ON oip_memories (tenant_id, importance);
CREATE INDEX IF NOT EXISTS idx_oip_memories_freshness ON oip_memories (tenant_id, freshness);
CREATE INDEX IF NOT EXISTS idx_oip_memories_created ON oip_memories (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_oip_memories_type_hash ON oip_memories (tenant_id, memory_type, content_hash);

CREATE TABLE IF NOT EXISTS oip_memory_records (
    record_id TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    source_module TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    snapshot_pointer TEXT NOT NULL,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    lineage_json TEXT NOT NULL DEFAULT '{}',
    sequence INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES oip_memories (memory_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_records_memory ON oip_memory_records (memory_id, sequence);

CREATE TABLE IF NOT EXISTS oip_memory_embeddings (
    embedding_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    vector_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES oip_memories (memory_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_embeddings_memory ON oip_memory_embeddings (memory_id);
CREATE INDEX IF NOT EXISTS idx_oip_memory_embeddings_tenant ON oip_memory_embeddings (tenant_id);

CREATE TABLE IF NOT EXISTS oip_memory_links (
    link_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_memory_id TEXT NOT NULL,
    target_memory_id TEXT NOT NULL,
    link_type TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (source_memory_id) REFERENCES oip_memories (memory_id),
    FOREIGN KEY (target_memory_id) REFERENCES oip_memories (memory_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_links_source ON oip_memory_links (source_memory_id);
CREATE INDEX IF NOT EXISTS idx_oip_memory_links_target ON oip_memory_links (target_memory_id);
CREATE INDEX IF NOT EXISTS idx_oip_memory_links_entity ON oip_memory_links (tenant_id, link_type);

CREATE TABLE IF NOT EXISTS oip_memory_collections (
    collection_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    scope TEXT NOT NULL,
    company_id TEXT,
    conversation_id TEXT,
    workflow_id TEXT,
    memory_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_collections_tenant ON oip_memory_collections (tenant_id, scope);

CREATE TABLE IF NOT EXISTS oip_memory_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    recall_latency_ms_avg REAL NOT NULL DEFAULT 0,
    hit_ratio REAL NOT NULL DEFAULT 0,
    cache_ratio REAL NOT NULL DEFAULT 0,
    merge_ratio REAL NOT NULL DEFAULT 0,
    duplicate_ratio REAL NOT NULL DEFAULT 0,
    compression_ratio REAL NOT NULL DEFAULT 0,
    retention_expiry_count INTEGER NOT NULL DEFAULT 0,
    memory_growth INTEGER NOT NULL DEFAULT 0,
    total_memories INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (tenant_id, metric_date)
);

CREATE TABLE IF NOT EXISTS oip_memory_retention (
    retention_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    policy TEXT NOT NULL,
    expires_at TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES oip_memories (memory_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_retention_tenant ON oip_memory_retention (tenant_id, expires_at);

CREATE TABLE IF NOT EXISTS oip_memory_patterns (
    pattern_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES oip_memories (memory_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_patterns_type ON oip_memory_patterns (tenant_id, pattern_type);

CREATE TABLE IF NOT EXISTS oip_memory_failures (
    failure_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    memory_id TEXT NOT NULL,
    failure_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (memory_id) REFERENCES oip_memories (memory_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_failures_tenant ON oip_memory_failures (tenant_id, failure_type);

CREATE TABLE IF NOT EXISTS oip_memory_recalls (
    recall_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    query TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    mode TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    cache_hit INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_memory_recalls_tenant ON oip_memory_recalls (tenant_id, created_at);
