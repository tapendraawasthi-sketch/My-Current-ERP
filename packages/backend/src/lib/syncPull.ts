import { query } from "./db.js";
import type { AuthTokenPayload } from "../middleware/auth.js";

export interface SyncPullResult {
  since: string | null;
  pulledAt: string;
  accounts: Record<string, unknown>[];
  parties: Record<string, unknown>[];
  items: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
}

function requireTenantContext(user: AuthTokenPayload): { tenantId: string; companyId: string } {
  if (!user.companyId) {
    throw new Error("Company context required for sync");
  }
  return { tenantId: user.tenantId, companyId: user.companyId };
}

export async function fetchSyncPull(
  user: AuthTokenPayload,
  since?: string | null,
): Promise<SyncPullResult> {
  const { tenantId, companyId } = requireTenantContext(user);
  const sinceTs = since ? new Date(since) : null;
  const sinceParam = sinceTs && !Number.isNaN(sinceTs.getTime()) ? sinceTs.toISOString() : null;

  const accountSql = sinceParam
    ? `SELECT id, code, name, account_type, level, is_group, is_active, parent_id, updated_at
       FROM chart_of_accounts
       WHERE tenant_id = $1 AND company_id = $2 AND updated_at > $3
       ORDER BY updated_at ASC LIMIT 500`
    : `SELECT id, code, name, account_type, level, is_group, is_active, parent_id, updated_at
       FROM chart_of_accounts
       WHERE tenant_id = $1 AND company_id = $2
       ORDER BY updated_at ASC LIMIT 500`;

  const partySql = sinceParam
    ? `SELECT id, name, party_type, pan_number, vat_number, credit_days, is_active, updated_at
       FROM parties
       WHERE tenant_id = $1 AND company_id = $2 AND updated_at > $3
       ORDER BY updated_at ASC LIMIT 500`
    : `SELECT id, name, party_type, pan_number, vat_number, credit_days, is_active, updated_at
       FROM parties
       WHERE tenant_id = $1 AND company_id = $2
       ORDER BY updated_at ASC LIMIT 500`;

  const itemSql = sinceParam
    ? `SELECT id, code, name, unit, valuation_method, is_active, updated_at
       FROM items
       WHERE tenant_id = $1 AND company_id = $2 AND updated_at > $3
       ORDER BY updated_at ASC LIMIT 500`
    : `SELECT id, code, name, unit, valuation_method, is_active, updated_at
       FROM items
       WHERE tenant_id = $1 AND company_id = $2
       ORDER BY updated_at ASC LIMIT 500`;

  const invoiceSql = sinceParam
    ? `SELECT id, invoice_no, invoice_date, invoice_type, party_id, status, sub_total, vat_amount, grand_total, updated_at
       FROM invoices
       WHERE tenant_id = $1 AND company_id = $2 AND updated_at > $3
       ORDER BY updated_at ASC LIMIT 200`
    : `SELECT id, invoice_no, invoice_date, invoice_type, party_id, status, sub_total, vat_amount, grand_total, updated_at
       FROM invoices
       WHERE tenant_id = $1 AND company_id = $2
       ORDER BY updated_at ASC LIMIT 200`;

  const params = sinceParam ? [tenantId, companyId, sinceParam] : [tenantId, companyId];

  const [accounts, parties, items, invoices] = await Promise.all([
    query(accountSql, params),
    query(partySql, params),
    query(itemSql, params),
    query(invoiceSql, params),
  ]);

  return {
    since: sinceParam,
    pulledAt: new Date().toISOString(),
    accounts: accounts.rows,
    parties: parties.rows,
    items: items.rows,
    invoices: invoices.rows,
  };
}
