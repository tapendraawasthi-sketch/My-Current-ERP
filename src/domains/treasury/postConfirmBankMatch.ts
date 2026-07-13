/**
 * Confirm bank reconciliation match - atomic Dexie command (Phase 10).
 */

import { getDB, generateId } from "@/lib/db";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { enqueueBankSyncInTransaction } from "@/platform/sync/enqueueBankSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { getBankAccount } from "./bankAccountModel";
import {
  buildScopedTreasuryIdempotencyKey,
  collectTxnTables,
  findExistingReceipt,
  writeAudit,
  assertTreasuryPeriodOpen,
  type FailureInjectionStage,
} from "./postingFramework";
import type {
  BankReconciliationLinkRow,
  BankStatementLineRow,
  MatchMethod,
  MatchType,
  MoneyString,
  TreasuryCommandSource,
  TreasuryPostingResult,
  TreasuryPostingSuccessBase,
} from "./types";
import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";

export interface ConfirmBankMatchCommand {
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
  sessionId?: string | null;
  statementLineId: string;
  erpDocumentIds: string[];
  matchedAmount: MoneyString;
  matchType?: MatchType;
  matchMethod?: MatchMethod;
  expectedStatementLineVersion: number;
  expectedErpMatchVersions?: Record<string, number>;
  currency?: string;
  explanation?: string | null;
  confidence?: number | null;
  injectFailure?: FailureInjectionStage;
}

export interface ConfirmBankMatchSuccess extends TreasuryPostingSuccessBase {
  operation: "confirm_bank_match";
  link_id: string;
  statement_line_id: string;
  statement_line_version: number;
  matched_amount: MoneyString;
}

export type ConfirmBankMatchResult = TreasuryPostingResult<ConfirmBankMatchSuccess>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: {
    retryable?: boolean;
    draft_id?: string | null;
    conflict_category?: import("./types").TreasuryConflictCategory;
  },
): ConfirmBankMatchResult {
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

export async function confirmBankMatch(
  cmd: ConfirmBankMatchCommand,
): Promise<ConfirmBankMatchResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Matching requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot confirm bank matches.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (!cmd.erpDocumentIds?.length) {
    return fail("posting_failed", "missing_erp_documents", "At least one ERP document is required.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const db = getDB();
  const operation = "confirm_bank_match" as const;
  const scopedKey = buildScopedTreasuryIdempotencyKey(
    operation,
    cmd.companyId,
    cmd.draftId,
    cmd.previewVersion,
    cmd.previewHash,
    cmd.idempotencyKey,
  );
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();

  const existingReceipt = await findExistingReceipt(db, scopedKey);
  if (existingReceipt?.status === "completed") {
    const result = existingReceipt.resultPayload as ConfirmBankMatchSuccess;
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
  const currency = cmd.currency || bank.currency;
  if (currency !== bank.currency) {
    return fail("posting_conflict", "currency_mismatch", "Currency does not match bank account.", {
      draft_id: cmd.draftId,
      conflict_category: "currency_mismatch",
    });
  }

  let matchedPaisa: number;
  try {
    matchedPaisa = parseMoneyToPaisa(cmd.matchedAmount);
    if (!(matchedPaisa > 0)) {
      return fail("posting_failed", "invalid_amount", "Matched amount must be greater than zero.", {
        retryable: false,
        draft_id: cmd.draftId,
      });
    }
  } catch {
    return fail("posting_failed", "invalid_amount", "Matched amount is invalid.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const lineForPeriod = (await (db as any).bankStatementLines.get(cmd.statementLineId)) as
    | { transactionDate?: string }
    | undefined;
  try {
    await assertTreasuryPeriodOpen(
      lineForPeriod?.transactionDate || new Date().toISOString().slice(0, 10),
      db,
    );
  } catch (e) {
    return fail(
      "posting_failed",
      "period_locked",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false, conflict_category: "period_locked" },
    );
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      if (cmd.injectFailure === "before_match_write") {
        throw Object.assign(new Error("Injected failure before match write."), {
          code: "injected_failure",
        });
      }

      const line = (await (db as any).bankStatementLines.get(
        cmd.statementLineId,
      )) as BankStatementLineRow | undefined;
      if (!line || line.companyId !== cmd.companyId) {
        throw Object.assign(new Error("Statement line not found."), {
          code: "document_not_found",
          conflict_category: "document_not_found",
        });
      }
      if (line.bankAccountId !== cmd.bankAccountId) {
        throw Object.assign(new Error("Statement line bank account mismatch."), {
          code: "bank_account_mismatch",
          conflict_category: "bank_account_mismatch",
        });
      }
      if (line.reconciliationVersion !== cmd.expectedStatementLineVersion) {
        throw Object.assign(new Error("Stale statement line version."), {
          code: "stale_statement_line_version",
          conflict_category: "stale_statement_line_version",
        });
      }
      if (matchedPaisa > line.remainingMatchPaisa) {
        throw Object.assign(new Error("Overmatch: amount exceeds remaining statement line."), {
          code: "overmatch",
          conflict_category: "overmatch",
        });
      }

      const linkId = generateId();
      const nextRemaining = line.remainingMatchPaisa - matchedPaisa;
      const nextVersion = line.reconciliationVersion + 1;
      const nextStatus =
        nextRemaining <= 0 ? "matched" : ("partially_matched" as BankStatementLineRow["status"]);

      await (db as any).bankStatementLines.update(line.id, {
        remainingMatchPaisa: nextRemaining,
        reconciliationVersion: nextVersion,
        status: nextStatus,
      });

      const link: BankReconciliationLinkRow = {
        id: linkId,
        companyId: cmd.companyId,
        bankAccountId: cmd.bankAccountId,
        sessionId: cmd.sessionId ?? null,
        statementLineId: cmd.statementLineId,
        erpDocumentIds: [...cmd.erpDocumentIds],
        matchedAmountPaisa: matchedPaisa,
        matchType: cmd.matchType || (cmd.erpDocumentIds.length > 1 ? "one_to_many" : "one_to_one"),
        matchMethod: cmd.matchMethod || "manual_confirm",
        status: "confirmed",
        version: 1,
        confidence: cmd.confidence ?? null,
        explanation: cmd.explanation ?? null,
        confirmedAt: now,
        createdAt: now,
        createdBy: cmd.userId,
      };
      await (db as any).bankReconciliationLinks.put(link);

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), {
          code: "injected_failure",
        });
      }

      const auditId = await writeAudit(db, {
        userId: cmd.userId,
        action: "BANK_RECONCILIATION_MATCHED",
        entityType: "bank_reconciliation_link",
        entityId: linkId,
        companyId: cmd.companyId,
        sessionId: cmd.sessionId,
        after: {
          statementLineId: cmd.statementLineId,
          erpDocumentIds: cmd.erpDocumentIds,
          matchedAmount: paisaToString(matchedPaisa),
          statementLineVersion: nextVersion,
        },
      });

      const receiptId = generateId();
      const successPayload: ConfirmBankMatchSuccess = {
        posting_id: postingId,
        operation: "confirm_bank_match",
        link_id: linkId,
        statement_line_id: cmd.statementLineId,
        statement_line_version: nextVersion,
        matched_amount: paisaToString(matchedPaisa),
        idempotent_replay: false,
        sync_status: "disabled",
        audit_id: auditId,
        receipt_id: receiptId,
        draft_id: cmd.draftId ?? null,
      };

      await db.orbixPostingReceipts.put({
        id: receiptId,
        scopedKey,
        idempotencyKey: cmd.idempotencyKey,
        companyId: cmd.companyId,
        draftId: cmd.draftId || null,
        status: "completed",
        postingId,
        createdAt: now,
        resultPayload: successPayload,
      } as any);

      if (cmd.injectFailure === "before_sync") {
        throw Object.assign(new Error("Injected failure before sync."), {
          code: "injected_failure",
        });
      }

      const syncEnqueue = isLocalOnly(syncPolicy)
        ? ({ syncStatus: "disabled" as const, eventId: null })
        : await enqueueBankSyncInTransaction(db, {
            tenantId: cmd.tenantId || "local",
            companyId: cmd.companyId,
            financialYearId: cmd.financialYearId ?? null,
            userId: cmd.userId,
            source: cmd.source,
            correlationId: cmd.requestId || postingId,
            causationId: cmd.draftId ?? null,
            idempotencyKey: cmd.idempotencyKey,
            syncPolicy,
            eventType: "bank_reconciliation_matched",
            payload: {
              posting_id: postingId,
              bank_account_id: cmd.bankAccountId,
              session_id: cmd.sessionId ?? null,
              link_id: linkId,
              statement_line_id: cmd.statementLineId,
              voucher_id: cmd.erpDocumentIds[0] || linkId,
              erp_document_ids: [...cmd.erpDocumentIds],
              amounts: { matched_amount: paisaToString(matchedPaisa) },
              statement_line_version: nextVersion,
              expected_statement_line_version: cmd.expectedStatementLineVersion,
              match_type:
                cmd.matchType ||
                (cmd.erpDocumentIds.length > 1 ? "one_to_many" : "one_to_one"),
              statement_lines: [
                {
                  id: cmd.statementLineId,
                  line_number: Number(line.lineNumber || 0),
                  transaction_date: line.transactionDate,
                  description: line.description,
                  reference: line.reference ?? null,
                  debit_paisa: line.debitPaisa,
                  credit_paisa: line.creditPaisa,
                  signed_amount_paisa: line.signedAmountPaisa,
                  balance_paisa: line.balancePaisa ?? null,
                  raw_hash: line.rawHash,
                  reconciliation_version: nextVersion,
                  status: nextStatus,
                  remaining_match_paisa: nextRemaining,
                  currency: line.currency || currency,
                },
              ],
              currency,
              local_idempotency_key: cmd.idempotencyKey,
              aggregate_version: nextVersion,
              audit_id: auditId,
              receipt_id: receiptId,
              financial_year_id: cmd.financialYearId ?? null,
              source: cmd.source,
            },
          });

      successPayload.sync_status = syncEnqueue.syncStatus;
      successPayload.sync_event_id = syncEnqueue.eventId;
      await db.orbixPostingReceipts.update(receiptId, { resultPayload: successPayload } as any);
      return successPayload;
    });

    return { type: "posting_completed", status: "success", payload: result };
  } catch (err: any) {
    const cat = err?.conflict_category;
    return fail(
      cat ? "posting_conflict" : "posting_failed",
      err?.code || "match_failed",
      String(err?.message || err),
      {
        draft_id: cmd.draftId,
        retryable: err?.code === "injected_failure" || cat === "stale_statement_line_version",
        conflict_category: cat,
      },
    );
  }
}
