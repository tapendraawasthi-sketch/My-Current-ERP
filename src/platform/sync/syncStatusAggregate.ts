/**
 * Aggregated sync status for SyncStatusControl (legacy outbox + event queue).
 */

import { getPendingSyncCount, type SyncStatus as LegacyStatus } from "@/lib/syncEngine";
import { countSyncQueueByStatus } from "./syncQueue";
import { getOrCreateDeviceId } from "./vectorClock";
import { getCompanySyncPolicy } from "./companySyncPolicy";
import { getDB } from "@/lib/db";

export type UiSyncState =
  | "synced"
  | "syncing"
  | "pending"
  | "offline"
  | "failed"
  | "retry_scheduled"
  | "conflict"
  | "action_required"
  | "local_only"
  | "stale";

export interface AggregatedSyncStatus {
  state: UiSyncState;
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  conflictCount: number;
  deadLetterCount: number;
  deviceId: string;
  deviceIdShort: string;
  registrationStatus: string | null;
  lastSuccessfulSync: string | null;
  detail: string;
}

export async function getAggregatedSyncStatus(
  online: boolean,
  legacyStatus?: LegacyStatus,
): Promise<AggregatedSyncStatus> {
  const deviceId = getOrCreateDeviceId();
  const counts = await countSyncQueueByStatus();
  const legacyPending = await getPendingSyncCount().catch(() => 0);

  let policy: Awaited<ReturnType<typeof getCompanySyncPolicy>> = "sync_enabled";
  try {
    const settings = await getDB().companySettings.toCollection().first();
    const companyId =
      (settings as { companyId?: string } | undefined)?.companyId ||
      settings?.id ||
      "main";
    policy = await getCompanySyncPolicy(companyId);
  } catch {
    /* default */
  }

  const pendingCount = (counts.pending ?? 0) + (counts.failed ?? 0) + legacyPending;
  const syncingCount = counts.syncing ?? 0;
  const failedCount = counts.failed ?? 0;
  const conflictCount = counts.conflict ?? 0;
  const deadLetterCount = counts.dead_letter ?? 0;

  let lastSuccessfulSync: string | null = null;
  try {
    const db = getDB();
    const synced = await db.eventSyncQueue
      .filter((r: { status?: string; syncedAt?: string }) => r.status === "synced" && !!r.syncedAt)
      .toArray();
    const times = synced
      .map((r: { syncedAt?: string }) => r.syncedAt)
      .filter(Boolean)
      .sort();
    lastSuccessfulSync = times.length ? String(times[times.length - 1]) : null;
  } catch {
    /* ignore */
  }

  if (policy === "local_only") {
    return {
      state: "local_only",
      pendingCount: 0,
      syncingCount: 0,
      failedCount: 0,
      conflictCount: 0,
      deadLetterCount: 0,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail: "This company is configured as local-only. Remote sync is not required.",
    };
  }

  if (!online) {
    return {
      state: "offline",
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      deadLetterCount,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail:
        pendingCount > 0
          ? `${pendingCount} change(s) waiting. Offline — will sync later.`
          : "You are offline. Changes will queue until connection returns.",
    };
  }

  if (conflictCount > 0 || deadLetterCount > 0) {
    return {
      state: conflictCount > 0 ? "conflict" : "action_required",
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      deadLetterCount,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail:
        conflictCount > 0
          ? `${conflictCount} conflict(s) require review. Local records remain posted.`
          : `${deadLetterCount} event(s) in dead letter require attention.`,
    };
  }

  if (legacyStatus === "syncing" || syncingCount > 0) {
    return {
      state: "syncing",
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      deadLetterCount,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail: "Synchronizing pending changes…",
    };
  }

  // Transient queue failures with an available retry path are not the same as conflict.
  if (failedCount > 0 && online) {
    return {
      state: "retry_scheduled",
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      deadLetterCount,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail:
        "Sync retry is scheduled. Local records remain posted; remote acknowledgement is pending.",
    };
  }

  if (legacyStatus === "error") {
    return {
      state: "failed",
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      deadLetterCount,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail: "Sync failed — local records are safe. Retry to push pending events.",
    };
  }

  if (pendingCount > 0 || legacyStatus === "pending") {
    return {
      state: "pending",
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      deadLetterCount,
      deviceId,
      deviceIdShort: deviceId.slice(0, 8),
      registrationStatus: null,
      lastSuccessfulSync,
      detail: `${pendingCount} pending change(s) waiting to sync. Not remotely acknowledged.`,
    };
  }

  // Synced only when no pending/failed/conflict and (when known) remote ack exists.
  // Never treat a bare local Dexie write as synced — that is handled by pending counts above.
  if (lastSuccessfulSync) {
    const ageMs = Date.now() - Date.parse(lastSuccessfulSync);
    if (Number.isFinite(ageMs) && ageMs > 7 * 24 * 60 * 60 * 1000) {
      return {
        state: "stale",
        pendingCount: 0,
        syncingCount: 0,
        failedCount: 0,
        conflictCount: 0,
        deadLetterCount: 0,
        deviceId,
        deviceIdShort: deviceId.slice(0, 8),
        registrationStatus: null,
        lastSuccessfulSync,
        detail: "No pending local events, but the last remote acknowledgement is older than 7 days.",
      };
    }
  }

  return {
    state: "synced",
    pendingCount: 0,
    syncingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    deadLetterCount: 0,
    deviceId,
    deviceIdShort: deviceId.slice(0, 8),
    registrationStatus: null,
    lastSuccessfulSync,
    detail: lastSuccessfulSync
      ? "All local changes are synced (remote acknowledgement persisted)."
      : "No pending local events. Remote acknowledgement history not yet observed for this device.",
  };
}
