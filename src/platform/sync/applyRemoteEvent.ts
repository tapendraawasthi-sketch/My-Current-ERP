/**
 * Deterministic application of remote sync envelopes into Dexie.
 * Never re-enqueues business outbound events for remote_sync origin.
 * Device B applies authoritative event facts — does not recalculate VAT or cost.
 */

import { getDB, generateId } from "@/lib/db";
import {
  verifyAccountingEnvelopeIntegrity,
  isSalesAdjustmentEventType,
  isPurchaseAdjustmentEventType,
  isFinancialEventType,
  isBankReconciliationEventType,
  isSettlementFinancialEventType,
  isSupportedAccountingEventType,
} from "./accountingSyncContract";
import type { SyncEventEnvelope } from "./syncServerContracts";
import { getOrCreateDeviceId } from "./vectorClock";
import type { DBEventSyncQueueRow } from "./syncQueue";
import { rebuildInvoicePaidProjection } from "@/domains/settlement/outstandingBalance";

export type ApplyResult =
  | { status: "applied" }
  | { status: "duplicate" }
  | { status: "same_origin_ack" }
  | { status: "conflict"; code: string }
  | { status: "rejected"; code: string };

function extractBusiness(
  payload: Record<string, unknown>,
  eventType: string,
): Record<string, unknown> {
  if (isBankReconciliationEventType(eventType)) {
    return (payload.treasury ??
      payload.financial ??
      payload.settlement ??
      payload) as Record<string, unknown>;
  }
  if (isFinancialEventType(eventType)) {
    return (payload.financial ??
      payload.settlement ??
      payload) as Record<string, unknown>;
  }
  if (isPurchaseAdjustmentEventType(eventType)) {
    return (payload.purchase_adjustment ??
      payload.purchase ??
      payload.sale ??
      payload) as Record<string, unknown>;
  }
  if (isSalesAdjustmentEventType(eventType)) {
    return (payload.sale_adjustment ??
      payload.sale ??
      payload.purchase ??
      payload) as Record<string, unknown>;
  }
  if (eventType === "sales_posted") {
    return (payload.sale ?? payload.purchase ?? payload) as Record<string, unknown>;
  }
  return (payload.purchase ?? payload.sale ?? payload) as Record<string, unknown>;
}

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function resolveInvoiceType(eventType: string): string {
  if (eventType === "sales_return_posted") return "sales-return";
  if (eventType === "sales_credit_note_posted") return "credit-note";
  if (eventType === "sales_posted") return "sales-invoice";
  if (eventType === "purchase_return_posted") return "purchase-return";
  if (eventType === "supplier_debit_note_posted") return "debit-note";
  return "purchase-invoice";
}

function resolveFinancialVoucherType(eventType: string, business: Record<string, unknown>): string {
  if (business.voucher_type) return String(business.voucher_type);
  if (eventType === "receipt_posted") return "receipt";
  if (eventType === "payment_posted") return "payment";
  if (eventType === "contra_posted") return "contra";
  if (eventType === "journal_posted") return "journal";
  return "journal";
}

/**
 * Facts-only apply for Phase 9 financial / settlement events.
 * Never recalculates withholding / discount / allocations; never enqueues outbound.
 */
async function applyFinancialRemoteEnvelope(
  envelope: SyncEventEnvelope & { deviceId?: string; companyId?: string; remoteSequence?: number },
): Promise<ApplyResult> {
  const db = getDB();
  const payload = envelope.payload as Record<string, unknown>;
  const business = extractBusiness(payload, envelope.eventType);
  const localDevice = getOrCreateDeviceId();
  const remoteDevice = String(payload.device_id ?? envelope.deviceId ?? "");
  const companyId = String(
    business.company_id ?? payload.company_id ?? envelope.companyId ?? "",
  );
  const voucherId = String(business.voucher_id ?? envelope.aggregateId);
  const now = new Date().toISOString();

  if (remoteDevice && remoteDevice === localDevice) {
    const queueRow = (await db.eventSyncQueue.get(envelope.eventId)) as
      | DBEventSyncQueueRow
      | undefined;
    if (queueRow && queueRow.status !== "synced") {
      await db.eventSyncQueue.update(envelope.eventId, {
        status: "synced",
        syncedAt: now,
        remoteEventId: envelope.eventId,
        remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
        acknowledgedAt: now,
      });
    }
    return { status: "same_origin_ack" };
  }

  const appliedMarker = await db.eventSyncQueue.get(`applied:${envelope.eventId}`);
  if (appliedMarker) {
    return { status: "duplicate" };
  }

  const txnTables = [
    db.vouchers,
    db.accounts,
    db.auditLogs,
    db.eventSyncQueue,
    db.invoices,
  ];
  if (db.tables.some((t) => t.name === "settlementAllocations") && db.settlementAllocations) {
    txnTables.push(db.settlementAllocations);
  }
  if (db.tables.some((t) => t.name === "documentSettlementState") && db.documentSettlementState) {
    txnTables.push(db.documentSettlementState);
  }
  if (db.tables.some((t) => t.name === "partyAdvances") && db.partyAdvances) {
    txnTables.push(db.partyAdvances);
  }
  if (db.tables.some((t) => t.name === "unappliedBalances") && db.unappliedBalances) {
    txnTables.push(db.unappliedBalances);
  }

  return db.transaction("rw", txnTables.filter(Boolean), async () => {
    const existingVoucher = await db.vouchers.get(voucherId);
    if (existingVoucher) {
      return { status: "duplicate" as const };
    }

    const settlementVersions =
      (business.settlement_versions as Record<string, number> | undefined) || {};
    const allocations = (business.allocations as Array<Record<string, unknown>>) || [];

    // Settlement version conflict: local ahead of payload facts / expected
    for (const [docId, afterVersionRaw] of Object.entries(settlementVersions)) {
      const afterVersion = asNumber(afterVersionRaw);
      const local =
        db.documentSettlementState &&
        (await db.documentSettlementState.get(docId));
      const localVersion = asNumber(
        (local as { settlementVersion?: number } | undefined)?.settlementVersion,
      );
      if (localVersion > afterVersion) {
        await db.eventSyncConflicts?.put?.({
          id: generateId(),
          eventId: envelope.eventId,
          classification: "stale_settlement_version",
          createdAt: now,
          details: { documentId: docId, localVersion, remoteVersion: afterVersion },
        });
        return { status: "conflict" as const, code: "stale_settlement_version" };
      }
    }
    for (const alloc of allocations) {
      const docId = String(alloc.document_id ?? alloc.targetDocumentId ?? "");
      if (!docId) continue;
      const expected =
        alloc.expected_settlement_version ??
        alloc.adjustment_version_before ??
        (settlementVersions[docId] != null
          ? asNumber(settlementVersions[docId]) - 1
          : null);
      if (expected == null) continue;
      const local =
        db.documentSettlementState &&
        (await db.documentSettlementState.get(docId));
      const localVersion = asNumber(
        (local as { settlementVersion?: number } | undefined)?.settlementVersion,
      );
      if (localVersion !== asNumber(expected) && localVersion > asNumber(expected)) {
        await db.eventSyncConflicts?.put?.({
          id: generateId(),
          eventId: envelope.eventId,
          classification: "stale_settlement_version",
          createdAt: now,
          details: {
            documentId: docId,
            localVersion,
            expected: asNumber(expected),
          },
        });
        return { status: "conflict" as const, code: "stale_settlement_version" };
      }
    }

    const journalLines = (business.journal_lines as Array<Record<string, unknown>>) || [];
    if (journalLines.length) {
      const debits = journalLines.reduce((s, l) => s + asNumber(l.debit), 0);
      const credits = journalLines.reduce((s, l) => s + asNumber(l.credit), 0);
      if (Math.abs(debits - credits) > 0.01) {
        return { status: "rejected" as const, code: "unbalanced_journal" };
      }
    }

    const amounts = (business.amounts as Record<string, unknown>) || {};
    const amount = asNumber(amounts.amount ?? business.amount);
    const voucherType = resolveFinancialVoucherType(envelope.eventType, business);

    await db.vouchers.put({
      id: voucherId,
      voucherNo: String(business.voucher_number ?? ""),
      date: String(business.transaction_date ?? now.slice(0, 10)),
      type: voucherType,
      status: "posted",
      narration: String(business.narration || "Remote financial sync"),
      totalDebit: amount || journalLines.reduce((s, l) => s + asNumber(l.debit), 0),
      totalCredit: amount || journalLines.reduce((s, l) => s + asNumber(l.credit), 0),
      grandTotal: amount,
      lines: journalLines.map((l, i) => ({
        id: `vl-${voucherId}-${i}`,
        accountId: String(l.accountId ?? l.account_id ?? ""),
        accountName: String(l.accountName ?? l.account_name ?? ""),
        debit: asNumber(l.debit),
        credit: asNumber(l.credit),
        narration: l.narration ? String(l.narration) : undefined,
        partyId: l.partyId ? String(l.partyId) : l.party_id ? String(l.party_id) : undefined,
      })),
      partyId: business.party_id ? String(business.party_id) : undefined,
      createdBy: String(business.user_id || "remote"),
      companyId,
      syncOrigin: "remote_sync",
    } as any);

    // Write allocation facts as given — do not recalculate components
    const touchedDocs = new Set<string>();
    if (db.settlementAllocations) {
      for (const alloc of allocations) {
        const docId = String(alloc.document_id ?? alloc.targetDocumentId ?? "");
        if (!docId) continue;
        touchedDocs.add(docId);
        if (alloc.id && alloc.component) {
          await db.settlementAllocations.put({
            ...alloc,
            id: String(alloc.id),
            companyId: String(alloc.companyId ?? companyId),
            voucherId: String(alloc.voucherId ?? voucherId),
            voucherType: String(alloc.voucherType ?? voucherType),
            targetDocumentId: docId,
            status: String(alloc.status || "posted"),
            source: "remote_sync",
            syncOrigin: "remote_sync",
          } as any);
          continue;
        }
        const components: Array<{ component: string; amount: unknown }> = [
          { component: "principal", amount: alloc.principal ?? alloc.amount },
          { component: "discount", amount: alloc.discount },
          { component: "withholding", amount: alloc.withholding },
          { component: "writeoff", amount: alloc.writeoff },
        ];
        for (const c of components) {
          const amt = asNumber(c.amount);
          if (!(amt > 0)) continue;
          await db.settlementAllocations.put({
            id: generateId(),
            companyId,
            voucherId,
            voucherType,
            targetDocumentId: docId,
            partyId: business.party_id ? String(business.party_id) : null,
            component: c.component,
            amount: String(Number(c.amount).toFixed?.(2) ?? amt),
            amountPaisa: Math.round(amt * 100),
            currency: String(business.currency || "NPR"),
            status: "posted",
            createdAt: now,
            source: "remote_sync",
            syncOrigin: "remote_sync",
          } as any);
        }
      }
    }

    // Write settlement versions as given
    if (db.documentSettlementState) {
      for (const [docId, version] of Object.entries(settlementVersions)) {
        await db.documentSettlementState.put({
          id: docId,
          companyId,
          settlementVersion: asNumber(version),
          updatedAt: now,
          syncOrigin: "remote_sync",
        } as any);
        touchedDocs.add(docId);
      }
    }

    // Write partyAdvances as given
    const partyAdvances = (business.party_advances as Array<Record<string, unknown>>) || [];
    if (db.partyAdvances && partyAdvances.length) {
      for (const adv of partyAdvances) {
        await db.partyAdvances.put({
          ...adv,
          id: String(adv.id ?? generateId()),
          companyId: String(adv.companyId ?? companyId),
          syncOrigin: "remote_sync",
        } as any);
      }
    } else if (db.partyAdvances) {
      const advanceIds = (business.advance_ids as string[]) || [];
      const advanceAmt = asNumber(amounts.advance);
      if (advanceIds.length && advanceAmt > 0 && business.party_id) {
        for (const advanceId of advanceIds) {
          await db.partyAdvances.put({
            id: advanceId,
            companyId,
            partyId: String(business.party_id),
            side:
              voucherType === "payment" || envelope.eventType === "payment_posted"
                ? "supplier"
                : "customer",
            remainingAmount: String(advanceAmt.toFixed(2)),
            remainingPaisa: Math.round(advanceAmt * 100),
            currency: String(business.currency || "NPR"),
            advanceVersion: 1,
            status: "open",
            sourceVoucherId: voucherId,
            updatedAt: now,
            createdAt: now,
            syncOrigin: "remote_sync",
          } as any);
        }
      }
    }

    // Projection only from written allocation facts (not a re-settlement calc)
    for (const docId of touchedDocs) {
      await rebuildInvoicePaidProjection(db, docId);
    }

    await db.auditLogs.add({
      id: generateId(),
      timestamp: now,
      userId: "remote_sync",
      userName: "Remote Sync",
      action: `REMOTE_${String(envelope.eventType).toUpperCase()}_APPLIED`,
      module: "sync",
      entityType: "voucher",
      entityId: voucherId,
      companyId,
      after: {
        eventId: envelope.eventId,
        remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
        origin: "remote_sync",
        eventType: envelope.eventType,
      },
    } as any);

    await db.eventSyncQueue.put({
      id: `applied:${envelope.eventId}`,
      eventId: envelope.eventId,
      globalSequence: envelope.globalSequence,
      tenantId: String(envelope.tenantId),
      companyId,
      status: "synced",
      syncAttempts: 0,
      createdAt: now,
      syncedAt: now,
      origin: "remote_sync",
      remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
      acknowledgedAt: now,
    } satisfies DBEventSyncQueueRow);

    return { status: "applied" as const };
  });
}

/**
 * Facts-only apply for Phase 10 bank reconciliation events.
 * Never rematches statement lines; never enqueues outbound.
 */
async function applyBankReconciliationRemoteEnvelope(
  envelope: SyncEventEnvelope & { deviceId?: string; companyId?: string; remoteSequence?: number },
): Promise<ApplyResult> {
  const db = getDB();
  const payload = envelope.payload as Record<string, unknown>;
  const business = extractBusiness(payload, envelope.eventType);
  const localDevice = getOrCreateDeviceId();
  const remoteDevice = String(payload.device_id ?? envelope.deviceId ?? "");
  const companyId = String(
    business.company_id ?? payload.company_id ?? envelope.companyId ?? "",
  );
  const now = new Date().toISOString();
  const aggregateId = String(
    business.link_id ??
      business.session_id ??
      business.batch_id ??
      business.cheque_id ??
      business.statement_line_id ??
      business.voucher_id ??
      envelope.aggregateId,
  );

  if (remoteDevice && remoteDevice === localDevice) {
    const queueRow = (await db.eventSyncQueue.get(envelope.eventId)) as
      | DBEventSyncQueueRow
      | undefined;
    if (queueRow && queueRow.status !== "synced") {
      await db.eventSyncQueue.update(envelope.eventId, {
        status: "synced",
        syncedAt: now,
        remoteEventId: envelope.eventId,
        remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
        acknowledgedAt: now,
      });
    }
    return { status: "same_origin_ack" };
  }

  const txnTables = [
    (db as any).bankAccounts,
    (db as any).bankStatementBatches,
    (db as any).bankStatementLines,
    (db as any).bankReconciliationLinks,
    (db as any).bankReconciliationSessions,
    (db as any).chequeInstruments,
    db.auditLogs,
    db.eventSyncQueue,
    db.orbixPostingReceipts,
  ].filter(Boolean);

  return db.transaction("rw", txnTables, async () => {
    const existingApplied = await db.eventSyncQueue.get(`applied:${envelope.eventId}`);
    if (existingApplied) {
      return { status: "duplicate" as const };
    }

    // Facts-only: record audit + applied cursor. Do not rematch or recompute suggestions.
    await db.auditLogs.add({
      id: generateId(),
      timestamp: now,
      userId: String(business.user_id ?? envelope.principalId ?? "remote"),
      userName: "remote_sync",
      action: `REMOTE_${String(envelope.eventType).toUpperCase()}`,
      module: "treasury",
      entityType: "bank_reconciliation",
      entityId: aggregateId,
      recordId: aggregateId,
      recordType: "bank_reconciliation",
      companyId,
      after: {
        eventId: envelope.eventId,
        remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
        origin: "remote_sync",
        eventType: envelope.eventType,
        facts: {
          bank_account_id: business.bank_account_id,
          statement_line_id: business.statement_line_id,
          link_id: business.link_id,
          session_id: business.session_id,
          batch_id: business.batch_id,
          cheque_id: business.cheque_id,
          statement_line_version: business.statement_line_version,
          cheque_version: business.cheque_version,
          session_version: business.session_version,
        },
      },
    } as any);

    // Facts-only projections: upsert missing rows from payload; never rematch; never enqueue.
    const bankAccountId = String(business.bank_account_id || "");
    const currency = String(business.currency || "NPR");
    const statementLineId = business.statement_line_id
      ? String(business.statement_line_id)
      : "";
    const lineFacts = Array.isArray(business.statement_lines)
      ? (business.statement_lines as Record<string, unknown>[])
      : [];

    const upsertStatementLineFact = async (
      fact: Record<string, unknown>,
      opts?: {
        forceMatched?: boolean;
        forceUnmatched?: boolean;
        versionOverride?: number;
      },
    ) => {
      if (!(db as any).bankStatementLines) return;
      const lineId = String(fact.id || fact.statement_line_id || "");
      if (!lineId) return;
      const existing = await (db as any).bankStatementLines.get(lineId);
      const remoteVer = Number(
        opts?.versionOverride ??
          fact.reconciliation_version ??
          business.statement_line_version ??
          existing?.reconciliationVersion ??
          1,
      );
      if (existing && remoteVer < Number(existing.reconciliationVersion || 0)) return;

      let status = String(fact.status || existing?.status || "unmatched");
      let remaining = Number(
        fact.remaining_match_paisa ??
          existing?.remainingMatchPaisa ??
          Math.abs(Number(fact.signed_amount_paisa ?? 0)),
      );
      if (opts?.forceMatched) {
        status = "matched";
        remaining = 0;
      }
      if (opts?.forceUnmatched) {
        status = "unmatched";
      }

      const row = {
        id: lineId,
        batchId: String(fact.batch_id || business.batch_id || existing?.batchId || ""),
        bankAccountId: String(
          fact.bank_account_id || bankAccountId || existing?.bankAccountId || "",
        ),
        companyId: companyId || existing?.companyId || "",
        lineNumber: Number(fact.line_number ?? existing?.lineNumber ?? 0),
        transactionDate: String(
          fact.transaction_date || existing?.transactionDate || now.slice(0, 10),
        ),
        valueDate: fact.value_date ?? existing?.valueDate ?? null,
        description: String(fact.description ?? existing?.description ?? ""),
        reference: fact.reference ?? existing?.reference ?? null,
        bankTransactionId: fact.bank_transaction_id ?? existing?.bankTransactionId ?? null,
        debitPaisa: Number(fact.debit_paisa ?? existing?.debitPaisa ?? 0),
        creditPaisa: Number(fact.credit_paisa ?? existing?.creditPaisa ?? 0),
        signedAmountPaisa: Number(
          fact.signed_amount_paisa ?? existing?.signedAmountPaisa ?? 0,
        ),
        balancePaisa:
          fact.balance_paisa != null
            ? Number(fact.balance_paisa)
            : (existing?.balancePaisa ?? null),
        status,
        remainingMatchPaisa: remaining,
        reconciliationVersion: remoteVer,
        rawHash: String(fact.raw_hash || existing?.rawHash || lineId),
        currency: String(fact.currency || existing?.currency || currency),
      };
      await (db as any).bankStatementLines.put(row);
    };

    if (envelope.eventType === "bank_statement_imported") {
      const batchId = business.batch_id ? String(business.batch_id) : "";
      if (batchId && (db as any).bankStatementBatches) {
        const existingBatch = await (db as any).bankStatementBatches.get(batchId);
        await (db as any).bankStatementBatches.put({
          id: batchId,
          companyId,
          bankAccountId: bankAccountId || existingBatch?.bankAccountId || "",
          sourceType: existingBatch?.sourceType || "remote_sync",
          sourceHash: String(business.source_hash || existingBatch?.sourceHash || batchId),
          status: existingBatch?.status === "superseded" ? "superseded" : "imported",
          periodStart: existingBatch?.periodStart || now.slice(0, 10),
          periodEnd: existingBatch?.periodEnd || now.slice(0, 10),
          currency: existingBatch?.currency || currency,
          openingBalancePaisa: existingBatch?.openingBalancePaisa ?? null,
          closingBalancePaisa: existingBatch?.closingBalancePaisa ?? null,
          lineCount: lineFacts.length || existingBatch?.lineCount || 0,
          importedAt: existingBatch?.importedAt || now,
          supersededByBatchId: existingBatch?.supersededByBatchId ?? null,
          createdBy: String(business.user_id || existingBatch?.createdBy || "remote_sync"),
          version: Number(business.aggregate_version ?? existingBatch?.version ?? 1),
        });
      }
      for (const fact of lineFacts) {
        await upsertStatementLineFact({
          ...fact,
          batch_id: batchId || fact.batch_id,
          bank_account_id: bankAccountId,
        });
      }
    }

    if (
      envelope.eventType === "bank_reconciliation_matched" ||
      envelope.eventType === "bank_adjustment_linked"
    ) {
      for (const fact of lineFacts) {
        await upsertStatementLineFact(fact, {
          forceMatched: true,
          versionOverride:
            Number(fact.reconciliation_version ?? business.statement_line_version ?? 0) ||
            undefined,
        });
      }
      if (statementLineId) {
        const existingLine = await (db as any).bankStatementLines?.get(statementLineId);
        if (existingLine) {
          await upsertStatementLineFact(
            {
              id: statementLineId,
              reconciliation_version: business.statement_line_version,
            },
            {
              forceMatched: true,
              versionOverride: Number(business.statement_line_version ?? 0) || undefined,
            },
          );
        } else if (lineFacts.length === 0) {
          await upsertStatementLineFact(
            {
              id: statementLineId,
              batch_id: business.batch_id,
              bank_account_id: bankAccountId,
              line_number: 0,
              description: "remote_sync",
              signed_amount_paisa: 0,
              debit_paisa: 0,
              credit_paisa: 0,
              raw_hash: statementLineId,
              reconciliation_version: business.statement_line_version ?? 1,
            },
            { forceMatched: true },
          );
        }
      }
    }

    if (envelope.eventType === "bank_reconciliation_unmatched" && statementLineId) {
      await upsertStatementLineFact(
        { id: statementLineId, reconciliation_version: business.statement_line_version },
        {
          forceUnmatched: true,
          versionOverride: Number(business.statement_line_version ?? 0) || undefined,
        },
      );
    }

    const linkId = business.link_id ? String(business.link_id) : "";
    if (
      linkId &&
      (db as any).bankReconciliationLinks &&
      (envelope.eventType === "bank_reconciliation_matched" ||
        envelope.eventType === "bank_adjustment_linked")
    ) {
      const amounts = (business.amounts || {}) as {
        matched_amount?: string;
        amount?: string;
      };
      const matchedPaisa = Math.round(
        Number(String(amounts.matched_amount || amounts.amount || "0").replace(/,/g, "")) * 100,
      );
      const existingLink = await (db as any).bankReconciliationLinks.get(linkId);
      const erpIds = Array.isArray(business.erp_document_ids)
        ? (business.erp_document_ids as unknown[]).map(String)
        : existingLink?.erpDocumentIds || [];
      await (db as any).bankReconciliationLinks.put({
        id: linkId,
        companyId,
        bankAccountId: bankAccountId || existingLink?.bankAccountId || "",
        sessionId: business.session_id
          ? String(business.session_id)
          : (existingLink?.sessionId ?? null),
        statementLineId: statementLineId || existingLink?.statementLineId || "",
        erpDocumentIds: erpIds,
        matchedAmountPaisa: matchedPaisa || existingLink?.matchedAmountPaisa || 0,
        matchType: business.match_type || existingLink?.matchType || "one_to_one",
        matchMethod: existingLink?.matchMethod || "manual_confirm",
        status: "confirmed",
        version: Number(business.aggregate_version ?? existingLink?.version ?? 1),
        confidence: existingLink?.confidence ?? null,
        explanation: existingLink?.explanation ?? null,
        confirmedAt: now,
        createdAt: existingLink?.createdAt || now,
        createdBy: String(business.user_id || "remote_sync"),
      });
    }
    if (
      linkId &&
      (db as any).bankReconciliationLinks &&
      envelope.eventType === "bank_reconciliation_unmatched"
    ) {
      const existingLink = await (db as any).bankReconciliationLinks.get(linkId);
      if (existingLink) {
        await (db as any).bankReconciliationLinks.update(linkId, {
          status: "reversed",
          version: Number(business.aggregate_version ?? existingLink.version ?? 1),
        });
      }
    }

    const chequeId = business.cheque_id ? String(business.cheque_id) : "";
    if (chequeId && (db as any).chequeInstruments) {
      const chq = await (db as any).chequeInstruments.get(chequeId);
      const remoteVer = Number(
        business.cheque_version ??
          (business as { instrument_version?: number }).instrument_version ??
          0,
      );
      const nextStatus = String(
        business.cheque_status_to ||
          (business as { next_status?: string }).next_status ||
          chq?.status ||
          "",
      );
      const amountPaisa = Number(
        business.amount_paisa ??
          Math.round(
            Number(
              String(
                ((business.amounts || {}) as { amount?: string }).amount || "0",
              ).replace(/,/g, ""),
            ) * 100,
          ),
      );
      if (!chq && nextStatus) {
        await (db as any).chequeInstruments.put({
          id: chequeId,
          companyId,
          bankAccountId: bankAccountId || "",
          partyId: business.party_id != null ? String(business.party_id) : null,
          instrumentType: String(business.instrument_type || "received"),
          instrumentNumber: String(business.instrument_number || chequeId),
          status: nextStatus,
          instrumentVersion: remoteVer || 1,
          amountPaisa: amountPaisa || 0,
          currency,
          chequeDate: String(business.cheque_date || now.slice(0, 10)),
          sourceVoucherId: business.voucher_id ? String(business.voucher_id) : null,
          bounceVoucherId: null,
          clearedStatementLineId: statementLineId || null,
          createdAt: now,
          updatedAt: now,
        });
      } else if (chq && remoteVer >= Number(chq.instrumentVersion || 0) && nextStatus) {
        await (db as any).chequeInstruments.put({
          ...chq,
          instrumentVersion: remoteVer,
          status: nextStatus,
          clearedStatementLineId: statementLineId || chq.clearedStatementLineId || null,
          updatedAt: now,
        });
      }
    }

    const sessionId = business.session_id ? String(business.session_id) : "";
    if (sessionId && (db as any).bankReconciliationSessions) {
      const sess = await (db as any).bankReconciliationSessions.get(sessionId);
      const remoteVer = Number(business.session_version ?? 0);
      if (sess && remoteVer > Number(sess.version || 0)) {
        const status =
          envelope.eventType === "bank_reconciliation_closed"
            ? "closed"
            : envelope.eventType === "bank_reconciliation_reopened"
              ? "reopened"
              : sess.status;
        await (db as any).bankReconciliationSessions.update(sessionId, {
          version: remoteVer,
          status,
        });
      }
    }

    await db.eventSyncQueue.put({
      id: `applied:${envelope.eventId}`,
      eventId: envelope.eventId,
      globalSequence: envelope.globalSequence,
      tenantId: String(envelope.tenantId),
      companyId,
      status: "synced",
      syncAttempts: 0,
      createdAt: now,
      syncedAt: now,
      origin: "remote_sync",
      remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
      acknowledgedAt: now,
    } satisfies DBEventSyncQueueRow);

    return { status: "applied" as const };
  });
}

export async function applyRemoteSyncEnvelope(
  envelope: SyncEventEnvelope & { deviceId?: string; companyId?: string; remoteSequence?: number },
): Promise<ApplyResult> {
  const integrity = await verifyAccountingEnvelopeIntegrity(envelope);
  if (integrity.ok === false) {
    return { status: "rejected", code: integrity.code };
  }

  if (!isSupportedAccountingEventType(envelope.eventType)) {
    return { status: "rejected", code: "unsupported_event_version" };
  }

  if (isBankReconciliationEventType(envelope.eventType)) {
    return applyBankReconciliationRemoteEnvelope(envelope);
  }

  if (isSettlementFinancialEventType(envelope.eventType) || isFinancialEventType(envelope.eventType)) {
    return applyFinancialRemoteEnvelope(envelope);
  }

  const isSalesAdj = isSalesAdjustmentEventType(envelope.eventType);
  const isPurchaseAdj = isPurchaseAdjustmentEventType(envelope.eventType);
  const isAdjustment = isSalesAdj || isPurchaseAdj;
  const isSale = envelope.eventType === "sales_posted" || isSalesAdj;
  const isInventoryReturn = envelope.eventType === "sales_return_posted";
  const isPurchaseReturn = envelope.eventType === "purchase_return_posted";
  const isSupplierDebitNote = envelope.eventType === "supplier_debit_note_posted";
  /** These carry historical VAT / taxable totals in the payload (unlike a plain purchase). */
  const carriesVat = isSale || isPurchaseAdj;
  const invoiceType = resolveInvoiceType(envelope.eventType);
  const voucherType = isSale ? "sales" : "purchase";
  const auditAction = isInventoryReturn
    ? "REMOTE_SALES_RETURN_APPLIED"
    : envelope.eventType === "sales_credit_note_posted"
      ? "REMOTE_SALES_CREDIT_NOTE_APPLIED"
      : isPurchaseReturn
        ? "REMOTE_PURCHASE_RETURN_APPLIED"
        : isSupplierDebitNote
          ? "REMOTE_SUPPLIER_DEBIT_NOTE_APPLIED"
          : isSale
            ? "REMOTE_SALES_APPLIED"
            : "REMOTE_PURCHASE_APPLIED";

  const db = getDB();
  const payload = envelope.payload as Record<string, unknown>;
  const business = extractBusiness(payload, envelope.eventType);
  const localDevice = getOrCreateDeviceId();
  const remoteDevice = String(payload.device_id ?? envelope.deviceId ?? "");
  const companyId = String(payload.company_id ?? envelope.companyId ?? "");
  const invoiceId = String(business.invoice_id ?? envelope.aggregateId);

  if (remoteDevice && remoteDevice === localDevice) {
    const queueRow = (await db.eventSyncQueue.get(envelope.eventId)) as
      | DBEventSyncQueueRow
      | undefined;
    if (queueRow && queueRow.status !== "synced") {
      await db.eventSyncQueue.update(envelope.eventId, {
        status: "synced",
        syncedAt: new Date().toISOString(),
        remoteEventId: envelope.eventId,
        remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
        acknowledgedAt: new Date().toISOString(),
      });
    }
    return { status: "same_origin_ack" };
  }

  const txnTables = [
    db.invoices,
    db.vouchers,
    db.stockMovements,
    db.accounts,
    db.auditLogs,
    db.eventSyncQueue,
    db.items,
  ];
  if (db.tables.some((t) => t.name === "salesCostAllocations") && db.salesCostAllocations) {
    txnTables.push(db.salesCostAllocations);
  }
  if (
    db.tables.some((t) => t.name === "salesInvoiceAdjustmentState") &&
    db.salesInvoiceAdjustmentState
  ) {
    txnTables.push(db.salesInvoiceAdjustmentState);
  }
  if (
    db.tables.some((t) => t.name === "purchaseInvoiceAdjustmentState") &&
    db.purchaseInvoiceAdjustmentState
  ) {
    txnTables.push(db.purchaseInvoiceAdjustmentState);
  }

  return db.transaction("rw", txnTables.filter(Boolean), async () => {
    const existingInvoice = await db.invoices.get(invoiceId);
    if (existingInvoice) {
      return { status: "duplicate" as const };
    }

    const byNumber = await db.invoices
      .where("invoiceNo")
      .equals(String(business.invoice_number ?? ""))
      .first();
    if (byNumber && byNumber.id !== invoiceId) {
      await db.eventSyncConflicts?.put?.({
        id: generateId(),
        eventId: envelope.eventId,
        classification: "invoice_number_collision",
        createdAt: new Date().toISOString(),
        details: {
          localInvoiceId: byNumber.id,
          remoteInvoiceId: invoiceId,
          invoiceNumber: business.invoice_number,
        },
      });
      return { status: "conflict" as const, code: "invoice_number_collision" };
    }

    const itemLines = (business.item_lines as Array<Record<string, unknown>>) ?? [];
    for (const line of itemLines) {
      const itemId = String(line.item_id ?? "");
      if (!itemId) continue;
      const item = await db.items.get(itemId);
      if (!item) {
        await db.eventSyncConflicts?.put?.({
          id: generateId(),
          eventId: envelope.eventId,
          classification: "missing_item",
          createdAt: new Date().toISOString(),
          details: { itemId, kind: "item" },
        });
        return { status: "conflict" as const, code: "missing_item" };
      }
    }

    const totals = (business.totals as Record<string, unknown>) || {};
    const grandTotal = asNumber(totals.grand_total ?? business.amount);
    const vatAmount = carriesVat ? asNumber(totals.tax ?? totals.vat_amount) : 0;
    const taxableAmount = carriesVat
      ? asNumber(totals.taxable_amount, grandTotal - vatAmount)
      : grandTotal;
    const exemptAmount = carriesVat ? asNumber(totals.exempt_amount) : 0;
    const discountAmount = asNumber(totals.discount);
    const cogsTotal = isSale
      ? asNumber(totals.cogs_total ?? totals.cost_reversal)
      : 0;
    /** Historical inventory carrying cost for perpetual purchase returns. */
    const purchaseCostTotal = isPurchaseAdj
      ? asNumber(totals.cost_total ?? totals.cost_reversal)
      : 0;
    const voucherId = String(business.voucher_id ?? `jnl-${invoiceId}`);
    const now = new Date().toISOString();
    const warehouseId = String(business.warehouse_id || "wh-main");
    const accountingPolicy = (business.accounting_policy as Record<string, unknown>) || {};
    const taxRuleVersion = business.tax_rule_version
      ? String(business.tax_rule_version)
      : null;
    const settlementMethod = String(
      business.settlement_method ?? business.payment_method ?? "",
    );
    const paymentMode =
      settlementMethod === "cash_refund" || settlementMethod === "cash"
        ? "cash"
        : settlementMethod === "bank_refund" || settlementMethod === "bank"
          ? "bank"
          : "credit";
    const originalInvoiceId = business.original_invoice_id
      ? String(business.original_invoice_id)
      : undefined;

    // Validate journal balance from event facts when lines present
    const journalLines = (business.journal_lines as Array<Record<string, unknown>>) || [];
    if (journalLines.length) {
      const debits = journalLines.reduce((s, l) => s + asNumber(l.debit), 0);
      const credits = journalLines.reduce((s, l) => s + asNumber(l.credit), 0);
      if (Math.abs(debits - credits) > 0.01) {
        return { status: "rejected" as const, code: "unbalanced_journal" };
      }
      if (carriesVat && Math.abs(debits - grandTotal) > 0.01) {
        return { status: "rejected" as const, code: "invoice_journal_total_mismatch" };
      }
    }

    const cogsJournalLines =
      (business.cogs_journal_lines as Array<Record<string, unknown>>) || [];
    if (isSale && cogsJournalLines.length) {
      const debits = cogsJournalLines.reduce((s, l) => s + asNumber(l.debit), 0);
      const credits = cogsJournalLines.reduce((s, l) => s + asNumber(l.credit), 0);
      if (Math.abs(debits - credits) > 0.01) {
        return { status: "rejected" as const, code: "cogs_inventory_mismatch" };
      }
      if (cogsTotal > 0 && Math.abs(debits - cogsTotal) > 0.01) {
        return { status: "rejected" as const, code: "cogs_inventory_mismatch" };
      }
    }

    await db.invoices.put({
      id: invoiceId,
      invoiceNo: String(business.invoice_number),
      date: String(business.transaction_date),
      type: invoiceType,
      status: "posted",
      partyId: (business.party_id as string) || undefined,
      partyName:
        (business.party_name as string) ||
        (isAdjustment ? "Synced Adjustment" : isSale ? "Synced Sale" : "Synced Purchase"),
      paymentMode,
      paymentStatus: paymentMode === "credit" ? "unpaid" : "paid",
      paidAmount: paymentMode === "credit" ? 0 : grandTotal,
      subTotal: asNumber(totals.subtotal, taxableAmount + exemptAmount),
      taxableAmount,
      exemptAmount,
      vatAmount,
      vatApplicable: vatAmount > 0,
      discountAmount,
      grandTotal,
      total: grandTotal,
      currencyCode: String(business.currency || "NPR"),
      narration: String(business.narration || "Remote sync apply"),
      createdBy: String(business.user_id || "remote"),
      taxRuleVersion,
      inventoryAccounting: accountingPolicy.inventory_accounting
        ? String(accountingPolicy.inventory_accounting)
        : undefined,
      valuationMethod: accountingPolicy.valuation_method
        ? String(accountingPolicy.valuation_method)
        : undefined,
      originalInvoiceId,
      lines: itemLines.map((l, idx) => {
        const unitCost = asNumber(l.unit_cost ?? l.cost_rate, asNumber(l.rate));
        const costAmount = asNumber(
          l.cost_amount ?? l.cogs_amount,
          unitCost * asNumber(l.quantity),
        );
        const lineVat = asNumber(l.vat_amount);
        const lineAmount = asNumber(l.amount);
        return {
          id: `line-${invoiceId}-${idx}`,
          originalSalesLineId: l.original_sales_line_id
            ? String(l.original_sales_line_id)
            : undefined,
          originalPurchaseLineId: l.original_purchase_line_id
            ? String(l.original_purchase_line_id)
            : undefined,
          itemId: String(l.item_id),
          itemName: String(l.item_name ?? ""),
          qty: asNumber(l.quantity),
          unit: String(l.unit || "pcs"),
          rate: asNumber(l.rate),
          netAmount: lineAmount,
          totalAmount: lineAmount + lineVat,
          lineTotal: lineAmount + lineVat,
          isTaxable: String(l.tax_treatment || "taxable") === "taxable" || lineVat > 0,
          taxableAmount: asNumber(l.taxable_amount, lineAmount),
          vatAmount: lineVat,
          unitCost,
          costAmount,
          valuationMethod: l.valuation_method ? String(l.valuation_method) : undefined,
          taxTreatment: l.tax_treatment ? String(l.tax_treatment) : undefined,
          taxRuleVersion: l.tax_rule_version ? String(l.tax_rule_version) : undefined,
          stockCondition: l.stock_condition ? String(l.stock_condition) : undefined,
        };
      }),
      syncOrigin: "remote_sync",
    } as any);

    const existingVoucher = await db.vouchers.get(voucherId);
    if (!existingVoucher) {
      await db.vouchers.put({
        id: voucherId,
        voucherNo: String(business.voucher_number ?? ""),
        date: String(business.transaction_date),
        type: voucherType,
        status: "posted",
        narration: String(business.narration || "Remote sync"),
        totalDebit: grandTotal,
        totalCredit: grandTotal,
        lines: journalLines.length
          ? journalLines.map((l) => ({
              accountId: String(l.accountId ?? l.account_id ?? ""),
              accountName: String(l.accountName ?? l.account_name ?? ""),
              debit: asNumber(l.debit),
              credit: asNumber(l.credit),
            }))
          : [],
        createdBy: String(business.user_id || "remote"),
        syncOrigin: "remote_sync",
        journalType: "revenue",
        linkedInvoiceId: invoiceId,
      } as any);
    }

    // Perpetual COGS / COGS-reversal voucher from event facts (never recalculated)
    if (isSale && envelope.eventType !== "sales_credit_note_posted") {
      const defaultCogsId = isInventoryReturn
        ? `jnl-cogs-rev-${invoiceId}`
        : `jnl-cogs-${invoiceId}`;
      const cogsVoucherId = String(business.cogs_voucher_id || defaultCogsId);
      const hasCogs =
        cogsJournalLines.length > 0 ||
        (String(accountingPolicy.inventory_accounting) === "perpetual" && cogsTotal > 0);
      if (hasCogs) {
        const existingCogs = await db.vouchers.get(cogsVoucherId);
        if (!existingCogs) {
          const defaultLines = isInventoryReturn
            ? [
                {
                  accountId: "acc-inventory",
                  accountName: "Inventory",
                  debit: cogsTotal,
                  credit: 0,
                },
                {
                  accountId: "acc-cogs",
                  accountName: "Cost of Goods Sold",
                  debit: 0,
                  credit: cogsTotal,
                },
              ]
            : [
                {
                  accountId: "acc-cogs",
                  accountName: "Cost of Goods Sold",
                  debit: cogsTotal,
                  credit: 0,
                },
                {
                  accountId: "acc-inventory",
                  accountName: "Inventory",
                  debit: 0,
                  credit: cogsTotal,
                },
              ];
          const lines =
            cogsJournalLines.length > 0
              ? cogsJournalLines.map((l) => ({
                  accountId: String(l.accountId ?? l.account_id ?? ""),
                  accountName: String(l.accountName ?? l.account_name ?? ""),
                  debit: asNumber(l.debit),
                  credit: asNumber(l.credit),
                }))
              : defaultLines;
          await db.vouchers.put({
            id: cogsVoucherId,
            voucherNo: `${isInventoryReturn ? "COGS-REV" : "COGS"}-${business.invoice_number}`,
            date: String(business.transaction_date),
            type: "journal",
            status: "posted",
            narration: `${isInventoryReturn ? "COGS reversal" : "COGS"} for ${business.invoice_number}`,
            lines,
            totalDebit: cogsTotal || lines.reduce((s, l) => s + l.debit, 0),
            totalCredit: cogsTotal || lines.reduce((s, l) => s + l.credit, 0),
            journalType: isInventoryReturn ? "inventory_cost_reversal" : "inventory_cost",
            linkedInvoiceId: invoiceId,
            syncOrigin: "remote_sync",
          } as any);
        }
      }
    }

    // Perpetual inventory removal voucher for purchase returns (never recalculated)
    if (isPurchaseReturn) {
      const inventoryVoucherId = String(
        business.inventory_voucher_id || `jnl-inv-rev-${invoiceId}`,
      );
      const inventoryJournalLines =
        (business.inventory_journal_lines as Array<Record<string, unknown>>) || [];
      const hasInventoryJournal =
        inventoryJournalLines.length > 0 ||
        (String(accountingPolicy.inventory_accounting) === "perpetual" && purchaseCostTotal > 0);
      if (hasInventoryJournal) {
        const existingInv = await db.vouchers.get(inventoryVoucherId);
        if (!existingInv) {
          const defaultLines = [
            {
              accountId: "acc-purchase",
              accountName: "Purchases",
              debit: purchaseCostTotal,
              credit: 0,
            },
            {
              accountId: "acc-inventory",
              accountName: "Inventory",
              debit: 0,
              credit: purchaseCostTotal,
            },
          ];
          const lines =
            inventoryJournalLines.length > 0
              ? inventoryJournalLines.map((l) => ({
                  accountId: String(l.accountId ?? l.account_id ?? ""),
                  accountName: String(l.accountName ?? l.account_name ?? ""),
                  debit: asNumber(l.debit),
                  credit: asNumber(l.credit),
                }))
              : defaultLines;
          await db.vouchers.put({
            id: inventoryVoucherId,
            voucherNo: `INV-REV-${business.invoice_number}`,
            date: String(business.transaction_date),
            type: "journal",
            status: "posted",
            narration: `Inventory removal for ${business.invoice_number}`,
            lines,
            totalDebit: purchaseCostTotal || lines.reduce((s, l) => s + l.debit, 0),
            totalCredit: purchaseCostTotal || lines.reduce((s, l) => s + l.credit, 0),
            journalType: "inventory_cost_reversal",
            linkedInvoiceId: invoiceId,
            syncOrigin: "remote_sync",
          } as any);
        }
      }
    }

    // Credit / debit notes: facts-only financial document — no stock movements
    const applyStock =
      envelope.eventType !== "sales_credit_note_posted" &&
      envelope.eventType !== "supplier_debit_note_posted";
    const movementIds = (business.stock_movement_ids as string[]) ?? [];
    if (applyStock) {
      for (let i = 0; i < itemLines.length; i++) {
        const line = itemLines[i];
        const mid = movementIds[i] || generateId();
        const existingMove = await db.stockMovements.get(mid);
        if (existingMove) continue;
        const qty = asNumber(line.quantity);
        if (!(qty > 0) && isInventoryReturn) continue;
        // Authoritative cost from event — never item.costPrice
        const unitCost = asNumber(line.unit_cost ?? line.cost_rate);
        const costAmount = asNumber(
          line.cost_amount ?? line.cogs_amount,
          unitCost * qty,
        );
        // Sale = stock out (-); sales return = stock in (+);
        // purchase = stock in (+); purchase return = stock out (-)
        const signedQty = isInventoryReturn
          ? qty
          : isPurchaseReturn
            ? -qty
            : isSale
              ? -qty
              : qty;
        await db.stockMovements.put({
          id: mid,
          date: String(business.transaction_date),
          type: invoiceType,
          itemId: String(line.item_id),
          warehouseId,
          quantity: signedQty,
          qty: signedQty,
          unit: String(line.unit || "pcs"),
          rate: unitCost || asNumber(line.rate),
          amount: isSale || isPurchaseReturn ? costAmount : asNumber(line.amount),
          referenceId: invoiceId,
          referenceType: invoiceType,
          createdAt: now,
          syncOrigin: "remote_sync",
          valuationMethod: line.valuation_method ? String(line.valuation_method) : undefined,
        } as any);

        // Persist cost allocation facts from event (Device B must not reallocate)
        if (
          envelope.eventType === "sales_posted" &&
          db.tables.some((t) => t.name === "salesCostAllocations") &&
          db.salesCostAllocations
        ) {
          const allocId = `alloc-remote-${invoiceId}-${i}`;
          await db.salesCostAllocations.put({
            id: allocId,
            posting_id: String(business.posting_id || invoiceId),
            invoice_id: invoiceId,
            sales_line_id: `line-${invoiceId}-${i}`,
            item_id: String(line.item_id),
            warehouse_id: warehouseId,
            company_id: companyId,
            quantity: String(qty),
            valuation_method: String(
              line.valuation_method ||
                accountingPolicy.valuation_method ||
                "current_item_cost_legacy",
            ),
            unit_cost: String(unitCost),
            total_cost: String(costAmount),
            valuation_version: 1,
            valued_at: now,
            source_layers: Array.isArray(line.cost_layers) ? line.cost_layers : [],
            syncOrigin: "remote_sync",
          } as any);
        }

        const item = await db.items.get(String(line.item_id));
        if (item) {
          const current = Number((item as { currentStock?: number }).currentStock ?? 0);
          await db.items.update(item.id, {
            currentStock: current + signedQty,
          } as any);
        }
      }
    }

    if (isAdjustment && originalInvoiceId) {
      const aggregateVersion = asNumber(
        business.aggregate_version,
        asNumber(envelope.aggregateVersion, 1),
      );
      if (
        isSalesAdj &&
        db.tables.some((t) => t.name === "salesInvoiceAdjustmentState") &&
        db.salesInvoiceAdjustmentState
      ) {
        await db.salesInvoiceAdjustmentState.put({
          id: originalInvoiceId,
          companyId,
          adjustmentVersion: aggregateVersion,
          updatedAt: now,
        } as any);
      }
      if (
        isPurchaseAdj &&
        db.tables.some((t) => t.name === "purchaseInvoiceAdjustmentState") &&
        db.purchaseInvoiceAdjustmentState
      ) {
        await db.purchaseInvoiceAdjustmentState.put({
          id: originalInvoiceId,
          companyId,
          adjustmentVersion: aggregateVersion,
          updatedAt: now,
        } as any);
      }
    }

    await db.auditLogs.add({
      id: generateId(),
      timestamp: now,
      userId: "remote_sync",
      userName: "Remote Sync",
      action: auditAction,
      module: "sync",
      entityType: "invoice",
      entityId: invoiceId,
      companyId,
      after: {
        eventId: envelope.eventId,
        remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
        origin: "remote_sync",
        eventType: envelope.eventType,
        vatAmount,
        cogsTotal,
        taxRuleVersion,
        valuationMethod: accountingPolicy.valuation_method,
        inventoryAccounting: accountingPolicy.inventory_accounting,
        originalInvoiceId,
      },
    } as any);

    // Mark applied — do NOT create outbound purchase_posted / sales_posted
    await db.eventSyncQueue.put({
      id: `applied:${envelope.eventId}`,
      eventId: envelope.eventId,
      globalSequence: envelope.globalSequence,
      tenantId: String(envelope.tenantId),
      companyId,
      status: "synced",
      syncAttempts: 0,
      createdAt: now,
      syncedAt: now,
      origin: "remote_sync",
      remoteSequence: envelope.remoteSequence ?? envelope.globalSequence,
      acknowledgedAt: now,
    } satisfies DBEventSyncQueueRow);

    return { status: "applied" as const };
  });
}
