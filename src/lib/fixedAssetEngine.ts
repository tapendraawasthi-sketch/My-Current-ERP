export interface FixedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  location: string;
  purchaseDate: string;
  purchaseInvoiceNo: string;
  supplierId: string;
  supplierName: string;
  purchaseCost: number;
  installationCost: number;
  totalCost: number;
  depreciationMethod: "straight_line" | "diminishing_balance" | "none";
  usefulLifeYears: number;
  depreciationRate: number;
  salvageValue: number;
  accumulatedDepreciation: number;
  bookValue: number;
  disposalDate: string;
  disposalAmount: number;
  disposalReason: string;
  status: "active" | "disposed" | "written_off" | "under_repair";
  assetTag: string;
  department: string;
  assignedTo: string;
  insuredUpto: string;
  warrantyUpto: string;
  notes: string;
  companyId: string;
  fiscalYear: string;
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  assetName: string;
  period: string;
  depreciation: number;
  bookValueBefore: number;
  bookValueAfter: number;
  method: string;
  postedAt: string;
  postedBy: string;
  voucherId: string;
}

const ASSETS_KEY = "sutra_fixed_assets";
const DEPRECIATION_KEY = "sutra_depreciation_entries";

// ─── 1. loadAssets ────────────────────────────────────────────────────────────
export function loadAssets(companyId: string): FixedAsset[] {
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    if (!raw) return [];
    const all: FixedAsset[] = JSON.parse(raw);
    return all.filter((a) => a.companyId === companyId);
  } catch {
    return [];
  }
}

// ─── 2. saveAsset ────────────────────────────────────────────────────────────
export function saveAsset(asset: FixedAsset): void {
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    const all: FixedAsset[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      all[idx] = asset;
    } else {
      all.push(asset);
    }
    localStorage.setItem(ASSETS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("saveAsset error:", e);
  }
}

// ─── 3. generateAssetCode ────────────────────────────────────────────────────
export function generateAssetCode(companyId: string): string {
  const assets = loadAssets(companyId);
  let max = 0;
  for (const a of assets) {
    const match = a.assetCode.match(/FA-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return "FA-" + String(max + 1).padStart(4, "0");
}

// ─── 4. computeMonthlyDepreciation ───────────────────────────────────────────
export function computeMonthlyDepreciation(asset: FixedAsset): number {
  if (asset.status !== "active" || asset.depreciationMethod === "none") return 0;
  let amount = 0;
  if (asset.depreciationMethod === "straight_line") {
    const depreciableAmount = asset.totalCost - asset.salvageValue;
    const months = asset.usefulLifeYears * 12;
    amount = months > 0 ? depreciableAmount / months : 0;
  } else if (asset.depreciationMethod === "diminishing_balance") {
    amount = (asset.bookValue * (asset.depreciationRate / 100)) / 12;
  }
  return Math.max(0, Math.round(amount * 100) / 100);
}

// ─── 5. runMonthlyDepreciation ───────────────────────────────────────────────
export function runMonthlyDepreciation(
  companyId: string,
  period: string,
  postedBy: string
): DepreciationEntry[] {
  const assets = loadAssets(companyId);
  const entries: DepreciationEntry[] = [];

  for (const asset of assets) {
    if (asset.status !== "active" || asset.depreciationMethod === "none") continue;

    const rawDepreciation = computeMonthlyDepreciation(asset);
    // Cap so bookValue never goes below salvageValue
    const maxAllowed = Math.max(0, asset.bookValue - asset.salvageValue);
    const depreciation = Math.min(rawDepreciation, maxAllowed);

    if (depreciation <= 0) continue;

    const bookValueBefore = asset.bookValue;
    const bookValueAfter = Math.round((asset.bookValue - depreciation) * 100) / 100;

    const entry: DepreciationEntry = {
      id: crypto.randomUUID(),
      assetId: asset.id,
      assetName: asset.assetName,
      period,
      depreciation,
      bookValueBefore,
      bookValueAfter,
      method: asset.depreciationMethod,
      postedAt: new Date().toISOString(),
      postedBy,
      voucherId: "",
    };

    entries.push(entry);

    // Update asset
    asset.accumulatedDepreciation = Math.round(
      (asset.accumulatedDepreciation + depreciation) * 100
    ) / 100;
    asset.bookValue = bookValueAfter;
    saveAsset(asset);
  }

  // Persist new depreciation entries
  try {
    const raw = localStorage.getItem(DEPRECIATION_KEY);
    const existing: DepreciationEntry[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(DEPRECIATION_KEY, JSON.stringify([...existing, ...entries]));
  } catch (e) {
    console.error("runMonthlyDepreciation save error:", e);
  }

  return entries;
}

// ─── 6. loadDepreciationHistory ──────────────────────────────────────────────
export function loadDepreciationHistory(assetId: string): DepreciationEntry[] {
  try {
    const raw = localStorage.getItem(DEPRECIATION_KEY);
    if (!raw) return [];
    const all: DepreciationEntry[] = JSON.parse(raw);
    return all
      .filter((e) => e.assetId === assetId)
      .sort((a, b) => a.period.localeCompare(b.period));
  } catch {
    return [];
  }
}

// ─── 7. getAssetSchedule ─────────────────────────────────────────────────────
export function getAssetSchedule(
  asset: FixedAsset
): { year: number; openingValue: number; depreciation: number; closingValue: number }[] {
  const schedule: { year: number; openingValue: number; depreciation: number; closingValue: number }[] = [];
  if (asset.depreciationMethod === "none") return schedule;

  let bookValue = asset.bookValue;
  const salvage = asset.salvageValue;
  const maxYears = Math.min(asset.usefulLifeYears || 30, 30);

  for (let year = 1; year <= maxYears; year++) {
    if (bookValue <= salvage) break;

    const opening = bookValue;
    let annualDepr = 0;

    if (asset.depreciationMethod === "straight_line") {
      const annualRate =
        asset.usefulLifeYears > 0
          ? (asset.totalCost - salvage) / asset.usefulLifeYears
          : 0;
      annualDepr = annualRate;
    } else if (asset.depreciationMethod === "diminishing_balance") {
      annualDepr = bookValue * (asset.depreciationRate / 100);
    }

    const maxAllowed = Math.max(0, bookValue - salvage);
    annualDepr = Math.min(annualDepr, maxAllowed);
    annualDepr = Math.round(annualDepr * 100) / 100;

    const closing = Math.round((bookValue - annualDepr) * 100) / 100;

    schedule.push({ year, openingValue: opening, depreciation: annualDepr, closingValue: closing });
    bookValue = closing;
  }

  return schedule;
}

// ─── 8. disposeAsset ─────────────────────────────────────────────────────────
export function disposeAsset(
  assetId: string,
  disposalDate: string,
  disposalAmount: number,
  reason: string,
  companyId: string
): void {
  try {
    const raw = localStorage.getItem(ASSETS_KEY);
    const all: FixedAsset[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((a) => a.id === assetId && a.companyId === companyId);
    if (idx < 0) return;
    all[idx].status = "disposed";
    all[idx].disposalDate = disposalDate;
    all[idx].disposalAmount = disposalAmount;
    all[idx].disposalReason = reason;
    localStorage.setItem(ASSETS_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("disposeAsset error:", e);
  }
}

// ─── 9. getAssetSummaryByCategory ────────────────────────────────────────────
export function getAssetSummaryByCategory(
  companyId: string
): {
  category: string;
  count: number;
  totalCost: number;
  totalDepreciation: number;
  totalBookValue: number;
}[] {
  const assets = loadAssets(companyId).filter((a) => a.status === "active");
  const map = new Map<
    string,
    { count: number; totalCost: number; totalDepreciation: number; totalBookValue: number }
  >();

  for (const asset of assets) {
    const existing = map.get(asset.category) ?? {
      count: 0,
      totalCost: 0,
      totalDepreciation: 0,
      totalBookValue: 0,
    };
    map.set(asset.category, {
      count: existing.count + 1,
      totalCost: existing.totalCost + asset.totalCost,
      totalDepreciation: existing.totalDepreciation + asset.accumulatedDepreciation,
      totalBookValue: existing.totalBookValue + asset.bookValue,
    });
  }

  return Array.from(map.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
