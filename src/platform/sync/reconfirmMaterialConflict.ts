/**
 * Operator reconfirm for material sync conflicts (PR-B3).
 *
 * Policy: REQUIRE_RECONFIRM_ON_MATERIAL_CONFLICT — no auto-overwrite.
 * First completion path: abandon the conflicting local push (keep local invoice;
 * do not apply remote colliding invoice onto this device).
 */

import { getDB } from "@/lib/db";
import {
  isEventSyncSchemaReady,
  type DBEventSyncQueueRow,
  type EventSyncQueueStatus,
} from "./syncQueue";

export type MaterialConflictReconfirmChoice = "abandon_conflicting_push";

export type ReconfirmMaterialConflictResult =
  | {
      ok: true;
      queueRowId: string;
      choice: MaterialConflictReconfirmChoice;
      status: EventSyncQueueStatus;
      localInvoiceId: string | null;
    }
  | { ok: false; error: string; errorCode: string };

function extractInvoiceId(row: DBEventSyncQueueRow): string | null {
  const payload = (row.envelope?.payload || {}) as Record<string, unknown>;
  const fromEnvelope = payload.invoice_id ?? payload.invoiceId;
  if (typeof fromEnvelope === "string" && fromEnvelope) return fromEnvelope;
  return null;
}

/**
 * Complete operator reconfirm for a parked material-conflict queue row.
 * Does not apply remote colliding documents onto local state.
 */
export async function reconfirmMaterialConflict(input: {
  queueRowId: string;
  choice: MaterialConflictReconfirmChoice;
}): Promise<ReconfirmMaterialConflictResult> {
  if (!isEventSyncSchemaReady()) {
    return { ok: false, error: "Event sync schema not ready", errorCode: "schema_not_ready" };
  }
  const db = getDB();
  const row = (await db.eventSyncQueue.get(input.queueRowId)) as DBEventSyncQueueRow | undefined;
  if (!row) {
    return { ok: false, error: "Conflict queue row not found", errorCode: "row_not_found" };
  }
  if (row.status !== "conflict") {
    return {
      ok: false,
      error: `Queue row is ${row.status}, expected conflict`,
      errorCode: "not_in_conflict",
    };
  }

  const code = String(row.lastErrorCode || row.lastError || "").toLowerCase();
  if (code && !code.includes("collision") && !code.includes("conflict")) {
    // Allow empty code (legacy) but reject unrelated parked rows.
    return {
      ok: false,
      error: `Not a material collision conflict (${code || "unknown"})`,
      errorCode: "not_material_conflict",
    };
  }

  if (input.choice !== "abandon_conflicting_push") {
    return { ok: false, error: "Unsupported reconfirm choice", errorCode: "unsupported_choice" };
  }

  let localInvoiceId = extractInvoiceId(row);
  if (!localInvoiceId && row.eventId) {
    try {
      const ev = await db.domainEvents.get(row.eventId);
      const p = (ev as { payload?: Record<string, unknown> } | undefined)?.payload;
      const id = p?.invoice_id ?? p?.invoiceId;
      if (typeof id === "string" && id) localInvoiceId = id;
    } catch {
      /* optional */
    }
  }

  // Park as resolved — not synced (push never accepted) and not dead_letter action_required.
  await db.eventSyncQueue.update(row.id, {
    status: "resolved",
    lastError: "Operator reconfirm: abandoned conflicting push (no remote overwrite)",
    lastErrorCode: "operator_reconfirm_abandon",
    claimOwner: null,
    claimExpiresAt: null,
    nextAttemptAt: null,
    envelope: undefined,
  } as Partial<DBEventSyncQueueRow>);

  // Local invoice remains; remote colliding invoice must not be force-applied here.
  if (localInvoiceId) {
    const local = await db.invoices.get(localInvoiceId);
    if (!local) {
      return {
        ok: false,
        error: "Local invoice missing after reconfirm",
        errorCode: "local_invoice_missing",
      };
    }
  }

  return {
    ok: true,
    queueRowId: row.id,
    choice: input.choice,
    status: "resolved",
    localInvoiceId,
  };
}
