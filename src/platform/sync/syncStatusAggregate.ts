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
  | "conflict"
  | "action_required"
  | "local_only";

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

  if (failedCount > 0 || legacyStatus === "error") {
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
      detail: `${pendingCount} pending change(s) waiting to sync.`,
    };
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
    detail: "All local changes are synced (remote acknowledgement persisted).",
  };
}
