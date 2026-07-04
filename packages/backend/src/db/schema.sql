-- Sutra ERP — canonical PostgreSQL schema
-- Multi-tenant isolation: tenant_id + company_id on all business tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Append-only protection ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; UPDATE and DELETE are not permitted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ─── Core tenancy ─────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  legal_name      TEXT,
  pan_number      VARCHAR(9),
  vat_number      VARCHAR(20),
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  base_currency   CHAR(3) NOT NULL DEFAULT 'NPR',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_tenant ON companies(tenant_id);

CREATE TABLE fiscal_years (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  fiscal_year_bs  TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  is_current      BOOLEAN NOT NULL DEFAULT FALSE,
  is_closed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fiscal_years_tenant_company ON fiscal_years(tenant_id, company_id);

-- ─── Auth & RBAC ────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  username        TEXT NOT NULL,
  email           TEXT,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'viewer',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  totp_secret     TEXT,
  totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, username)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_tenant_company ON users(tenant_id, company_id);

CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, company_id, name)
);

CREATE TABLE permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT,
  access          TEXT NOT NULL CHECK (access IN ('full', 'viewOnly', 'none')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_role ON permissions(tenant_id, company_id, role_id);

-- ─── Chart of accounts ────────────────────────────────────────────────────────
CREATE TABLE chart_of_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  account_type    TEXT NOT NULL,
  level           TEXT NOT NULL DEFAULT 'ledger',
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, company_id, code)
);

CREATE INDEX idx_coa_tenant_company ON chart_of_accounts(tenant_id, company_id);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_id);

CREATE TABLE ledgers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_dr      NUMERIC(18,2) NOT NULL DEFAULT 0,
  opening_cr      NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledgers_tenant_company ON ledgers(tenant_id, company_id);

-- ─── Masters ──────────────────────────────────────────────────────────────────
CREATE TABLE parties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  party_type      TEXT NOT NULL DEFAULT 'customer',
  pan_number      VARCHAR(9),
  vat_number      VARCHAR(20),
  credit_days     INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parties_tenant_company ON parties(tenant_id, company_id);

CREATE TABLE item_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES item_groups(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE stock_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_id       UUID REFERENCES stock_categories(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  unit            TEXT,
  group_id        UUID REFERENCES item_groups(id) ON DELETE SET NULL,
  category_id     UUID REFERENCES stock_categories(id) ON DELETE SET NULL,
  valuation_method TEXT DEFAULT 'AVERAGE',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, company_id, code)
);

CREATE INDEX idx_items_tenant_company ON items(tenant_id, company_id);

CREATE TABLE warehouses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_job_work_location BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warehouses_tenant_company ON warehouses(tenant_id, company_id);

CREATE TABLE batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  batch_no        TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date     DATE,
  current_qty     NUMERIC(18,4) NOT NULL DEFAULT 0,
  warehouse_id    UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_tenant_company ON batches(tenant_id, company_id);

-- ─── Vouchers & postings (immutable ledger) ───────────────────────────────────
CREATE TABLE vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id  UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
  voucher_no      TEXT NOT NULL,
  voucher_date    DATE NOT NULL,
  voucher_type    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  narration       TEXT,
  party_id        UUID REFERENCES parties(id) ON DELETE SET NULL,
  total_debit     NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credit    NUMERIC(18,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, company_id, voucher_type, voucher_no)
);

CREATE INDEX idx_vouchers_tenant_company ON vouchers(tenant_id, company_id);
CREATE INDEX idx_vouchers_fiscal_year ON vouchers(tenant_id, company_id, fiscal_year_id);
CREATE INDEX idx_vouchers_date ON vouchers(tenant_id, company_id, voucher_date);

CREATE TABLE voucher_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  debit           NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit          NUMERIC(18,2) NOT NULL DEFAULT 0,
  narration       TEXT,
  cost_centre_id  UUID,
  cost_category_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voucher_lines_voucher ON voucher_lines(voucher_id);

CREATE TABLE ledger_postings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id  UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
  voucher_id      UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  voucher_line_id UUID REFERENCES voucher_lines(id) ON DELETE RESTRICT,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  posting_date    DATE NOT NULL,
  debit           NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit          NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_postings_tenant_company ON ledger_postings(tenant_id, company_id);
CREATE INDEX idx_ledger_postings_account ON ledger_postings(tenant_id, company_id, account_id);

CREATE TRIGGER trg_ledger_postings_immutable
  BEFORE UPDATE OR DELETE ON ledger_postings
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

CREATE TABLE inventory_postings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id  UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
  item_id         UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id    UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  batch_id        UUID REFERENCES batches(id) ON DELETE SET NULL,
  movement_type   TEXT NOT NULL,
  quantity        NUMERIC(18,4) NOT NULL,
  rate            NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  reference_id    UUID,
  reference_type  TEXT,
  posting_date    DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_postings_tenant_company ON inventory_postings(tenant_id, company_id);

CREATE TRIGGER trg_inventory_postings_immutable
  BEFORE UPDATE OR DELETE ON inventory_postings
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();

-- ─── Invoicing ────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id  UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
  invoice_no      TEXT NOT NULL,
  invoice_date    DATE NOT NULL,
  invoice_type    TEXT NOT NULL,
  party_id        UUID REFERENCES parties(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  sub_total       NUMERIC(18,2) NOT NULL DEFAULT 0,
  vat_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, company_id, invoice_type, invoice_no)
);

CREATE INDEX idx_invoices_tenant_company ON invoices(tenant_id, company_id);

CREATE TABLE invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES items(id) ON DELETE SET NULL,
  quantity        NUMERIC(18,4) NOT NULL DEFAULT 0,
  rate            NUMERIC(18,4) NOT NULL DEFAULT 0,
  amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  vat_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

CREATE TABLE bill_references (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_id        UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  bill_no         TEXT NOT NULL,
  bill_date       DATE NOT NULL,
  due_date        DATE,
  original_amount NUMERIC(18,2) NOT NULL,
  balance_amount  NUMERIC(18,2) NOT NULL,
  reference_type  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bill_refs_tenant_company ON bill_references(tenant_id, company_id);

-- ─── Cost centres & budgets ───────────────────────────────────────────────────
CREATE TABLE cost_centres (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES cost_centres(id) ON DELETE SET NULL,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  centre_type     TEXT NOT NULL DEFAULT 'cost',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_centres_tenant_company ON cost_centres(tenant_id, company_id);

CREATE TABLE cost_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id  UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  budget_type     TEXT NOT NULL DEFAULT 'onNettTransactions',
  target_type     TEXT NOT NULL DEFAULT 'ledger',
  target_id       UUID,
  annual_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  monthly_amounts JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_budgets_tenant_company ON budgets(tenant_id, company_id, fiscal_year_id);

-- ─── Fixed assets & payroll ───────────────────────────────────────────────────
CREATE TABLE fixed_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  purchase_date   DATE NOT NULL,
  purchase_cost   NUMERIC(18,2) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE depreciation_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id        UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  fiscal_year_id  UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
  schedule_date   DATE NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  method          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code   TEXT NOT NULL,
  name            TEXT NOT NULL,
  joining_date    DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE salary_structures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_from  DATE NOT NULL,
  basic_salary    NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pay_heads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  head_type       TEXT NOT NULL,
  computation_type TEXT NOT NULL DEFAULT 'flatRate',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_month    INTEGER NOT NULL,
  period_year     INTEGER NOT NULL,
  days_present    NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_absent     NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year_id  UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',
  total_net_pay   NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id  UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  gross_salary    NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_pay         NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Banking ──────────────────────────────────────────────────────────────────
CREATE TABLE bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  bank_name       TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  branch          TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bank_reconciliations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  statement_date  DATE NOT NULL,
  statement_balance NUMERIC(18,2) NOT NULL,
  book_balance    NUMERIC(18,2),
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cheque_register (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  cheque_no       TEXT NOT NULL,
  cheque_date     DATE NOT NULL,
  payee_name      TEXT,
  amount          NUMERIC(18,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pdc_register (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_id        UUID REFERENCES parties(id) ON DELETE SET NULL,
  cheque_no       TEXT NOT NULL,
  cheque_date     DATE NOT NULL,
  amount          NUMERIC(18,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Multi-currency & tax ─────────────────────────────────────────────────────
CREATE TABLE currencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code            CHAR(3) NOT NULL,
  name            TEXT NOT NULL,
  symbol          TEXT NOT NULL,
  is_base         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, company_id, code)
);

CREATE TABLE exchange_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_currency   CHAR(3) NOT NULL,
  to_currency     CHAR(3) NOT NULL,
  effective_date  DATE NOT NULL,
  buy_rate        NUMERIC(18,6) NOT NULL,
  sell_rate       NUMERIC(18,6) NOT NULL,
  standard_rate   NUMERIC(18,6) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exchange_rates_lookup ON exchange_rates(tenant_id, company_id, from_currency, effective_date DESC);

CREATE TABLE fx_gain_loss_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_date      DATE NOT NULL,
  currency_code   CHAR(3) NOT NULL,
  gain_loss_amount NUMERIC(18,2) NOT NULL,
  entry_type      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tds_nature_of_payment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  section_code    TEXT NOT NULL,
  description     TEXT NOT NULL,
  rate            NUMERIC(6,3) NOT NULL DEFAULT 0,
  threshold       NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tds_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  party_id        UUID REFERENCES parties(id) ON DELETE SET NULL,
  voucher_id      UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  section_code    TEXT,
  gross_amount    NUMERIC(18,2) NOT NULL,
  tds_amount      NUMERIC(18,2) NOT NULL,
  transaction_date DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vat_classifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  rate            NUMERIC(6,3) NOT NULL DEFAULT 0,
  classification  TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workflow & audit ─────────────────────────────────────────────────────────
CREATE TABLE approval_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_type    TEXT NOT NULL,
  minimum_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,
  levels          JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  voucher_id      UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  policy_id       UUID REFERENCES approval_policies(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  current_level   INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE recurring_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  voucher_type    TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  lines           JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT,
  field_name      TEXT,
  old_value       TEXT,
  new_value       TEXT,
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_company ON audit_logs(tenant_id, company_id, created_at DESC);

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_mutation();
