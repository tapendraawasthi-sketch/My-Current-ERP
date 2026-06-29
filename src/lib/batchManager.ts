export interface BatchRecord {
  id: string;
  itemId: string;
  itemName: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  mrp: number;
  purchaseRate: number;
  saleRate: number;
  openingQty: number;
  currentQty: number;
  warehouseId: string;
  warehouseName: string;
  supplierId: string;
  supplierName: string;
  purchaseInvoiceId: string;
  purchaseInvoiceNo: string;
  purchaseDate: string;
  isActive: boolean;
  companyId: string;
}

export type BatchStatus = "ok" | "near_expiry" | "expired" | "out_of_stock";

export interface BatchWithStatus extends BatchRecord {
  status: BatchStatus;
  daysToExpiry: number;
}

const STORAGE_KEY = "sutra_batches";

function readAllBatches(): BatchRecord[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllBatches(batches: BatchRecord[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
  } catch {
    // Never crash application on storage failure.
  }
}

function getDaysToExpiry(expiryDate: string): number {
  if (!expiryDate) return -999999;
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return -999999;
  return Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function withStatus(batch: BatchRecord): BatchWithStatus {
  const daysToExpiry = getDaysToExpiry(batch.expiryDate);

  let status: BatchStatus = "ok";
  if (batch.currentQty <= 0) status = "out_of_stock";
  else if (daysToExpiry < 0) status = "expired";
  else if (daysToExpiry <= 30) status = "near_expiry";

  return {
    ...batch,
    status,
    daysToExpiry,
  };
}

export function loadBatches(companyId: string): BatchRecord[] {
  try {
    return readAllBatches().filter((batch) => batch.companyId === companyId);
  } catch {
    return [];
  }
}

export function saveBatch(batch: BatchRecord): void {
  try {
    const all = readAllBatches();
    const index = all.findIndex((row) => row.id === batch.id);

    if (index >= 0) all[index] = batch;
    else all.push(batch);

    writeAllBatches(all);
  } catch {
    // Never crash caller.
  }
}

export function getBatchesForItem(
  itemId: string,
  companyId: string,
  warehouseId?: string,
  showExpired: boolean = true,
): BatchWithStatus[] {
  try {
    let batches = loadBatches(companyId)
      .filter((batch) => batch.itemId === itemId)
      .filter((batch) => (warehouseId ? batch.warehouseId === warehouseId : true))
      .map(withStatus);

    if (!showExpired) {
      batches = batches.filter((batch) => batch.status !== "expired");
    }

    return batches.sort((a, b) => {
      const ad = new Date(a.expiryDate).getTime();
      const bd = new Date(b.expiryDate).getTime();
      return ad - bd;
    });
  } catch {
    return [];
  }
}

export function getAvailableBatchQty(
  itemId: string,
  warehouseId: string,
  companyId: string,
): number {
  return getBatchesForItem(itemId, companyId, warehouseId, false)
    .filter((batch) => batch.status !== "expired" && batch.status !== "out_of_stock")
    .reduce((sum, batch) => sum + Number(batch.currentQty || 0), 0);
}

export function deductBatchQty(batchId: string, qtyToDeduct: number, companyId: string): void {
  const all = readAllBatches();
  const index = all.findIndex((batch) => batch.id === batchId && batch.companyId === companyId);

  if (index === -1) {
    throw new Error("Batch not found");
  }

  const currentQty = Number(all[index].currentQty || 0);

  if (currentQty < qtyToDeduct) {
    throw new Error(`Insufficient qty: available ${currentQty}, requested ${qtyToDeduct}`);
  }

  all[index] = {
    ...all[index],
    currentQty: currentQty - qtyToDeduct,
  };

  writeAllBatches(all);
}

export function addBatchQty(batchId: string, qtyToAdd: number, companyId: string): void {
  const all = readAllBatches();
  const index = all.findIndex((batch) => batch.id === batchId && batch.companyId === companyId);

  if (index === -1) {
    throw new Error("Batch not found");
  }

  all[index] = {
    ...all[index],
    currentQty: Number(all[index].currentQty || 0) + qtyToAdd,
  };

  writeAllBatches(all);
}

export function createBatchFromPurchase(
  data: Omit<BatchRecord, "id" | "currentQty" | "isActive">,
): BatchRecord {
  const batch: BatchRecord = {
    ...data,
    id: crypto.randomUUID(),
    currentQty: data.openingQty,
    isActive: true,
  };

  saveBatch(batch);
  return batch;
}

export function getNearExpiryBatches(
  companyId: string,
  daysThreshold: number = 30,
): BatchWithStatus[] {
  return loadBatches(companyId)
    .map(withStatus)
    .filter(
      (batch) =>
        batch.currentQty > 0 && batch.daysToExpiry >= 0 && batch.daysToExpiry <= daysThreshold,
    )
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

export function getExpiredBatches(companyId: string): BatchWithStatus[] {
  return loadBatches(companyId)
    .map(withStatus)
    .filter((batch) => batch.status === "expired")
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
}

export function getBatchValueReport(companyId: string): {
  itemId: string;
  itemName: string;
  totalBatches: number;
  totalQty: number;
  totalValue: number;
  nearExpiryQty: number;
  expiredQty: number;
}[] {
  const map = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      totalBatches: number;
      totalQty: number;
      totalValue: number;
      nearExpiryQty: number;
      expiredQty: number;
    }
  >();

  for (const batch of loadBatches(companyId).map(withStatus)) {
    if (!map.has(batch.itemId)) {
      map.set(batch.itemId, {
        itemId: batch.itemId,
        itemName: batch.itemName,
        totalBatches: 0,
        totalQty: 0,
        totalValue: 0,
        nearExpiryQty: 0,
        expiredQty: 0,
      });
    }

    const row = map.get(batch.itemId)!;
    row.totalBatches += 1;
    row.totalQty += Number(batch.currentQty || 0);

    if (batch.status !== "expired") {
      row.totalValue += Number(batch.currentQty || 0) * Number(batch.purchaseRate || 0);
    }

    if (batch.status === "near_expiry") {
      row.nearExpiryQty += Number(batch.currentQty || 0);
    }

    if (batch.status === "expired") {
      row.expiredQty += Number(batch.currentQty || 0);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
}

export function selectBatchesFEFO(
  itemId: string,
  warehouseId: string,
  companyId: string,
  requiredQty: number,
): { batchId: string; batchNo: string; qty: number; rate: number; expiryDate: string }[] {
  const batches = getBatchesForItem(itemId, companyId, warehouseId, false).filter(
    (batch) => batch.status !== "expired" && batch.currentQty > 0,
  );

  const totalAvailable = batches.reduce((sum, batch) => sum + Number(batch.currentQty || 0), 0);

  if (totalAvailable < requiredQty) {
    throw new Error(
      `Insufficient stock across all batches. Available: ${totalAvailable}, Required: ${requiredQty}`,
    );
  }

  const selections: {
    batchId: string;
    batchNo: string;
    qty: number;
    rate: number;
    expiryDate: string;
  }[] = [];

  let remaining = requiredQty;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const takeQty = Math.min(remaining, batch.currentQty);
    selections.push({
      batchId: batch.id,
      batchNo: batch.batchNo,
      qty: takeQty,
      rate: batch.saleRate,
      expiryDate: batch.expiryDate,
    });

    remaining -= takeQty;
  }

  return selections;
}
