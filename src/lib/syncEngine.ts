import { getDB, type DBSyncOutboxRecord } from "./db";

export type SyncEntityType =
  | "account"
  | "party"
  | "item"
  | "voucher"
  | "invoice";

export interface EnqueueSyncInput {
  entityType: SyncEntityType;
  entityId: string;
  operation: "create" | "update";
  payload: Record<string, unknown>;
}

export type SyncStatus = "synced" | "syncing" | "pending" | "error";

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 5;
const BASE_INTERVAL_MS = 30_000;

let loopHandle: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let statusListeners: Array<(status: SyncStatus, pendingCount: number) => void> = [];

function apiBase(): string {
  return (
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem("sutra_access_token");
  } catch {
    return null;
  }
}

export function onSyncStatusChange(
  listener: (status: SyncStatus, pendingCount: number) => void,
): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

async function notifyStatus(): Promise<void> {
  const db = getDB();
  const pending = await db.syncOutbox
    .filter((r) => !r.syncedAt && r.status !== "sync_failed")
    .count();
  const failed = await db.syncOutbox.where("status").equals("sync_failed").count();
  const status: SyncStatus = isSyncing
    ? "syncing"
    : failed > 0
      ? "error"
      : pending > 0
        ? "pending"
        : "synced";
  statusListeners.forEach((l) => l(status, pending));
}

export async function enqueueSyncRecord(input: EnqueueSyncInput): Promise<void> {
  const db = getDB();
  const row = {
    id: crypto.randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    operation: input.operation,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    syncedAt: null as string | null,
    syncAttempts: 0,
    status: "pending" as const,
  };
  await db.syncOutbox.put(row);
  void notifyStatus();
}

async function pushBatch(records: DBSyncOutboxRecord[]): Promise<boolean> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/api/sync/push`, {
    method: "POST",
    headers,
    body: JSON.stringify({ records }),
  });

  if (!res.ok) {
    throw new Error(`Sync push failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  return body?.success === true;
}

export async function runSyncCycle(): Promise<void> {
  if (!navigator.onLine || isSyncing) return;
  isSyncing = true;
  await notifyStatus();

  try {
    const db = getDB();
    const pending = await db.syncOutbox
      .filter((r) => !r.syncedAt && (r.syncAttempts ?? 0) < MAX_ATTEMPTS && r.status !== "sync_failed")
      .limit(BATCH_SIZE)
      .toArray();

    if (pending.length === 0) return;

    try {
      const ok = await pushBatch(pending);
      if (ok) {
        const now = new Date().toISOString();
        await Promise.all(
          pending.map((r) =>
            db.syncOutbox.update(r.id, { syncedAt: now, status: "pending" }),
          ),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      await Promise.all(
        pending.map(async (r) => {
          const attempts = (r.syncAttempts ?? 0) + 1;
          await db.syncOutbox.update(r.id, {
            syncAttempts: attempts,
            lastError: message,
            status: attempts >= MAX_ATTEMPTS ? "sync_failed" : "pending",
          });
        }),
      );
    }
  } finally {
    isSyncing = false;
    await notifyStatus();
  }
}

export async function retryFailedSync(): Promise<void> {
  const db = getDB();
  const failed = await db.syncOutbox.where("status").equals("sync_failed").toArray();
  await Promise.all(
    failed.map((r) =>
      db.syncOutbox.update(r.id, { syncAttempts: 0, status: "pending", lastError: "" }),
    ),
  );
  await runSyncCycle();
}

export async function getPendingSyncCount(): Promise<number> {
  const db = getDB();
  return db.syncOutbox.filter((r) => !r.syncedAt && r.status !== "sync_failed").count();
}

export function startSyncLoop(): void {
  if (loopHandle) return;
  void runSyncCycle();
  loopHandle = setInterval(() => {
    void runSyncCycle();
  }, BASE_INTERVAL_MS);
  window.addEventListener("online", runSyncCycle);
}

export function stopSyncLoop(): void {
  if (loopHandle) {
    clearInterval(loopHandle);
    loopHandle = null;
  }
  window.removeEventListener("online", runSyncCycle);
}
