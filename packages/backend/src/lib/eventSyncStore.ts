/**
 * Phase 5 remote event sync store.
 * Uses PostgreSQL when DATABASE_URL is set; otherwise a JSON file store for
 * ORBIX_SYNC_TEST_MODE / local development (never production).
 */

import fs from "fs";
import path from "path";
import { query } from "./db.js";

export interface StoredSyncEvent {
  remote_sequence: number;
  event_id: string;
  tenant_id: string;
  company_id: string;
  device_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  idempotency_key: string;
  payload: unknown;
  payload_hash: string;
  event_hash: string;
  previous_event_hash: string | null;
  occurred_at: string;
  received_at: string;
  status: "accepted" | "duplicate";
}

export interface IngestResult {
  event_id: string;
  status: "accepted" | "duplicate" | "rejected" | "conflict";
  remote_event_id: string | null;
  remote_sequence: number | null;
  acknowledged_at: string | null;
  error_code: string | null;
  conflict: {
    classification: string;
    localVersion?: number;
    remoteVersion?: number;
    documentId?: string;
  } | null;
}

interface FileStore {
  nextSequence: number;
  events: StoredSyncEvent[];
  byEventId: Record<string, string>;
  byIdempotency: Record<string, string>;
}

function useFileStore(): boolean {
  return (
    process.env.ORBIX_SYNC_TEST_MODE === "true" ||
    process.env.ORBIX_SYNC_USE_FILE_STORE === "true" ||
    !process.env.DATABASE_URL
  );
}

function storePath(): string {
  const dir = process.env.ORBIX_SYNC_STORE_PATH || path.join(process.cwd(), ".data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "event-sync-store.json");
}

function readFileStore(): FileStore {
  const file = storePath();
  if (!fs.existsSync(file)) {
    return { nextSequence: 1, events: [], byEventId: {}, byIdempotency: {} };
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as FileStore;
}

function writeFileStore(store: FileStore): void {
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

function scopeKey(tenantId: string, companyId: string, key: string): string {
  return `${tenantId}|${companyId}|${key}`;
}

function getSaleAdjustment(payload: Record<string, unknown>): {
  original_invoice_id?: string;
  adjustment_version_before?: number;
  aggregate_version?: number;
  invoice_number?: string;
} | null {
  const adj = payload.sale_adjustment;
  if (adj && typeof adj === "object" && !Array.isArray(adj)) {
    return adj as {
      original_invoice_id?: string;
      adjustment_version_before?: number;
      aggregate_version?: number;
      invoice_number?: string;
    };
  }
  return null;
}

/** Max accepted adjustment aggregate_version for an original sales invoice. */
function maxAdjustmentVersionForOriginal(
  events: StoredSyncEvent[],
  tenantId: string,
  companyId: string,
  originalInvoiceId: string,
): number {
  let max = 0;
  for (const e of events) {
    if (e.tenant_id !== tenantId || e.company_id !== companyId) continue;
    if (e.event_type !== "sales_return_posted" && e.event_type !== "sales_credit_note_posted") {
      continue;
    }
    const adj = getSaleAdjustment((e.payload || {}) as Record<string, unknown>);
    if (!adj || adj.original_invoice_id !== originalInvoiceId) continue;
    const v = Number(adj.aggregate_version ?? e.aggregate_version ?? 0);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Reject stale sales return / credit note when adjustment_version_before
 * does not match the current max aggregate_version for that original invoice.
 */
function checkSalesAdjustmentVersion(
  input: {
    tenantId: string;
    companyId: string;
    envelope: {
      eventId: string;
      eventType: string;
      aggregateVersion: number;
      payload: Record<string, unknown>;
    };
  },
  events: StoredSyncEvent[],
): IngestResult | null {
  if (
    input.envelope.eventType !== "sales_return_posted" &&
    input.envelope.eventType !== "sales_credit_note_posted"
  ) {
    return null;
  }
  const adj = getSaleAdjustment(input.envelope.payload);
  if (!adj?.original_invoice_id) return null;
  if (adj.adjustment_version_before == null) return null;

  const currentMax = maxAdjustmentVersionForOriginal(
    events,
    input.tenantId,
    input.companyId,
    adj.original_invoice_id,
  );
  const before = Number(adj.adjustment_version_before);
  if (before !== currentMax) {
    return {
      event_id: input.envelope.eventId,
      status: "conflict",
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
      error_code: "stale_adjustment_version",
      conflict: {
        classification: "stale_adjustment_version",
        localVersion: currentMax,
        remoteVersion: before,
      },
    };
  }
  return null;
}

function getPurchaseAdjustment(payload: Record<string, unknown>): {
  original_invoice_id?: string;
  adjustment_version_before?: number;
  aggregate_version?: number;
  invoice_number?: string;
} | null {
  const adj = payload.purchase_adjustment;
  if (adj && typeof adj === "object" && !Array.isArray(adj)) {
    return adj as {
      original_invoice_id?: string;
      adjustment_version_before?: number;
      aggregate_version?: number;
      invoice_number?: string;
    };
  }
  return null;
}

/** Max accepted adjustment aggregate_version for an original purchase invoice. */
function maxPurchaseAdjustmentVersionForOriginal(
  events: StoredSyncEvent[],
  tenantId: string,
  companyId: string,
  originalInvoiceId: string,
): number {
  let max = 0;
  for (const e of events) {
    if (e.tenant_id !== tenantId || e.company_id !== companyId) continue;
    if (
      e.event_type !== "purchase_return_posted" &&
      e.event_type !== "supplier_debit_note_posted"
    ) {
      continue;
    }
    const adj = getPurchaseAdjustment((e.payload || {}) as Record<string, unknown>);
    if (!adj || adj.original_invoice_id !== originalInvoiceId) continue;
    const v = Number(adj.aggregate_version ?? e.aggregate_version ?? 0);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Reject stale purchase return / supplier debit note when adjustment_version_before
 * does not match the current max aggregate_version for that original purchase invoice.
 */
function checkPurchaseAdjustmentVersion(
  input: {
    tenantId: string;
    companyId: string;
    envelope: {
      eventId: string;
      eventType: string;
      aggregateVersion: number;
      payload: Record<string, unknown>;
    };
  },
  events: StoredSyncEvent[],
): IngestResult | null {
  if (
    input.envelope.eventType !== "purchase_return_posted" &&
    input.envelope.eventType !== "supplier_debit_note_posted"
  ) {
    return null;
  }
  const adj = getPurchaseAdjustment(input.envelope.payload);
  if (!adj?.original_invoice_id) return null;
  if (adj.adjustment_version_before == null) return null;

  const currentMax = maxPurchaseAdjustmentVersionForOriginal(
    events,
    input.tenantId,
    input.companyId,
    adj.original_invoice_id,
  );
  const before = Number(adj.adjustment_version_before);
  if (before !== currentMax) {
    return {
      event_id: input.envelope.eventId,
      status: "conflict",
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
      error_code: "stale_adjustment_version",
      conflict: {
        classification: "stale_adjustment_version",
        localVersion: currentMax,
        remoteVersion: before,
      },
    };
  }
  return null;
}

function getFinancialPayload(payload: Record<string, unknown>): {
  allocations?: Array<Record<string, unknown>>;
  settlement_versions?: Record<string, number>;
  amounts?: Record<string, unknown>;
  statement_line_id?: string;
  cheque_id?: string;
  session_id?: string;
  statement_line_version?: number;
  cheque_version?: number;
  session_version?: number;
  expected_statement_line_version?: number;
  expected_cheque_version?: number;
  expected_session_version?: number;
} | null {
  const fin = payload.financial ?? payload.settlement ?? payload.treasury;
  if (fin && typeof fin === "object" && !Array.isArray(fin)) {
    return fin as {
      allocations?: Array<Record<string, unknown>>;
      settlement_versions?: Record<string, number>;
      amounts?: Record<string, unknown>;
      statement_line_id?: string;
      cheque_id?: string;
      session_id?: string;
      statement_line_version?: number;
      cheque_version?: number;
      session_version?: number;
      expected_statement_line_version?: number;
      expected_cheque_version?: number;
      expected_session_version?: number;
    };
  }
  if (
    payload.allocations ||
    payload.settlement_versions ||
    payload.statement_line_id ||
    payload.cheque_id ||
    payload.session_id
  ) {
    return payload as {
      allocations?: Array<Record<string, unknown>>;
      settlement_versions?: Record<string, number>;
      amounts?: Record<string, unknown>;
      statement_line_id?: string;
      cheque_id?: string;
      session_id?: string;
      statement_line_version?: number;
      cheque_version?: number;
      session_version?: number;
      expected_statement_line_version?: number;
      expected_cheque_version?: number;
      expected_session_version?: number;
    };
  }
  return null;
}

/** Max accepted settlement version for a document from prior financial events. */
function maxSettlementVersionForDocument(
  events: StoredSyncEvent[],
  tenantId: string,
  companyId: string,
  documentId: string,
): number {
  let max = 0;
  for (const e of events) {
    if (e.tenant_id !== tenantId || e.company_id !== companyId) continue;
    if (
      e.event_type !== "receipt_posted" &&
      e.event_type !== "payment_posted" &&
      e.event_type !== "settlement_allocated" &&
      e.event_type !== "advance_applied" &&
      e.event_type !== "settlement_reversed"
    ) {
      continue;
    }
    const fin = getFinancialPayload((e.payload || {}) as Record<string, unknown>);
    const versions = fin?.settlement_versions || {};
    const v = Number(versions[documentId] ?? 0);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Reject stale / over-allocated receipt or payment when a prior accepted event
 * already advanced settlement beyond adjustment_version_before / expected snapshot.
 */
function checkFinancialSettlementVersion(
  input: {
    tenantId: string;
    companyId: string;
    envelope: {
      eventId: string;
      eventType: string;
      aggregateVersion: number;
      payload: Record<string, unknown>;
    };
  },
  events: StoredSyncEvent[],
): IngestResult | null {
  if (
    input.envelope.eventType !== "receipt_posted" &&
    input.envelope.eventType !== "payment_posted"
  ) {
    return null;
  }
  const fin = getFinancialPayload(input.envelope.payload);
  if (!fin) return null;
  const allocations = fin.allocations || [];
  const settlementVersions = fin.settlement_versions || {};

  for (const alloc of allocations) {
    const documentId = String(alloc.document_id ?? alloc.targetDocumentId ?? "");
    if (!documentId) continue;

    const expectedRaw =
      alloc.expected_settlement_version ??
      alloc.adjustment_version_before ??
      (settlementVersions[documentId] != null
        ? Number(settlementVersions[documentId]) - 1
        : null);
    if (expectedRaw == null || Number.isNaN(Number(expectedRaw))) continue;

    const expected = Number(expectedRaw);
    const currentMax = maxSettlementVersionForDocument(
      events,
      input.tenantId,
      input.companyId,
      documentId,
    );

    if (expected !== currentMax) {
      const classification =
        currentMax > expected && alloc.remaining_outstanding != null
          ? Number(alloc.principal ?? alloc.amount ?? 0) >
            Number(alloc.remaining_outstanding)
            ? "over_allocation"
            : "stale_settlement_version"
          : "stale_settlement_version";
      // Prefer over_allocation when amount clearly exceeds remaining_before
      const remaining = alloc.remaining_outstanding ?? alloc.remaining_before;
      const allocAmt =
        Number(alloc.principal ?? 0) +
        Number(alloc.discount ?? 0) +
        Number(alloc.withholding ?? 0) +
        Number(alloc.writeoff ?? 0) +
        (alloc.principal == null && alloc.amount != null ? Number(alloc.amount) : 0);
      const finalClassification =
        remaining != null && allocAmt > Number(remaining)
          ? "over_allocation"
          : classification === "over_allocation"
            ? "over_allocation"
            : "stale_settlement_version";

      return {
        event_id: input.envelope.eventId,
        status: "conflict",
        remote_event_id: null,
        remote_sequence: null,
        acknowledged_at: null,
        error_code: finalClassification,
        conflict: {
          classification: finalClassification,
          localVersion: currentMax,
          remoteVersion: expected,
          documentId,
        },
      };
    }

    const remaining = alloc.remaining_outstanding ?? alloc.remaining_before;
    if (remaining != null) {
      const allocAmt =
        Number(alloc.principal ?? 0) +
        Number(alloc.discount ?? 0) +
        Number(alloc.withholding ?? 0) +
        Number(alloc.writeoff ?? 0) +
        (alloc.principal == null && alloc.amount != null ? Number(alloc.amount) : 0);
      if (allocAmt > Number(remaining)) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: null,
          remote_sequence: null,
          acknowledged_at: null,
          error_code: "over_allocation",
          conflict: {
            classification: "over_allocation",
            localVersion: currentMax,
            remoteVersion: expected,
            documentId,
          },
        };
      }
    }
  }
  return null;
}

const BANK_RECON_EVENT_TYPES = new Set([
  "bank_statement_imported",
  "bank_reconciliation_matched",
  "bank_reconciliation_unmatched",
  "bank_reconciliation_closed",
  "bank_reconciliation_reopened",
  "cheque_status_changed",
  "bank_adjustment_linked",
]);

function maxBankEntityVersion(
  events: StoredSyncEvent[],
  tenantId: string,
  companyId: string,
  entityKey: "statement_line_id" | "cheque_id" | "session_id",
  entityId: string,
  versionKey: "statement_line_version" | "cheque_version" | "session_version",
): number {
  let max = 0;
  for (const e of events) {
    if (e.tenant_id !== tenantId || e.company_id !== companyId) continue;
    if (!BANK_RECON_EVENT_TYPES.has(e.event_type)) continue;
    const fin = getFinancialPayload((e.payload || {}) as Record<string, unknown>);
    if (!fin) continue;
    if (String((fin as any)[entityKey] ?? "") !== entityId) continue;
    const v = Number((fin as any)[versionKey] ?? 0);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Phase 10: reject stale statement line / cheque / session versions on bank recon events.
 */
function checkBankReconciliationVersion(
  input: {
    tenantId: string;
    companyId: string;
    envelope: {
      eventId: string;
      eventType: string;
      aggregateVersion: number;
      payload: Record<string, unknown>;
    };
  },
  events: StoredSyncEvent[],
): IngestResult | null {
  if (!BANK_RECON_EVENT_TYPES.has(input.envelope.eventType)) return null;
  const fin = getFinancialPayload(input.envelope.payload);
  if (!fin) return null;

  const checks: Array<{
    id?: string | null;
    expected?: number | null;
    entityKey: "statement_line_id" | "cheque_id" | "session_id";
    versionKey: "statement_line_version" | "cheque_version" | "session_version";
    error: string;
  }> = [
    {
      id: fin.statement_line_id,
      expected: fin.expected_statement_line_version,
      entityKey: "statement_line_id",
      versionKey: "statement_line_version",
      error: "stale_statement_line_version",
    },
    {
      id: fin.cheque_id,
      expected: fin.expected_cheque_version,
      entityKey: "cheque_id",
      versionKey: "cheque_version",
      error: "stale_cheque_version",
    },
    {
      id: fin.session_id,
      expected: fin.expected_session_version,
      entityKey: "session_id",
      versionKey: "session_version",
      error: "stale_session_version",
    },
  ];

  for (const c of checks) {
    if (!c.id || c.expected == null || Number.isNaN(Number(c.expected))) continue;
    const currentMax = maxBankEntityVersion(
      events,
      input.tenantId,
      input.companyId,
      c.entityKey,
      String(c.id),
      c.versionKey,
    );
    if (Number(c.expected) !== currentMax) {
      return {
        event_id: input.envelope.eventId,
        status: "conflict",
        remote_event_id: null,
        remote_sequence: null,
        acknowledged_at: null,
        error_code: c.error,
        conflict: {
          classification: c.error,
          localVersion: currentMax,
          remoteVersion: Number(c.expected),
          documentId: String(c.id),
        },
      };
    }
  }
  return null;
}

export async function ensureEventSyncTables(): Promise<void> {
  if (useFileStore()) return;
  await query(`
    CREATE TABLE IF NOT EXISTS sync_events (
      remote_sequence BIGSERIAL PRIMARY KEY,
      event_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload JSONB NOT NULL,
      payload_hash TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      previous_event_hash TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'accepted',
      UNIQUE (tenant_id, company_id, event_id),
      UNIQUE (tenant_id, company_id, idempotency_key)
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS company_sync_cursors (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      device_id TEXT,
      last_remote_sequence BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, company_id)
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      classification TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function ingestSyncEnvelope(input: {
  tenantId: string;
  companyId: string;
  deviceId: string;
  envelope: {
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    aggregateVersion: number;
    timestamp: string;
    hash: string;
    payload: Record<string, unknown>;
  };
}): Promise<IngestResult> {
  const payload = input.envelope.payload;
  const integrity = (payload.integrity ?? {}) as {
    payload_hash?: string;
    event_hash?: string;
    previous_event_hash?: string | null;
  };
  const idempotencyKey =
    (typeof payload.idempotency_key === "string" && payload.idempotency_key) ||
    input.envelope.eventId;
  const payloadHash = integrity.payload_hash ?? "";
  const eventHash = integrity.event_hash ?? input.envelope.hash;
  const acknowledgedAt = new Date().toISOString();

  if (!payloadHash || !eventHash) {
    return {
      event_id: input.envelope.eventId,
      status: "rejected",
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
      error_code: "invalid_schema",
      conflict: null,
    };
  }

  if (eventHash !== input.envelope.hash) {
    return {
      event_id: input.envelope.eventId,
      status: "rejected",
      remote_event_id: null,
      remote_sequence: null,
      acknowledged_at: null,
      error_code: "integrity_hash_mismatch",
      conflict: null,
    };
  }

  if (useFileStore()) {
    const store = readFileStore();
    const eid = scopeKey(input.tenantId, input.companyId, input.envelope.eventId);
    const iid = scopeKey(input.tenantId, input.companyId, idempotencyKey);

    const existingByEvent = store.byEventId[eid]
      ? store.events.find((e) => e.event_id === store.byEventId[eid])
      : undefined;

    if (existingByEvent) {
      if (existingByEvent.event_hash !== eventHash || existingByEvent.payload_hash !== payloadHash) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: existingByEvent.event_id,
          remote_sequence: existingByEvent.remote_sequence,
          acknowledged_at: null,
          error_code: "integrity_hash_mismatch",
          conflict: { classification: "integrity_hash_mismatch" },
        };
      }
      return {
        event_id: input.envelope.eventId,
        status: "duplicate",
        remote_event_id: existingByEvent.event_id,
        remote_sequence: existingByEvent.remote_sequence,
        acknowledged_at: acknowledgedAt,
        error_code: null,
        conflict: null,
      };
    }

    const existingByIdem = store.byIdempotency[iid]
      ? store.events.find((e) => e.event_id === store.byIdempotency[iid])
      : undefined;

    if (existingByIdem) {
      if (existingByIdem.event_hash !== eventHash) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: existingByIdem.event_id,
          remote_sequence: existingByIdem.remote_sequence,
          acknowledged_at: null,
          error_code: "duplicate_idempotency_key",
          conflict: { classification: "duplicate_idempotency_key" },
        };
      }
      return {
        event_id: input.envelope.eventId,
        status: "duplicate",
        remote_event_id: existingByIdem.event_id,
        remote_sequence: existingByIdem.remote_sequence,
        acknowledged_at: acknowledgedAt,
        error_code: null,
        conflict: null,
      };
    }

    // Voucher number collision (same company, different event)
    const purchase = payload.purchase as { invoice_number?: string; voucher_number?: string } | undefined;
    if (purchase?.invoice_number) {
      const clash = store.events.find(
        (e) =>
          e.tenant_id === input.tenantId &&
          e.company_id === input.companyId &&
          e.event_id !== input.envelope.eventId &&
          (e.payload as { purchase?: { invoice_number?: string } })?.purchase?.invoice_number ===
            purchase.invoice_number,
      );
      if (clash) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: clash.event_id,
          remote_sequence: clash.remote_sequence,
          acknowledged_at: null,
          error_code: "invoice_number_collision",
          conflict: { classification: "invoice_number_collision" },
        };
      }
    }

    // Phase 7: reject stale sales return / credit note versions
    const versionConflict = checkSalesAdjustmentVersion(input, store.events);
    if (versionConflict) return versionConflict;

    // Phase 8: reject stale purchase return / supplier debit note versions
    const purchaseVersionConflict = checkPurchaseAdjustmentVersion(input, store.events);
    if (purchaseVersionConflict) return purchaseVersionConflict;

    // Phase 9: reject stale settlement / over-allocation on receipt & payment
    const financialVersionConflict = checkFinancialSettlementVersion(input, store.events);
    if (financialVersionConflict) return financialVersionConflict;

    // Phase 10: reject stale statement line / cheque / session versions
    const bankVersionConflict = checkBankReconciliationVersion(input, store.events);
    if (bankVersionConflict) return bankVersionConflict;

    const remoteSequence = store.nextSequence++;
    const row: StoredSyncEvent = {
      remote_sequence: remoteSequence,
      event_id: input.envelope.eventId,
      tenant_id: input.tenantId,
      company_id: input.companyId,
      device_id: input.deviceId,
      event_type: input.envelope.eventType,
      aggregate_type: input.envelope.aggregateType,
      aggregate_id: input.envelope.aggregateId,
      aggregate_version: input.envelope.aggregateVersion,
      idempotency_key: idempotencyKey,
      payload,
      payload_hash: payloadHash,
      event_hash: eventHash,
      previous_event_hash: integrity.previous_event_hash ?? null,
      occurred_at: input.envelope.timestamp,
      received_at: acknowledgedAt,
      status: "accepted",
    };
    store.events.push(row);
    store.byEventId[eid] = row.event_id;
    store.byIdempotency[iid] = row.event_id;
    writeFileStore(store);

    return {
      event_id: input.envelope.eventId,
      status: "accepted",
      remote_event_id: row.event_id,
      remote_sequence: remoteSequence,
      acknowledged_at: acknowledgedAt,
      error_code: null,
      conflict: null,
    };
  }

  // PostgreSQL path
  const existing = await query<{
    event_id: string;
    event_hash: string;
    payload_hash: string;
    remote_sequence: string;
  }>(
    `SELECT event_id, event_hash, payload_hash, remote_sequence::text
     FROM sync_events
     WHERE tenant_id = $1 AND company_id = $2 AND (event_id = $3 OR idempotency_key = $4)
     LIMIT 1`,
    [input.tenantId, input.companyId, input.envelope.eventId, idempotencyKey],
  );

  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (row.event_hash !== eventHash || row.payload_hash !== payloadHash) {
      return {
        event_id: input.envelope.eventId,
        status: "conflict",
        remote_event_id: row.event_id,
        remote_sequence: Number(row.remote_sequence),
        acknowledged_at: null,
        error_code: "integrity_hash_mismatch",
        conflict: { classification: "integrity_hash_mismatch" },
      };
    }
    return {
      event_id: input.envelope.eventId,
      status: "duplicate",
      remote_event_id: row.event_id,
      remote_sequence: Number(row.remote_sequence),
      acknowledged_at: acknowledgedAt,
      error_code: null,
      conflict: null,
    };
  }

  // Phase 7: stale adjustment version check (Postgres)
  if (
    input.envelope.eventType === "sales_return_posted" ||
    input.envelope.eventType === "sales_credit_note_posted"
  ) {
    const adj = getSaleAdjustment(payload);
    if (adj?.original_invoice_id != null && adj.adjustment_version_before != null) {
      const prior = await query<{ aggregate_version: number; payload: unknown }>(
        `SELECT aggregate_version, payload
         FROM sync_events
         WHERE tenant_id = $1 AND company_id = $2
           AND event_type IN ('sales_return_posted', 'sales_credit_note_posted')
           AND (
             payload->'sale_adjustment'->>'original_invoice_id' = $3
             OR payload->>'original_invoice_id' = $3
           )`,
        [input.tenantId, input.companyId, adj.original_invoice_id],
      );
      let maxVersion = 0;
      for (const row of prior.rows) {
        const rowAdj = getSaleAdjustment((row.payload || {}) as Record<string, unknown>);
        const v = Number(rowAdj?.aggregate_version ?? row.aggregate_version ?? 0);
        if (v > maxVersion) maxVersion = v;
      }
      if (Number(adj.adjustment_version_before) !== maxVersion) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: null,
          remote_sequence: null,
          acknowledged_at: null,
          error_code: "stale_adjustment_version",
          conflict: {
            classification: "stale_adjustment_version",
            localVersion: maxVersion,
            remoteVersion: Number(adj.adjustment_version_before),
          },
        };
      }
    }
  }

  // Phase 8: stale purchase adjustment version check (Postgres)
  if (
    input.envelope.eventType === "purchase_return_posted" ||
    input.envelope.eventType === "supplier_debit_note_posted"
  ) {
    const adj = getPurchaseAdjustment(payload);
    if (adj?.original_invoice_id != null && adj.adjustment_version_before != null) {
      const prior = await query<{ aggregate_version: number; payload: unknown }>(
        `SELECT aggregate_version, payload
         FROM sync_events
         WHERE tenant_id = $1 AND company_id = $2
           AND event_type IN ('purchase_return_posted', 'supplier_debit_note_posted')
           AND (
             payload->'purchase_adjustment'->>'original_invoice_id' = $3
             OR payload->>'original_invoice_id' = $3
           )`,
        [input.tenantId, input.companyId, adj.original_invoice_id],
      );
      let maxVersion = 0;
      for (const row of prior.rows) {
        const rowAdj = getPurchaseAdjustment((row.payload || {}) as Record<string, unknown>);
        const v = Number(rowAdj?.aggregate_version ?? row.aggregate_version ?? 0);
        if (v > maxVersion) maxVersion = v;
      }
      if (Number(adj.adjustment_version_before) !== maxVersion) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: null,
          remote_sequence: null,
          acknowledged_at: null,
          error_code: "stale_adjustment_version",
          conflict: {
            classification: "stale_adjustment_version",
            localVersion: maxVersion,
            remoteVersion: Number(adj.adjustment_version_before),
          },
        };
      }
    }
  }

  // Phase 9: stale settlement / over-allocation check (Postgres)
  if (
    input.envelope.eventType === "receipt_posted" ||
    input.envelope.eventType === "payment_posted"
  ) {
    const fin = getFinancialPayload(payload);
    const allocations = fin?.allocations || [];
    const settlementVersions = fin?.settlement_versions || {};
    for (const alloc of allocations) {
      const documentId = String(alloc.document_id ?? alloc.targetDocumentId ?? "");
      if (!documentId) continue;
      const expectedRaw =
        alloc.expected_settlement_version ??
        alloc.adjustment_version_before ??
        (settlementVersions[documentId] != null
          ? Number(settlementVersions[documentId]) - 1
          : null);
      if (expectedRaw == null || Number.isNaN(Number(expectedRaw))) continue;
      const expected = Number(expectedRaw);

      const prior = await query<{ payload: unknown }>(
        `SELECT payload
         FROM sync_events
         WHERE tenant_id = $1 AND company_id = $2
           AND event_type IN (
             'receipt_posted', 'payment_posted',
             'settlement_allocated', 'advance_applied', 'settlement_reversed'
           )`,
        [input.tenantId, input.companyId],
      );
      let maxVersion = 0;
      for (const row of prior.rows) {
        const rowFin = getFinancialPayload((row.payload || {}) as Record<string, unknown>);
        const v = Number(rowFin?.settlement_versions?.[documentId] ?? 0);
        if (v > maxVersion) maxVersion = v;
      }

      const remaining = alloc.remaining_outstanding ?? alloc.remaining_before;
      const allocAmt =
        Number(alloc.principal ?? 0) +
        Number(alloc.discount ?? 0) +
        Number(alloc.withholding ?? 0) +
        Number(alloc.writeoff ?? 0) +
        (alloc.principal == null && alloc.amount != null ? Number(alloc.amount) : 0);

      if (remaining != null && allocAmt > Number(remaining)) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: null,
          remote_sequence: null,
          acknowledged_at: null,
          error_code: "over_allocation",
          conflict: {
            classification: "over_allocation",
            localVersion: maxVersion,
            remoteVersion: expected,
            documentId,
          },
        };
      }

      if (expected !== maxVersion) {
        return {
          event_id: input.envelope.eventId,
          status: "conflict",
          remote_event_id: null,
          remote_sequence: null,
          acknowledged_at: null,
          error_code: "stale_settlement_version",
          conflict: {
            classification: "stale_settlement_version",
            localVersion: maxVersion,
            remoteVersion: expected,
            documentId,
          },
        };
      }
    }
  }

  // Phase 10: stale statement line / cheque / session version check (Postgres)
  if (BANK_RECON_EVENT_TYPES.has(input.envelope.eventType)) {
    const fin = getFinancialPayload(payload);
    if (fin) {
      const checks: Array<{
        id?: string | null;
        expected?: number | null;
        versionField: string;
        idField: string;
        error: string;
      }> = [
        {
          id: fin.statement_line_id,
          expected: fin.expected_statement_line_version,
          versionField: "statement_line_version",
          idField: "statement_line_id",
          error: "stale_statement_line_version",
        },
        {
          id: fin.cheque_id,
          expected: fin.expected_cheque_version,
          versionField: "cheque_version",
          idField: "cheque_id",
          error: "stale_cheque_version",
        },
        {
          id: fin.session_id,
          expected: fin.expected_session_version,
          versionField: "session_version",
          idField: "session_id",
          error: "stale_session_version",
        },
      ];
      for (const c of checks) {
        if (!c.id || c.expected == null || Number.isNaN(Number(c.expected))) continue;
        const prior = await query<{ payload: unknown }>(
          `SELECT payload
           FROM sync_events
           WHERE tenant_id = $1 AND company_id = $2
             AND event_type IN (
               'bank_statement_imported', 'bank_reconciliation_matched',
               'bank_reconciliation_unmatched', 'bank_reconciliation_closed',
               'bank_reconciliation_reopened', 'cheque_status_changed',
               'bank_adjustment_linked'
             )`,
          [input.tenantId, input.companyId],
        );
        let maxVersion = 0;
        for (const row of prior.rows) {
          const rowFin = getFinancialPayload((row.payload || {}) as Record<string, unknown>);
          if (!rowFin) continue;
          if (String((rowFin as any)[c.idField] ?? "") !== String(c.id)) continue;
          const v = Number((rowFin as any)[c.versionField] ?? 0);
          if (v > maxVersion) maxVersion = v;
        }
        if (Number(c.expected) !== maxVersion) {
          return {
            event_id: input.envelope.eventId,
            status: "conflict",
            remote_event_id: null,
            remote_sequence: null,
            acknowledged_at: null,
            error_code: c.error,
            conflict: {
              classification: c.error,
              localVersion: maxVersion,
              remoteVersion: Number(c.expected),
              documentId: String(c.id),
            },
          };
        }
      }
    }
  }

  try {
    const inserted = await query<{ remote_sequence: string }>(
      `INSERT INTO sync_events (
         event_id, tenant_id, company_id, device_id, event_type, aggregate_type,
         aggregate_id, aggregate_version, idempotency_key, payload, payload_hash,
         event_hash, previous_event_hash, occurred_at, received_at, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,NOW(),'accepted')
       RETURNING remote_sequence::text`,
      [
        input.envelope.eventId,
        input.tenantId,
        input.companyId,
        input.deviceId,
        input.envelope.eventType,
        input.envelope.aggregateType,
        input.envelope.aggregateId,
        input.envelope.aggregateVersion,
        idempotencyKey,
        JSON.stringify(payload),
        payloadHash,
        eventHash,
        integrity.previous_event_hash ?? null,
        input.envelope.timestamp,
      ],
    );
    return {
      event_id: input.envelope.eventId,
      status: "accepted",
      remote_event_id: input.envelope.eventId,
      remote_sequence: Number(inserted.rows[0].remote_sequence),
      acknowledged_at: acknowledgedAt,
      error_code: null,
      conflict: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique") || message.includes("duplicate")) {
      return {
        event_id: input.envelope.eventId,
        status: "duplicate",
        remote_event_id: input.envelope.eventId,
        remote_sequence: null,
        acknowledged_at: acknowledgedAt,
        error_code: null,
        conflict: null,
      };
    }
    throw err;
  }
}

export async function pullSyncEvents(input: {
  tenantId: string;
  companyId: string;
  sinceRemoteSequence: number;
  limit?: number;
}): Promise<{ events: StoredSyncEvent[]; lastRemoteSequence: number; hasMore: boolean }> {
  const limit = Math.min(input.limit ?? 50, 100);

  if (useFileStore()) {
    const store = readFileStore();
    const filtered = store.events
      .filter(
        (e) =>
          e.tenant_id === input.tenantId &&
          e.company_id === input.companyId &&
          e.remote_sequence > input.sinceRemoteSequence,
      )
      .sort((a, b) => a.remote_sequence - b.remote_sequence);
    const page = filtered.slice(0, limit);
    const last = page.length ? page[page.length - 1].remote_sequence : input.sinceRemoteSequence;
    return { events: page, lastRemoteSequence: last, hasMore: filtered.length > page.length };
  }

  const result = await query<StoredSyncEvent>(
    `SELECT remote_sequence, event_id, tenant_id, company_id, device_id, event_type,
            aggregate_type, aggregate_id, aggregate_version, idempotency_key, payload,
            payload_hash, event_hash, previous_event_hash, occurred_at::text, received_at::text, status
     FROM sync_events
     WHERE tenant_id = $1 AND company_id = $2 AND remote_sequence > $3
     ORDER BY remote_sequence ASC
     LIMIT $4`,
    [input.tenantId, input.companyId, input.sinceRemoteSequence, limit + 1],
  );
  const hasMore = result.rows.length > limit;
  const events = result.rows.slice(0, limit);
  const last = events.length
    ? Number(events[events.length - 1].remote_sequence)
    : input.sinceRemoteSequence;
  return { events, lastRemoteSequence: last, hasMore };
}

/** E2E-only: delete events for a tagged test company. Aborts if company is not E2E. */
export async function resetE2ESyncStore(companyId: string): Promise<number> {
  if (!companyId.startsWith("orbix-") && !companyId.includes("e2e") && !companyId.includes("sync-e2e")) {
    throw new Error("Refuse to reset non-E2E company sync store");
  }
  if (process.env.ORBIX_SYNC_TEST_MODE !== "true" && process.env.NODE_ENV === "production") {
    throw new Error("Refuse to reset sync store outside test mode");
  }
  if (useFileStore()) {
    const store = readFileStore();
    const before = store.events.length;
    store.events = store.events.filter((e) => e.company_id !== companyId);
    store.byEventId = {};
    store.byIdempotency = {};
    for (const e of store.events) {
      store.byEventId[scopeKey(e.tenant_id, e.company_id, e.event_id)] = e.event_id;
      store.byIdempotency[scopeKey(e.tenant_id, e.company_id, e.idempotency_key)] = e.event_id;
    }
    writeFileStore(store);
    return before - store.events.length;
  }
  const result = await query(`DELETE FROM sync_events WHERE company_id = $1`, [companyId]);
  return result.rowCount ?? 0;
}
