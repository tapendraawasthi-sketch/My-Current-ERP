/**
 * General journal posting (Phase 9). Never creates settlement allocations.
 * Supports optional reversal of an existing voucher by opposite lines.
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
  findExistingFinancialReceipt,
  generateNextVoucherNo,
  writeAuditLog,
  type FailureInjectionStage,
  type JournalLineDraft,
} from "./postingFramework";
import type {
  MoneyString,
  SettlementCommandSource,
  SettlementPostingResult,
  SettlementPostingSuccessBase,
} from "./types";

export interface JournalLineInput {
  accountId: string;
  accountName?: string;
  debit?: MoneyString | number | null;
  credit?: MoneyString | number | null;
  narration?: string;
  partyId?: string | null;
}

export interface JournalPostingCommand {
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
  journal: {
    transactionDate: string;
    lines?: JournalLineInput[];
    narration?: string;
    currency?: string;
    reversesVoucherId?: string | null;
    allowRestrictedControlAccounts?: boolean;
  };
  injectFailure?: FailureInjectionStage;
}

export interface JournalPostingSuccessPayload extends SettlementPostingSuccessBase {
  operation: "post_journal";
  reverses_voucher_id: string | null;
}

export type JournalPostingResult = SettlementPostingResult<JournalPostingSuccessPayload>;

const RESTRICTED_PATTERNS = [
  /receivable/i,
  /payable/i,
  /sundry\s*debtor/i,
  /sundry\s*creditor/i,
  /inventory/i,
  /\bvat\b/i,
  /\bcash\b/i,
  /\bbank\b/i,
  /withholding/i,
  /\btds\b/i,
];

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: { rolled_back?: boolean; retryable?: boolean; draft_id?: string | null; conflict_category?: any },
): JournalPostingResult {
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

function isRestrictedAccount(acc: { code?: string; name?: string; id?: string }): boolean {
  const hay = `${acc.code || ""} ${acc.name || ""} ${acc.id || ""}`;
  return RESTRICTED_PATTERNS.some((re) => re.test(hay));
}

function toPaisaSafe(v: MoneyString | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  return parseMoneyToPaisa(v);
}

export async function postJournalTransaction(
  cmd: JournalPostingCommand,
): Promise<JournalPostingResult> {
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
    return fail("posting_denied", "permission_denied", "Your role cannot post journals.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  const db = getDB();
  const j = cmd.journal;
  const operation = "post_journal" as const;
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
  const currency = j.currency || "NPR";

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
    assertDateInFiscalYear(j.transactionDate, fy);
    await enforcePostingPeriodLock(j.transactionDate, db);
  } catch (e) {
    return fail(
      "posting_failed",
      "period_or_fy",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  {
    const existingEarly = await findExistingFinancialReceipt(db, scopedKey);
    if (existingEarly?.status === "completed" && existingEarly.result) {
      return {
        type: "posting_completed",
        status: "success",
        payload: {
          ...(existingEarly.result as JournalPostingSuccessPayload),
          idempotent_replay: true,
        },
      };
    }
  }

  let lineInputs = j.lines || [];
  if ((!lineInputs.length) && j.reversesVoucherId) {
    const original = await db.vouchers.get(j.reversesVoucherId);
    if (!original) {
      return fail("posting_failed", "original_not_found", "Original voucher not found for reversal.", {
        draft_id: cmd.draftId,
        retryable: false,
      });
    }
    lineInputs = (original.lines || []).map((l: any) => ({
      accountId: l.accountId,
      accountName: l.accountName,
      debit: l.credit || 0,
      credit: l.debit || 0,
      narration: `Reversal of ${original.voucherNo}`,
      partyId: l.partyId,
    }));
  }

  if (lineInputs.length < 2) {
    return fail("posting_failed", "insufficient_lines", "Journal requires at least two lines.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  const allowRestricted =
    j.allowRestrictedControlAccounts === true || isAccountantOrAdmin(cmd.userRole);
  const drafts: JournalLineDraft[] = [];
  for (const line of lineInputs) {
    const debitP = toPaisaSafe(line.debit);
    const creditP = toPaisaSafe(line.credit);
    if (debitP < 0 || creditP < 0) {
      return fail("posting_failed", "negative_amount", "Journal amounts cannot be negative.", {
        draft_id: cmd.draftId,
        retryable: false,
      });
    }
    if ((debitP > 0 && creditP > 0) || (debitP === 0 && creditP === 0)) {
      return fail(
        "posting_failed",
        "invalid_line",
        "Each journal line must have debit XOR credit.",
        { draft_id: cmd.draftId, retryable: false },
      );
    }
    const acc = await db.accounts.get(line.accountId);
    if (!acc) {
      return fail("posting_failed", "account_not_found", `Account not found: ${line.accountId}`, {
        draft_id: cmd.draftId,
        retryable: false,
      });
    }
    if (isRestrictedAccount(acc as any) && !allowRestricted) {
      return fail(
        "posting_denied",
        "restricted_control_account",
        `Restricted control account requires allowRestrictedControlAccounts: ${line.accountId}`,
        { draft_id: cmd.draftId, retryable: false },
      );
    }
    drafts.push({
      accountId: line.accountId,
      accountName: line.accountName || (acc as any).name,
      debit: paisaToNumber(debitP),
      credit: paisaToNumber(creditP),
      narration: line.narration,
      partyId: line.partyId || undefined,
    });
  }

  try {
    assertJournalBalanced(drafts);
  } catch (e) {
    return fail("posting_failed", "journal_unbalanced", (e as Error).message, {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);
  const amountPaisa = drafts.reduce((s, l) => s + parseMoneyToPaisa(l.debit), 0);

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      const existing = await findExistingFinancialReceipt(db, scopedKey);
      if (existing?.status === "completed" && existing.result) {
        return {
          type: "posting_completed" as const,
          status: "success" as const,
          payload: {
            ...(existing.result as JournalPostingSuccessPayload),
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

      await applyAccountProjectionDeltas(db, drafts);

      const voucherId = generateId();
      let voucherNo = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        voucherNo = await generateNextVoucherNo("journal", db);
        const clash = await db.vouchers.where("voucherNo").equals(voucherNo).first();
        if (!clash) break;
      }

      const totalDebit = drafts.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = drafts.reduce((s, l) => s + (l.credit || 0), 0);
      await db.vouchers.put({
        id: voucherId,
        voucherNo,
        date: j.transactionDate,
        type: "journal",
        status: "posted",
        narration: j.narration || (j.reversesVoucherId ? "Journal reversal" : "Journal"),
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        grandTotal: paisaToNumber(amountPaisa),
        lines: drafts.map((l, i) => ({
          id: `vl-${voucherId}-${i}`,
          accountId: l.accountId,
          accountName: l.accountName,
          debit: l.debit,
          credit: l.credit,
          narration: l.narration,
          partyId: l.partyId,
        })),
        referenceNo: j.reversesVoucherId || undefined,
        createdBy: cmd.userId,
        createdAt: now,
        companyId: cmd.companyId,
      } as any);

      // Never delete the original voucher on reversal.
      if (j.reversesVoucherId) {
        const original = await db.vouchers.get(j.reversesVoucherId);
        if (original) {
          await db.vouchers.put({
            ...original,
            reversedByVoucherId: voucherId,
          } as any);
        }
      }

      if (cmd.injectFailure === "before_audit") {
        throw Object.assign(new Error("Injected failure before audit."), {
          code: "injected_failure",
        });
      }

      const auditId = await writeAuditLog(db, {
        userId: cmd.userId,
        userName: storeState.currentUser?.name,
        action: j.reversesVoucherId ? "JOURNAL_REVERSAL_POSTED" : "JOURNAL_POSTED",
        entityType: "voucher",
        entityId: voucherId,
        companyId: cmd.companyId,
        sessionId: cmd.conversationId,
        after: {
          voucherNo,
          reversesVoucherId: j.reversesVoucherId || null,
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
            eventType: "journal_posted",
            payload: {
              posting_id: postingId,
              voucher_id: voucherId,
              voucher_number: voucherNo,
              voucher_type: "journal",
              transaction_date: j.transactionDate,
              party_id: null,
              reverses_voucher_id: j.reversesVoucherId || null,
              amounts: { amount: paisaToString(amountPaisa) },
              journal_lines: drafts as unknown as Array<Record<string, unknown>>,
              audit_id: auditId,
              currency,
              financial_year_id: cmd.financialYearId ?? null,
              local_idempotency_key: cmd.idempotencyKey,
              source: cmd.source,
              receipt_id: receiptId,
              narration: j.narration,
              aggregate_version: 1,
            },
          });

      const successPayload: JournalPostingSuccessPayload = {
        posting_id: postingId,
        voucher_id: voucherId,
        voucher_number: voucherNo,
        voucher_type: "journal",
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
        reverses_voucher_id: j.reversesVoucherId || null,
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
      e instanceof Error ? e.message : "Journal posting failed",
      { draft_id: cmd.draftId },
    );
  }
}