-- NIOS v3 tenant scope migration (Phase 0)
-- Apply to existing Orbix SQLite databases on startup.

ALTER TABLE sessions ADD COLUMN tenant_id TEXT;
ALTER TABLE episodes ADD COLUMN tenant_id TEXT;
ALTER TABLE semantic_facts ADD COLUMN tenant_id TEXT;
ALTER TABLE semantic_facts ADD COLUMN company_id TEXT;
ALTER TABLE tool_audit_log ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_episodes_tenant ON episodes(tenant_id, company_id);
