/**
 * Cheque / instrument lifecycle (Phase 10).
 *
 * company policy: accounting at issue/receive; clearing is evidence link;
 * bounce posts corrective journal via Phase 9.
 *
 * clear = link + status; bounce = postJournalTransaction.
 * Never calls addVoucher.
 */

import { getDB, generateId } from "@/lib/db";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { postJournalTransaction } from "@/domains/settlement/postJournalTransaction";
import type { JournalLineInput } from "@/domains/settlement/postJournalTransaction";
import { enqueueBankSyncInTransaction } from "@/platform/sync/enqueueBankSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { paisaToString } from "@/domains/purchase/money";
import { getBankAccount } from "./bankAccountModel";
import {
  buildScopedTreasuryIdempotencyKey,
  collectTxnTables,
  findExistingReceipt,
  writeAudit,
  type FailureInjectionStage,
} from "./postingFramework";
import type {
  ChequeInstrumentRow,
  ChequeInstrumentType,
  ChequeState,
  MoneyString,
  TreasuryCommandSource,
  TreasuryPostingResult,
  TreasuryPostingSuccessBase,
} from "./types";

/** Allowed transitions keyed by current state. */
export const CHEQUE_TRANSITIONS: Record<ChequeState, readonly ChequeState[]> = {
  draft: ["issued", "cancelled"],
  issued: ["cleared", "stopped", "cancelled", "bounced", "expired"],
  received: ["deposited", "cleared", "bounced", "cancelled", "expired"],
  deposited: ["cleared", "bounced", "cancelled"],
  cleared: [],
  bounced: ["deposited", "cancelled"],
  cancelled: [],
  stopped: [],
  expired: [],
};

export function canTransitionCheque(from: ChequeState, to: ChequeState): boolean {
  return (CHEQUE_TRANSITIONS[from] || []).includes(to);
}

export function assertChequeTransition(
  instrumentType: ChequeInstrumentType,
  from: ChequeState,
  to: ChequeState,
): void {
  if (!canTransitionCheque(from, to)) {
    throw Object.assign(
      new Error(`Invalid cheque transition ${from} -> ${to} (${instrumentType})`),
      { code: "invalid_cheque_transition", conflict_category: "invalid_cheque_transition" },
    );
  }
}

export interface ChequeStatusChangeCommand {
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
  chequeId: string;
  nextStatus: ChequeState;
  expectedInstrumentVersion: number;
  /** Required when clearing: statement evidence line. */
  statementLineId?: string | null;
  /** Required when bouncing: Phase 9 corrective journal lines (no hard-coded accounts). */
  bounceJournalLines?: JournalLineInput[] | null;
  bounceNarration?: string | null;
  bounceTransactionDate?: string | null;
  reason?: string | null;
  injectFailure?: FailureInjectionStage;
}

export interface ChequeStatusChangeSuccess extends TreasuryPostingSuccessBase {
  operation: "cheque_status_change";
  cheque_id: string;
  prior_status: ChequeState;
  next_status: ChequeState;
  instrument_version: number;
  bounce_voucher_id: string | null;
  cleared_statement_line_id: string | null;
}

export type ChequeStatusChangeResult = TreasuryPostingResult<ChequeStatusChangeSuccess>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: {
    retryable?: boolean;
    draft_id?: string | null;
    conflict_category?: import("./types").TreasuryConflictCategory;
  },
): ChequeStatusChangeResult {
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

export async function postChequeStatusChange(
  cmd: ChequeStatusChangeCommand,
): Promise<ChequeStatusChangeResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Cheque status change requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot change cheque status.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const db = getDB();
  const operation = "cheque_status_change" as const;
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
    const result = existingReceipt.resultPayload as ChequeStatusChangeSuccess;
    return {
      type: "posting_completed",
      status: "success",
      payload: { ...result, idempotent_replay: true },
    };
  }

  const table = (db as any).chequeInstruments;
  if (!table) {
    return fail("posting_failed", "schema_missing", "chequeInstruments table not available.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const cheque = (await table.get(cmd.chequeId)) as ChequeInstrumentRow | undefined;
  if (!cheque || cheque.companyId !== cmd.companyId) {
    return fail("posting_failed", "document_not_found", "Cheque not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "document_not_found",
    });
  }
  if (cheque.instrumentVersion !== cmd.expectedInstrumentVersion) {
    return fail("posting_conflict", "stale_cheque_version", "Stale cheque version.", {
      draft_id: cmd.draftId,
      conflict_category: "stale_cheque_version",
    });
  }

  try {
    assertChequeTransition(cheque.instrumentType, cheque.status, cmd.nextStatus);
  } catch (err: any) {
    return fail("posting_conflict", err?.code || "invalid_cheque_transition", String(err?.message || err), {
      draft_id: cmd.draftId,
      conflict_category: "invalid_cheque_transition",
      retryable: false,
    });
  }

  const bank = await getBankAccount(db, cheque.bankAccountId);
  if (!bank || bank.companyId !== cmd.companyId) {
    return fail("posting_failed", "bank_account_not_found", "Bank account not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "bank_account_mismatch",
    });
  }

  let bounceVoucherId: string | null = null;
  let clearedStatementLineId: string | null = cheque.clearedStatementLineId ?? null;

  // clear = evidence link only (accounting already posted at issue/receive)
  if (cmd.nextStatus === "cleared") {
    if (!cmd.statementLineId?.trim()) {
      return fail("posting_failed", "missing_statement_line", "Clearing requires a statement line evidence link.", {
        retryable: false,
        draft_id: cmd.draftId,
      });
    }
    const line = await (db as any).bankStatementLines?.get(cmd.statementLineId);
    if (!line || line.companyId !== cmd.companyId || line.bankAccountId !== cheque.bankAccountId) {
      return fail("posting_failed", "document_not_found", "Statement line not found for this bank account.", {
        retryable: false,
        draft_id: cmd.draftId,
        conflict_category: "document_not_found",
      });
    }
    clearedStatementLineId = cmd.statementLineId;
  }

  // bounce = corrective journal via Phase 9 (do not delete original RV/PV)
  if (cmd.nextStatus === "bounced") {
    const lines = cmd.bounceJournalLines || [];
    if (!lines.length) {
      return fail(
        "posting_failed",
        "bounce_journal_required",
        "Bounce requires corrective journal lines (Phase 9).",
        { retryable: false, draft_id: cmd.draftId },
      );
    }
    const jr = await postJournalTransaction({
      commandId: `${cmd.commandId}-bounce-jv`,
      requestId: `${cmd.requestId}-bounce-jv`,
      draftId: cmd.draftId,
      previewVersion: cmd.previewVersion,
      previewHash: cmd.previewHash,
      idempotencyKey: `${cmd.idempotencyKey}|bounce-jv`,
      tenantId: cmd.tenantId,
      companyId: cmd.companyId,
      financialYearId: cmd.financialYearId,
      userId: cmd.userId,
      userRole: cmd.userRole,
      orbixMode: cmd.orbixMode,
      source: cmd.source === "remote_sync" ? "remote_sync" : cmd.source === "test" ? "test" : "manual_form",
      journal: {
        transactionDate: cmd.bounceTransactionDate || new Date().toISOString().slice(0, 10),
        narration: cmd.bounceNarration || `Cheque bounce ${cheque.instrumentNumber}`,
        allowRestrictedControlAccounts: true,
        lines,
      },
    });
    if (jr.type !== "posting_completed") {
      return fail(jr.type, jr.payload.error_code, jr.payload.safe_message, {
        draft_id: cmd.draftId,
        retryable: jr.payload.retryable,
      });
    }
    bounceVoucherId = jr.payload.voucher_id;
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);
  const now = new Date().toISOString();
  const nextVersion = cheque.instrumentVersion + 1;

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      if (cmd.injectFailure === "before_match_write") {
        throw Object.assign(new Error("Injected failure before match write."), {
          code: "injected_failure",
        });
      }

      const updated: ChequeInstrumentRow = {
        ...cheque,
        status: cmd.nextStatus,
        instrumentVersion: nextVersion,
        updatedAt: now,
        clearedStatementLineId:
          cmd.nextStatus === "cleared" ? clearedStatementLineId : cheque.clearedStatementLineId,
        bounceVoucherId: bounceVoucherId || cheque.bounceVoucherId,
      };
      await table.put(updated);

      const auditId = await writeAudit(db, {
        userId: cmd.userId,
        action: "cheque_status_changed",
        entityType: "cheque_instrument",
        entityId: cheque.id,
        companyId: cmd.companyId,
        after: {
          prior_status: cheque.status,
          next_status: cmd.nextStatus,
          reason: cmd.reason,
          bounce_voucher_id: bounceVoucherId,
          cleared_statement_line_id: clearedStatementLineId,
        },
      });

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), { code: "injected_failure" });
      }

      const amountStr: MoneyString = paisaToString(cheque.amountPaisa);
      const successPayload: ChequeStatusChangeSuccess = {
        posting_id: postingId,
        operation: "cheque_status_change",
        cheque_id: cheque.id,
        prior_status: cheque.status,
        next_status: cmd.nextStatus,
        instrument_version: nextVersion,
        bounce_voucher_id: bounceVoucherId,
        cleared_statement_line_id: clearedStatementLineId,
        idempotent_replay: false,
        sync_status: "disabled",
        sync_event_id: null,
        audit_id: auditId,
        receipt_id: null,
        draft_id: cmd.draftId ?? null,
      };

      const receiptId = generateId();
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
      successPayload.receipt_id = receiptId;

      if (cmd.injectFailure === "before_sync") {
        throw Object.assign(new Error("Injected failure before sync."), { code: "injected_failure" });
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
            eventType: "cheque_status_changed",
            payload: {
              posting_id: postingId,
              bank_account_id: cheque.bankAccountId,
              cheque_id: cheque.id,
              statement_line_id: clearedStatementLineId,
              voucher_id: bounceVoucherId || cheque.sourceVoucherId || cheque.id,
              amounts: { amount: amountStr },
              cheque_version: nextVersion,
              expected_cheque_version: cmd.expectedInstrumentVersion,
              cheque_status_from: cheque.status,
              cheque_status_to: cmd.nextStatus,
              instrument_number: cheque.instrumentNumber,
              instrument_type: cheque.instrumentType,
              amount_paisa: cheque.amountPaisa,
              party_id: cheque.partyId ?? null,
              cheque_date: cheque.chequeDate,
              currency: cheque.currency,
              local_idempotency_key: cmd.idempotencyKey,
              aggregate_version: nextVersion,
              audit_id: auditId,
              receipt_id: receiptId,
              financial_year_id: cmd.financialYearId ?? null,
              source: cmd.source,
            } as any,
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
      err?.code || "cheque_status_failed",
      String(err?.message || err),
      {
        draft_id: cmd.draftId,
        retryable: err?.code === "injected_failure" || !!cat,
        conflict_category: cat,
      },
    );
  }
}