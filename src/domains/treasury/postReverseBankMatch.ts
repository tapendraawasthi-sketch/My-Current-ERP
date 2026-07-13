/**
 * Reverse / unmatch a confirmed bank reconciliation link (Phase 10).
 */

import { getDB, generateId } from "@/lib/db";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { enqueueBankSyncInTransaction } from "@/platform/sync/enqueueBankSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { paisaToString } from "@/domains/purchase/money";
import {
  buildScopedTreasuryIdempotencyKey,
  collectTxnTables,
  findExistingReceipt,
  writeAudit,
  type FailureInjectionStage,
} from "./postingFramework";
import type {
  BankReconciliationLinkRow,
  BankStatementLineRow,
  TreasuryCommandSource,
  TreasuryPostingResult,
  TreasuryPostingSuccessBase,
} from "./types";

export interface ReverseBankMatchCommand {
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
  linkId: string;
  expectedLinkVersion: number;
  expectedStatementLineVersion: number;
  injectFailure?: FailureInjectionStage;
}

export interface ReverseBankMatchSuccess extends TreasuryPostingSuccessBase {
  operation: "reverse_bank_match";
  link_id: string;
  statement_line_id: string;
  statement_line_version: number;
}

export type ReverseBankMatchResult = TreasuryPostingResult<ReverseBankMatchSuccess>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: {
    retryable?: boolean;
    draft_id?: string | null;
    conflict_category?: import("./types").TreasuryConflictCategory;
  },
): ReverseBankMatchResult {
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

export async function reverseBankMatch(
  cmd: ReverseBankMatchCommand,
): Promise<ReverseBankMatchResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Unmatch requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot reverse bank matches.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const db = getDB();
  const operation = "reverse_bank_match" as const;
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
    const result = existingReceipt.resultPayload as ReverseBankMatchSuccess;
    return {
      type: "posting_completed",
      status: "success",
      payload: { ...result, idempotent_replay: true },
    };
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      if (cmd.injectFailure === "before_match_write") {
        throw Object.assign(new Error("Injected failure before match write."), {
          code: "injected_failure",
        });
      }

      const link = (await (db as any).bankReconciliationLinks.get(
        cmd.linkId,
      )) as BankReconciliationLinkRow | undefined;
      if (!link || link.companyId !== cmd.companyId) {
        throw Object.assign(new Error("Reconciliation link not found."), {
          code: "document_not_found",
          conflict_category: "document_not_found",
        });
      }
      if (link.status !== "confirmed") {
        throw Object.assign(new Error("Only confirmed links can be unmatched."), {
          code: "invalid_link_status",
        });
      }
      if (link.version !== cmd.expectedLinkVersion) {
        throw Object.assign(new Error("Stale reconciliation link version."), {
          code: "stale_statement_line_version",
          conflict_category: "stale_statement_line_version",
        });
      }

      const line = (await (db as any).bankStatementLines.get(
        link.statementLineId,
      )) as BankStatementLineRow | undefined;
      if (!line) {
        throw Object.assign(new Error("Statement line not found."), {
          code: "document_not_found",
          conflict_category: "document_not_found",
        });
      }
      if (line.reconciliationVersion !== cmd.expectedStatementLineVersion) {
        throw Object.assign(new Error("Stale statement line version."), {
          code: "stale_statement_line_version",
          conflict_category: "stale_statement_line_version",
        });
      }

      const restoredRemaining = line.remainingMatchPaisa + link.matchedAmountPaisa;
      const absLine = Math.abs(line.signedAmountPaisa);
      const nextVersion = line.reconciliationVersion + 1;
      const nextStatus =
        restoredRemaining >= absLine
          ? "unmatched"
          : ("partially_matched" as BankStatementLineRow["status"]);

      await (db as any).bankStatementLines.update(line.id, {
        remainingMatchPaisa: Math.min(restoredRemaining, absLine),
        reconciliationVersion: nextVersion,
        status: nextStatus,
      });

      await (db as any).bankReconciliationLinks.update(link.id, {
        status: "reversed",
        version: link.version + 1,
        reversedAt: now,
      });

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), {
          code: "injected_failure",
        });
      }

      const auditId = await writeAudit(db, {
        userId: cmd.userId,
        action: "BANK_RECONCILIATION_UNMATCHED",
        entityType: "bank_reconciliation_link",
        entityId: link.id,
        companyId: cmd.companyId,
        sessionId: link.sessionId,
        after: {
          restoredAmount: paisaToString(link.matchedAmountPaisa),
          statementLineVersion: nextVersion,
        },
      });

      const receiptId = generateId();
      const successPayload: ReverseBankMatchSuccess = {
        posting_id: postingId,
        operation: "reverse_bank_match",
        link_id: link.id,
        statement_line_id: line.id,
        statement_line_version: nextVersion,
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
            eventType: "bank_reconciliation_unmatched",
            payload: {
              posting_id: postingId,
              bank_account_id: link.bankAccountId,
              session_id: link.sessionId ?? null,
              link_id: link.id,
              statement_line_id: line.id,
              amounts: { matched_amount: paisaToString(link.matchedAmountPaisa) },
              statement_line_version: nextVersion,
              expected_statement_line_version: cmd.expectedStatementLineVersion,
              currency: line.currency,
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
      err?.code || "unmatch_failed",
      String(err?.message || err),
      {
        draft_id: cmd.draftId,
        retryable: err?.code === "injected_failure" || !!cat,
        conflict_category: cat,
      },
    );
  }
}
