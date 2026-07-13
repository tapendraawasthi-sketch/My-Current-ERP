import { getDB } from "@/lib/db";
import type { DBDomainEvent } from "@/platform/event-store/eventSchemas";
import type { SyncEventEnvelope } from "./syncServerContracts";
import type { SyncOrigin } from "./accountingSyncContract";

export type EventSyncQueueStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict"
  | "dead_letter";

export interface DBEventSyncQueueRow {
  id: string;
  eventId: string;
  globalSequence: number;
  tenantId: string;
  companyId?: string;
  status: EventSyncQueueStatus;
  syncAttempts: number;
  lastError?: string;
  lastErrorCode?: string;
  createdAt: string;
  syncedAt?: string;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
  claimOwner?: string | null;
  claimedAt?: string | null;
  claimExpiresAt?: string | null;
  idempotencyKey?: string;
  payloadHash?: string;
  previousEventHash?: string | null;
  eventHash?: string;
  origin?: SyncOrigin;
  envelope?: SyncEventEnvelope;
  remoteEventId?: string | null;
  remoteSequence?: number | null;
  acknowledgedAt?: string | null;
}

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;

export function isEventSyncSchemaReady(): boolean {
  try {
    const db = getDB() as unknown as Record<string, unknown>;
    return Boolean(db.eventSyncQueue);
  } catch {
    return false;
  }
}

export async function enqueueEventForSync(record: DBDomainEvent): Promise<void> {
  if (!isEventSyncSchemaReady()) return;
  const db = getDB();
  await db.eventSyncQueue.put({
    id: record.id,
    eventId: record.id,
    globalSequence: record.globalSequence,
    tenantId: record.tenantId,
    companyId: record.companyId ?? undefined,
    status: "pending",
    syncAttempts: 0,
    createdAt: new Date().toISOString(),
    origin: "local_user",
  } satisfies DBEventSyncQueueRow);
}

export async function getPendingSyncEvents(limit = 20): Promise<DBEventSyncQueueRow[]> {
  if (!isEventSyncSchemaReady()) return [];
  const db = getDB();
  const now = Date.now();
  const rows = (await db.eventSyncQueue
    .filter((r: DBEventSyncQueueRow) => {
      if (r.origin === "remote_sync") return false;
      if (r.status === "synced" || r.status === "dead_letter" || r.status === "conflict") {
        return false;
      }
      if (r.status === "syncing") {
        const expires = r.claimExpiresAt ? Date.parse(r.claimExpiresAt) : 0;
        return !expires || expires < now;
      }
      if (r.status === "pending" || r.status === "failed") {
        if (r.nextAttemptAt && Date.parse(r.nextAttemptAt) > now) return false;
        return true;
      }
      return false;
    })
    .toArray()) as DBEventSyncQueueRow[];

  return rows
    .sort((a, b) => a.globalSequence - b.globalSequence)
    .slice(0, limit);
}

export async function claimSyncEvents(
  rows: DBEventSyncQueueRow[],
  workerId: string,
): Promise<DBEventSyncQueueRow[]> {
  if (!rows.length || !isEventSyncSchemaReady()) return [];
  const db = getDB();
  const claimed: DBEventSyncQueueRow[] = [];
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + LEASE_MS).toISOString();

  await db.transaction("rw", db.eventSyncQueue, async () => {
    for (const row of rows) {
      const current = (await db.eventSyncQueue.get(row.id)) as DBEventSyncQueueRow | undefined;
      if (!current) continue;
      if (current.status === "synced" || current.status === "dead_letter" || current.status === "conflict") {
        continue;
      }
      if (
        current.status === "syncing" &&
        current.claimExpiresAt &&
        Date.parse(current.claimExpiresAt) > Date.now() &&
        current.claimOwner !== workerId
      ) {
        continue;
      }
      const patch: Partial<DBEventSyncQueueRow> = {
        status: "syncing",
        claimOwner: workerId,
        claimedAt: now,
        claimExpiresAt: expires,
        lastAttemptAt: now,
      };
      await db.eventSyncQueue.update(row.id, patch);
      claimed.push({ ...current, ...patch, status: "syncing" });
    }
  });

  return claimed;
}

export async function markEventSyncing(id: string): Promise<void> {
  const db = getDB();
  await db.eventSyncQueue.update(id, { status: "syncing" });
}

/** Release a worker claim so the event can be retried (pending). */
export async function releaseSyncClaim(
  id: string,
  opts?: { error?: string; errorCode?: string },
): Promise<void> {
  if (!isEventSyncSchemaReady()) return;
  const db = getDB();
  await db.eventSyncQueue.update(id, {
    status: "pending",
    claimOwner: null,
    claimedAt: null,
    claimExpiresAt: null,
    lastError: opts?.error,
    lastErrorCode: opts?.errorCode,
  });
}

/** Force-release orphaned syncing claims (E2E / lease recovery). */
export async function releaseExpiredOrOwnedSyncClaims(
  workerId?: string,
  opts?: { forceAllSyncing?: boolean },
): Promise<number> {
  if (!isEventSyncSchemaReady()) return 0;
  const db = getDB();
  const now = Date.now();
  const rows = (await db.eventSyncQueue
    .filter((r: DBEventSyncQueueRow) => r.status === "syncing")
    .toArray()) as DBEventSyncQueueRow[];
  let released = 0;
  for (const row of rows) {
    const expired = !row.claimExpiresAt || Date.parse(row.claimExpiresAt) <= now;
    const owned = Boolean(workerId && row.claimOwner === workerId);
    if (opts?.forceAllSyncing || expired || owned) {
      await releaseSyncClaim(row.id);
      released += 1;
    }
  }
  return released;
}

export async function markEventSynced(
  id: string,
  ack?: { remoteEventId?: string; remoteSequence?: number; acknowledgedAt?: string },
): Promise<void> {
  const db = getDB();
  await db.eventSyncQueue.update(id, {
    status: "synced",
    syncedAt: new Date().toISOString(),
    remoteEventId: ack?.remoteEventId ?? null,
    remoteSequence: ack?.remoteSequence ?? null,
    acknowledgedAt: ack?.acknowledgedAt ?? new Date().toISOString(),
    claimOwner: null,
    claimExpiresAt: null,
  });
}

export async function markEventSyncFailed(
  id: string,
  error: string,
  attempts: number,
  opts?: { errorCode?: string; retryable?: boolean; nextAttemptAt?: string | null },
): Promise<void> {
  const db = getDB();
  if (!opts?.retryable && attempts >= MAX_ATTEMPTS) {
    await db.eventSyncQueue.update(id, {
      status: "dead_letter",
      syncAttempts: attempts,
      lastError: error,
      lastErrorCode: opts?.errorCode ?? "permanent_failure",
      claimOwner: null,
      claimExpiresAt: null,
    });
    return;
  }
  await db.eventSyncQueue.update(id, {
    status: "failed",
    syncAttempts: attempts,
    lastError: error,
    lastErrorCode: opts?.errorCode,
    nextAttemptAt: opts?.nextAttemptAt ?? null,
    claimOwner: null,
    claimExpiresAt: null,
  });
}

export async function markEventConflict(
  id: string,
  error: string,
  errorCode: string,
): Promise<void> {
  const db = getDB();
  await db.eventSyncQueue.update(id, {
    status: "conflict",
    lastError: error,
    lastErrorCode: errorCode,
    claimOwner: null,
    claimExpiresAt: null,
  });
}

export async function countSyncQueueByStatus(): Promise<Record<string, number>> {
  if (!isEventSyncSchemaReady()) {
    return { pending: 0, syncing: 0, failed: 0, conflict: 0, dead_letter: 0, synced: 0 };
  }
  const db = getDB();
  const rows = (await db.eventSyncQueue.toArray()) as DBEventSyncQueueRow[];
  const counts: Record<string, number> = {
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
    dead_letter: 0,
    synced: 0,
  };
  for (const row of rows) {
    if (row.origin === "remote_sync") continue;
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
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

export { MAX_ATTEMPTS, LEASE_MS };
