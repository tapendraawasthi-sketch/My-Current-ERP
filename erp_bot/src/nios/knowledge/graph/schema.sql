-- NIOS Knowledge Graph — temporal versioning (PostgreSQL-compatible; SQLite subset)

CREATE TABLE IF NOT EXISTS kg_nodes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  node_type TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  tenant_id TEXT,
  company_id TEXT,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(node_type, label);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_tenant ON kg_nodes(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_temporal ON kg_nodes(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS kg_edges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  tenant_id TEXT,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges(from_id, relation);
CREATE INDEX IF NOT EXISTS idx_kg_edges_to ON kg_edges(to_id, relation);
CREATE INDEX IF NOT EXISTS idx_kg_edges_temporal ON kg_edges(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS kg_observations (
  id TEXT PRIMARY KEY,
  observation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  tenant_id TEXT,
  company_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kg_observations_type ON kg_observations(observation_type, created_at);
