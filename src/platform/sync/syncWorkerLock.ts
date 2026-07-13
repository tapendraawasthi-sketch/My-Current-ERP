/**
 * Cross-tab sync worker lock (Web Locks API with fallback).
 */

const LOCK_NAME = "orbix-event-sync-worker";

export function getSyncWorkerId(): string {
  try {
    const key = "orbix_sync_worker_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `worker-${Math.random().toString(36).slice(2)}`;
  }
}

export async function withSyncWorkerLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    return locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) return null;
      return fn();
    });
  }

  // Fallback: single-tab in-memory mutex
  const g = globalThis as { __orbixSyncLock?: boolean };
  if (g.__orbixSyncLock) return null;
  g.__orbixSyncLock = true;
  try {
    return await fn();
  } finally {
    g.__orbixSyncLock = false;
  }
}
