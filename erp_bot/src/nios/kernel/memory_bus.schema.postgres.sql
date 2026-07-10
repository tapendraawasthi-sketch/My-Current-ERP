-- NIOS 7-level Memory Bus (PostgreSQL-compatible)
CREATE TABLE IF NOT EXISTS nios_memory_records (
  id UUID PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN (
    'sensory', 'working', 'semantic', 'procedural',
    'episodic', 'business', 'long_term'
  )),
  key TEXT NOT NULL,
  value_json JSONB NOT NULL,
  tenant_id TEXT,
  company_id TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nios_memory_level ON nios_memory_records(level, tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_nios_memory_session ON nios_memory_records(session_id, level);
