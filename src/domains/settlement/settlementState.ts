/**
 * Document settlement + party advance optimistic concurrency helpers (Phase 9).
 * Table ids = target document id / advance id.
 */

import type { SutraERPDatabase } from "@/lib/db";
import type {
  AdvancePartySide,
  DocumentSettlementStateRow,
  MoneyString,
  PartyAdvanceStateRow,
} from "./types";
import { paisaToString } from "@/domains/purchase/money";

export async function getOrCreateDocumentSettlementState(
  db: SutraERPDatabase,
  companyId: string,
  documentId: string,
): Promise<DocumentSettlementStateRow> {
  const nowIso = new Date().toISOString();
  const table = (db as any).documentSettlementState;
  if (table) {
    const existing = await table.get(documentId);
    if (existing && typeof existing.settlementVersion === "number") {
      return {
        id: String(existing.id || documentId),
        companyId: String(existing.companyId || companyId),
        settlementVersion: existing.settlementVersion,
        updatedAt: String(existing.updatedAt || nowIso),
      };
    }
    const row: DocumentSettlementStateRow = {
      id: documentId,
      companyId,
      settlementVersion: 0,
      updatedAt: nowIso,
    };
    await table.put(row);
    return row;
  }
  return {
    id: documentId,
    companyId,
    settlementVersion: 0,
    updatedAt: nowIso,
  };
}

export async function bumpDocumentSettlementVersion(
  db: SutraERPDatabase,
  companyId: string,
  documentId: string,
  nextVersion: number,
  nowIso: string,
): Promise<void> {
  const table = (db as any).documentSettlementState;
  if (!table) return;
  await table.put({
    id: documentId,
    companyId,
    settlementVersion: nextVersion,
    updatedAt: nowIso,
  });
}

export async function getOrCreateAdvanceState(
  db: SutraERPDatabase,
  opts: {
    advanceId: string;
    companyId: string;
    partyId: string;
    side: AdvancePartySide;
    remainingPaisa?: number;
    currency?: string;
    sourceVoucherId?: string | null;
  },
): Promise<PartyAdvanceStateRow> {
  const nowIso = new Date().toISOString();
  const table = (db as any).partyAdvances;
  if (table) {
    const existing = await table.get(opts.advanceId);
    if (existing && typeof existing.advanceVersion === "number") {
      return {
        id: String(existing.id || opts.advanceId),
        companyId: String(existing.companyId || opts.companyId),
        partyId: String(existing.partyId || opts.partyId),
        side: (existing.side || opts.side) as AdvancePartySide,
        remainingAmount: String(existing.remainingAmount ?? "0.00"),
        remainingPaisa: Number(existing.remainingPaisa ?? 0),
        currency: String(existing.currency || opts.currency || "NPR"),
        advanceVersion: existing.advanceVersion,
        status: (existing.status || "open") as PartyAdvanceStateRow["status"],
        sourceVoucherId: existing.sourceVoucherId ?? opts.sourceVoucherId ?? null,
        updatedAt: String(existing.updatedAt || nowIso),
        createdAt: String(existing.createdAt || nowIso),
      };
    }
    const remainingPaisa = opts.remainingPaisa ?? 0;
    const remainingAmount: MoneyString = paisaToString(remainingPaisa);
    const row: PartyAdvanceStateRow = {
      id: opts.advanceId,
      companyId: opts.companyId,
      partyId: opts.partyId,
      side: opts.side,
      remainingAmount,
      remainingPaisa,
      currency: opts.currency || "NPR",
      advanceVersion: 0,
      status: remainingPaisa > 0 ? "open" : "fully_applied",
      sourceVoucherId: opts.sourceVoucherId ?? null,
      updatedAt: nowIso,
      createdAt: nowIso,
    };
    await table.put(row);
    return row;
  }
  const remainingPaisa = opts.remainingPaisa ?? 0;
  return {
    id: opts.advanceId,
    companyId: opts.companyId,
    partyId: opts.partyId,
    side: opts.side,
    remainingAmount: paisaToString(remainingPaisa),
    remainingPaisa,
    currency: opts.currency || "NPR",
    advanceVersion: 0,
    status: remainingPaisa > 0 ? "open" : "fully_applied",
    sourceVoucherId: opts.sourceVoucherId ?? null,
    updatedAt: nowIso,
    createdAt: nowIso,
  };
}

export async function bumpAdvanceVersion(
  db: SutraERPDatabase,
  advanceId: string,
  patch: Partial<PartyAdvanceStateRow> & { advanceVersion: number; updatedAt: string },
): Promise<void> {
  const table = (db as any).partyAdvances;
  if (!table) return;
  const existing = await table.get(advanceId);
  await table.put({
    ...(existing || { id: advanceId }),
    ...patch,
    id: advanceId,
  });
}
