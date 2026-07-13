/**
 * Deterministic treasury position engine (Phase 10).
 * Distinguishes book / statement / cleared / available balances.
 */

import type { SutraERPDatabase } from "@/lib/db";
import { getDB } from "@/lib/db";
import { paisaToString } from "@/domains/purchase/money";
import {
  getBankAccount,
  listBankAccountsForCompany,
  resolveLedgerBalancePaisa,
} from "./bankAccountModel";
import type { BankAccountRow, ChequeInstrumentRow, MoneyString } from "./types";

export interface TreasuryAccountPosition {
  bankAccountId: string;
  ledgerAccountId: string;
  name: string;
  currency: string;
  /** Accounting ledger balance. */
  bookBalance: MoneyString;
  bookBalancePaisa: number;
  /** Latest statement closing balance when known. */
  statementBalance: MoneyString | null;
  statementBalancePaisa: number | null;
  /** Last reconciled / cleared snapshot. */
  reconciledBalance: MoneyString | null;
  reconciledBalancePaisa: number | null;
  unclearedReceiptsPaisa: number;
  unclearedPaymentsPaisa: number;
  outstandingIssuedChequesPaisa: number;
  receivedChequesNotClearedPaisa: number;
  minBalancePaisa: number | null;
  overdraftLimitPaisa: number | null;
  overdraftUsedPaisa: number;
  overdraftAvailablePaisa: number;
  /** Immediately available = book - outstanding issued + received not cleared (policy: PDC excluded). */
  availableBalance: MoneyString;
  availableBalancePaisa: number;
  warningCodes: string[];
}

export interface TreasuryPositionResult {
  companyId: string;
  asOfDate: string;
  accounts: TreasuryAccountPosition[];
  totals: {
    bookBalancePaisa: number;
    availableBalancePaisa: number;
    outstandingIssuedChequesPaisa: number;
    receivedChequesNotClearedPaisa: number;
  };
}

function isOutstandingIssued(c: ChequeInstrumentRow): boolean {
  return (
    c.instrumentType === "issued" &&
    (c.status === "issued" || c.status === "draft" || c.status === "stopped")
  );
}

function isReceivedNotCleared(c: ChequeInstrumentRow): boolean {
  return (
    c.instrumentType === "received" &&
    (c.status === "received" || c.status === "deposited")
  );
}

async function latestStatementClosingPaisa(
  db: SutraERPDatabase,
  bankAccountId: string,
): Promise<number | null> {
  const batches = (db as any).bankStatementBatches;
  if (!batches) return null;
  const rows = await batches.where("bankAccountId").equals(bankAccountId).toArray();
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a: any, b: any) =>
    String(b.periodEnd || "").localeCompare(String(a.periodEnd || "")),
  );
  const top = sorted[0];
  return typeof top.closingBalancePaisa === "number" ? top.closingBalancePaisa : null;
}

async function positionForAccount(
  db: SutraERPDatabase,
  bank: BankAccountRow,
  cheques: ChequeInstrumentRow[],
): Promise<TreasuryAccountPosition> {
  const bookBalancePaisa = await resolveLedgerBalancePaisa(db, bank.ledgerAccountId);
  const statementBalancePaisa = await latestStatementClosingPaisa(db, bank.id);
  const reconciledBalancePaisa = bank.lastReconciledDate
    ? bookBalancePaisa // snapshot proxy when session closed updated lastReconciledDate
    : null;

  const mine = cheques.filter((c) => c.bankAccountId === bank.id);
  const outstandingIssuedChequesPaisa = mine
    .filter(isOutstandingIssued)
    .reduce((s, c) => s + c.amountPaisa, 0);
  const receivedChequesNotClearedPaisa = mine
    .filter(isReceivedNotCleared)
    .reduce((s, c) => s + c.amountPaisa, 0);

  // Uncleared receipts/payments approximated from unmatched statement lines (timing)
  let unclearedReceiptsPaisa = 0;
  let unclearedPaymentsPaisa = 0;
  const linesTable = (db as any).bankStatementLines;
  if (linesTable) {
    const lines = await linesTable.where("bankAccountId").equals(bank.id).toArray();
    for (const line of lines || []) {
      if (line.status === "matched" || line.status === "excluded") continue;
      if (line.signedAmountPaisa > 0) unclearedReceiptsPaisa += line.remainingMatchPaisa ?? line.signedAmountPaisa;
      else unclearedPaymentsPaisa += Math.abs(line.remainingMatchPaisa ?? line.signedAmountPaisa);
    }
  }

  // Available: book less outstanding issued cheques (cash committed out); do not count uncleared received as available
  const availableBalancePaisa = bookBalancePaisa - outstandingIssuedChequesPaisa;

  const overdraftUsedPaisa = availableBalancePaisa < 0 ? Math.abs(availableBalancePaisa) : 0;
  const odLimit = bank.overdraftLimitPaisa ?? 0;
  const overdraftAvailablePaisa = Math.max(0, odLimit - overdraftUsedPaisa);

  const warningCodes: string[] = [];
  if (bank.minBalancePaisa != null && availableBalancePaisa < bank.minBalancePaisa) {
    warningCodes.push("min_balance_breach");
  }
  if (overdraftUsedPaisa > 0) warningCodes.push("overdraft_used");
  if (odLimit > 0 && overdraftUsedPaisa > odLimit) warningCodes.push("overdraft_limit_exceeded");

  return {
    bankAccountId: bank.id,
    ledgerAccountId: bank.ledgerAccountId,
    name: bank.name,
    currency: bank.currency,
    bookBalance: paisaToString(bookBalancePaisa),
    bookBalancePaisa,
    statementBalance: statementBalancePaisa == null ? null : paisaToString(statementBalancePaisa),
    statementBalancePaisa,
    reconciledBalance: reconciledBalancePaisa == null ? null : paisaToString(reconciledBalancePaisa),
    reconciledBalancePaisa,
    unclearedReceiptsPaisa,
    unclearedPaymentsPaisa,
    outstandingIssuedChequesPaisa,
    receivedChequesNotClearedPaisa,
    minBalancePaisa: bank.minBalancePaisa ?? null,
    overdraftLimitPaisa: bank.overdraftLimitPaisa ?? null,
    overdraftUsedPaisa,
    overdraftAvailablePaisa,
    availableBalance: paisaToString(availableBalancePaisa),
    availableBalancePaisa,
    warningCodes,
  };
}

export async function computeTreasuryPosition(opts: {
  companyId: string;
  bankAccountId?: string | null;
  asOfDate?: string;
  db?: SutraERPDatabase;
}): Promise<TreasuryPositionResult> {
  const db = opts.db || getDB();
  const asOfDate = opts.asOfDate || new Date().toISOString().slice(0, 10);

  let accounts: BankAccountRow[] = [];
  if (opts.bankAccountId) {
    const one = await getBankAccount(db, opts.bankAccountId);
    if (one && one.companyId === opts.companyId) accounts = [one];
  } else {
    accounts = (await listBankAccountsForCompany(db, opts.companyId)).filter((a) => a.isActive);
  }

  const chequeTable = (db as any).chequeInstruments;
  const cheques: ChequeInstrumentRow[] = chequeTable
    ? ((await chequeTable.where("companyId").equals(opts.companyId).toArray()) as ChequeInstrumentRow[])
    : [];

  const positions: TreasuryAccountPosition[] = [];
  for (const bank of accounts) {
    positions.push(await positionForAccount(db, bank, cheques));
  }

  const totals = {
    bookBalancePaisa: positions.reduce((s, p) => s + p.bookBalancePaisa, 0),
    availableBalancePaisa: positions.reduce((s, p) => s + p.availableBalancePaisa, 0),
    outstandingIssuedChequesPaisa: positions.reduce((s, p) => s + p.outstandingIssuedChequesPaisa, 0),
    receivedChequesNotClearedPaisa: positions.reduce((s, p) => s + p.receivedChequesNotClearedPaisa, 0),
  };

  return { companyId: opts.companyId, asOfDate, accounts: positions, totals };
}