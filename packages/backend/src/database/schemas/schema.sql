-- ==============================================================================
-- BUSY ERP - POSTGRESQL MULTI-TENANT DATABASE SCHEMA
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Base Tenant/Company Schema
-- ------------------------------------------------------------------------------

-- Tenants (Multi-tenant isolation)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    plan TEXT DEFAULT 'standard',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Companies
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    gstin VARCHAR(15) UNIQUE,
    pan VARCHAR(10),
    fy_beginning DATE NOT NULL,
    fy_end DATE NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_companies_tenant ON companies(tenant_id);

-- Fiscal Years
CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_label VARCHAR(7) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fiscal_years_company ON fiscal_years(company_id, is_current);

-- ------------------------------------------------------------------------------
-- 2. Account Masters (with bill-by-bill)
-- ------------------------------------------------------------------------------

-- Account Groups
CREATE TYPE account_nature AS ENUM ('asset', 'liability', 'income', 'expense');

CREATE TABLE account_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES account_groups(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    nature account_nature NOT NULL,
    sort_order INT DEFAULT 0
);

-- Ledgers
CREATE TABLE ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fy_id UUID NOT NULL REFERENCES fiscal_years(id),
    group_id UUID NOT NULL REFERENCES account_groups(id),
    name VARCHAR(100) NOT NULL,
    alias VARCHAR(30),
    bill_by_bill BOOLEAN DEFAULT false,
    op_balance DECIMAL(15, 2) DEFAULT 0.00,
    op_dr_cr CHAR(1) DEFAULT 'D' CHECK (op_dr_cr IN ('D', 'C')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. Inventory Masters
-- ------------------------------------------------------------------------------

-- Tax Categories
CREATE TABLE tax_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    cgst_rate DECIMAL(5,2) DEFAULT 0,
    sgst_rate DECIMAL(5,2) DEFAULT 0,
    igst_rate DECIMAL(5,2) DEFAULT 0
);

-- Item Groups
CREATE TABLE item_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES item_groups(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL
);

-- Items
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    group_id UUID REFERENCES item_groups(id),
    tax_category_id UUID REFERENCES tax_categories(id),
    name VARCHAR(100) NOT NULL,
    hsn_code VARCHAR(15)
);

-- Material Centres
CREATE TABLE material_centres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stock_account_id UUID REFERENCES ledgers(id),
    name VARCHAR(100) NOT NULL
);

-- Bill Sundries (Taxes, Discounts, Charges)
CREATE TABLE bill_sundries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_id UUID REFERENCES ledgers(id),
    name VARCHAR(100) NOT NULL,
    type TEXT CHECK (type IN ('additive', 'subtractive')),
    nature TEXT CHECK (nature IN ('tax', 'discount', 'other'))
);

-- ------------------------------------------------------------------------------
-- 4. Voucher Series & Vouchers
-- ------------------------------------------------------------------------------

-- Voucher Series
CREATE TABLE voucher_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    voucher_type VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    prefix VARCHAR(20),
    next_number INT DEFAULT 1,
    reset_on TEXT CHECK (reset_on IN ('never', 'yearly', 'monthly'))
);

-- Vouchers
CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES voucher_series(id),
    voucher_type VARCHAR(50) NOT NULL,
    number INT NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'held', 'posted', 'cancelled'))
);
CREATE INDEX idx_vouchers_date_company ON vouchers(company_id, date DESC);

-- ------------------------------------------------------------------------------
-- 5. Event-Sourced Immutable Tables (NO UPDATE/DELETE ALLOWED)
-- ------------------------------------------------------------------------------

-- Ledger Postings (Immutable event log for double-entry)
CREATE TABLE ledger_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id),
    ledger_id UUID NOT NULL REFERENCES ledgers(id),
    debit DECIMAL(15, 2) DEFAULT 0.00,
    credit DECIMAL(15, 2) DEFAULT 0.00,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) WITH (fillfactor=100);
CREATE INDEX idx_ledger_postings_ledger ON ledger_postings(ledger_id, date DESC);

-- Inventory Postings (Immutable event log for stock)
CREATE TABLE inventory_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id),
    item_id UUID NOT NULL REFERENCES items(id),
    material_centre_id UUID REFERENCES material_centres(id),
    qty_in DECIMAL(15, 4) DEFAULT 0,
    qty_out DECIMAL(15, 4) DEFAULT 0,
    value_in DECIMAL(15, 2) DEFAULT 0,
    value_out DECIMAL(15, 2) DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) WITH (fillfactor=100);
CREATE INDEX idx_inventory_postings_item ON inventory_postings(item_id, date DESC);

-- Audit Log (Immutable log)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    before_json JSONB,
    after_json JSONB,
    at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) WITH (fillfactor=100);

-- ------------------------------------------------------------------------------
-- 6. Bill-by-Bill Adjustment
-- ------------------------------------------------------------------------------

CREATE TABLE bill_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES vouchers(id),
    ledger_id UUID NOT NULL REFERENCES ledgers(id),
    method TEXT CHECK (method IN ('new_ref', 'adjustment', 'on_account', 'advance')),
    ref_no VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    dc CHAR(1) CHECK (dc IN ('D', 'C')),
    due_date DATE,
    is_cleared BOOLEAN DEFAULT false
);
CREATE INDEX idx_bill_references_ledger ON bill_references(ledger_id, is_cleared);

-- ------------------------------------------------------------------------------
-- Triggers for Immutability Protection
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION block_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates and Deletes are strictly prohibited on this immutable table.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER block_ledger_mutations BEFORE UPDATE OR DELETE ON ledger_postings FOR EACH ROW EXECUTE FUNCTION block_update_delete();
CREATE TRIGGER block_inventory_mutations BEFORE UPDATE OR DELETE ON inventory_postings FOR EACH ROW EXECUTE FUNCTION block_update_delete();
CREATE TRIGGER block_audit_mutations BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION block_update_delete();
