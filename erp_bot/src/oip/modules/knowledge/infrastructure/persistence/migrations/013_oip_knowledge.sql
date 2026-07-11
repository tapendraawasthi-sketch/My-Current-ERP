-- OIP Phase 2.0 — Knowledge Runtime module

CREATE TABLE IF NOT EXISTS oip_knowledge_documents (
    document_id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    authority_level TEXT NOT NULL,
    authority_id TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    supersedes TEXT,
    superseded_by TEXT,
    revision TEXT NOT NULL DEFAULT '1.0',
    content_hash TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    status TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_documents_tenant
    ON oip_knowledge_documents (tenant_id, jurisdiction);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_documents_authority
    ON oip_knowledge_documents (tenant_id, authority_level);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_documents_effective
    ON oip_knowledge_documents (tenant_id, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS oip_knowledge_collections (
    collection_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    jurisdiction TEXT NOT NULL,
    authority_level TEXT NOT NULL,
    document_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_collections_tenant
    ON oip_knowledge_collections (tenant_id, jurisdiction);

CREATE TABLE IF NOT EXISTS oip_knowledge_chunks (
    chunk_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES oip_knowledge_documents (document_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_chunks_document
    ON oip_knowledge_chunks (document_id);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_chunks_tenant
    ON oip_knowledge_chunks (tenant_id);

CREATE TABLE IF NOT EXISTS oip_knowledge_embeddings (
    embedding_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    vector_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (chunk_id) REFERENCES oip_knowledge_chunks (chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_embeddings_document
    ON oip_knowledge_embeddings (document_id, model_version);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_embeddings_tenant
    ON oip_knowledge_embeddings (tenant_id, model_name);

CREATE TABLE IF NOT EXISTS oip_embedding_generations (
    generation_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    collection_id TEXT,
    embedding_model TEXT NOT NULL,
    model_version TEXT NOT NULL,
    chunk_strategy TEXT NOT NULL,
    document_count INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    campaign_name TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_embedding_generations_tenant
    ON oip_embedding_generations (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_evidence_bundles (
    bundle_id TEXT PRIMARY KEY,
    retrieval_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    query TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    authority_summary_json TEXT NOT NULL DEFAULT '{}',
    document_ids_json TEXT NOT NULL DEFAULT '[]',
    chunk_ids_json TEXT NOT NULL DEFAULT '[]',
    evidence_hash TEXT NOT NULL,
    scores_json TEXT NOT NULL DEFAULT '[]',
    blocked_document_ids_json TEXT NOT NULL DEFAULT '[]',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_evidence_bundles_retrieval
    ON oip_evidence_bundles (retrieval_id);

CREATE INDEX IF NOT EXISTS idx_oip_evidence_bundles_tenant
    ON oip_evidence_bundles (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_knowledge_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    retrieval_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    as_of TEXT NOT NULL,
    authority_summary_json TEXT NOT NULL DEFAULT '{}',
    evidence_hashes_json TEXT NOT NULL DEFAULT '[]',
    embedding_versions_json TEXT NOT NULL DEFAULT '[]',
    document_ids_json TEXT NOT NULL DEFAULT '[]',
    bundle_id TEXT NOT NULL,
    immutable INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (bundle_id) REFERENCES oip_evidence_bundles (bundle_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_snapshots_retrieval
    ON oip_knowledge_snapshots (retrieval_id);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_snapshots_query
    ON oip_knowledge_snapshots (tenant_id, query_hash, jurisdiction);

CREATE TABLE IF NOT EXISTS oip_retrievals (
    retrieval_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    query TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    mode TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    as_of TEXT NOT NULL,
    status TEXT NOT NULL,
    snapshot_id TEXT,
    bundle_id TEXT,
    result_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    cache_hit INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_retrievals_cache
    ON oip_retrievals (tenant_id, query_hash, jurisdiction, as_of, status)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_oip_retrievals_tenant
    ON oip_retrievals (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_authority_registry (
    authority_id TEXT PRIMARY KEY,
    level TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    rank INTEGER NOT NULL,
    jurisdiction TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oip_jurisdiction_registry (
    pack_code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    accounting_standard TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oip_knowledge_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    retrievals_started INTEGER NOT NULL DEFAULT 0,
    retrievals_completed INTEGER NOT NULL DEFAULT 0,
    documents_indexed INTEGER NOT NULL DEFAULT 0,
    reembed_campaigns INTEGER NOT NULL DEFAULT 0,
    poison_blocked INTEGER NOT NULL DEFAULT 0,
    cache_hits INTEGER NOT NULL DEFAULT 0,
    snapshots_created INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_oip_knowledge_metrics_tenant
    ON oip_knowledge_metrics (tenant_id, metric_date DESC);
