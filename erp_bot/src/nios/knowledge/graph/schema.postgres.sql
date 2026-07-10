-- NIOS Knowledge Graph — PostgreSQL production schema (Phase 4)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS kg_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  node_type TEXT NOT NULL,
  properties_json JSONB NOT NULL DEFAULT '{}',
  tenant_id UUID,
  company_id UUID,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_nodes_type ON kg_nodes(node_type, label);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_tenant ON kg_nodes(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_temporal ON kg_nodes(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES kg_nodes(id),
  to_id UUID NOT NULL REFERENCES kg_nodes(id),
  relation TEXT NOT NULL,
  properties_json JSONB NOT NULL DEFAULT '{}',
  tenant_id UUID,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_edges_from ON kg_edges(from_id, relation);
CREATE INDEX IF NOT EXISTS idx_kg_edges_to ON kg_edges(to_id, relation);
CREATE INDEX IF NOT EXISTS idx_kg_edges_temporal ON kg_edges(valid_from, valid_until);

CREATE TABLE IF NOT EXISTS kg_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_type TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  tenant_id UUID,
  company_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_observations_type ON kg_observations(observation_type, created_at);

CREATE TABLE IF NOT EXISTS world_state_slices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  company_id UUID,
  domain TEXT NOT NULL,
  slice_key TEXT NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  source_event TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, company_id, domain, slice_key)
);

CREATE INDEX IF NOT EXISTS idx_world_state_domain ON world_state_slices(tenant_id, company_id, domain);
