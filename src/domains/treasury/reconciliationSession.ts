/**
 * Bank reconciliation session open / update / close / reopen (Phase 10).
 * Close rejects nonzero difference beyond configured tolerance.
 * Reopen requires admin. Versioned optimistic concurrency + sync events.
 */

import { getDB, generateId } from "@/lib/db";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { enqueueBankSyncInTransaction } from "@/platform/sync/enqueueBankSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import { paisaToString } from "@/domains/purchase/money";
import { getBankAccount, resolveLedgerBalancePaisa, setLastReconciledDate } from "./bankAccountModel";
import {
  buildScopedTreasuryIdempotencyKey,
  collectTxnTables,
  findExistingReceipt,
  writeAudit,
  type FailureInjectionStage,
} from "./postingFramework";
import type {
  BankReconciliationSessionRow,
  MoneyString,
  ReconciliationSessionStatus,
  TreasuryCommandSource,
  TreasuryPostingResult,
  TreasuryPostingSuccessBase,
} from "./types";

/** Default close tolerance in paisa (Rs 0.01). */
export const DEFAULT_RECON_CLOSE_TOLERANCE_PAISA = 1;

export interface OpenReconciliationSessionInput {
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
  periodStart: string;
  periodEnd: string;
  statementBalancePaisa: number;
  bookBalancePaisa?: number | null;
  currency?: string;
  injectFailure?: FailureInjectionStage;
}

export interface UpdateReconciliationSessionInput {
  sessionId: string;
  expectedVersion: number;
  companyId: string;
  userId: string;
  clearedBalancePaisa?: number;
  bookBalancePaisa?: number;
  statementBalancePaisa?: number;
  differencePaisa?: number;
  status?: Extract<ReconciliationSessionStatus, "open" | "in_progress">;
}

export interface CloseReconciliationCommand {
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
  sessionId: string;
  expectedVersion: number;
  /** Absolute paisa tolerance; defaults to DEFAULT_RECON_CLOSE_TOLERANCE_PAISA. */
  tolerancePaisa?: number;
  injectFailure?: FailureInjectionStage;
}

export interface ReopenReconciliationCommand {
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
  sessionId: string;
  expectedVersion: number;
  reason: string;
  injectFailure?: FailureInjectionStage;
}

export interface ReconciliationSessionSuccess extends TreasuryPostingSuccessBase {
  operation: "open_bank_reconciliation" | "close_bank_reconciliation" | "reopen_bank_reconciliation";
  session_id: string;
  session_version: number;
  status: ReconciliationSessionStatus;
  difference: MoneyString;
}

export type ReconciliationSessionResult = TreasuryPostingResult<ReconciliationSessionSuccess>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: {
    retryable?: boolean;
    draft_id?: string | null;
    conflict_category?: import("./types").TreasuryConflictCategory;
    warning_codes?: import("./types").TreasuryWarningCode[];
  },
): ReconciliationSessionResult {
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
      warning_codes: opts?.warning_codes,
    },
  };
}

function computeDifferencePaisa(session: {
  statementBalancePaisa: number;
  bookBalancePaisa: number;
  clearedBalancePaisa: number;
}): number {
  // statement vs adjusted book (book + uncleared timing via cleared snapshot)
  return session.statementBalancePaisa - session.clearedBalancePaisa;
}

export async function openBankReconciliationSession(
  cmd: OpenReconciliationSessionInput,
): Promise<ReconciliationSessionResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Opening reconciliation requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot open bank reconciliation.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const db = getDB();
  const table = (db as any).bankReconciliationSessions;
  if (!table) {
    return fail("posting_failed", "schema_missing", "bankReconciliationSessions table not available.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const operation = "open_bank_reconciliation" as const;
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
    const result = existingReceipt.resultPayload as ReconciliationSessionSuccess;
    return { type: "posting_completed", status: "success", payload: { ...result, idempotent_replay: true } };
  }

  const bank = await getBankAccount(db, cmd.bankAccountId);
  if (!bank || bank.companyId !== cmd.companyId) {
    return fail("posting_failed", "bank_account_not_found", "Bank account not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "bank_account_mismatch",
    });
  }

  const bookBalancePaisa =
    cmd.bookBalancePaisa ?? (await resolveLedgerBalancePaisa(db, bank.ledgerAccountId));
  const now = new Date().toISOString();
  const sessionId = generateId();
  const clearedBalancePaisa = bookBalancePaisa;
  const differencePaisa = computeDifferencePaisa({
    statementBalancePaisa: cmd.statementBalancePaisa,
    bookBalancePaisa,
    clearedBalancePaisa,
  });

  const row: BankReconciliationSessionRow = {
    id: sessionId,
    companyId: cmd.companyId,
    bankAccountId: cmd.bankAccountId,
    status: "open",
    version: 1,
    periodStart: cmd.periodStart,
    periodEnd: cmd.periodEnd,
    statementBalancePaisa: cmd.statementBalancePaisa,
    bookBalancePaisa,
    clearedBalancePaisa,
    differencePaisa,
    currency: cmd.currency || bank.currency || "NPR",
    openedAt: now,
    openedBy: cmd.userId,
  };

  await table.put(row);
  const auditId = await writeAudit(db, {
    userId: cmd.userId,
    action: "bank_reconciliation_opened",
    entityType: "bank_reconciliation_session",
    entityId: sessionId,
    companyId: cmd.companyId,
    after: { periodStart: cmd.periodStart, periodEnd: cmd.periodEnd },
  });

  const success: ReconciliationSessionSuccess = {
    posting_id: postingId,
    operation,
    session_id: sessionId,
    session_version: 1,
    status: "open",
    difference: paisaToString(differencePaisa),
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
    resultPayload: success,
  } as any);
  success.receipt_id = receiptId;

  return { type: "posting_completed", status: "success", payload: success };
}

export async function updateBankReconciliationSession(
  input: UpdateReconciliationSessionInput,
): Promise<BankReconciliationSessionRow> {
  const db = getDB();
  const table = (db as any).bankReconciliationSessions;
  if (!table) {
    throw Object.assign(new Error("bankReconciliationSessions table not available"), {
      code: "schema_missing",
    });
  }
  const session = (await table.get(input.sessionId)) as BankReconciliationSessionRow | undefined;
  if (!session || session.companyId !== input.companyId) {
    throw Object.assign(new Error("Session not found"), {
      code: "document_not_found",
      conflict_category: "document_not_found",
    });
  }
  if (session.version !== input.expectedVersion) {
    throw Object.assign(new Error("Stale session version"), {
      code: "stale_session_version",
      conflict_category: "stale_session_version",
    });
  }
  if (session.status === "closed") {
    throw Object.assign(new Error("Session is closed"), {
      code: "session_already_closed",
      conflict_category: "session_already_closed",
    });
  }

  const next: BankReconciliationSessionRow = {
    ...session,
    version: session.version + 1,
    status: input.status || "in_progress",
    clearedBalancePaisa: input.clearedBalancePaisa ?? session.clearedBalancePaisa,
    bookBalancePaisa: input.bookBalancePaisa ?? session.bookBalancePaisa,
    statementBalancePaisa: input.statementBalancePaisa ?? session.statementBalancePaisa,
    differencePaisa: 0,
  };
  next.differencePaisa =
    input.differencePaisa ??
    computeDifferencePaisa({
      statementBalancePaisa: next.statementBalancePaisa,
      bookBalancePaisa: next.bookBalancePaisa,
      clearedBalancePaisa: next.clearedBalancePaisa,
    });
  await table.put(next);
  return next;
}

export async function closeBankReconciliation(
  cmd: CloseReconciliationCommand,
): Promise<ReconciliationSessionResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Closing reconciliation requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot close bank reconciliation.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const db = getDB();
  const table = (db as any).bankReconciliationSessions;
  if (!table) {
    return fail("posting_failed", "schema_missing", "bankReconciliationSessions table not available.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const operation = "close_bank_reconciliation" as const;
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
    const result = existingReceipt.resultPayload as ReconciliationSessionSuccess;
    return { type: "posting_completed", status: "success", payload: { ...result, idempotent_replay: true } };
  }

  const session = (await table.get(cmd.sessionId)) as BankReconciliationSessionRow | undefined;
  if (!session || session.companyId !== cmd.companyId) {
    return fail("posting_failed", "document_not_found", "Session not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "document_not_found",
    });
  }
  if (session.version !== cmd.expectedVersion) {
    return fail("posting_conflict", "stale_session_version", "Stale session version.", {
      draft_id: cmd.draftId,
      conflict_category: "stale_session_version",
    });
  }
  if (session.status === "closed") {
    return fail("posting_conflict", "session_already_closed", "Session already closed.", {
      draft_id: cmd.draftId,
      conflict_category: "session_already_closed",
      retryable: false,
    });
  }

  const tolerance = cmd.tolerancePaisa ?? DEFAULT_RECON_CLOSE_TOLERANCE_PAISA;
  const diff = Math.abs(session.differencePaisa);
  if (diff > tolerance) {
    return fail(
      "posting_denied",
      "nonzero_recon_difference",
      `Reconciliation difference ${paisaToString(session.differencePaisa)} exceeds tolerance.`,
      {
        retryable: false,
        draft_id: cmd.draftId,
        warning_codes: ["nonzero_recon_difference"],
      },
    );
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);
  const now = new Date().toISOString();
  const nextVersion = session.version + 1;

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      if (cmd.injectFailure === "before_match_write") {
        throw Object.assign(new Error("Injected failure before match write."), { code: "injected_failure" });
      }

      const closed: BankReconciliationSessionRow = {
        ...session,
        status: "closed",
        version: nextVersion,
        closedAt: now,
        closedBy: cmd.userId,
      };
      await table.put(closed);
      await setLastReconciledDate(db, session.bankAccountId, session.periodEnd);

      const auditId = await writeAudit(db, {
        userId: cmd.userId,
        action: "bank_reconciliation_closed",
        entityType: "bank_reconciliation_session",
        entityId: session.id,
        companyId: cmd.companyId,
        sessionId: session.id,
        after: {
          differencePaisa: session.differencePaisa,
          version: nextVersion,
        },
      });

      const successPayload: ReconciliationSessionSuccess = {
        posting_id: postingId,
        operation,
        session_id: session.id,
        session_version: nextVersion,
        status: "closed",
        difference: paisaToString(session.differencePaisa),
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
            eventType: "bank_reconciliation_closed",
            payload: {
              posting_id: postingId,
              bank_account_id: session.bankAccountId,
              session_id: session.id,
              voucher_id: session.id,
              amounts: {
                statement_balance: paisaToString(session.statementBalancePaisa),
                book_balance: paisaToString(session.bookBalancePaisa),
                cleared_balance: paisaToString(session.clearedBalancePaisa),
                difference: paisaToString(session.differencePaisa),
              },
              session_version: nextVersion,
              expected_session_version: cmd.expectedVersion,
              currency: session.currency,
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
    return fail(cat ? "posting_conflict" : "posting_failed", err?.code || "close_failed", String(err?.message || err), {
      draft_id: cmd.draftId,
      retryable: err?.code === "injected_failure" || !!cat,
      conflict_category: cat,
    });
  }
}

export async function reopenBankReconciliation(
  cmd: ReopenReconciliationCommand,
): Promise<ReconciliationSessionResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (!cmd.reason?.trim()) {
    return fail("posting_failed", "reason_required", "Reopen requires a reason.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  // Admin only (elevated)
  if (cmd.userRole !== "admin" && cmd.userRole !== "owner") {
    return fail("posting_denied", "permission_denied", "Only admin can reopen a closed reconciliation.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "permission_denied",
    });
  }

  const db = getDB();
  const table = (db as any).bankReconciliationSessions;
  if (!table) {
    return fail("posting_failed", "schema_missing", "bankReconciliationSessions table not available.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }

  const operation = "reopen_bank_reconciliation" as const;
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
    const result = existingReceipt.resultPayload as ReconciliationSessionSuccess;
    return { type: "posting_completed", status: "success", payload: { ...result, idempotent_replay: true } };
  }

  const session = (await table.get(cmd.sessionId)) as BankReconciliationSessionRow | undefined;
  if (!session || session.companyId !== cmd.companyId) {
    return fail("posting_failed", "document_not_found", "Session not found.", {
      retryable: false,
      draft_id: cmd.draftId,
      conflict_category: "document_not_found",
    });
  }
  if (session.version !== cmd.expectedVersion) {
    return fail("posting_conflict", "stale_session_version", "Stale session version.", {
      draft_id: cmd.draftId,
      conflict_category: "stale_session_version",
    });
  }
  if (session.status !== "closed") {
    return fail("posting_conflict", "session_not_open", "Only a closed session can be reopened.", {
      draft_id: cmd.draftId,
      conflict_category: "session_not_open",
      retryable: false,
    });
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);
  const now = new Date().toISOString();
  const nextVersion = session.version + 1;

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      const reopened: BankReconciliationSessionRow = {
        ...session,
        status: "reopened",
        version: nextVersion,
        reopenedAt: now,
      };
      await table.put(reopened);

      const auditId = await writeAudit(db, {
        userId: cmd.userId,
        action: "bank_reconciliation_reopened",
        entityType: "bank_reconciliation_session",
        entityId: session.id,
        companyId: cmd.companyId,
        sessionId: session.id,
        after: { reason: cmd.reason, version: nextVersion, prior_closed_at: session.closedAt },
      });

      const successPayload: ReconciliationSessionSuccess = {
        posting_id: postingId,
        operation,
        session_id: session.id,
        session_version: nextVersion,
        status: "reopened",
        difference: paisaToString(session.differencePaisa),
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
            eventType: "bank_reconciliation_reopened",
            payload: {
              posting_id: postingId,
              bank_account_id: session.bankAccountId,
              session_id: session.id,
              voucher_id: session.id,
              reason: cmd.reason,
              amounts: { difference: paisaToString(session.differencePaisa) },
              session_version: nextVersion,
              expected_session_version: cmd.expectedVersion,
              currency: session.currency,
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
    return fail(cat ? "posting_conflict" : "posting_failed", err?.code || "reopen_failed", String(err?.message || err), {
      draft_id: cmd.draftId,
      retryable: err?.code === "injected_failure" || !!cat,
      conflict_category: cat,
    });
  }
}