/**
 * Treasury E2E seed helpers (Phase 10) — development only.
 * Extends settlement seed with bank account on acc-bank, RV/PV fixtures
 * RV-E2E-001/002/003 and PV-E2E-001, CH-E2E-001/002, and sample CSV.
 */

import { getDB, generateId } from "@/lib/db";
import { E2E_COMPANY_ID, E2E_COMPANY_NAME } from "@/domains/purchase/postPurchaseTransaction";
import {
  E2E_CUSTOMER_ID,
  E2E_CUSTOMER_NAME,
  E2E_FY_ID,
  E2E_SUPPLIER_ID,
  E2E_USER_AUTHORIZED,
  seedSettlementE2ECompany,
} from "@/domains/settlement/e2eSeed";
import { upsertBankAccount } from "./bankAccountModel";
import type { ChequeInstrumentRow } from "./types";

export {
  E2E_COMPANY_ID,
  E2E_CUSTOMER_ID,
  E2E_CUSTOMER_NAME,
  E2E_FY_ID,
  E2E_SUPPLIER_ID,
  E2E_USER_AUTHORIZED,
};

export const E2E_BANK_ACCOUNT_ID = "bank-e2e-main";
export const E2E_BANK_LEDGER_ID = "acc-bank";
export const E2E_INTEREST_INCOME_ID = "acc-interest-income";
export const E2E_CHEQUE_CLEARED_ID = "cheque-e2e-001";
export const E2E_CHEQUE_BOUNCE_ID = "cheque-e2e-002";
export const E2E_CHEQUE_CLEARED_NO = "CH-E2E-001";
export const E2E_CHEQUE_BOUNCE_NO = "CH-E2E-002";

export const E2E_RV_001_ID = "voucher-e2e-rv-001";
export const E2E_RV_002_ID = "voucher-e2e-rv-002";
export const E2E_RV_003_ID = "voucher-e2e-rv-003";
export const E2E_PV_001_ID = "voucher-e2e-pv-001";

/** Sample CSV matching DEFAULT_CSV_HEADER_MAP in statementImport. */
export const E2E_SAMPLE_STATEMENT_CSV = [
  "Date,Description,Reference,Debit,Credit,Balance",
  "2026-07-01,Opening balance,,,100000.00,100000.00",
  "2026-07-02,Customer receipt Ram Traders,RV-E2E-001,,25000.00,125000.00",
  "2026-07-03,Customer receipt Ram Traders,RV-E2E-002,,15000.00,140000.00",
  "2026-07-04,Customer receipt Ram Traders,RV-E2E-003,,8000.00,148000.00",
  "2026-07-05,Supplier payment ABC,PV-E2E-001,12000.00,,136000.00",
  "2026-07-06,Cheque CH-E2E-001 cleared,CH-E2E-001,,10000.00,146000.00",
  "2026-07-07,Bank charge monthly,,500.00,,145500.00",
  "2026-07-08,Bank interest credit,,,1000.00,146500.00",
  "2026-07-09,Grouped deposit RV-E2E-002+RV-E2E-003,GROUP-E2E-001,,23000.00,169500.00",
].join("\n");

export async function seedTreasuryE2ECompany(): Promise<{
  companyId: string;
  bankAccountId: string;
  ledgerAccountId: string;
  chequeClearedId: string;
  chequeBounceId: string;
  sampleCsv: string;
  authorizedUserId: string;
  rvIds: string[];
  pvIds: string[];
}> {
  await seedSettlementE2ECompany();
  const db = getDB();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Ensure two-device sync is enabled for orbix-e2e-company (same as purchase e2eSeed).
  await db.companySettings.put({
    id: "main",
    companyId: E2E_COMPANY_ID,
    name: E2E_COMPANY_NAME,
    companyName: E2E_COMPANY_NAME,
    syncPolicy: "sync_enabled",
    updatedAt: now,
  } as any);

  // Clear Phase 10 treasury facts so re-seeds are deterministic (no duplicate imports).
  for (const tableName of [
    "bankStatementBatches",
    "bankStatementLines",
    "bankReconciliationLinks",
    "bankReconciliationSessions",
    "chequeInstruments",
    "treasuryForecastItems",
  ] as const) {
    const t = (db as any)[tableName];
    if (t?.clear) await t.clear();
  }

  const bankLedger = await db.accounts.get(E2E_BANK_LEDGER_ID);
  if (!bankLedger) {
    await db.accounts.add({
      id: E2E_BANK_LEDGER_ID,
      code: "1402",
      name: "Bank",
      type: "asset",
      balance: 100000,
      level: 1,
      isGroup: false,
      isActive: true,
      createdAt: now,
    } as any);
  } else {
    await db.accounts.update(E2E_BANK_LEDGER_ID, { balance: 100000, isActive: true } as any);
  }

  const interest = await db.accounts.get(E2E_INTEREST_INCOME_ID);
  if (!interest) {
    await db.accounts.add({
      id: E2E_INTEREST_INCOME_ID,
      code: "4201",
      name: "Interest Income",
      type: "income",
      balance: 0,
      level: 1,
      isGroup: false,
      isActive: true,
      createdAt: now,
    } as any);
  }

  const bank = await upsertBankAccount(db, {
    id: E2E_BANK_ACCOUNT_ID,
    companyId: E2E_COMPANY_ID,
    ledgerAccountId: E2E_BANK_LEDGER_ID,
    name: "E2E Main Bank",
    currency: "NPR",
    bankName: "E2E Bank Ltd",
    accountNumberMasked: "****0001",
    minBalancePaisa: 0,
    overdraftLimitPaisa: 0,
    isActive: true,
  });

  if (db.vouchers) {
    const putRv = async (id: string, no: string, amount: number) => {
      await db.vouchers.put({
        id,
        voucherNo: no,
        type: "receipt",
        date: today,
        status: "posted",
        partyId: E2E_CUSTOMER_ID,
        partyName: E2E_CUSTOMER_NAME,
        amount,
        totalDebit: amount,
        totalCredit: amount,
        narration: `E2E treasury receipt ${no}`,
        companyId: E2E_COMPANY_ID,
        createdBy: E2E_USER_AUTHORIZED,
        createdAt: now,
        bankTransactionId: null,
        chequeNumber: null,
        reference: no,
      } as any);
    };

    await putRv(E2E_RV_001_ID, "RV-E2E-001", 25000);
    await putRv(E2E_RV_002_ID, "RV-E2E-002", 15000);
    await putRv(E2E_RV_003_ID, "RV-E2E-003", 8000);

    await db.vouchers.put({
      id: E2E_PV_001_ID,
      voucherNo: "PV-E2E-001",
      type: "payment",
      date: today,
      status: "posted",
      partyId: E2E_SUPPLIER_ID,
      amount: 12000,
      totalDebit: 12000,
      totalCredit: 12000,
      narration: "E2E treasury payment PV-E2E-001",
      companyId: E2E_COMPANY_ID,
      createdBy: E2E_USER_AUTHORIZED,
      createdAt: now,
      reference: "PV-E2E-001",
    } as any);
  }

  const chequeTable = (db as any).chequeInstruments;
  if (chequeTable) {
    const cleared: ChequeInstrumentRow = {
      id: E2E_CHEQUE_CLEARED_ID,
      companyId: E2E_COMPANY_ID,
      bankAccountId: bank.id,
      partyId: E2E_CUSTOMER_ID,
      instrumentType: "received",
      instrumentNumber: E2E_CHEQUE_CLEARED_NO,
      status: "deposited",
      instrumentVersion: 1,
      amountPaisa: 1_000_000,
      currency: "NPR",
      chequeDate: today,
      sourceVoucherId: E2E_RV_001_ID,
      bounceVoucherId: null,
      clearedStatementLineId: null,
      createdAt: now,
      updatedAt: now,
    };
    const bounce: ChequeInstrumentRow = {
      id: E2E_CHEQUE_BOUNCE_ID,
      companyId: E2E_COMPANY_ID,
      bankAccountId: bank.id,
      partyId: E2E_CUSTOMER_ID,
      instrumentType: "received",
      instrumentNumber: E2E_CHEQUE_BOUNCE_NO,
      status: "deposited",
      instrumentVersion: 1,
      amountPaisa: 500_000,
      currency: "NPR",
      chequeDate: today,
      sourceVoucherId: null,
      bounceVoucherId: null,
      clearedStatementLineId: null,
      createdAt: now,
      updatedAt: now,
    };
    await chequeTable.put(cleared);
    await chequeTable.put(bounce);
  }

  return {
    companyId: E2E_COMPANY_ID,
    bankAccountId: bank.id,
    ledgerAccountId: E2E_BANK_LEDGER_ID,
    chequeClearedId: E2E_CHEQUE_CLEARED_ID,
    chequeBounceId: E2E_CHEQUE_BOUNCE_ID,
    sampleCsv: E2E_SAMPLE_STATEMENT_CSV,
    authorizedUserId: E2E_USER_AUTHORIZED,
    rvIds: [E2E_RV_001_ID, E2E_RV_002_ID, E2E_RV_003_ID],
    pvIds: [E2E_PV_001_ID],
  };
}

/** Convenience: write sample CSV text (tests may parse via statementImport). */
export function getE2ESampleStatementCsv(): string {
  return E2E_SAMPLE_STATEMENT_CSV;
}

export async function seedE2ETreasuryForecastItems(): Promise<void> {
  const db = getDB();
  const table = (db as any).treasuryForecastItems;
  if (!table) return;
  const today = new Date().toISOString().slice(0, 10);
  const mk = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await table.put({
    id: "forecast-e2e-in-1",
    companyId: E2E_COMPANY_ID,
    date: mk(3),
    side: "inflow",
    amountPaisa: 200_000,
    confidence: "expected",
    status: "open",
    label: "Expected customer collection",
    sourceType: "e2e",
    sourceId: generateId(),
  });
  await table.put({
    id: "forecast-e2e-out-1",
    companyId: E2E_COMPANY_ID,
    date: mk(5),
    side: "outflow",
    amountPaisa: 150_000,
    confidence: "committed",
    status: "open",
    label: "Committed supplier payment",
    sourceType: "e2e",
    sourceId: generateId(),
  });
}
