/**
 * Shared settlement posting helpers (Phase 9).
 */

import type { SutraERPDatabase } from "@/lib/db";
import { generateId } from "@/lib/db";
import { parseMoneyToPaisa, paisaToNumber } from "@/domains/purchase/money";

export type FailureInjectionStage =
  | "before_allocations"
  | "before_audit"
  | "before_sync"
  | null
  | undefined;

export interface JournalLineDraft {
  accountId: string;
  accountName?: string;
  debit: number;
  credit: number;
  narration?: string;
  partyId?: string;
}

export function buildScopedFinancialIdempotencyKey(
  op: string,
  companyId: string,
  draftId: string | null | undefined,
  previewVersion: string | number | null | undefined,
  previewHash: string | null | undefined,
  idempotencyKey: string,
): string {
  return [
    "local",
    companyId,
    op,
    draftId || "",
    previewVersion != null ? String(previewVersion) : "",
    previewHash || "",
    idempotencyKey,
  ].join("|");
}

export async function findExistingFinancialReceipt(
  db: SutraERPDatabase,
  scopedKey: string,
): Promise<any | null> {
  if (!db.orbixPostingReceipts) return null;
  const existing = await db.orbixPostingReceipts.where("scopedKey").equals(scopedKey).first();
  return existing || null;
}

export function assertJournalBalanced(lines: JournalLineDraft[]): void {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += parseMoneyToPaisa(line.debit);
    credit += parseMoneyToPaisa(line.credit);
  }
  if (debit !== credit) {
    throw Object.assign(
      new Error(
        `Journal unbalanced: debit ${paisaToNumber(debit)} vs credit ${paisaToNumber(credit)}`,
      ),
      { code: "journal_unbalanced" },
    );
  }
}

function maxSerialFromNumbers(numbers: Array<string | undefined>, pad = 4): string {
  let max = 0;
  for (const no of numbers) {
    const match = no?.match(/-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return String(max + 1).padStart(pad, "0");
}

/** Allocate next voucher number without importing the full Zustand store graph. */
export async function generateNextVoucherNo(
  type: string,
  db: SutraERPDatabase,
): Promise<string> {
  const prefixes: Record<string, string> = {
    journal: "JV",
    payment: "PV",
    receipt: "RV",
    contra: "CV",
    reversal: "REV",
  };
  const prefix = prefixes[type] || "VCH";
  const existing = await db.vouchers.where("type").equals(type).toArray();
  return `${prefix}-${maxSerialFromNumbers(existing.map((v) => v.voucherNo))}`;
}

export async function applyAccountProjectionDeltas(
  db: SutraERPDatabase,
  lines: JournalLineDraft[],
): Promise<void> {
  for (const line of lines) {
    const acc = await db.accounts.get(line.accountId);
    if (!acc) {
      throw Object.assign(new Error(`Account not found: ${line.accountId}`), {
        code: "account_not_found",
      });
    }
    const delta = (Number(line.debit) || 0) - (Number(line.credit) || 0);
    const type = String((acc as { type?: string }).type || "").toLowerCase();
    // Asset/expense increase with debit; liability/income/equity increase with credit.
    const signed =
      type === "liability" || type === "income" || type === "equity" || type === "revenue"
        ? -delta
        : delta;
    const next = Math.round(((Number(acc.balance) || 0) + signed) * 100) / 100;
    await db.accounts.update(line.accountId, { balance: next } as any);
  }
}

export async function writeAuditLog(
  db: SutraERPDatabase,
  opts: {
    userId: string;
    userName?: string;
    action: string;
    module?: string;
    entityType: string;
    entityId: string;
    companyId: string;
    sessionId?: string | null;
    after?: Record<string, unknown>;
  },
): Promise<string> {
  const auditId = generateId();
  await db.auditLogs.add({
    id: auditId,
    timestamp: new Date().toISOString(),
    userId: opts.userId,
    userName: opts.userName || opts.userId,
    action: opts.action,
    module: opts.module || "settlement",
    entityType: opts.entityType,
    entityId: opts.entityId,
    recordId: opts.entityId,
    recordType: opts.entityType,
    companyId: opts.companyId,
    sessionId: opts.sessionId || undefined,
    after: opts.after || {},
  } as any);
  return auditId;
}

export function collectTxnTables(db: SutraERPDatabase): any[] {
  return [
    (db as any).settlementAllocations,
    (db as any).documentSettlementState,
    (db as any).partyAdvances,
    (db as any).partyAdvanceApplications,
    (db as any).unappliedBalances,
    db.vouchers,
    db.accounts,
    db.auditLogs,
    db.orbixPostingReceipts,
    db.eventSyncQueue,
    db.domainEvents,
    db.syncLocalSequences,
    db.invoices,
    db.parties,
    db.periodLocks,
    db.companySettings,
  ].filter(Boolean);
}

export function moneyStringFromPaisa(paisa: number): string {
  return (Math.round(paisa) / 100).toFixed(2);
}

export function optionalMoneyPaisa(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return parseMoneyToPaisa(value);
}

export function isCashOrBankAccount(acc: {
  id?: string;
  name?: string;
  type?: string;
  code?: string;
  isCash?: boolean;
  isBank?: boolean;
}): boolean {
  if (acc.isCash || acc.isBank) return true;
  const name = String(acc.name || "").toLowerCase();
  const code = String(acc.code || "").toLowerCase();
  const id = String(acc.id || "").toLowerCase();
  if (name.includes("cash") || name.includes("bank")) return true;
  if (code.includes("cash") || code.includes("bank")) return true;
  if (id.includes("cash") || id.includes("bank")) return true;
  return String(acc.type || "").toLowerCase() === "asset" && (name.includes("cash") || name.includes("bank"));
}

export const DEFAULT_SETTLEMENT_ACCOUNTS = {
  sundryDebtors: "acc-sundry-debtors",
  sundryCreditors: "acc-sundry-creditors",
  customerAdvance: "acc-customer-advance",
  supplierAdvance: "acc-supplier-advance",
  bankCharges: "acc-bank-charges",
  tdsReceivable: "acc-tds-receivable",
  tdsPayable: "acc-tds-payable",
  settlementDiscount: "acc-settlement-discount",
  writeoff: "acc-writeoff",
  cash: "acc-cash",
  bank: "acc-bank",
} as const;