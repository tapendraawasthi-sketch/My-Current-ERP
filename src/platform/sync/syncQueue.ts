import { getDB } from "@/lib/db";
import type { DBDomainEvent } from "@/platform/event-store/eventSchemas";

export type EventSyncQueueStatus = "pending" | "syncing" | "synced" | "failed" | "dead_letter";

export interface DBEventSyncQueueRow {
  id: string;
  eventId: string;
  globalSequence: number;
  tenantId: string;
  status: EventSyncQueueStatus;
  syncAttempts: number;
  lastError?: string;
  createdAt: string;
  syncedAt?: string;
}

export function isEventSyncSchemaReady(): boolean {
  try {
    const db = getDB() as Record<string, unknown>;
    return Boolean(db.eventSyncQueue);
  } catch {
    return false;
  }
}

export async function enqueueEventForSync(record: DBDomainEvent): Promise<void> {
  if (!isEventSyncSchemaReady()) return;
  const db = getDB() as Record<string, { put: (row: DBEventSyncQueueRow) => Promise<unknown> }>;
  await db.eventSyncQueue.put({
    id: record.id,
    eventId: record.id,
    globalSequence: record.globalSequence,
    tenantId: record.tenantId,
    status: "pending",
    syncAttempts: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function getPendingSyncEvents(limit = 20): Promise<DBEventSyncQueueRow[]> {
  if (!isEventSyncSchemaReady()) return [];
  const db = getDB() as Record<string, { filter: (fn: (r: DBEventSyncQueueRow) => boolean) => { limit: (n: number) => { toArray: () => Promise<DBEventSyncQueueRow[]> } } }>;
  return db.eventSyncQueue
    .filter((r) => r.status === "pending" || r.status === "failed")
    .limit(limit)
    .toArray();
}

export async function markEventSyncing(id: string): Promise<void> {
  const db = getDB() as Record<string, { update: (id: string, patch: Partial<DBEventSyncQueueRow>) => Promise<unknown> }>;
  await db.eventSyncQueue.update(id, { status: "syncing" });
}

export async function markEventSynced(id: string): Promise<void> {
  const db = getDB() as Record<string, { update: (id: string, patch: Partial<DBEventSyncQueueRow>) => Promise<unknown> }>;
  await db.eventSyncQueue.update(id, {
    status: "synced",
    syncedAt: new Date().toISOString(),
  });
}

export async function markEventSyncFailed(id: string, error: string, attempts: number): Promise<void> {
  const db = getDB() as Record<string, { update: (id: string, patch: Partial<DBEventSyncQueueRow>) => Promise<unknown> }>;
  await db.eventSyncQueue.update(id, {
    status: "failed",
    syncAttempts: attempts,
    lastError: error,
  });
}

export async function scanUnqueuedEvents(
  tenantId: string,
  fromGlobalSequence: number,
  loadEvents: (tenantId: string, from: number) => Promise<DBDomainEvent[]>,
): Promise<number> {
  const events = await loadEvents(tenantId, fromGlobalSequence + 1);
  for (const event of events) {
    await enqueueEventForSync(event);
  }
  return events.length;
}
