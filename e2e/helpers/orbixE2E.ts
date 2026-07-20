/**
 * Playwright helpers for Orbix E2E Dexie verification (test-only).
 */

export type LedgerSnapshot = {
  invoices: Array<{
    id: string;
    invoiceNo: string;
    type: string;
    status: string;
    grandTotal?: number;
    narration?: string;
    createdBy?: string;
    lines?: Array<{ itemId?: string; itemName?: string; qty?: number }>;
  }>;
  vouchers: Array<{
    id: string;
    voucherNo: string;
    type: string;
    status: string;
    totalDebit?: number;
    totalCredit?: number;
    narration?: string;
  }>;
  stockMovements: Array<{
    id: string;
    itemId: string;
    itemName?: string;
    qty: number;
    referenceId?: string;
    referenceNo?: string;
    type?: string;
  }>;
  auditLogs: Array<{
    id?: string | number;
    action?: string;
    entityId?: string;
    recordId?: string;
    after?: Record<string, unknown>;
  }>;
  syncOutbox: Array<{
    id: string;
    entityType: string;
    entityId: string;
    status?: string;
    payload?: Record<string, unknown>;
  }>;
  /** Phase 5+ accounting outbox (flattened; purchase/sales post → event sync). */
  eventSyncQueue?: Array<{
    id?: string;
    eventId?: string;
    status?: string;
    aggregateId?: string;
    invoiceId?: string;
    voucherId?: string;
  }>;
  receipts: Array<{
    id: string;
    scopedKey: string;
    status: string;
    invoiceId?: string | null;
    voucherId?: string | null;
    result?: Record<string, unknown> | null;
  }>;
  accountBalances: Record<string, number>;
  companyId?: string;
  itemBike?: { id: string; name: string; unit?: string } | null;
};

async function evalDb<T>(
  page: import("@playwright/test").Page,
  fn: () => Promise<T>,
): Promise<T> {
  return page.evaluate(fn);
}

export async function getLedgerSnapshot(
  page: import("@playwright/test").Page,
): Promise<LedgerSnapshot> {
  // Vite HMR can destroy the execution context mid-poll — retry briefly.
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      return await page.evaluate(async () => {
        const helper = (window as unknown as { __orbixE2E?: { getSnapshot: () => Promise<LedgerSnapshot> } })
          .__orbixE2E;
        if (helper?.getSnapshot) return helper.getSnapshot();

        const DB_NAME = "SutraERPDatabase";
        const openDb = (): Promise<IDBDatabase> =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME);
            req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
            req.onsuccess = () => resolve(req.result);
          });
        const all = <T>(db: IDBDatabase, store: string): Promise<T[]> =>
          new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(store)) {
              resolve([]);
              return;
            }
            const tx = db.transaction(store, "readonly");
            const req = tx.objectStore(store).getAll();
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve((req.result ?? []) as T[]);
          });

        const db = await openDb();
        try {
          const [
            invoices,
            vouchers,
            stockMovements,
            auditLogs,
            syncOutbox,
            eventSyncQueue,
            receipts,
            accounts,
            items,
          ] = await Promise.all([
            all<LedgerSnapshot["invoices"][0]>(db, "invoices"),
            all<LedgerSnapshot["vouchers"][0]>(db, "vouchers"),
            all<LedgerSnapshot["stockMovements"][0]>(db, "stockMovements"),
            all<LedgerSnapshot["auditLogs"][0]>(db, "auditLogs"),
            all<LedgerSnapshot["syncOutbox"][0]>(db, "syncOutbox"),
            all<NonNullable<LedgerSnapshot["eventSyncQueue"]>[0]>(db, "eventSyncQueue"),
            all<LedgerSnapshot["receipts"][0]>(db, "orbixPostingReceipts"),
            all<{ id: string; balance?: number }>(db, "accounts"),
            all<{ id: string; name: string; unit?: string }>(db, "items"),
          ]);
          const accountBalances: Record<string, number> = {};
          for (const a of accounts) accountBalances[a.id] = Number(a.balance || 0);
          const itemBike =
            items.find((i) => i.id === "item-e2e-test-bike" || i.name === "E2E Test Bike") || null;
          return {
            invoices,
            vouchers,
            stockMovements,
            auditLogs,
            syncOutbox,
            eventSyncQueue,
            receipts,
            accountBalances,
            itemBike,
          };
        } finally {
          db.close();
        }
      });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/Execution context was destroyed|Target closed|navigation/i.test(msg)) {
        throw err;
      }
      await page.waitForTimeout(500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function resetAndSeedOrbixE2E(page: import("@playwright/test").Page): Promise<{
  companyId: string;
  itemId: string;
  authorizedUserId: string;
}> {
  return page.evaluate(async () => {
    const w = window as unknown as {
      __orbixE2E?: {
        resetAndSeed: () => Promise<{
          companyId: string;
          itemId: string;
          authorizedUserId: string;
        }>;
      };
    };
    if (!w.__orbixE2E?.resetAndSeed) {
      throw new Error("__orbixE2E.resetAndSeed missing — open /e2e/ui-qa.html harness");
    }
    return w.__orbixE2E.resetAndSeed();
  });
}

export async function assertE2ECompanyActive(page: import("@playwright/test").Page): Promise<void> {
  const ok = await page.evaluate(() => {
    const w = window as unknown as {
      __orbixE2E?: { assertSafeCompany: () => boolean };
    };
    return w.__orbixE2E?.assertSafeCompany?.() ?? false;
  });
  if (!ok) throw new Error("Active company is not Orbix E2E Test Company — aborting");
}

export { evalDb };

/** Re-export legacy helpers */
export { getKhataVouchers, getPartyByName } from "./indexedDb";
