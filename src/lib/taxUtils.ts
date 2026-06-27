// src/lib/taxUtils.ts

export interface LineForVAT {
  qty: number;
  rate: number;
  discount?: number; // percent
  vatExempt?: boolean;
  isTaxable?: boolean;
  vatRate?: number;
  itemName?: string;
}

export interface VATComputation {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  grandTotal: number;
  // Aliases used by OrderForm
  subTotal: number;
  taxableTotal: number;
  exemptTotal: number;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
export const VAT_RATE = 0.13;

export function computeVatExclusive(baseAmount: number) {
  const taxableAmount = round2(baseAmount);
  const vatAmount = round2(taxableAmount * VAT_RATE);

  return {
    taxableAmount,
    vatAmount,
    totalAmount: round2(taxableAmount + vatAmount),
  };
}

export function computeVatInclusive(inclusiveAmount: number) {
  const totalAmount = round2(inclusiveAmount);
  const taxableAmount = round2(totalAmount / (1 + VAT_RATE));
  const vatAmount = round2(totalAmount - taxableAmount);

  return {
    taxableAmount,
    vatAmount,
    totalAmount,
  };
}

export function computeInvoiceVAT(lines: LineForVAT[], vatRate = 13): VATComputation {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  let exemptAmount = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const gross = round2((line.qty || 0) * (line.rate || 0));
    const discAmt = round2(gross * ((line.discount || 0) / 100));
    const net = round2(gross - discAmt);
    subtotal = round2(subtotal + gross);
    totalDiscount = round2(totalDiscount + discAmt);
    const isExempt = line.vatExempt === true || line.isTaxable === false;
    if (isExempt) {
      exemptAmount = round2(exemptAmount + net);
    } else {
      taxableAmount = round2(taxableAmount + net);
      const lineVatRate = line.vatRate !== undefined ? line.vatRate : vatRate;
      vatAmount = round2(vatAmount + round2(net * (lineVatRate / 100)));
    }
  }

  const grandTotal = round2(taxableAmount + exemptAmount + vatAmount);

  return {
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    taxableAmount: round2(taxableAmount),
    exemptAmount: round2(exemptAmount),
    vatAmount: round2(vatAmount),
    grandTotal,
    // Aliases
    subTotal: round2(subtotal),
    taxableTotal: round2(taxableAmount),
    exemptTotal: round2(exemptAmount),
  };
}

// Used by OrderForm
export function computeVAT(lines: Array<{
  qty: number;
  rate: number;
  discount?: number;
  isTaxable?: boolean;
  vatRate?: number;
  itemName?: string;
}>): VATComputation {
  return computeInvoiceVAT(
    lines.map((l) => ({
      qty: l.qty,
      rate: l.rate,
      discount: l.discount || 0,
      vatExempt: l.isTaxable === false,
      vatRate: l.vatRate,
    }))
  );
}

export function validatePAN(pan: string): boolean {
  if (!pan) return false;
  return /^\d{9}$/.test(pan.trim());
}

export function validateVAT(vat: string): boolean {
  if (!vat) return false;
  return /^\d{9}$/.test(vat.trim());
}

export function computeTDS(amount: number, rate: number): number {
  return round2(amount * (rate / 100));
}

// ─── TDS withholding calculator ───────────────────────────────────────────────
export function computeWithholdingTDS(
  grossAmount: number,
  rate: number,
  threshold: number = 0
): { tdsAmount: number; netAmount: number; isBelowThreshold: boolean } {
  const gross = Number(grossAmount) || 0;
  const r = Number(rate) || 0;
  const thresh = Number(threshold) || 0;

  if (gross <= thresh) {
    return { tdsAmount: 0, netAmount: gross, isBelowThreshold: true };
  }
  const tdsAmount = round2(gross * (r / 100));
  const netAmount = round2(gross - tdsAmount);
  return { tdsAmount, netAmount, isBelowThreshold: false };
}

// ─── VAT Annex helpers ─────────────────────────────────────────────────────────
type AnnexRow = {
  sn: number;
  billNo: string;
  billNumber: string;
  date: string;
  partyName: string;
  partyPan: string;
  customerPAN: string;
  supplierPAN: string;
  taxableAmt: number;
  vatAmt: number;
  exemptAmt: number;
  totalAmt: number;
};
type AnnexResult = {
  rows: AnnexRow[];
  totals: { taxable: number; vat: number; exempt: number; total: number };
};

function emptyAnnex(): AnnexResult {
  return { rows: [], totals: { taxable: 0, vat: 0, exempt: 0, total: 0 } };
}

function isBetween(dateStr: string, start: string, end: string): boolean {
  if (!dateStr) return false;
  return dateStr >= start && dateStr <= end;
}

// Annex A — Sales invoices with VAT
export function computeVatAnnexA(
  invoices: any[],
  _vouchers: any[],
  _accounts: any[],
  startDate: string,
  endDate: string
): AnnexResult {
  if (!Array.isArray(invoices)) return emptyAnnex();

  const salesInvoices = invoices.filter(
    (inv) =>
      (inv.status === "posted" || inv.status === "POSTED") &&
      (inv.type === "sales-invoice" || inv.type === "sales_invoice" || inv.type === "sales-return" || inv.type === "sales_return") &&
      isBetween(inv.date, startDate, endDate)
  );

  let taxable = 0, vat = 0, exempt = 0, total = 0;
  const rows: AnnexRow[] = salesInvoices.map((inv, idx) => {
    const sign = (inv.type === "sales-return" || inv.type === "sales_return") ? -1 : 1;
    const t = round2(Number(inv.taxableAmount) || 0) * sign;
    const v = round2(Number(inv.vatAmount) || 0) * sign;
    const e = round2(Number(inv.exemptAmount) || 0) * sign;
    const tot = round2(Number(inv.grandTotal) || (t + v + e)) * sign;
    taxable += t; vat += v; exempt += e; total += tot;
    return {
      sn: idx + 1,
      billNo: inv.invoiceNo || inv.id,
      billNumber: inv.invoiceNo || inv.id,
      date: inv.date,
      partyName: inv.partyName || "",
      partyPan: inv.partyPan || inv.partyPAN || "",
      customerPAN: inv.partyPan || inv.partyPAN || "",
      supplierPAN: "",
      taxableAmt: t,
      vatAmt: v,
      exemptAmt: e,
      totalAmt: tot,
    };
  });

  return {
    rows,
    totals: {
      taxable: round2(taxable),
      vat: round2(vat),
      exempt: round2(exempt),
      total: round2(total),
    },
  };
}

// Annex B — Purchase invoices with VAT
export function computeVatAnnexB(
  invoices: any[],
  _vouchers: any[],
  _accounts: any[],
  startDate: string,
  endDate: string
): AnnexResult {
  if (!Array.isArray(invoices)) return emptyAnnex();

  const purchaseInvoices = invoices.filter(
    (inv) =>
      (inv.status === "posted" || inv.status === "POSTED") &&
      (inv.type === "purchase-invoice" || inv.type === "purchase_invoice" || inv.type === "purchase-return" || inv.type === "purchase_return") &&
      isBetween(inv.date, startDate, endDate)
  );

  let taxable = 0, vat = 0, exempt = 0, total = 0;
  const rows: AnnexRow[] = purchaseInvoices.map((inv, idx) => {
    const sign = (inv.type === "purchase-return" || inv.type === "purchase_return") ? -1 : 1;
    const t = round2(Number(inv.taxableAmount) || 0) * sign;
    const v = round2(Number(inv.vatAmount) || 0) * sign;
    const e = round2(Number(inv.exemptAmount) || 0) * sign;
    const tot = round2(Number(inv.grandTotal) || (t + v + e)) * sign;
    taxable += t; vat += v; exempt += e; total += tot;
    return {
      sn: idx + 1,
      billNo: inv.invoiceNo || inv.id,
      billNumber: inv.invoiceNo || inv.id,
      date: inv.date,
      partyName: inv.partyName || "",
      partyPan: inv.partyPan || inv.partyPAN || "",
      customerPAN: "",
      supplierPAN: inv.partyPan || inv.partyPAN || "",
      taxableAmt: t,
      vatAmt: v,
      exemptAmt: e,
      totalAmt: tot,
    };
  });

  return {
    rows,
    totals: {
      taxable: round2(taxable),
      vat: round2(vat),
      exempt: round2(exempt),
      total: round2(total),
    },
  };
}

// Annex C — Import invoices
export function computeVatAnnexC(
  invoices: any[],
  startDate: string,
  endDate: string
): AnnexResult {
  if (!Array.isArray(invoices)) return emptyAnnex();

  const importInvoices = invoices.filter(
    (inv) =>
      (inv.type === "import-invoice" || inv.type === "import") &&
      inv.status !== "cancelled" &&
      isBetween(inv.date, startDate, endDate)
  );

  let taxable = 0, vat = 0, exempt = 0, total = 0;
  const rows: AnnexRow[] = importInvoices.map((inv, idx) => {
    const t = round2(Number(inv.taxableAmount) || 0);
    const v = round2(Number(inv.vatAmount) || 0);
    const e = round2(Number(inv.exemptAmount) || 0);
    const tot = round2(Number(inv.grandTotal) || t + v + e);
    taxable += t; vat += v; exempt += e; total += tot;
    return {
      sn: idx + 1,
      billNo: inv.invoiceNo || inv.id,
      billNumber: inv.invoiceNo || inv.id,
      date: inv.date,
      partyName: inv.partyName || "",
      partyPan: inv.partyPan || inv.partyPAN || "",
      customerPAN: "",
      supplierPAN: inv.partyPan || inv.partyPAN || "",
      taxableAmt: t,
      vatAmt: v,
      exemptAmt: e,
      totalAmt: tot,
    };
  });

  return {
    rows,
    totals: {
      taxable: round2(taxable),
      vat: round2(vat),
      exempt: round2(exempt),
      total: round2(total),
    },
  };
}

// VAT 3 Return summary
export function computeVAT3Return(
  annexA: AnnexResult,
  annexB: AnnexResult,
  _startDate?: string,
  _endDate?: string
): {
  salesVat: number;
  purchaseVat: number;
  netVat: number;
  vatPayable: number;
  vatRefundable: number;
  prevBalance: number;
} {
  const salesVat = round2(annexA?.totals?.vat || 0);
  const purchaseVat = round2(annexB?.totals?.vat || 0);
  const prevBalance = 0; // loaded from settings in a full impl
  const netVat = round2(salesVat - purchaseVat - prevBalance);
  const vatPayable = netVat > 0 ? netVat : 0;
  const vatRefundable = netVat < 0 ? Math.abs(netVat) : 0;
  return { salesVat, purchaseVat, netVat, vatPayable, vatRefundable, prevBalance };
}
