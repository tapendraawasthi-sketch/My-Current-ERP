-- Orbix v2 memory schema (SQLite).

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  tenant_id TEXT,
  company_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  working_state_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  tenant_id TEXT,
  company_id TEXT,
  user_message TEXT NOT NULL,
  agent_answer TEXT NOT NULL,
  intent TEXT,
  tool_trace_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes(user_id);

CREATE TABLE IF NOT EXISTS semantic_facts (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  source_hash TEXT,
  tenant_id TEXT,
  company_id TEXT,
  valid_from TEXT NOT NULL,
  valid_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_facts_ns ON semantic_facts(namespace, subject);

CREATE TABLE IF NOT EXISTS tool_audit_log (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  tenant_id TEXT,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  ok INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
