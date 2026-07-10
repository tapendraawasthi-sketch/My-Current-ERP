-- Knowledge document pipeline (multi-tenant, billion-object scale ready)
-- Apply via: psql $DATABASE_URL -f backend/knowledge/schema.sql

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  company_id        UUID NOT NULL,
  filename          TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL DEFAULT 0,
  r2_original_key   TEXT NOT NULL,
  r2_markdown_key   TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  processing_stage  TEXT NOT NULL DEFAULT 'uploaded',
  error_message     TEXT,
  requires_ocr      BOOLEAN NOT NULL DEFAULT FALSE,
  chunk_count       INTEGER NOT NULL DEFAULT 0,
  uploaded_by       TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_documents_status_chk CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_tenant
  ON knowledge_documents (tenant_id, company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status
  ON knowledge_documents (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_r2_key
  ON knowledge_documents (r2_original_key);

CREATE TABLE IF NOT EXISTS knowledge_ingestion_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'queued',
  stage             TEXT NOT NULL DEFAULT 'queued',
  attempt           INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  error_message     TEXT,
  scheduled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_jobs_status_chk CHECK (
    status IN ('queued', 'running', 'completed', 'failed', 'retrying')
  )
);

CREATE INDEX IF NOT EXISTS idx_knowledge_jobs_document
  ON knowledge_ingestion_jobs (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_jobs_queue
  ON knowledge_ingestion_jobs (status, scheduled_at)
  WHERE status IN ('queued', 'retrying');

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL,
  company_id        UUID NOT NULL,
  chunk_index       INTEGER NOT NULL,
  chroma_id         TEXT NOT NULL,
  text_hash         TEXT NOT NULL,
  token_estimate    INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document
  ON knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant
  ON knowledge_chunks (tenant_id, company_id);

CREATE TABLE IF NOT EXISTS knowledge_audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID,
  company_id        UUID,
  document_id       UUID,
  job_id            UUID,
  action            TEXT NOT NULL,
  stage             TEXT,
  payload           JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_audit_document
  ON knowledge_audit_logs (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_audit_tenant
  ON knowledge_audit_logs (tenant_id, company_id, created_at DESC);
