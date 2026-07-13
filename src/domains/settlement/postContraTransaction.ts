/**
 * Contra voucher posting: cash/bank transfers (Phase 9).
 */

import { getDB, generateId } from "@/lib/db";
import { assertDateInFiscalYear } from "@/store/store.types";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";
import { isAccountantOrAdmin } from "@/lib/permissions";
import type { OrbixOperatingMode } from "@/lib/ekhata/orbixOperatingMode";
import { parseMoneyToPaisa, paisaToNumber, paisaToString } from "@/domains/purchase/money";
import { enqueueFinancialSyncInTransaction } from "@/platform/sync/enqueueFinancialSync";
import { getCompanySyncPolicy, isLocalOnly } from "@/platform/sync/companySyncPolicy";
import {
  applyAccountProjectionDeltas,
  assertJournalBalanced,
  buildScopedFinancialIdempotencyKey,
  collectTxnTables,
  DEFAULT_SETTLEMENT_ACCOUNTS,
  findExistingFinancialReceipt,
  generateNextVoucherNo,
  isCashOrBankAccount,
  optionalMoneyPaisa,
  writeAuditLog,
  type FailureInjectionStage,
  type JournalLineDraft,
} from "./postingFramework";
import type {
  ContraType,
  MoneyString,
  SettlementCommandSource,
  SettlementInstrumentMeta,
  SettlementPostingResult,
  SettlementPostingSuccessBase,
} from "./types";

export interface ContraPostingCommand {
  commandId: string;
  requestId: string;
  conversationId?: string | null;
  draftId?: string | null;
  draftVersion?: number | null;
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
  contra: {
    contraType: ContraType;
    transactionDate: string;
    fromAccountId: string;
    toAccountId: string;
    amount: MoneyString;
    bankCharges?: MoneyString | null;
    bankChargeAccountId?: string | null;
    currency?: string;
    narration?: string;
    instrument?: SettlementInstrumentMeta | null;
  };
  injectFailure?: FailureInjectionStage;
}

export interface ContraPostingSuccessPayload extends SettlementPostingSuccessBase {
  operation: "post_contra";
  contra_type: ContraType;
  from_account_id: string;
  to_account_id: string;
}

export type ContraPostingResult = SettlementPostingResult<ContraPostingSuccessPayload>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: { rolled_back?: boolean; retryable?: boolean; draft_id?: string | null; conflict_category?: any },
): ContraPostingResult {
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

export async function postContraTransaction(
  cmd: ContraPostingCommand,
): Promise<ContraPostingResult> {
  if (!cmd.idempotencyKey?.trim() || !cmd.companyId?.trim() || !cmd.userId?.trim()) {
    return fail("posting_failed", "missing_required", "Missing required posting fields.", {
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
    return fail("posting_denied", "permission_denied", "Your role cannot post contra vouchers.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  const db = getDB();
  const c = cmd.contra;
  const operation = "post_contra" as const;
  const scopedKey = buildScopedFinancialIdempotencyKey(
    operation,
    cmd.companyId,
    cmd.draftId,
    cmd.previewVersion,
    cmd.previewHash,
    cmd.idempotencyKey,
  );
  const postingId = `post-${cmd.requestId}`;
  const now = new Date().toISOString();
  const currency = c.currency || "NPR";

  let storeBridge: { getState: () => any; setState: (x: any) => void } | null = null;
  try {
    const mod = await import("@/store/useStore");
    storeBridge = { getState: mod.useStore.getState, setState: mod.useStore.setState };
  } catch {
    storeBridge = null;
  }
  const storeState = storeBridge?.getState() || {};

  try {
    let fy = storeState.currentFiscalYear;
    if (!fy) {
      const years = await db.fiscalYears.toArray();
      fy = years.find((y: any) => y.isCurrent) || years[0];
    }
    assertDateInFiscalYear(c.transactionDate, fy);
    await enforcePostingPeriodLock(c.transactionDate, db);
  } catch (e) {
    return fail(
      "posting_failed",
      "period_or_fy",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  if (c.fromAccountId === c.toAccountId) {
    return fail("posting_failed", "same_account", "From and to accounts must differ.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  const fromAcc = await db.accounts.get(c.fromAccountId);
  const toAcc = await db.accounts.get(c.toAccountId);
  if (!fromAcc || !toAcc) {
    return fail("posting_failed", "account_not_found", "Contra accounts were not found.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  if (!isCashOrBankAccount(fromAcc as any) || !isCashOrBankAccount(toAcc as any)) {
    return fail(
      "posting_failed",
      "not_cash_bank",
      "Contra accounts must be cash/bank accounts.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  let amountPaisa = 0;
  try {
    amountPaisa = parseMoneyToPaisa(c.amount);
    if (!(amountPaisa > 0)) throw new Error("zero");
  } catch {
    return fail("posting_failed", "invalid_amount", "Contra amount must be greater than zero.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  const bankChargesPaisa = optionalMoneyPaisa(c.bankCharges);

  {
    const existingEarly = await findExistingFinancialReceipt(db, scopedKey);
    if (existingEarly?.status === "completed" && existingEarly.result) {
      return {
        type: "posting_completed",
        status: "success",
        payload: {
          ...(existingEarly.result as ContraPostingSuccessPayload),
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
            ...(existing.result as ContraPostingSuccessPayload),
            idempotent_replay: true,
          },
        };
      }
      if (existing?.status === "processing") {
        throw Object.assign(new Error("Posting already in progress."), { code: "in_progress" });
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
        draftVersion: cmd.draftVersion ?? null,
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

      const chargeAcct = c.bankChargeAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.bankCharges;
      const lines: JournalLineDraft[] = [
        {
          accountId: c.toAccountId,
          accountName: (toAcc as any).name,
          debit: paisaToNumber(amountPaisa),
          credit: 0,
          narration: c.narration || "Contra",
        },
        {
          accountId: c.fromAccountId,
          accountName: (fromAcc as any).name,
          debit: 0,
          credit: paisaToNumber(amountPaisa),
          narration: c.narration || "Contra",
        },
      ];
      if (bankChargesPaisa > 0) {
        lines.push({
          accountId: chargeAcct,
          debit: paisaToNumber(bankChargesPaisa),
          credit: 0,
          narration: "Bank charges",
        });
        lines.push({
          accountId: c.fromAccountId,
          debit: 0,
          credit: paisaToNumber(bankChargesPaisa),
          narration: "Bank charges",
        });
      }

      assertJournalBalanced(lines);
      await applyAccountProjectionDeltas(db, lines);

      const voucherId = generateId();
      let voucherNo = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        voucherNo = await generateNextVoucherNo("contra", db);
        const clash = await db.vouchers.where("voucherNo").equals(voucherNo).first();
        if (!clash) break;
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
      await db.vouchers.put({
        id: voucherId,
        voucherNo,
        date: c.transactionDate,
        type: "contra",
        status: "posted",
        narration: c.narration || "Contra",
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        grandTotal: paisaToNumber(amountPaisa),
        lines: lines.map((l, i) => ({
          id: `vl-${voucherId}-${i}`,
          accountId: l.accountId,
          accountName: l.accountName,
          debit: l.debit,
          credit: l.credit,
          narration: l.narration,
        })),
        createdBy: cmd.userId,
        createdAt: now,
        companyId: cmd.companyId,
      } as any);

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), {
          code: "injected_failure",
        });
      }

      const auditId = await writeAuditLog(db, {
        userId: cmd.userId,
        userName: storeState.currentUser?.name,
        action: "CONTRA_POSTED",
        entityType: "voucher",
        entityId: voucherId,
        companyId: cmd.companyId,
        sessionId: cmd.conversationId,
        after: {
          voucherNo,
          contraType: c.contraType,
          fromAccountId: c.fromAccountId,
          toAccountId: c.toAccountId,
          amount: paisaToString(amountPaisa),
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
            eventType: "contra_posted",
            payload: {
              posting_id: postingId,
              voucher_id: voucherId,
              voucher_number: voucherNo,
              voucher_type: "contra",
              transaction_date: c.transactionDate,
              party_id: null,
              contra_type: c.contraType,
              from_account_id: c.fromAccountId,
              to_account_id: c.toAccountId,
              amounts: {
                amount: paisaToString(amountPaisa),
                bank_charges: paisaToString(bankChargesPaisa),
              },
              journal_lines: lines as unknown as Array<Record<string, unknown>>,
              instrument: (c.instrument as Record<string, unknown> | null | undefined) || null,
              audit_id: auditId,
              currency,
              financial_year_id: cmd.financialYearId ?? null,
              local_idempotency_key: cmd.idempotencyKey,
              source: cmd.source,
              receipt_id: receiptId,
              narration: c.narration,
              aggregate_version: 1,
            },
          });

      const successPayload: ContraPostingSuccessPayload = {
        posting_id: postingId,
        voucher_id: voucherId,
        voucher_number: voucherNo,
        voucher_type: "contra",
        amount: paisaToString(amountPaisa),
        currency,
        posted_at: now,
        idempotent_replay: false,
        sync_status: syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending",
        sync_event_id: syncEnqueue.eventId,
        draft_id: cmd.draftId ?? null,
        audit_id: auditId,
        receipt_id: receiptId,
        operation,
        contra_type: c.contraType,
        from_account_id: c.fromAccountId,
        to_account_id: c.toAccountId,
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
        draftVersion: cmd.draftVersion ?? null,
        previewVersion: cmd.previewVersion != null ? String(cmd.previewVersion) : null,
        previewHash: cmd.previewHash ?? null,
        status: "completed",
        postingId,
        voucherId,
        invoiceId: null,
        journalId: voucherId,
        result: successPayload,
        createdAt: existing?.createdAt || now,
        completedAt: now,
      } as any);

      if (storeBridge) {
        const vouchers = await db.vouchers.toArray();
        const accounts = await db.accounts.toArray();
        storeBridge.setState({
          vouchers: vouchers.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          accounts,
        });
      }

      return {
        type: "posting_completed" as const,
        status: "success" as const,
        payload: successPayload,
      };
    });

    return result;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "in_progress") {
      return fail("posting_conflict", code, (e as Error).message, {
        draft_id: cmd.draftId,
        conflict_category: "in_progress",
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
      e instanceof Error ? e.message : "Contra posting failed",
      { draft_id: cmd.draftId },
    );
  }
}