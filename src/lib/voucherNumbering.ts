export interface VoucherSeries {
  id: string;
  companyId: string;
  voucherType: string;
  prefix: string;
  suffix: string;
  currentNumber: number;
  padLength: number;
  resetOnFiscalYear: boolean;
  fiscalYear: string;
  branchCode: string;
}

export interface NumberingConfig {
  series: VoucherSeries[];
}

export function getSeriesKey(companyId: string): string {
  return `sutra_voucher_series_${companyId}`;
}

export function loadAllSeries(companyId: string): VoucherSeries[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(getSeriesKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAllSeries(companyId: string, series: VoucherSeries[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(getSeriesKey(companyId), JSON.stringify(series));
  } catch {
    // Never throw from numbering storage.
  }
}

export function getDefaultPrefix(voucherType: string): string {
  switch (voucherType) {
    case "SALES":
      return "INV-";
    case "PURCHASE":
      return "PUR-";
    case "PAYMENT":
      return "PAY-";
    case "RECEIPT":
      return "REC-";
    case "JOURNAL":
      return "JV-";
    case "DEBIT_NOTE":
      return "DN-";
    case "CREDIT_NOTE":
      return "CN-";
    case "QUOTATION":
      return "QT-";
    case "DELIVERY_CHALLAN":
      return "DC-";
    case "GRN":
      return "GRN-";
    case "STOCK_JOURNAL":
      return "SJ-";
    default:
      return "DOC-";
  }
}

export function getOrCreateSeries(
  companyId: string,
  voucherType: string,
  fiscalYear: string,
): VoucherSeries {
  const allSeries = loadAllSeries(companyId);

  const existing = allSeries.find(
    (series) => series.voucherType === voucherType && series.fiscalYear === fiscalYear,
  );

  if (existing) return existing;

  const created: VoucherSeries = {
    id: crypto.randomUUID(),
    companyId,
    voucherType,
    prefix: getDefaultPrefix(voucherType),
    suffix: "",
    currentNumber: 0,
    padLength: 4,
    resetOnFiscalYear: true,
    fiscalYear,
    branchCode: "",
  };

  allSeries.push(created);
  saveAllSeries(companyId, allSeries);

  return created;
}

function formatVoucherNumber(series: VoucherSeries, nextNumber: number): string {
  return `${series.prefix}${nextNumber.toString().padStart(series.padLength, "0")}${series.suffix}`;
}

export function generateNextNumber(
  companyId: string,
  voucherType: string,
  fiscalYear: string,
): string {
  const series = getOrCreateSeries(companyId, voucherType, fiscalYear);
  const nextNumber = series.currentNumber + 1;

  const updatedSeries: VoucherSeries = {
    ...series,
    currentNumber: nextNumber,
  };

  updateSeries(companyId, updatedSeries);

  return formatVoucherNumber(updatedSeries, nextNumber);
}

export function previewNextNumber(
  companyId: string,
  voucherType: string,
  fiscalYear: string,
): string {
  const series = getOrCreateSeries(companyId, voucherType, fiscalYear);
  const nextNumber = series.currentNumber + 1;
  return formatVoucherNumber(series, nextNumber);
}

export function updateSeries(companyId: string, series: VoucherSeries): void {
  try {
    const allSeries = loadAllSeries(companyId);
    const index = allSeries.findIndex((row) => row.id === series.id);

    if (index >= 0) {
      allSeries[index] = series;
    } else {
      allSeries.push(series);
    }

    saveAllSeries(companyId, allSeries);
  } catch {
    // Never throw from updateSeries.
  }
}

export function checkForDuplicateNumber(
  companyId: string,
  voucherType: string,
  voucherNo: string,
  excludeId?: string,
): boolean {
  try {
    if (typeof localStorage === "undefined") return false;

    const raw = localStorage.getItem(`sutra_vouchers_${companyId}`);
    if (!raw) return false;

    const vouchers = JSON.parse(raw);
    if (!Array.isArray(vouchers)) return false;

    return vouchers.some((voucher) => {
      if (!voucher) return false;
      if (voucher.id === excludeId) return false;
      return voucher.voucherNo === voucherNo && voucher.voucherType === voucherType;
    });
  } catch {
    return false;
  }
}
