import { createHash } from "crypto";
import { query } from "./db.js";
import type { AuthTokenPayload } from "../middleware/auth.js";

export interface SyncRecordInput {
  id: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update";
  payload: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function clientIdToUuid(clientId: string): string {
  if (UUID_RE.test(clientId)) return clientId;
  const hash = createHash("sha256").update(`sutra-sync:${clientId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function requireTenantContext(user: AuthTokenPayload): { tenantId: string; companyId: string } {
  if (!user.companyId) {
    throw new Error("Company context required for sync");
  }
  return { tenantId: user.tenantId, companyId: user.companyId };
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback = true): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1) return true;
  if (v === "false" || v === 0) return false;
  return fallback;
}

async function upsertAccount(
  tenantId: string,
  companyId: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = clientIdToUuid(entityId);
  const parentId = payload.parentId ? clientIdToUuid(str(payload.parentId)) : null;
  await query(
    `INSERT INTO chart_of_accounts (
      id, tenant_id, company_id, parent_id, code, name, account_type, level, is_group, is_active, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (id) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      account_type = EXCLUDED.account_type,
      level = EXCLUDED.level,
      is_group = EXCLUDED.is_group,
      is_active = EXCLUDED.is_active,
      parent_id = EXCLUDED.parent_id,
      updated_at = NOW()`,
    [
      id,
      tenantId,
      companyId,
      parentId,
      str(payload.code, entityId.slice(0, 20)),
      str(payload.name, "Unnamed Account"),
      str(payload.type, "asset"),
      str(payload.level, payload.isGroup ? "group" : "ledger"),
      bool(payload.isGroup, false),
      bool(payload.isActive, true),
    ],
  );
}

async function upsertParty(
  tenantId: string,
  companyId: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = clientIdToUuid(entityId);
  const partyType = str(payload.type, "customer");
  await query(
    `INSERT INTO parties (
      id, tenant_id, company_id, name, party_type, pan_number, vat_number, credit_days, is_active, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      party_type = EXCLUDED.party_type,
      pan_number = EXCLUDED.pan_number,
      vat_number = EXCLUDED.vat_number,
      credit_days = EXCLUDED.credit_days,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()`,
    [
      id,
      tenantId,
      companyId,
      str(payload.name, "Unnamed Party"),
      partyType === "supplier" || partyType === "both" ? partyType : "customer",
      payload.pan ? str(payload.pan).slice(0, 9) : null,
      payload.vatNo ? str(payload.vatNo).slice(0, 20) : null,
      num(payload.creditPeriod, 0),
      bool(payload.isActive, true),
    ],
  );
}

async function upsertItem(
  tenantId: string,
  companyId: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = clientIdToUuid(entityId);
  const code = str(payload.code || payload.sku, entityId.slice(0, 32));
  await query(
    `INSERT INTO items (
      id, tenant_id, company_id, code, name, unit, valuation_method, is_active, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (id) DO UPDATE SET
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      unit = EXCLUDED.unit,
      valuation_method = EXCLUDED.valuation_method,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()`,
    [
      id,
      tenantId,
      companyId,
      code,
      str(payload.name, "Unnamed Item"),
      payload.unit ? str(payload.unit) : null,
      str(payload.valuationMethod, "AVERAGE").toUpperCase(),
      bool(payload.isActive, true),
    ],
  );
}

async function upsertVoucher(
  tenantId: string,
  companyId: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = clientIdToUuid(entityId);
  const voucherNo = str(payload.voucherNo, `V-${entityId.slice(-8)}`);
  const voucherDate = str(payload.date, new Date().toISOString().slice(0, 10));
  const voucherType = str(payload.type, "journal");
  const status = str(payload.status, "draft").toLowerCase();

  await query(
    `INSERT INTO vouchers (
      id, tenant_id, company_id, voucher_no, voucher_date, voucher_type, status,
      narration, total_debit, total_credit, grand_total, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (id) DO UPDATE SET
      voucher_no = EXCLUDED.voucher_no,
      voucher_date = EXCLUDED.voucher_date,
      voucher_type = EXCLUDED.voucher_type,
      status = EXCLUDED.status,
      narration = EXCLUDED.narration,
      total_debit = EXCLUDED.total_debit,
      total_credit = EXCLUDED.total_credit,
      grand_total = EXCLUDED.grand_total,
      updated_at = NOW()`,
    [
      id,
      tenantId,
      companyId,
      voucherNo,
      voucherDate,
      voucherType,
      status,
      payload.narration ? str(payload.narration) : null,
      num(payload.totalDebit),
      num(payload.totalCredit),
      num(payload.grandTotal),
    ],
  );

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  for (const [idx, line] of lines.entries()) {
    if (!line || typeof line !== "object") continue;
    const row = line as Record<string, unknown>;
    const lineId = clientIdToUuid(str(row.id, `${entityId}-line-${idx}`));
    const accountId = clientIdToUuid(str(row.accountId, "00000000-0000-4000-8000-000000000001"));
    await query(
      `INSERT INTO voucher_lines (
        id, tenant_id, company_id, voucher_id, account_id, debit, credit, narration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        debit = EXCLUDED.debit,
        credit = EXCLUDED.credit,
        narration = EXCLUDED.narration`,
      [
        lineId,
        tenantId,
        companyId,
        id,
        accountId,
        num(row.debit),
        num(row.credit),
        row.narration ? str(row.narration) : null,
      ],
    );
  }
}

async function upsertInvoice(
  tenantId: string,
  companyId: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const id = clientIdToUuid(entityId);
  const invoiceNo = str(payload.invoiceNo || payload.voucherNo, `INV-${entityId.slice(-8)}`);
  const invoiceDate = str(
    payload.date || payload.invoiceDate,
    new Date().toISOString().slice(0, 10),
  );
  const invoiceType = str(payload.type || payload.invoiceType, "sales");
  const partyId = payload.partyId ? clientIdToUuid(str(payload.partyId)) : null;

  await query(
    `INSERT INTO invoices (
      id, tenant_id, company_id, invoice_no, invoice_date, invoice_type, party_id, status,
      sub_total, vat_amount, grand_total, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (id) DO UPDATE SET
      invoice_no = EXCLUDED.invoice_no,
      invoice_date = EXCLUDED.invoice_date,
      invoice_type = EXCLUDED.invoice_type,
      party_id = EXCLUDED.party_id,
      status = EXCLUDED.status,
      sub_total = EXCLUDED.sub_total,
      vat_amount = EXCLUDED.vat_amount,
      grand_total = EXCLUDED.grand_total,
      updated_at = NOW()`,
    [
      id,
      tenantId,
      companyId,
      invoiceNo,
      invoiceDate,
      invoiceType,
      partyId,
      str(payload.status, "draft").toLowerCase(),
      num(payload.subTotal ?? payload.taxableAmount),
      num(payload.vatAmount ?? payload.taxAmount),
      num(payload.grandTotal ?? payload.total),
    ],
  );
}

export async function processSyncRecord(
  user: AuthTokenPayload,
  record: SyncRecordInput,
): Promise<void> {
  const { tenantId, companyId } = requireTenantContext(user);
  const entityId = record.entityId || record.id;
  const payload = record.payload ?? {};

  switch (record.entityType) {
    case "account":
      await upsertAccount(tenantId, companyId, entityId, payload);
      break;
    case "party":
      await upsertParty(tenantId, companyId, entityId, payload);
      break;
    case "item":
      await upsertItem(tenantId, companyId, entityId, payload);
      break;
    case "voucher":
      await upsertVoucher(tenantId, companyId, entityId, payload);
      break;
    case "invoice":
      await upsertInvoice(tenantId, companyId, entityId, payload);
      break;
    default:
      throw new Error(`Unsupported entity type: ${record.entityType}`);
  }
}
