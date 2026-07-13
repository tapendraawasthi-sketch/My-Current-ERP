/**
 * Post bank adjustment from statement line via Phase 9 settlement commands.
 *
 * NEVER calls addVoucher. Routes:
 * - bank_charge → postPaymentTransaction (expense) or postJournalTransaction
 * - bank_interest → postReceiptTransaction (other) or postJournalTransaction
 * - direct_deposit → postReceiptTransaction
 * - direct_debit → postPaymentTransaction
 * - bank_transfer → postContraTransaction
 * Then creates a confirmed match link to the posted voucher.
 */

import { getDB, generateId } from "@/lib/db";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { postPaymentTransaction } from "@/domains/settlement/postPaymentTransaction";
import { postReceiptTransaction } from "@/domains/settlement/postReceiptTransaction";
import { postContraTransaction } from "@/domains/settlement/postContraTransaction";
import { postJournalTransaction } from "@/domains/settlement/postJournalTransaction";
import { DEFAULT_SETTLEMENT_ACCOUNTS } from "@/domains/settlement/postingFramework";
import { enqueueBankSyncInTransaction } from "@/platform/sync/enqueueBankSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";
import { getBankAccount } from "./bankAccountModel";
import { confirmBankMatch } from "./postConfirmBankMatch";
import {
  buildScopedTreasuryIdempotencyKey,
  findExistingReceipt,
  type FailureInjectionStage,
} from "./postingFramework";
import type {
  BankAdjustmentType,
  BankStatementLineRow,
  MoneyString,
  TreasuryCommandSource,
  TreasuryPostingResult,
  TreasuryPostingSuccessBase,
} from "./types";

export interface BankAdjustmentFromStatementCommand {
  commandId: string;
  requestId: string;
  draftId?: string | null;
  previewVersion?: string | number | null;
  previewHash?: string | null;
  idempotencyKey: string;
  tenantId?: string | null;
  companyId: string;
  financialYearId?: string | null;
  userId: string;
  userRole?: string | null;
  orbixMode?: OrbixOperatingMode | null;
  source: TreasuryCommandSource;
  bankAccountId: string;
  statementLineId: string;
  expectedStatementLineVersion: number;
  adjustmentType: BankAdjustmentType;
  amount?: MoneyString | null;
  /** Offset account for charge/interest journal path, or transfer destination. */
  offsetAccountId?: string | null;
  toBankAccountLedgerId?: string | null;
  useJournal?: boolean;
  narration?: string;
  sessionId?: string | null;
  injectFailure?: FailureInjectionStage;
}

export interface BankAdjustmentSuccess extends TreasuryPostingSuccessBase {
  operation: "bank_adjustment_from_statement";
  adjustment_type: BankAdjustmentType;
  voucher_id: string;
  voucher_number: string;
  link_id: string | null;
  statement_line_id: string;
}

export type BankAdjustmentResult = TreasuryPostingResult<BankAdjustmentSuccess>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: { retryable?: boolean; draft_id?: string | null; conflict_category?: any },
): BankAdjustmentResult {
  return {
    type,
    status: "failed",
    payload: {
      error_code,
      safe_message,
      rolled_back: true,
      draft_retained: true,
      retryable: opts?.retryable ?? true,
      draft_id: opts?.draft_id ?? null,
      conflict_category: opts?.conflict_category,
    },
  };
}

export async function postBankAdjustmentFromStatement(
  cmd: BankAdjustmentFromStatementCommand,
): Promise<BankAdjustmentResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Adjustment requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot post bank adjustments.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const db = getDB();
  const operation = "bank_adjustment_from_statement" as const;
  const scopedKey = buildScopedTreasuryIdempotencyKey(
    operation,
    cmd.companyId,
    cmd.draftId,
    cmd.previewVersion,
    cmd.previewHash,
    cmd.idempotencyKey,
  );
  const postingId = `post-${cmd.requestId}`;

  const existingReceipt = await findExistingReceipt(db, scopedKey);
  if (existingReceipt?.status === "completed") {
    const result = existingReceipt.resultPayload as BankAdjustmentSuccess;
    return {
      type: "posting_completed",
      status: "success",
      payload: { ...result, idempotent_replay: true },
    };
  }

  const bank = await getBankAccount(db, cmd.bankAccountId);
  if (!bank || bank.companyId !== cmd.companyId) {
    return fail("posting_failed", "bank_account_not_found", "Bank account not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "bank_account_mismatch",
    });
  }

  const line = (await (db as any).bankStatementLines.get(
    cmd.statementLineId,
  )) as BankStatementLineRow | undefined;
  if (!line || line.companyId !== cmd.companyId) {
    return fail("posting_failed", "document_not_found", "Statement line not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "document_not_found",
    });
  }
  if (line.reconciliationVersion !== cmd.expectedStatementLineVersion) {
    return fail("posting_conflict", "stale_statement_line_version", "Stale statement line version.", {
      draft_id: cmd.draftId,
      conflict_category: "stale_statement_line_version",
    });
  }

  const amountPaisa = cmd.amount
    ? parseMoneyToPaisa(cmd.amount)
    : Math.abs(line.signedAmountPaisa);
  const amountStr = paisaToString(amountPaisa);
  const date = line.transactionDate;
  const narration = cmd.narration || `Bank adj ${cmd.adjustmentType}: ${line.description}`;
  const common = {
    commandId: cmd.commandId,
    requestId: `${cmd.requestId}-phase9`,
    draftId: cmd.draftId,
    previewVersion: cmd.previewVersion,
    previewHash: cmd.previewHash,
    idempotencyKey: `${cmd.idempotencyKey}|phase9`,
    tenantId: cmd.tenantId,
    companyId: cmd.companyId,
    financialYearId: cmd.financialYearId,
    userId: cmd.userId,
    userRole: cmd.userRole,
    orbixMode: cmd.orbixMode,
    source: cmd.source === "remote_sync" ? ("remote_sync" as const) : cmd.source,
    injectFailure:
      cmd.injectFailure === "before_audit" || cmd.injectFailure === "before_sync"
        ? cmd.injectFailure
        : undefined,
  };

  let voucherId = "";
  let voucherNumber = "";
  let settlementOk = false;

  try {
    if (cmd.adjustmentType === "bank_charge") {
      if (cmd.useJournal) {
        const offset = cmd.offsetAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.bankCharges;
        const jr = await postJournalTransaction({
          ...common,
          journal: {
            transactionDate: date,
            narration,
            lines: [
              { accountId: offset, debit: amountStr, credit: "0.00" },
              { accountId: bank.ledgerAccountId, debit: "0.00", credit: amountStr },
            ],
          },
        });
        if (jr.type !== "posting_completed") {
          return fail(jr.type, jr.payload.error_code, jr.payload.safe_message, {
            draft_id: cmd.draftId,
            retryable: jr.payload.retryable,
          });
        }
        voucherId = jr.payload.voucher_id;
        voucherNumber = jr.payload.voucher_number;
        settlementOk = true;
      } else {
        const pr = await postPaymentTransaction({
          ...common,
          payment: {
            paymentType: "expense_payment",
            transactionDate: date,
            cashOrBankAccountId: bank.ledgerAccountId,
            amount: amountStr,
            narration,
            payableAccountId: cmd.offsetAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.bankCharges,
          },
        });
        if (pr.type !== "posting_completed") {
          return fail(pr.type, pr.payload.error_code, pr.payload.safe_message, {
            draft_id: cmd.draftId,
            retryable: pr.payload.retryable,
          });
        }
        voucherId = pr.payload.voucher_id;
        voucherNumber = pr.payload.voucher_number;
        settlementOk = true;
      }
    } else if (cmd.adjustmentType === "bank_interest") {
      if (cmd.useJournal) {
        const incomeAcc = cmd.offsetAccountId || "acc-interest-income";
        const jr = await postJournalTransaction({
          ...common,
          journal: {
            transactionDate: date,
            narration,
            allowRestrictedControlAccounts: true,
            lines: [
              { accountId: bank.ledgerAccountId, debit: amountStr, credit: "0.00" },
              { accountId: incomeAcc, debit: "0.00", credit: amountStr },
            ],
          },
        });
        if (jr.type !== "posting_completed") {
          return fail(jr.type, jr.payload.error_code, jr.payload.safe_message, {
            draft_id: cmd.draftId,
            retryable: jr.payload.retryable,
          });
        }
        voucherId = jr.payload.voucher_id;
        voucherNumber = jr.payload.voucher_number;
        settlementOk = true;
      } else {
        const rr = await postReceiptTransaction({
          ...common,
          receipt: {
            receiptType: "other_receipt",
            transactionDate: date,
            cashOrBankAccountId: bank.ledgerAccountId,
            amount: amountStr,
            narration,
            receivableAccountId: cmd.offsetAccountId || "acc-interest-income",
          },
        });
        if (rr.type !== "posting_completed") {
          return fail(rr.type, rr.payload.error_code, rr.payload.safe_message, {
            draft_id: cmd.draftId,
            retryable: rr.payload.retryable,
          });
        }
        voucherId = rr.payload.voucher_id;
        voucherNumber = rr.payload.voucher_number;
        settlementOk = true;
      }
    } else if (cmd.adjustmentType === "direct_deposit") {
      const rr = await postReceiptTransaction({
        ...common,
        receipt: {
          receiptType: "other_receipt",
          transactionDate: date,
          cashOrBankAccountId: bank.ledgerAccountId,
          amount: amountStr,
          narration,
          receivableAccountId: cmd.offsetAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.sundryDebtors,
        },
      });
      if (rr.type !== "posting_completed") {
        return fail(rr.type, rr.payload.error_code, rr.payload.safe_message, {
          draft_id: cmd.draftId,
          retryable: rr.payload.retryable,
        });
      }
      voucherId = rr.payload.voucher_id;
      voucherNumber = rr.payload.voucher_number;
      settlementOk = true;
    } else if (cmd.adjustmentType === "direct_debit") {
      const pr = await postPaymentTransaction({
        ...common,
        payment: {
          paymentType: "expense_payment",
          transactionDate: date,
          cashOrBankAccountId: bank.ledgerAccountId,
          amount: amountStr,
          narration,
          payableAccountId: cmd.offsetAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.bankCharges,
        },
      });
      if (pr.type !== "posting_completed") {
        return fail(pr.type, pr.payload.error_code, pr.payload.safe_message, {
          draft_id: cmd.draftId,
          retryable: pr.payload.retryable,
        });
      }
      voucherId = pr.payload.voucher_id;
      voucherNumber = pr.payload.voucher_number;
      settlementOk = true;
    } else if (cmd.adjustmentType === "bank_transfer") {
      const toId = cmd.toBankAccountLedgerId || cmd.offsetAccountId;
      if (!toId) {
        return fail("posting_failed", "missing_transfer_target", "Transfer target account required.", {
          retryable: false,
          draft_id: cmd.draftId,
        });
      }
      const outflow = line.signedAmountPaisa < 0;
      const cr = await postContraTransaction({
        ...common,
        contra: {
          contraType: "bank_to_bank",
          transactionDate: date,
          fromAccountId: outflow ? bank.ledgerAccountId : toId,
          toAccountId: outflow ? toId : bank.ledgerAccountId,
          amount: amountStr,
          narration,
        },
      });
      if (cr.type !== "posting_completed") {
        return fail(cr.type, cr.payload.error_code, cr.payload.safe_message, {
          draft_id: cmd.draftId,
          retryable: cr.payload.retryable,
        });
      }
      voucherId = cr.payload.voucher_id;
      voucherNumber = cr.payload.voucher_number;
      settlementOk = true;
    } else {
      return fail("posting_failed", "unsupported_adjustment", "Unsupported adjustment type.", {
        retryable: false,
        draft_id: cmd.draftId,
      });
    }
  } catch (err: any) {
    return fail("posting_failed", err?.code || "adjustment_failed", String(err?.message || err), {
      draft_id: cmd.draftId,
    });
  }

  if (!settlementOk || !voucherId) {
    return fail("posting_failed", "phase9_failed", "Phase 9 posting did not complete.", {
      draft_id: cmd.draftId,
    });
  }

  // Refresh line version after Phase 9 (unchanged) then confirm match link.
  const lineAfter = (await (db as any).bankStatementLines.get(
    cmd.statementLineId,
  )) as BankStatementLineRow;
  const match = await confirmBankMatch({
    commandId: `${cmd.commandId}-link`,
    requestId: `${cmd.requestId}-link`,
    draftId: cmd.draftId,
    previewVersion: cmd.previewVersion,
    previewHash: cmd.previewHash,
    idempotencyKey: `${cmd.idempotencyKey}|link`,
    tenantId: cmd.tenantId,
    companyId: cmd.companyId,
    financialYearId: cmd.financialYearId,
    userId: cmd.userId,
    userRole: cmd.userRole,
    orbixMode: cmd.orbixMode,
    source: cmd.source,
    bankAccountId: cmd.bankAccountId,
    sessionId: cmd.sessionId,
    statementLineId: cmd.statementLineId,
    erpDocumentIds: [voucherId],
    matchedAmount: amountStr,
    matchType: "adjustment_link",
    matchMethod: "adjustment_post",
    expectedStatementLineVersion: lineAfter.reconciliationVersion,
    explanation: `Linked ${cmd.adjustmentType} voucher ${voucherNumber}`,
    injectFailure: cmd.injectFailure,
  });

  if (match.type !== "posting_completed") {
    return fail(match.type, match.payload.error_code, match.payload.safe_message, {
      draft_id: cmd.draftId,
      retryable: match.payload.retryable,
      conflict_category: match.payload.conflict_category,
    });
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);
  let syncEventId: string | null = null;
  let syncStatus: BankAdjustmentSuccess["sync_status"] = "disabled";
  if (!isLocalOnly(syncPolicy)) {
    try {
      const enq = await db.transaction("rw", [db.eventSyncQueue, db.domainEvents, db.syncLocalSequences, db.orbixPostingReceipts].filter(Boolean), async () => {
        return enqueueBankSyncInTransaction(db, {
          tenantId: cmd.tenantId || "local",
          companyId: cmd.companyId,
          financialYearId: cmd.financialYearId ?? null,
          userId: cmd.userId,
          source: cmd.source,
          correlationId: cmd.requestId || postingId,
          causationId: cmd.draftId ?? null,
          idempotencyKey: `${cmd.idempotencyKey}|adj-link-event`,
          syncPolicy,
          eventType: "bank_adjustment_linked",
          payload: {
            posting_id: postingId,
            bank_account_id: cmd.bankAccountId,
            statement_line_id: cmd.statementLineId,
            link_id: match.payload.link_id,
            voucher_id: voucherId,
            voucher_number: voucherNumber,
            adjustment_type: cmd.adjustmentType,
            amounts: { amount: amountStr },
            currency: bank.currency,
            local_idempotency_key: cmd.idempotencyKey,
            aggregate_version: match.payload.statement_line_version,
            financial_year_id: cmd.financialYearId ?? null,
            source: cmd.source,
          },
        });
      });
      syncEventId = enq.eventId;
      syncStatus = enq.syncStatus;
    } catch {
      syncStatus = "failed";
    }
  }

  const success: BankAdjustmentSuccess = {
    posting_id: postingId,
    operation: "bank_adjustment_from_statement",
    adjustment_type: cmd.adjustmentType,
    voucher_id: voucherId,
    voucher_number: voucherNumber,
    link_id: match.payload.link_id,
    statement_line_id: cmd.statementLineId,
    idempotent_replay: false,
    sync_status: syncStatus,
    sync_event_id: syncEventId,
    audit_id: match.payload.audit_id,
    receipt_id: match.payload.receipt_id,
    draft_id: cmd.draftId ?? null,
  };

  await db.orbixPostingReceipts.put({
    id: generateId(),
    scopedKey,
    idempotencyKey: cmd.idempotencyKey,
    companyId: cmd.companyId,
    draftId: cmd.draftId || null,
    status: "completed",
    postingId,
    createdAt: new Date().toISOString(),
    resultPayload: success,
  } as any);

  return { type: "posting_completed", status: "success", payload: success };
}
