/**
 * Authoritative supplier payment posting (Phase 9) - Model B Dexie local-first.
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
  bumpDocumentSettlementVersion,
  getOrCreateDocumentSettlementState,
  getOrCreateAdvanceState,
} from "./settlementState";
import { computeDocumentOutstanding, rebuildInvoicePaidProjection } from "./outstandingBalance";
import {
  applyAccountProjectionDeltas,
  assertJournalBalanced,
  buildScopedFinancialIdempotencyKey,
  collectTxnTables,
  DEFAULT_SETTLEMENT_ACCOUNTS,
  findExistingFinancialReceipt,
  generateNextVoucherNo,
  optionalMoneyPaisa,
  writeAuditLog,
  type FailureInjectionStage,
  type JournalLineDraft,
} from "./postingFramework";
import type {
  MoneyString,
  PaymentType,
  SettlementAllocationInput,
  SettlementCommandSource,
  SettlementInstrumentMeta,
  SettlementPostingResult,
  SettlementPostingSuccessBase,
} from "./types";

export interface PaymentPostingCommand {
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
  payment: {
    paymentType: PaymentType;
    transactionDate: string;
    partyId?: string | null;
    cashOrBankAccountId: string;
    amount: MoneyString;
    bankCharges?: MoneyString | null;
    withholding?: MoneyString | null;
    discount?: MoneyString | null;
    writeoff?: MoneyString | null;
    currency?: string;
    narration?: string;
    instrument?: SettlementInstrumentMeta | null;
    allocations?: SettlementAllocationInput[];
    payableAccountId?: string | null;
    advanceAccountId?: string | null;
    bankChargeAccountId?: string | null;
    withholdingAccountId?: string | null;
    discountAccountId?: string | null;
    writeoffAccountId?: string | null;
  };
  injectFailure?: FailureInjectionStage;
}

export interface PaymentPostingSuccessPayload extends SettlementPostingSuccessBase {
  operation: "post_payment";
  payment_type: PaymentType;
  party_id: string | null;
  settlement_versions: Record<string, number>;
}

export type PaymentPostingResult = SettlementPostingResult<PaymentPostingSuccessPayload>;

function fail(
  type: "posting_denied" | "posting_conflict" | "posting_failed",
  error_code: string,
  safe_message: string,
  opts?: {
    rolled_back?: boolean;
    retryable?: boolean;
    draft_id?: string | null;
    conflict_category?: any;
  },
): PaymentPostingResult {
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

function validateCommand(cmd: PaymentPostingCommand): PaymentPostingResult | null {
  if (!cmd.idempotencyKey?.trim()) {
    return fail("posting_failed", "missing_idempotency_key", "Idempotency key is required.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (!cmd.companyId?.trim()) {
    return fail("posting_failed", "missing_company", "Company is required.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (!cmd.userId?.trim()) {
    return fail("posting_denied", "missing_user", "Authenticated user is required.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  if (cmd.source === "orbix" && cmd.orbixMode !== "accountant") {
    return fail("posting_denied", "mode_restriction", "Posting requires Accountant Mode.", {
      retryable: true,
      draft_id: cmd.draftId,
    });
  }
  if (!isAccountantOrAdmin(cmd.userRole) && cmd.userRole !== "manager") {
    return fail("posting_denied", "permission_denied", "Your role cannot post payments.", {
      retryable: false,
      draft_id: cmd.draftId,
    });
  }
  const p = cmd.payment;
  if (!p?.cashOrBankAccountId?.trim()) {
    return fail("posting_failed", "missing_cash_bank", "Cash/bank account is required.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  try {
    if (!(parseMoneyToPaisa(p.amount) > 0)) {
      return fail("posting_failed", "invalid_amount", "Payment amount must be greater than zero.", {
        draft_id: cmd.draftId,
        retryable: false,
      });
    }
  } catch {
    return fail("posting_failed", "invalid_amount", "Payment amount is invalid.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }
  return null;
}

export async function postPaymentTransaction(
  cmd: PaymentPostingCommand,
): Promise<PaymentPostingResult> {
  const early = validateCommand(cmd);
  if (early) return early;

  const db = getDB();
  const p = cmd.payment;
  const operation = "post_payment" as const;
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
  const currency = p.currency || "NPR";

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
    assertDateInFiscalYear(p.transactionDate, fy);
    await enforcePostingPeriodLock(p.transactionDate, db);
  } catch (e) {
    return fail(
      "posting_failed",
      "period_or_fy",
      e instanceof Error ? e.message : "Date is outside an open posting period.",
      { draft_id: cmd.draftId, retryable: false },
    );
  }

  const cashBank = await db.accounts.get(p.cashOrBankAccountId);
  if (!cashBank) {
    return fail("posting_failed", "cash_bank_not_found", "Cash/bank account was not found.", {
      draft_id: cmd.draftId,
      retryable: false,
    });
  }

  {
    const existingEarly = await findExistingFinancialReceipt(db, scopedKey);
    if (existingEarly?.status === "completed" && existingEarly.result) {
      return {
        type: "posting_completed",
        status: "success",
        payload: {
          ...(existingEarly.result as PaymentPostingSuccessPayload),
          idempotent_replay: true,
        },
      };
    }
  }

  const amountPaisa = parseMoneyToPaisa(p.amount);
  const bankChargesPaisa = optionalMoneyPaisa(p.bankCharges);
  const headerWithholding = optionalMoneyPaisa(p.withholding);
  const headerDiscount = optionalMoneyPaisa(p.discount);
  const headerWriteoff = optionalMoneyPaisa(p.writeoff);
  const allocations = p.allocations || [];
  const syncPolicy = await getCompanySyncPolicy(cmd.companyId);

  try {
    const result = await db.transaction("rw", collectTxnTables(db), async () => {
      const existing = await findExistingFinancialReceipt(db, scopedKey);
      if (existing?.status === "completed" && existing.result) {
        return {
          type: "posting_completed" as const,
          status: "success" as const,
          payload: {
            ...(existing.result as PaymentPostingSuccessPayload),
            idempotent_replay: true,
          },
        };
      }
      if (existing?.status === "processing") {
        throw Object.assign(new Error("Posting already in progress for this confirmation."), {
          code: "in_progress",
        });
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

      let allocPrincipal = 0;
      let allocDiscount = 0;
      let allocWithholding = 0;
      let allocWriteoff = 0;
      const settlementVersions: Record<string, number> = {};
      const allocationIds: string[] = [];
      const preparedAllocs: Array<{
        documentId: string;
        partyId: string | null;
        principal: number;
        discount: number;
        withholding: number;
        writeoff: number;
        nextVersion: number;
      }> = [];

      for (const a of allocations) {
        const outstanding = await computeDocumentOutstanding(db, cmd.companyId, a.document_id);
        if (!outstanding) {
          throw Object.assign(new Error(`Document ${a.document_id} not found.`), {
            code: "document_not_found",
          });
        }
        if (outstanding.document_type !== "purchase-invoice") {
          throw Object.assign(new Error("Payment allocations require purchase invoices."), {
            code: "invalid_document_type",
          });
        }
        if (p.partyId && outstanding.party_id && p.partyId !== outstanding.party_id) {
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
        const discount = optionalMoneyPaisa(a.discount);
        const withholding = optionalMoneyPaisa(a.withholding);
        const writeoff = optionalMoneyPaisa(a.writeoff);
        const totalLine = principal + discount + withholding + writeoff;
        if (totalLine > outstanding.remaining_outstanding_paisa) {
          throw Object.assign(new Error("Allocation exceeds remaining outstanding."), {
            code: "over_allocation",
          });
        }
        const state = await getOrCreateDocumentSettlementState(db, cmd.companyId, a.document_id);
        preparedAllocs.push({
          documentId: a.document_id,
          partyId: outstanding.party_id,
          principal,
          discount,
          withholding,
          writeoff,
          nextVersion: state.settlementVersion + 1,
        });
        allocPrincipal += principal;
        allocDiscount += discount;
        allocWithholding += withholding;
        allocWriteoff += writeoff;
      }

      if (cmd.injectFailure === "before_allocations") {
        throw Object.assign(new Error("Injected failure before allocations."), {
          code: "injected_failure",
        });
      }

      const totalAllocated =
        allocPrincipal + allocDiscount + allocWithholding + allocWriteoff;
      const totalWh = allocWithholding + headerWithholding;
      const totalDisc = allocDiscount + headerDiscount;
      const totalWrite = allocWriteoff + headerWriteoff;

      const payableId = p.payableAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.sundryCreditors;
      const advanceAcct = p.advanceAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.supplierAdvance;
      const bankChargeAcct = p.bankChargeAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.bankCharges;
      const whAcct = p.withholdingAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.tdsPayable;
      const discAcct = p.discountAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.settlementDiscount;
      const writeAcct = p.writeoffAccountId || DEFAULT_SETTLEMENT_ACCOUNTS.writeoff;

      // Dr payable (totalAllocated) + Dr advance (excess) + Dr bank charges
      // Cr cash/bank (amount) + Cr withholding + Cr discount + Cr writeoff
      const effectiveCredit = amountPaisa + totalWh + totalDisc + totalWrite;
      const advanceDebit = Math.max(0, effectiveCredit - totalAllocated);

      const lines: JournalLineDraft[] = [];
      if (totalAllocated > 0) {
        lines.push({
          accountId: payableId,
          debit: paisaToNumber(totalAllocated),
          credit: 0,
          narration: "Supplier payable settlement",
          partyId: p.partyId || undefined,
        });
      }
      if (advanceDebit > 0) {
        lines.push({
          accountId: advanceAcct,
          debit: paisaToNumber(advanceDebit),
          credit: 0,
          narration: "Supplier advance / unapplied",
          partyId: p.partyId || undefined,
        });
      }
      if (bankChargesPaisa > 0) {
        lines.push({
          accountId: bankChargeAcct,
          debit: paisaToNumber(bankChargesPaisa),
          credit: 0,
          narration: "Bank charges",
        });
      }
      lines.push({
        accountId: p.cashOrBankAccountId,
        accountName: (cashBank as any).name,
        debit: 0,
        credit: paisaToNumber(amountPaisa + bankChargesPaisa),
        narration: p.narration || "Payment",
        partyId: p.partyId || undefined,
      });
      if (totalWh > 0) {
        lines.push({
          accountId: whAcct,
          debit: 0,
          credit: paisaToNumber(totalWh),
          narration: "Withholding payable",
          partyId: p.partyId || undefined,
        });
      }
      if (totalDisc > 0) {
        lines.push({
          accountId: discAcct,
          debit: 0,
          credit: paisaToNumber(totalDisc),
          narration: "Settlement discount",
          partyId: p.partyId || undefined,
        });
      }
      if (totalWrite > 0) {
        lines.push({
          accountId: writeAcct,
          debit: 0,
          credit: paisaToNumber(totalWrite),
          narration: "Write-off",
          partyId: p.partyId || undefined,
        });
      }

      assertJournalBalanced(lines);
      await applyAccountProjectionDeltas(db, lines);

      const voucherId = generateId();
      let voucherNo = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        voucherNo = await generateNextVoucherNo("payment", db);
        const clash = await db.vouchers.where("voucherNo").equals(voucherNo).first();
        if (!clash) break;
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
      await db.vouchers.put({
        id: voucherId,
        voucherNo,
        date: p.transactionDate,
        type: "payment",
        status: "posted",
        narration: p.narration || "Payment",
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
          partyId: l.partyId,
        })),
        partyId: p.partyId || undefined,
        chequeNo: p.instrument?.instrument_no || undefined,
        chequeDate: p.instrument?.instrument_date || undefined,
        bankName: p.instrument?.bank_name || undefined,
        referenceNo: p.instrument?.reference_no || undefined,
        paymentMode: p.instrument?.instrument_type || undefined,
        createdBy: cmd.userId,
        createdAt: now,
        companyId: cmd.companyId,
      } as any);

      const allocTable = (db as any).settlementAllocations;
      for (const prep of preparedAllocs) {
        const components: Array<{ component: string; paisa: number }> = [
          { component: "principal", paisa: prep.principal },
          { component: "discount", paisa: prep.discount },
          { component: "withholding", paisa: prep.withholding },
          { component: "writeoff", paisa: prep.writeoff },
        ];
        for (const c of components) {
          if (!(c.paisa > 0)) continue;
          const id = generateId();
          allocationIds.push(id);
          if (allocTable) {
            await allocTable.put({
              id,
              companyId: cmd.companyId,
              voucherId,
              voucherType: "payment",
              targetDocumentId: prep.documentId,
              partyId: prep.partyId,
              component: c.component,
              amount: paisaToString(c.paisa),
              amountPaisa: c.paisa,
              currency,
              status: "posted",
              createdAt: now,
              source: cmd.source,
            });
          }
        }
        await bumpDocumentSettlementVersion(
          db,
          cmd.companyId,
          prep.documentId,
          prep.nextVersion,
          now,
        );
        settlementVersions[prep.documentId] = prep.nextVersion;
        await rebuildInvoicePaidProjection(db, prep.documentId);
      }

      const advanceIds: string[] = [];
      if (advanceDebit > 0 && p.partyId) {
        const advanceId = generateId();
        advanceIds.push(advanceId);
        await getOrCreateAdvanceState(db, {
          advanceId,
          companyId: cmd.companyId,
          partyId: p.partyId,
          side: "supplier",
          remainingPaisa: advanceDebit,
          currency,
          sourceVoucherId: voucherId,
        });
        const unapplied = (db as any).unappliedBalances;
        if (unapplied) {
          await unapplied.put({
            id: generateId(),
            companyId: cmd.companyId,
            partyId: p.partyId,
            classification:
              p.paymentType === "unapplied_supplier_payment"
                ? "unapplied_supplier_payment"
                : "supplier_advance",
            amount: paisaToString(advanceDebit),
            amountPaisa: advanceDebit,
            currency,
            sourceVoucherId: voucherId,
            advanceId,
            status: "open",
            createdAt: now,
          });
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
        action: "PAYMENT_POSTED",
        entityType: "voucher",
        entityId: voucherId,
        companyId: cmd.companyId,
        sessionId: cmd.conversationId,
        after: {
          voucherNo,
          amount: paisaToString(amountPaisa),
          paymentType: p.paymentType,
          partyId: p.partyId,
          allocationIds,
          advanceIds,
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
            eventType: "payment_posted",
            payload: {
              posting_id: postingId,
              voucher_id: voucherId,
              voucher_number: voucherNo,
              voucher_type: "payment",
              transaction_date: p.transactionDate,
              party_id: p.partyId || null,
              payment_type: p.paymentType,
              cash_or_bank_account_id: p.cashOrBankAccountId,
              amounts: {
                amount: paisaToString(amountPaisa),
                bank_charges: paisaToString(bankChargesPaisa),
                withholding: paisaToString(totalWh),
                discount: paisaToString(totalDisc),
                writeoff: paisaToString(totalWrite),
                advance: paisaToString(advanceDebit),
              },
              journal_lines: lines as unknown as Array<Record<string, unknown>>,
              allocations: preparedAllocs.map((x) => ({
                document_id: x.documentId,
                principal: paisaToString(x.principal),
                discount: paisaToString(x.discount),
                withholding: paisaToString(x.withholding),
                writeoff: paisaToString(x.writeoff),
                expected_settlement_version: x.nextVersion - 1,
                adjustment_version_before: x.nextVersion - 1,
              })),
              advance_ids: advanceIds,
              instrument: (p.instrument as Record<string, unknown> | null | undefined) || null,
              settlement_versions: settlementVersions,
              audit_id: auditId,
              currency,
              financial_year_id: cmd.financialYearId ?? null,
              local_idempotency_key: cmd.idempotencyKey,
              source: cmd.source,
              receipt_id: receiptId,
              narration: p.narration,
              aggregate_version: Object.values(settlementVersions)[0] ?? 1,
            },
          });

      const successPayload: PaymentPostingSuccessPayload = {
        posting_id: postingId,
        voucher_id: voucherId,
        voucher_number: voucherNo,
        voucher_type: "payment",
        amount: paisaToString(amountPaisa),
        currency,
        posted_at: now,
        idempotent_replay: false,
        sync_status: syncEnqueue.syncStatus === "disabled" ? "disabled" : "pending",
        sync_event_id: syncEnqueue.eventId,
        draft_id: cmd.draftId ?? null,
        audit_id: auditId,
        receipt_id: receiptId,
        allocation_ids: allocationIds,
        advance_ids: advanceIds,
        operation,
        payment_type: p.paymentType,
        party_id: p.partyId || null,
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
        const invoices = await db.invoices.toArray();
        storeBridge.setState({
          vouchers: vouchers.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          accounts,
          invoices: invoices.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        });
      }

      return {
        type: "posting_completed" as const,
        status: "success" as const,
        payload: successPayload,
      };
    });

    if (
      result.type === "posting_completed" &&
      result.payload.sync_status === "pending" &&
      typeof navigator !== "undefined" &&
      navigator.onLine
    ) {
      void import("@/platform/sync/syncCoordinator")
        .then((m) => m.runEventSyncCycle())
        .catch(() => {});
    }

    return result;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (
      code === "in_progress" ||
      code === "stale_settlement_version" ||
      code === "over_allocation" ||
      code === "party_mismatch"
    ) {
      return fail("posting_conflict", code, (e as Error).message, {
        rolled_back: true,
        retryable: true,
        draft_id: cmd.draftId,
        conflict_category: code,
      });
    }
    if (code === "injected_failure") {
      return fail("posting_failed", "injected_failure", (e as Error).message, {
        rolled_back: true,
        retryable: true,
        draft_id: cmd.draftId,
      });
    }
    return fail(
      "posting_failed",
      "posting_exception",
      e instanceof Error ? e.message : "Payment posting failed",
      { rolled_back: true, retryable: true, draft_id: cmd.draftId },
    );
  }
}