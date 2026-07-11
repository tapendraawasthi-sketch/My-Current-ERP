-- Sutra-compatible ERP accounting schema (SQLite) for production connectors

CREATE TABLE IF NOT EXISTS erp_chart_of_accounts (
    account_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE (tenant_id, company_id, code)
);

CREATE TABLE IF NOT EXISTS erp_fiscal_periods (
    period_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_open INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS erp_vouchers (
    voucher_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    voucher_no TEXT NOT NULL,
    voucher_date TEXT NOT NULL,
    voucher_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'posted',
    narration TEXT,
    idempotency_key TEXT UNIQUE,
    total_debit REAL NOT NULL DEFAULT 0,
    total_credit REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_voucher_lines (
    line_id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS erp_ledger_postings (
    posting_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    voucher_id TEXT NOT NULL,
    account_code TEXT NOT NULL,
    posting_date TEXT NOT NULL,
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS erp_parties (
    party_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    party_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS erp_approvals (
    approval_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    action_ref TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_erp_postings_tenant_company ON erp_ledger_postings(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_erp_postings_account ON erp_ledger_postings(tenant_id, company_id, account_code);
CREATE INDEX IF NOT EXISTS idx_erp_vouchers_idempotency ON erp_vouchers(idempotency_key);
