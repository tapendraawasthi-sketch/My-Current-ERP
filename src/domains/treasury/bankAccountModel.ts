/**
 * Bank account master helpers (Phase 10).
 * Uses optional bankAccounts table + accounts ledger row.
 */

import type { SutraERPDatabase } from "@/lib/db";
import { generateId } from "@/lib/db";
import type { BankAccountRow } from "./types";

export interface UpsertBankAccountInput {
  id?: string;
  companyId: string;
  ledgerAccountId: string;
  name: string;
  currency?: string;
  bankName?: string | null;
  accountNumberMasked?: string | null;
  minBalancePaisa?: number | null;
  overdraftLimitPaisa?: number | null;
  lastReconciledDate?: string | null;
  isActive?: boolean;
}

export async function getBankAccount(
  db: SutraERPDatabase,
  bankAccountId: string,
): Promise<BankAccountRow | null> {
  const table = (db as any).bankAccounts;
  if (!table) return null;
  const row = await table.get(bankAccountId);
  return (row as BankAccountRow) || null;
}

export async function listBankAccountsForCompany(
  db: SutraERPDatabase,
  companyId: string,
): Promise<BankAccountRow[]> {
  const table = (db as any).bankAccounts;
  if (!table) return [];
  return (await table.where("companyId").equals(companyId).toArray()) as BankAccountRow[];
}

export async function findBankAccountByLedger(
  db: SutraERPDatabase,
  companyId: string,
  ledgerAccountId: string,
): Promise<BankAccountRow | null> {
  const all = await listBankAccountsForCompany(db, companyId);
  return all.find((a) => a.ledgerAccountId === ledgerAccountId && a.isActive) || null;
}

export async function upsertBankAccount(
  db: SutraERPDatabase,
  input: UpsertBankAccountInput,
): Promise<BankAccountRow> {
  const table = (db as any).bankAccounts;
  if (!table) {
    throw Object.assign(new Error("bankAccounts table not available (Dexie v33+)"), {
      code: "schema_missing",
    });
  }
  const ledger = await db.accounts.get(input.ledgerAccountId);
  if (!ledger) {
    throw Object.assign(new Error(`Ledger account not found: ${input.ledgerAccountId}`), {
      code: "account_not_found",
    });
  }
  const now = new Date().toISOString();
  const id = input.id || generateId();
  const existing = await table.get(id);
  const row: BankAccountRow = {
    id,
    companyId: input.companyId,
    ledgerAccountId: input.ledgerAccountId,
    name: input.name,
    currency: input.currency || "NPR",
    bankName: input.bankName ?? null,
    accountNumberMasked: input.accountNumberMasked ?? null,
    minBalancePaisa: input.minBalancePaisa ?? null,
    overdraftLimitPaisa: input.overdraftLimitPaisa ?? null,
    lastReconciledDate: input.lastReconciledDate ?? existing?.lastReconciledDate ?? null,
    isActive: input.isActive ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await table.put(row);
  return row;
}

export async function setLastReconciledDate(
  db: SutraERPDatabase,
  bankAccountId: string,
  date: string,
): Promise<void> {
  const table = (db as any).bankAccounts;
  if (!table) return;
  await table.update(bankAccountId, {
    lastReconciledDate: date,
    updatedAt: new Date().toISOString(),
  });
}

export async function resolveLedgerBalancePaisa(
  db: SutraERPDatabase,
  ledgerAccountId: string,
): Promise<number> {
  const acc = await db.accounts.get(ledgerAccountId);
  if (!acc) return 0;
  return Math.round((Number((acc as any).balance) || 0) * 100);
}
