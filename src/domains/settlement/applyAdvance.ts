/**
 * Apply existing customer/supplier advances to invoices without cash movement (Phase 9).
 */

import { getDB, generateId } from "@/lib/db";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { parseMoneyToPaisa, paisaToString } from "@/domains/purchase/money";
import { enqueueFinancialSyncInTransaction } from "@/platform/sync/enqueueFinancialSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import {
  bumpAdvanceVersion,
  bumpDocumentSettlementVersion,
  getOrCreateDocumentSettlementState,
} from "./settlementState";
import { computeDocumentOutstanding, rebuildInvoicePaidProjection } from "./outstandingBalance";
import {
  buildScopedFinancialIdempotencyKey,
  collectTxnTables,
  findExistingFinancialReceipt,
  writeAuditLog,
  type FailureInjectionStage,
} from "./postingFramework";
import type {
  MoneyString,
  SettlementAllocationInput,
  SettlementCommandSource,
  SettlementPostingResult,
  SettlementPostingSuccessBase,
} from "./types";

export interface ApplyAdvanceCommand {
  commandId: string;
  requestId: string;
  conversationId?: string | null;
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
  source: SettlementCommandSource;
  advanceId: string;
  expectedAdvanceVersion?: number | null;
  allocations: SettlementAllocationInput[];
  currency?: string;
  narration?: string;
  injectFailure?: FailureInjectionStage;
}

export interface ApplyAdvanceSuccessPayload extends SettlementPostingSuccessBase {
  operation: "apply_advance";
  advance_id: string;
  side: "customer" | "supplier";
  advance_version: number;
  settlement_versions: Record<string, number>;
}

export type ApplyAdvanceResult = SettlementPostingResult<ApplyAdvanceSuccessPayload>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: { rolled_back?: boolean; retryable?: boolean; draft_id?: string | null; conflict_category?: any },
): ApplyAdvanceResult {
  return {
    type,
    status: "failed",
    payload: {
      error_code,
      safe_message,
      rolled_back: opts?.rolled_back ?? true,
      draft_retained: true,
      retryable: opts?.retryable ?? true,
      draft_id: opts?.draft_id ?? null,
      conflict_category: opts?.conflict_category,
    },
  };
}

async function applyAdvanceInternal(
  cmd: ApplyAdvanceCommand,
  side: "customer" | "supplier",
): Promise<ApplyAdvanceResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required fields.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Posting requires Accountant Mode.", {
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot apply advances.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  if (!cmd.allocations?.length) {
    return fail("posting_failed", "missing_allocations", "At least one allocation is required.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  const db = getDB();
  const operation = "apply_advance" as const;
  const scopedKey = buildScopedFinancialIdempotencyKey(
    `${operation}_${side}`,
    cmd.companyId,
    cmd.draftId,
    cmd.previewVersion,
    cmd.previewHash,
    cmd.idempotencyKey,
  );
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();
  const currency = cmd.currency || "NPR";
  const expectedDocType = side === "customer" ? "sales-invoice" : "purchase-invoice";
  const eventType = "advance_applied" as const;

  {
    const existingEarly = await findExistingFinancialReceipt(db, scopedKey);
    if (existingEarly?.status === "completed" && existingEarly.result) {
      return {
        type: "posting_completed",
        status: "success",
        payload: {
          ...(existingEarly.result as ApplyAdvanceSuccessPayload),
          idempotent_replay: true,
        },
      };
    }
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      const existing = await findExistingFinancialReceipt(db, scopedKey);
      if (existing?.status === "completed" && existing.result) {
        return {
          type: "posting_completed" as const,
          status: "success" as const,
          payload: {
            ...(existing.result as ApplyAdvanceSuccessPayload),
            idempotent_replay: true,
          },
        };
      }
      if (existing?.status === "processing") {
        throw Object.assign(new Error("Posting already in progress."), { code: "in_progress" });
      }

      const advances = (db as any).partyAdvances;
      const advance = advances ? await advances.get(cmd.advanceId) : null;
      if (!advance) {
        throw Object.assign(new Error("Advance not found."), { code: "advance_not_found" });
      }
      if (String(advance.side) !== side) {
        throw Object.assign(new Error(`Advance side must be ${side}.`), { code: "advance_side_mismatch" });
      }
      if (
        cmd.expectedAdvanceVersion != null &&
        cmd.expectedAdvanceVersion !== Number(advance.advanceVersion)
      ) {
        throw Object.assign(
          new Error(
            `Stale advance version: expected ${cmd.expectedAdvanceVersion}, actual ${advance.advanceVersion}.`,
          ),
          { code: "stale_advance_version" },
        );
      }

      const receiptId = existing?.id || generateId();
      await db.orbixPostingReceipts.put({
        id: receiptId,
        idempotencyKey: cmd.idempotencyKey,
        scopedKey,
        tenantId: cmd.tenantId || "local",
        companyId: cmd.companyId,
        userId: cmd.userId,
        operation,
        draftId: cmd.draftId ?? null,
        draftVersion: null,
        previewVersion: cmd.previewVersion != null ? String(cmd.previewVersion) : null,
        previewHash: cmd.previewHash ?? null,
        status: "processing",
        postingId,
        voucherId: null,
        invoiceId: null,
        journalId: null,
        result: null,
        createdAt: existing?.createdAt || now,
        completedAt: null,
      } as any);

      if (cmd.injectFailure === "before_allocations") {
        throw Object.assign(new Error("Injected failure before allocations."), {
          code: "injected_failure",
        });
      }

      let applyTotal = 0;
      const allocationIds: string[] = [];
      const settlementVersions: Record<string, number> = {};
      const allocTable = (db as any).settlementAllocations;
      const appTable = (db as any).partyAdvanceApplications;

      for (const a of cmd.allocations) {
        const outstanding = await computeDocumentOutstanding(db, cmd.companyId, a.document_id);
        if (!outstanding) {
          throw Object.assign(new Error(`Document ${a.document_id} not found.`), {
            code: "document_not_found",
          });
        }
        if (outstanding.document_type !== expectedDocType) {
          throw Object.assign(new Error(`Expected ${expectedDocType} documents.`), {
            code: "invalid_document_type",
          });
        }
        if (advance.partyId && outstanding.party_id && advance.partyId !== outstanding.party_id) {
          throw Object.assign(new Error("Party does not match target invoice."), {
            code: "party_mismatch",
          });
        }
        if (
          a.expected_settlement_version != null &&
          a.expected_settlement_version !== outstanding.settlement_version
        ) {
          throw Object.assign(
            new Error(
              `Stale settlement version: expected ${a.expected_settlement_version}, actual ${outstanding.settlement_version}.`,
            ),
            { code: "stale_settlement_version" },
          );
        }
        const principal = parseMoneyToPaisa(a.amount);
        if (!(principal > 0)) {
          throw Object.assign(new Error("Allocation amount must be positive."), {
            code: "invalid_amount",
          });
        }
        if (principal > outstanding.remaining_outstanding_paisa) {
          throw Object.assign(new Error("Allocation exceeds remaining outstanding."), {
            code: "over_allocation",
          });
        }
        applyTotal += principal;

        const state = await getOrCreateDocumentSettlementState(db, cmd.companyId, a.document_id);
        const nextVersion = state.settlementVersion + 1;
        const allocId = generateId();
        allocationIds.push(allocId);
        if (allocTable) {
          await allocTable.put({
            id: allocId,
            companyId: cmd.companyId,
            voucherId: advance.sourceVoucherId || cmd.advanceId,
            voucherType: side === "customer" ? "receipt" : "payment",
            targetDocumentId: a.document_id,
            partyId: outstanding.party_id,
            component: "principal",
            amount: paisaToString(principal),
            amountPaisa: principal,
            currency,
            status: "posted",
            createdAt: now,
            source: cmd.source,
            advanceId: cmd.advanceId,
          });
        }
        if (appTable) {
          await appTable.put({
            id: generateId(),
            companyId: cmd.companyId,
            advanceId: cmd.advanceId,
            documentId: a.document_id,
            allocationId: allocId,
            amount: paisaToString(principal),
            amountPaisa: principal,
            createdAt: now,
          });
        }
        await bumpDocumentSettlementVersion(db, cmd.companyId, a.document_id, nextVersion, now);
        settlementVersions[a.document_id] = nextVersion;
        await rebuildInvoicePaidProjection(db, a.document_id);
      }

      const remainingPaisa = Number(advance.remainingPaisa || 0);
      if (applyTotal > remainingPaisa) {
        throw Object.assign(new Error("Insufficient advance remaining balance."), {
          code: "insufficient_advance",
        });
      }
      const nextRemaining = remainingPaisa - applyTotal;
      const nextAdvVersion = Number(advance.advanceVersion || 0) + 1;
      await bumpAdvanceVersion(db, cmd.advanceId, {
        companyId: cmd.companyId,
        partyId: advance.partyId,
        side,
        remainingAmount: paisaToString(nextRemaining) as MoneyString,
        remainingPaisa: nextRemaining,
        currency: advance.currency || currency,
        advanceVersion: nextAdvVersion,
        status: nextRemaining > 0 ? "open" : "fully_applied",
        sourceVoucherId: advance.sourceVoucherId || null,
        updatedAt: now,
        createdAt: advance.createdAt || now,
      });

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), {
          code: "injected_failure",
        });
      }

      const auditId = await writeAuditLog(db, {
        userId: cmd.userId,
        action: side === "customer" ? "CUSTOMER_ADVANCE_APPLIED" : "SUPPLIER_ADVANCE_APPLIED",
        entityType: "advance",
        entityId: cmd.advanceId,
        companyId: cmd.companyId,
        sessionId: cmd.conversationId,
        after: {
          advanceId: cmd.advanceId,
          applied: paisaToString(applyTotal),
          allocationIds,
          settlementVersions,
          advanceVersion: nextAdvVersion,
          draftId: cmd.draftId,
          requestId: cmd.requestId,
          source: cmd.source,
          idempotencyKey: cmd.idempotencyKey,
        },
      });

      if (cmd.injectFailure === "before_sync") {
        throw Object.assign(new Error("Injected failure before sync."), {
          code: "injected_failure",
        });
      }

      const syncEnqueue = isLocalOnly(syncPolicy)
        ? ({ syncStatus: "disabled" as const, eventId: null })
        : await enqueueFinancialSyncInTransaction(db, {
            tenantId: cmd.tenantId || "local",
            companyId: cmd.companyId,
            financialYearId: cmd.financialYearId ?? null,
            userId: cmd.userId,
            source: cmd.source,
            correlationId: cmd.requestId || postingId,
            causationId: cmd.draftId ?? null,
            idempotencyKey: cmd.idempotencyKey,
            syncPolicy,
            eventType,
            payload: {
              posting_id: postingId,
              voucher_id: advance.sourceVoucherId || cmd.advanceId,
              voucher_number: "",
              voucher_type: side === "customer" ? "receipt" : "payment",
              transaction_date: now.slice(0, 10),
              party_id: advance.partyId || null,
              advance_ids: [cmd.advanceId],
              amounts: { amount: paisaToString(applyTotal), advance: paisaToString(nextRemaining) },
              allocations: cmd.allocations.map((a) => ({
                document_id: a.document_id,
                principal: a.amount,
              })),
              settlement_versions: settlementVersions,
              audit_id: auditId,
              currency,
              financial_year_id: cmd.financialYearId ?? null,
              local_idempotency_key: cmd.idempotencyKey,
              source: cmd.source,
              receipt_id: receiptId,
              narration: cmd.narration,
              aggregate_version: nextAdvVersion,
            },
          });

      const successPayload: ApplyAdvanceSuccessPayload = {
        posting_id: postingId,
        voucher_id: advance.sourceVoucherId || cmd.advanceId,
        voucher_number: "",
        voucher_type: side === "customer" ? "receipt" : "payment",
        amount: paisaToString(applyTotal),
        currency,
        posted_at: now,
        idempotent_replay: false,
        sync_status: syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending",
        sync_event_id: syncEnqueue.eventId,
        draft_id: cmd.draftId ?? null,
        audit_id: auditId,
        receipt_id: receiptId,
        allocation_ids: allocationIds,
        advance_ids: [cmd.advanceId],
        operation,
        advance_id: cmd.advanceId,
        side,
        advance_version: nextAdvVersion,
        settlement_versions: settlementVersions,
      };

      await db.orbixPostingReceipts.put({
        id: receiptId,
        idempotencyKey: cmd.idempotencyKey,
        scopedKey,
        tenantId: cmd.tenantId || "local",
        companyId: cmd.companyId,
        userId: cmd.userId,
        operation,
        draftId: cmd.draftId ?? null,
        draftVersion: null,
        previewVersion: cmd.previewVersion != null ? String(cmd.previewVersion) : null,
        previewHash: cmd.previewHash ?? null,
        status: "completed",
        postingId,
        voucherId: advance.sourceVoucherId || null,
        invoiceId: null,
        journalId: null,
        result: successPayload,
        createdAt: existing?.createdAt || now,
        completedAt: now,
      } as any);

      return {
        type: "posting_completed" as const,
        status: "success" as const,
        payload: successPayload,
      };
    });

    return result;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (
      code === "in_progress" ||
      code === "stale_advance_version" ||
      code === "stale_settlement_version" ||
      code === "over_allocation" ||
      code === "insufficient_advance" ||
      code === "party_mismatch"
    ) {
      return fail("posting_conflict", code, (e as Error).message, {
        draft_id: cmd.draftId,
        conflict_category: code,
      });
    }
    if (code === "injected_failure") {
      return fail("posting_failed", "injected_failure", (e as Error).message, {
        draft_id: cmd.draftId,
      });
    }
    return fail(
      "posting_failed",
      "posting_exception",
      e instanceof Error ? e.message : "Advance application failed",
      { draft_id: cmd.draftId },
    );
  }
}

export async function applyCustomerAdvance(cmd: ApplyAdvanceCommand): Promise<ApplyAdvanceResult> {
  return applyAdvanceInternal(cmd, "customer");
}

export async function applySupplierAdvance(cmd: ApplyAdvanceCommand): Promise<ApplyAdvanceResult> {
  return applyAdvanceInternal(cmd, "supplier");
}