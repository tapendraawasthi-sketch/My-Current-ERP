-- OIP Phase 1.3 — Router module

CREATE TABLE IF NOT EXISTS oip_route_decisions (
    route_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    conversation_id TEXT,
    correlation_id TEXT NOT NULL,
    status TEXT NOT NULL,
    routing_policy TEXT NOT NULL,
    edition TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    primary_provider_id TEXT NOT NULL,
    fallback_providers_json TEXT NOT NULL DEFAULT '[]',
    selected_tools_json TEXT NOT NULL DEFAULT '[]',
    estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
    estimated_latency_ms INTEGER NOT NULL DEFAULT 0,
    estimated_tokens INTEGER NOT NULL DEFAULT 0,
    expected_quality REAL NOT NULL DEFAULT 0,
    policy_decisions_json TEXT NOT NULL DEFAULT '{}',
    reason_codes_json TEXT NOT NULL DEFAULT '[]',
    health_snapshot_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    approved_at TEXT,
    rejected_at TEXT,
    expired_at TEXT,
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_route_decisions_tenant_company
    ON oip_route_decisions (tenant_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_route_decisions_request
    ON oip_route_decisions (request_id);

CREATE INDEX IF NOT EXISTS idx_oip_route_decisions_conversation
    ON oip_route_decisions (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_route_decisions_plan
    ON oip_route_decisions (plan_id);

CREATE INDEX IF NOT EXISTS idx_oip_route_decisions_status
    ON oip_route_decisions (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_route_decisions_provider
    ON oip_route_decisions (primary_provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_route_candidates (
    candidate_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    rank_order INTEGER NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    capability_match_json TEXT NOT NULL DEFAULT '{}',
    latency_estimate_ms INTEGER NOT NULL DEFAULT 0,
    cost_estimate_micros INTEGER NOT NULL DEFAULT 0,
    quality_estimate REAL NOT NULL DEFAULT 0,
    health_score REAL NOT NULL DEFAULT 0,
    reason_codes_json TEXT NOT NULL DEFAULT '[]',
    selected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (route_id) REFERENCES oip_route_decisions (route_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_route_candidates_rank
    ON oip_route_candidates (route_id, rank_order);

CREATE INDEX IF NOT EXISTS idx_oip_route_candidates_provider
    ON oip_route_candidates (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_provider_health (
    provider_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'global',
    circuit_state TEXT NOT NULL DEFAULT 'closed',
    availability REAL NOT NULL DEFAULT 1.0,
    rolling_latency_ms REAL NOT NULL DEFAULT 0,
    rolling_failure_rate REAL NOT NULL DEFAULT 0,
    last_success_at TEXT,
    last_failure_at TEXT,
    last_heartbeat_at TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oip_provider_health_tenant
    ON oip_provider_health (tenant_id, provider_id);

CREATE TABLE IF NOT EXISTS oip_routing_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    routes_created INTEGER NOT NULL DEFAULT 0,
    routes_approved INTEGER NOT NULL DEFAULT 0,
    routes_rejected INTEGER NOT NULL DEFAULT 0,
    routes_expired INTEGER NOT NULL DEFAULT 0,
    routes_archived INTEGER NOT NULL DEFAULT 0,
    avg_estimated_latency_ms REAL NOT NULL DEFAULT 0,
    avg_estimated_cost_micros REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);
