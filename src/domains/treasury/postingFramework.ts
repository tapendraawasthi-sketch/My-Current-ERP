/**
 * Shared treasury posting helpers (Phase 10).
 * Mirrors Phase 9 settlement postingFramework patterns.
 */

import type { SutraERPDatabase } from "@/lib/db";
import { generateId } from "@/lib/db";
import { collectTxnTables as collectSettlementTxnTables } from "@/domains/settlement/postingFramework";
import { enforcePostingPeriodLock } from "@/lib/ledger/postingPeriodGuard";

export type FailureInjectionStage =
  | "before_match_write"
  | "before_audit"
  | "before_sync"
  | null
  | undefined;

/** Throws when date falls in a locked period (same guard as Phase 9). */
export async function assertTreasuryPeriodOpen(
  date: string,
  db: SutraERPDatabase,
): Promise<void> {
  await enforcePostingPeriodLock(date, db);
}

export function buildScopedTreasuryIdempotencyKey(
  op: string,
  companyId: string,
  draftId: string | null | undefined,
  previewVersion: string | number | null | undefined,
  previewHash: string | null | undefined,
  idempotencyKey: string,
): string {
  return [
    "local",
    companyId,
    op,
    draftId || "",
    previewVersion != null ? String(previewVersion) : "",
    previewHash || "",
    idempotencyKey,
  ].join("|");
}

export async function findExistingReceipt(
  db: SutraERPDatabase,
  scopedKey: string,
): Promise<any | null> {
  if (!db.orbixPostingReceipts) return null;
  const existing = await db.orbixPostingReceipts.where("scopedKey").equals(scopedKey).first();
  return existing || null;
}

export async function writeAudit(
  db: SutraERPDatabase,
  opts: {
    userId: string;
    userName?: string;
    action: string;
    module?: string;
    entityType: string;
    entityId: string;
    companyId: string;
    sessionId?: string | null;
    after?: Record<string, unknown>;
  },
): Promise<string> {
  const auditId = generateId();
  await db.auditLogs.add({
    id: auditId,
    timestamp: new Date().toISOString(),
    userId: opts.userId,
    userName: opts.userName || opts.userId,
    action: opts.action,
    module: opts.module || "treasury",
    entityType: opts.entityType,
    entityId: opts.entityId,
    recordId: opts.entityId,
    recordType: opts.entityType,
    companyId: opts.companyId,
    sessionId: opts.sessionId || undefined,
    after: opts.after || {},
  } as any);
  return auditId;
}

/** Treasury tables + Phase 9 settlement tables for atomic Dexie transactions. */
export function collectTxnTables(db: SutraERPDatabase): any[] {
  const treasury = [
    (db as any).bankAccounts,
    (db as any).bankStatementBatches,
    (db as any).bankStatementLines,
    (db as any).bankReconciliationLinks,
    (db as any).bankReconciliationSessions,
    (db as any).chequeInstruments,
    (db as any).treasuryForecastItems,
  ];
  return [...collectSettlementTxnTables(db), ...treasury].filter(Boolean);
}

export function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

export function normalizeReference(ref: string | null | undefined): string {
  return String(ref || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
