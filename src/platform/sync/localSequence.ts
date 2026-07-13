/**
 * Company-scoped monotonic local event sequence (Phase 5).
 * Not a global ordering claim — remote allocates its own sequence.
 */

import type { Table } from "dexie";

export interface DBSyncLocalSequenceRow {
  id: string;
  companyId: string;
  tenantId: string;
  lastSequence: number;
  lastEventHash: string | null;
  updatedAt: string;
}

function sequenceKey(tenantId: string, companyId: string): string {
  return `${tenantId}:${companyId}`;
}

export async function allocateLocalSequence(
  table: Table<DBSyncLocalSequenceRow>,
  tenantId: string,
  companyId: string,
): Promise<{ localSequence: number; previousEventHash: string | null }> {
  const id = sequenceKey(tenantId, companyId);
  const existing = await table.get(id);
  const next = (existing?.lastSequence ?? 0) + 1;
  const previousEventHash = existing?.lastEventHash ?? null;
  await table.put({
    id,
    companyId,
    tenantId,
    lastSequence: next,
    lastEventHash: previousEventHash,
    updatedAt: new Date().toISOString(),
  });
  return { localSequence: next, previousEventHash };
}

export async function commitLocalSequenceHash(
  table: Table<DBSyncLocalSequenceRow>,
  tenantId: string,
  companyId: string,
  localSequence: number,
  eventHash: string,
): Promise<void> {
  const id = sequenceKey(tenantId, companyId);
  const existing = await table.get(id);
  await table.put({
    id,
    companyId,
    tenantId,
    lastSequence: Math.max(existing?.lastSequence ?? 0, localSequence),
    lastEventHash: eventHash,
    updatedAt: new Date().toISOString(),
  });
}
