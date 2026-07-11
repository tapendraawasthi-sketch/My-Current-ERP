-- OIP Phase 1.2 — Planner module

CREATE TABLE IF NOT EXISTS oip_execution_plans (
    plan_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    company_id TEXT,
    conversation_id TEXT,
    correlation_id TEXT NOT NULL,
    module TEXT NOT NULL,
    intent TEXT NOT NULL,
    execution_mode TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    estimated_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_latency_ms INTEGER NOT NULL DEFAULT 0,
    estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
    knowledge_required INTEGER NOT NULL DEFAULT 0,
    memory_required INTEGER NOT NULL DEFAULT 0,
    tool_requirements_json TEXT NOT NULL DEFAULT '[]',
    skills_json TEXT NOT NULL DEFAULT '[]',
    stop_conditions_json TEXT NOT NULL DEFAULT '[]',
    fallback_policy_json TEXT NOT NULL DEFAULT '{}',
    goal_json TEXT NOT NULL DEFAULT '{}',
    context_budget_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    validated_at TEXT,
    expired_at TEXT,
    cancelled_at TEXT,
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_oip_execution_plans_tenant_company
    ON oip_execution_plans (tenant_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_execution_plans_conversation
    ON oip_execution_plans (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oip_execution_plans_request
    ON oip_execution_plans (request_id);

CREATE INDEX IF NOT EXISTS idx_oip_execution_plans_status
    ON oip_execution_plans (tenant_id, status, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS oip_execution_steps (
    step_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    step_type TEXT NOT NULL,
    name TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    depends_on_json TEXT NOT NULL DEFAULT '[]',
    estimated_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES oip_execution_plans (plan_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_oip_execution_steps_sequence
    ON oip_execution_steps (plan_id, sequence_no);

CREATE INDEX IF NOT EXISTS idx_oip_execution_steps_plan
    ON oip_execution_steps (plan_id, sequence_no ASC);

CREATE TABLE IF NOT EXISTS oip_planning_constraints (
    constraint_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    max_latency_ms INTEGER,
    max_tokens INTEGER,
    max_cost_micros INTEGER,
    offline_only INTEGER NOT NULL DEFAULT 0,
    provider_restrictions_json TEXT NOT NULL DEFAULT '[]',
    tool_restrictions_json TEXT NOT NULL DEFAULT '[]',
    knowledge_restrictions_json TEXT NOT NULL DEFAULT '[]',
    fiscal_restrictions_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES oip_execution_plans (plan_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_planning_constraints_plan
    ON oip_planning_constraints (plan_id);

CREATE TABLE IF NOT EXISTS oip_execution_budgets (
    budget_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    total_latency_ms INTEGER NOT NULL DEFAULT 0,
    total_cost_micros INTEGER NOT NULL DEFAULT 0,
    erp_snapshot_tokens INTEGER NOT NULL DEFAULT 0,
    knowledge_tokens INTEGER NOT NULL DEFAULT 0,
    conversation_tokens INTEGER NOT NULL DEFAULT 0,
    memory_tokens INTEGER NOT NULL DEFAULT 0,
    attachment_tokens INTEGER NOT NULL DEFAULT 0,
    user_input_tokens INTEGER NOT NULL DEFAULT 0,
    allocations_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (plan_id) REFERENCES oip_execution_plans (plan_id)
);

CREATE INDEX IF NOT EXISTS idx_oip_execution_budgets_plan
    ON oip_execution_budgets (plan_id);

CREATE TABLE IF NOT EXISTS oip_planner_metrics (
    tenant_id TEXT NOT NULL,
    metric_date TEXT NOT NULL,
    plans_created INTEGER NOT NULL DEFAULT 0,
    plans_validated INTEGER NOT NULL DEFAULT 0,
    plans_cancelled INTEGER NOT NULL DEFAULT 0,
    plans_expired INTEGER NOT NULL DEFAULT 0,
    plans_archived INTEGER NOT NULL DEFAULT 0,
    avg_estimated_latency_ms REAL NOT NULL DEFAULT 0,
    avg_estimated_tokens REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (tenant_id, metric_date)
);
