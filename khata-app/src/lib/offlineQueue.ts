import { isNativePlatform } from "./platform";

export interface QueuedTransaction {
  id?: number;
  client_idempotency_key: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const DB_NAME = "mobile-khata-offline";
const STORE_NAME = "confirm_queue";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueTransaction(
  clientIdempotencyKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({
      client_idempotency_key: clientIdempotencyKey,
      payload,
      created_at: new Date().toISOString(),
    } satisfies QueuedTransaction);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listQueuedTransactions(): Promise<QueuedTransaction[]> {
  const db = await openDb();
  const rows = await new Promise<QueuedTransaction[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedTransaction[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
}

export async function removeQueuedTransaction(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function replayQueue(
  sendFn: (payload: Record<string, unknown>) => Promise<void>,
): Promise<number> {
  const queued = await listQueuedTransactions();
  let replayed = 0;
  for (const item of queued) {
    if (item.id == null) continue;
    await sendFn(item.payload);
    await removeQueuedTransaction(item.id);
    replayed += 1;
  }
  return replayed;
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function registerNetworkListener(
  onOnline: () => void,
): Promise<() => void> {
  if (isNativePlatform()) {
    try {
      const { Network } = await import("@capacitor/network");
      const handle = await Network.addListener("networkStatusChange", (status) => {
        if (status.connected) {
          onOnline();
        }
      });
      return () => handle.remove();
    } catch {
      // Fallback to web API
    }
  }

  const handler = () => onOnline();
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

export async function isOnline(): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      return status.connected;
    } catch {
      return navigator.onLine;
    }
  }
  return navigator.onLine;
}
