/** Read Sutra Dexie vouchers from Playwright browser context (IndexedDB). */

export type KhataVoucherRow = {
  id: string;
  voucherNo?: string;
  type?: string;
  status?: string;
  partyName?: string;
  grandTotal?: number;
  totalDebit?: number;
  totalCredit?: number;
  lines?: Array<{ debit: number; credit: number; accountName?: string }>;
};

export async function getKhataVouchers(
  page: import("@playwright/test").Page,
): Promise<KhataVoucherRow[]> {
  return page.evaluate(async () => {
    const DB_NAME = "SutraERPDatabase";

    const openDb = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
        req.onsuccess = () => resolve(req.result);
      });

    const db = await openDb();
    try {
      if (!db.objectStoreNames.contains("vouchers")) {
        return [];
      }
      return await new Promise<KhataVoucherRow[]>((resolve, reject) => {
        const tx = db.transaction("vouchers", "readonly");
        const store = tx.objectStore("vouchers");
        const req = store.getAll();
        req.onerror = () => reject(req.error ?? new Error("getAll failed"));
        req.onsuccess = () => {
          const rows = (req.result ?? []) as KhataVoucherRow[];
          resolve(rows.filter((v) => String(v.type ?? "").startsWith("khata_")));
        };
      });
    } finally {
      db.close();
    }
  });
}

export async function getPartyByName(
  page: import("@playwright/test").Page,
  name: string,
): Promise<{ id: string; name: string; balance?: number } | null> {
  return page.evaluate(async (partyName) => {
    const DB_NAME = "SutraERPDatabase";
    const openDb = (): Promise<IDBDatabase> =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME);
        req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
        req.onsuccess = () => resolve(req.result);
      });

    const db = await openDb();
    try {
      if (!db.objectStoreNames.contains("parties")) return null;
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("parties", "readonly");
        const store = tx.objectStore("parties");
        const req = store.getAll();
        req.onerror = () => reject(req.error ?? new Error("getAll failed"));
        req.onsuccess = () => {
          const rows = req.result ?? [];
          const hit = rows.find(
            (p: { name?: string }) =>
              String(p.name ?? "").toLowerCase() === partyName.toLowerCase(),
          );
          resolve(hit ?? null);
        };
      });
    } finally {
      db.close();
    }
  }, name);
}
