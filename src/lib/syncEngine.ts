import { getDB, type DBSyncOutboxRecord } from "./db";
import { enforcePostingPeriodLockIfPosted } from "./ledger/postingPeriodGuard";

export type SyncEntityType = "account" | "party" | "item" | "voucher" | "invoice";

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

const SYNC_PULL_KEY = "sutra_last_sync_pull";

/** Applies remote voucher/invoice rows from sync pull (exported for integration tests). */
export async function applySyncPullFinancialRecords(
  data: { vouchers?: Record<string, unknown>[]; invoices?: Record<string, unknown>[] },
  db: ReturnType<typeof getDB> = getDB(),
): Promise<void> {
  for (const row of data.vouchers || []) {
    const id = String(row.id);
    const existing = await db.vouchers.get(id);
    const nextStatus = String(row.status || "draft");
    const date = String(row.voucher_date || existing?.date || "").slice(0, 10);
    await enforcePostingPeriodLockIfPosted({ status: nextStatus, date }, db);

    await db.vouchers.put({
      ...(existing || {}),
      id,
      voucherNo: String(row.voucher_no || ""),
      date,
      type: String(row.voucher_type || "journal"),
      status: nextStatus,
      narration: row.narration ? String(row.narration) : existing?.narration,
      partyId: row.party_id ? String(row.party_id) : existing?.partyId,
      totalDebit: Number(row.total_debit ?? existing?.totalDebit ?? 0),
      totalCredit: Number(row.total_credit ?? existing?.totalCredit ?? 0),
      grandTotal: Number(row.grand_total ?? existing?.grandTotal ?? 0),
      lines: existing?.lines || [],
    } as any);
  }

  for (const row of data.invoices || []) {
    const id = String(row.id);
    const existing = await db.invoices.get(id);
    const pulledLines = Array.isArray(row.lines) ? row.lines : [];
    const lines =
      pulledLines.length > 0
        ? pulledLines.map((l: Record<string, unknown>, idx: number) => ({
            id: String(l.id || `${id}-line-${idx}`),
            itemId: l.item_id ? String(l.item_id) : undefined,
            quantity: Number(l.quantity || 0),
            qty: Number(l.quantity || 0),
            rate: Number(l.rate || 0),
            amount: Number(l.amount || 0),
            vatAmount: Number(l.vat_amount || 0),
          }))
        : existing?.lines || [];

    const nextStatus = String(row.status || existing?.status || "draft");
    const date = String(row.invoice_date || existing?.date || "").slice(0, 10);
    await enforcePostingPeriodLockIfPosted({ status: nextStatus, date }, db);

    await db.invoices.put({
      ...(existing || {}),
      id,
      invoiceNo: String(row.invoice_no || existing?.invoiceNo || ""),
      date,
      type: String(row.invoice_type || existing?.type || "sales"),
      status: nextStatus,
      partyId: row.party_id ? String(row.party_id) : existing?.partyId,
      subTotal: Number(row.sub_total ?? existing?.subTotal ?? 0),
      vatAmount: Number(row.vat_amount ?? existing?.vatAmount ?? 0),
      grandTotal: Number(row.grand_total ?? existing?.grandTotal ?? 0),
      lines,
    } as any);
  }
}

async function pullRemoteChanges(): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  const since = localStorage.getItem(SYNC_PULL_KEY);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const url = since
    ? `${apiBase()}/api/sync/pull?since=${encodeURIComponent(since)}`
    : `${apiBase()}/api/sync/pull`;

  const res = await fetch(url, { headers });
  if (!res.ok) return;

  const body = await res.json();
  const data = body?.data;
  if (!data) return;

  const db = getDB();
  const now = data.pulledAt || new Date().toISOString();

  for (const row of data.parties || []) {
    await db.parties.put({
      id: String(row.id),
      name: String(row.name || ""),
      type:
        row.party_type === "supplier"
          ? "supplier"
          : row.party_type === "both"
            ? "both"
            : "customer",
      creditPeriod: Number(row.credit_days || 0),
      isActive: row.is_active !== false,
    } as any);
  }

  for (const row of data.items || []) {
    await db.items.put({
      id: String(row.id),
      code: String(row.code || ""),
      name: String(row.name || ""),
      unit: row.unit ? String(row.unit) : undefined,
      isActive: row.is_active !== false,
    } as any);
  }

  for (const row of data.accounts || []) {
    await db.accounts.put({
      id: String(row.id),
      code: String(row.code || ""),
      name: String(row.name || ""),
      type: String(row.account_type || "asset"),
      level: String(row.level || "ledger"),
      isGroup: row.is_group === true,
      isActive: row.is_active !== false,
      parentId: row.parent_id ? String(row.parent_id) : undefined,
      balance: 0,
    } as any);
  }

  await applySyncPullFinancialRecords(data, db);

  localStorage.setItem(SYNC_PULL_KEY, now);
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
      .filter(
        (r) => !r.syncedAt && (r.syncAttempts ?? 0) < MAX_ATTEMPTS && r.status !== "sync_failed",
      )
      .limit(BATCH_SIZE)
      .toArray();

    if (pending.length === 0) return;

    try {
      const ok = await pushBatch(pending);
      if (ok) {
        const now = new Date().toISOString();
        await Promise.all(
          pending.map((r) => db.syncOutbox.update(r.id, { syncedAt: now, status: "pending" })),
        );
        try {
          await pullRemoteChanges();
        } catch {
          /* pull is best-effort after push */
        }
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

export async function pullSyncNow(): Promise<void> {
  await pullRemoteChanges();
}

export async function syncNow(): Promise<void> {
  await runSyncCycle();
  await pullRemoteChanges();
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
