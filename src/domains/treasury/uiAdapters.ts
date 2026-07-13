/**
 * Thin adapters so manual bank UI pages call Phase 10 treasury commands
 * without rewriting large page components.
 *
 * NEVER routes bank adjustments through addVoucher.
 */

import { getDB, generateId } from "@/lib/db";
import { useStore } from "@/store/useStore";
import { paisaToString } from "@/domains/purchase/money";
import {
  createStatementBatch,
  type CreateStatementBatchResult,
} from "./statementBatch";
import {
  confirmBankMatch,
  type ConfirmBankMatchResult,
} from "./postConfirmBankMatch";
import {
  reverseBankMatch,
  type ReverseBankMatchResult,
} from "./postReverseBankMatch";
import {
  postBankAdjustmentFromStatement,
  type BankAdjustmentResult,
} from "./postBankAdjustmentFromStatement";
import {
  closeBankReconciliation,
  openBankReconciliationSession,
  type ReconciliationSessionResult,
} from "./reconciliationSession";
import {
  findBankAccountByLedger,
  upsertBankAccount,
} from "./bankAccountModel";
import type { BankAdjustmentType, TreasuryCommandSource } from "./types";

function resolveCompanyId(): string {
  const store = useStore.getState() as {
    companySettings?: { id?: string; companyId?: string };
    activeCompanyId?: string;
  };
  return (
    store.activeCompanyId ||
    store.companySettings?.companyId ||
    store.companySettings?.id ||
    "local"
  );
}

function resolveUserContext(): {
  userId: string;
  userRole: string | null;
  companyId: string;
} {
  const store = useStore.getState() as {
    currentUser?: { id?: string; role?: string };
    user?: { id?: string; role?: string };
  };
  const u = store.currentUser || store.user || {};
  return {
    userId: String(u.id || "manual-user"),
    userRole: u.role != null ? String(u.role) : "accountant",
    companyId: resolveCompanyId(),
  };
}

export async function ensureTreasuryBankAccountForLedger(
  ledgerAccountId: string,
  opts?: { name?: string; companyId?: string },
): Promise<{ bankAccountId: string; ledgerAccountId: string }> {
  const db = getDB();
  const companyId = opts?.companyId || resolveCompanyId();
  const existing = await findBankAccountByLedger(db, companyId, ledgerAccountId);
  if (existing) {
    return { bankAccountId: existing.id, ledgerAccountId };
  }
  const ledger = await db.accounts.get(ledgerAccountId);
  const row = await upsertBankAccount(db, {
    companyId,
    ledgerAccountId,
    name: opts?.name || (ledger as { name?: string } | undefined)?.name || "Bank",
    currency: "NPR",
  });
  return { bankAccountId: row.id, ledgerAccountId };
}

export function previewRowsToCsv(
  rows: Array<{
    date?: string;
    description?: string;
    narration?: string;
    reference?: string;
    refNo?: string;
    debit?: number | string;
    credit?: number | string;
    balance?: number | string;
    bankTransactionId?: string;
  }>,
): string {
  const header = "Date,Description,Reference,Debit,Credit,Balance,bank_transaction_id";
  const lines = rows.map((r) => {
    const desc = String(r.description || r.narration || "").replace(/"/g, '""');
    const ref = String(r.reference || r.refNo || "").replace(/"/g, '""');
    const debit = r.debit != null && Number(r.debit) ? Number(r.debit).toFixed(2) : "";
    const credit = r.credit != null && Number(r.credit) ? Number(r.credit).toFixed(2) : "";
    const bal = r.balance != null && r.balance !== "" ? Number(r.balance).toFixed(2) : "";
    const btid = String(r.bankTransactionId || "");
    return `${r.date || ""},"${desc}","${ref}",${debit},${credit},${bal},${btid}`;
  });
  return [header, ...lines].join("\n");
}

export async function importStatementViaTreasury(opts: {
  ledgerOrBankAccountId: string;
  csvText?: string;
  previewRows?: Parameters<typeof previewRowsToCsv>[0];
  bankAccountName?: string;
  source?: TreasuryCommandSource;
  supersedeDuplicate?: boolean;
  idempotencyKey?: string;
}): Promise<CreateStatementBatchResult> {
  const ctx = resolveUserContext();
  const { bankAccountId } = await ensureTreasuryBankAccountForLedger(
    opts.ledgerOrBankAccountId,
    { name: opts.bankAccountName, companyId: ctx.companyId },
  );
  const csvText =
    opts.csvText?.trim() ||
    (opts.previewRows?.length ? previewRowsToCsv(opts.previewRows) : "");
  if (!csvText) {
    return {
      type: "posting_failed",
      status: "failed",
      payload: {
        error_code: "empty_import",
        safe_message: "No statement rows to import.",
        rolled_back: true,
        draft_retained: false,
        retryable: false,
      },
    };
  }
  const requestId = generateId();
  return createStatementBatch({
    commandId: requestId,
    requestId,
    idempotencyKey: opts.idempotencyKey || `import-${requestId}`,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    source: opts.source || "manual_form",
    bankAccountId,
    csvText,
    sourceType: "csv_import",
    supersedeDuplicate: opts.supersedeDuplicate,
  });
}

export async function confirmMatchViaTreasury(opts: {
  ledgerOrBankAccountId: string;
  statementLineId: string;
  erpDocumentIds: string[];
  matchedAmount: number | string;
  expectedStatementLineVersion: number;
  sessionId?: string | null;
  matchMethod?: "manual_confirm" | "exact_amount_date" | "exact_normalized_reference";
  explanation?: string;
  idempotencyKey?: string;
}): Promise<ConfirmBankMatchResult> {
  const ctx = resolveUserContext();
  const { bankAccountId } = await ensureTreasuryBankAccountForLedger(
    opts.ledgerOrBankAccountId,
    { companyId: ctx.companyId },
  );
  const amount =
    typeof opts.matchedAmount === "number"
      ? opts.matchedAmount.toFixed(2)
      : String(opts.matchedAmount);
  const requestId = generateId();
  return confirmBankMatch({
    commandId: requestId,
    requestId,
    idempotencyKey: opts.idempotencyKey || `match-${requestId}`,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    source: "manual_form",
    bankAccountId,
    sessionId: opts.sessionId ?? null,
    statementLineId: opts.statementLineId,
    erpDocumentIds: opts.erpDocumentIds,
    matchedAmount: amount,
    matchType: opts.erpDocumentIds.length > 1 ? "one_to_many" : "one_to_one",
    matchMethod: opts.matchMethod || "manual_confirm",
    expectedStatementLineVersion: opts.expectedStatementLineVersion,
    expectedErpMatchVersions: {},
    currency: "NPR",
    explanation: opts.explanation ?? null,
  });
}

export async function unmatchViaTreasury(opts: {
  linkId: string;
  expectedLinkVersion: number;
  expectedStatementLineVersion: number;
  idempotencyKey?: string;
}): Promise<ReverseBankMatchResult> {
  const ctx = resolveUserContext();
  const requestId = generateId();
  return reverseBankMatch({
    commandId: requestId,
    requestId,
    idempotencyKey: opts.idempotencyKey || `unmatch-${requestId}`,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    source: "manual_form",
    linkId: opts.linkId,
    expectedLinkVersion: opts.expectedLinkVersion,
    expectedStatementLineVersion: opts.expectedStatementLineVersion,
  });
}

export async function postAdjustmentViaTreasury(opts: {
  ledgerOrBankAccountId: string;
  statementLineId: string;
  expectedStatementLineVersion: number;
  adjustmentType: BankAdjustmentType;
  amount?: number | string;
  offsetAccountId?: string;
  useJournal?: boolean;
  narration?: string;
  sessionId?: string | null;
  idempotencyKey?: string;
}): Promise<BankAdjustmentResult> {
  const ctx = resolveUserContext();
  const { bankAccountId } = await ensureTreasuryBankAccountForLedger(
    opts.ledgerOrBankAccountId,
    { companyId: ctx.companyId },
  );
  const requestId = generateId();
  return postBankAdjustmentFromStatement({
    commandId: requestId,
    requestId,
    idempotencyKey: opts.idempotencyKey || `adj-${requestId}`,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    source: "manual_form",
    bankAccountId,
    statementLineId: opts.statementLineId,
    expectedStatementLineVersion: opts.expectedStatementLineVersion,
    adjustmentType: opts.adjustmentType,
    amount:
      opts.amount != null
        ? typeof opts.amount === "number"
          ? opts.amount.toFixed(2)
          : String(opts.amount)
        : undefined,
    offsetAccountId: opts.offsetAccountId,
    useJournal: opts.useJournal ?? true,
    narration: opts.narration || "Bank adjustment from statement",
    sessionId: opts.sessionId ?? null,
  });
}

export async function openSessionViaTreasury(opts: {
  ledgerOrBankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementBalancePaisa: number;
  bookBalancePaisa?: number;
  idempotencyKey?: string;
}): Promise<ReconciliationSessionResult> {
  const ctx = resolveUserContext();
  const { bankAccountId } = await ensureTreasuryBankAccountForLedger(
    opts.ledgerOrBankAccountId,
    { companyId: ctx.companyId },
  );
  const requestId = generateId();
  return openBankReconciliationSession({
    commandId: requestId,
    requestId,
    idempotencyKey: opts.idempotencyKey || `open-recon-${requestId}`,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    source: "manual_form",
    bankAccountId,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    statementBalancePaisa: opts.statementBalancePaisa,
    bookBalancePaisa: opts.bookBalancePaisa,
    currency: "NPR",
  });
}

export async function closeSessionViaTreasury(opts: {
  sessionId: string;
  expectedVersion: number;
  tolerancePaisa?: number;
  idempotencyKey?: string;
}): Promise<ReconciliationSessionResult> {
  const ctx = resolveUserContext();
  const requestId = generateId();
  return closeBankReconciliation({
    commandId: requestId,
    requestId,
    idempotencyKey: opts.idempotencyKey || `close-recon-${requestId}`,
    companyId: ctx.companyId,
    userId: ctx.userId,
    userRole: ctx.userRole,
    source: "manual_form",
    sessionId: opts.sessionId,
    expectedVersion: opts.expectedVersion,
    tolerancePaisa: opts.tolerancePaisa,
  });
}

export { paisaToString };
