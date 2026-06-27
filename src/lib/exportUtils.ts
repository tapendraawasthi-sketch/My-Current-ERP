// src/lib/exportUtils.ts
import * as XLSX from "xlsx";

export function exportInvoicesToExcel(invoices: any[]): void {
  const headers = [
    "Invoice No", "Date (BS)", "Date (AD)", "Type", "Party Name", "Party PAN",
    "Sub Total", "Discount", "Taxable", "Exempt", "VAT", "Grand Total",
    "Payment Mode", "Payment Status", "Status",
  ];

  const rows = invoices.map((inv) => [
    inv.invoiceNo || "",
    inv.dateNepali || "",
    inv.date || "",
    (inv.type || "").replace(/-/g, " ").toUpperCase(),
    inv.partyName || "",
    inv.partyPan || "",
    Number(inv.subTotal) || 0,
    Number(inv.discountAmount) || 0,
    Number(inv.taxableAmount) || 0,
    Number(inv.exemptAmount) || 0,
    Number(inv.vatAmount) || 0,
    Number(inv.grandTotal) || 0,
    inv.paymentMode || "",
    inv.paymentStatus || "",
    inv.status || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportVouchersToExcel(vouchers: any[], accounts?: any[]): void {
  const headers = [
    "Voucher No", "Date (BS)", "Date (AD)", "Type", "Narration",
    "Total Debit", "Total Credit", "Status",
  ];

  const rows = vouchers.map((v) => [
    v.voucherNo || "",
    v.dateNepali || "",
    v.date || "",
    (v.type || "").toUpperCase(),
    v.narration || "",
    Number(v.totalDebit) || 0,
    Number(v.totalCredit) || 0,
    v.status || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Vouchers");
  XLSX.writeFile(wb, `Vouchers_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportToCSV(data: any[], filename = "export.csv"): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? "" : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportLedgerToExcel = () => {};
export const exportTrialBalanceToExcel = () => {};

export const exportProfitLossToExcel = () => {};
export const exportBalanceSheetToExcel = () => {};
export const exportCashFlowToExcel = () => {};

// ─── VAT Annex Excel export ────────────────────────────────────────────────────
export function workbookFromArray(
  headers: string[],
  rows: (string | number)[][],
  sheetName = "Sheet1"
): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

export function exportVatAnnexToExcel(
  type: "A" | "B" | "C",
  data: { rows: any[]; totals: any },
  periodLabel: string
): void {
  if (!data?.rows?.length) return;

  const isA = type === "A";
  const headers =
    isA
      ? ["SN", "Bill No", "Bill Date", "Customer Name", "PAN", "Taxable Amount", "VAT Amount", "Total"]
      : ["SN", "Bill No", "Supplier Name", "PAN", "Taxable Amount", "VAT Amount", "Total"];

  const rows = data.rows.map((r: any, idx: number) => {
    const base = [
      idx + 1,
      r.billNo || "",
      ...(isA ? [r.date || ""] : []),
      r.partyName || "",
      r.partyPan || "-",
      r.taxableAmt || 0,
      r.vatAmt || 0,
      r.totalAmt || 0,
    ];
    return base;
  });

  const wb = workbookFromArray(headers, rows, `Annex ${type}`);
  downloadWorkbook(wb, `VAT_Annex_${type}_${periodLabel.replace(/\s+/g, "_")}.xlsx`);
}

// ─── TDS Return Excel export ───────────────────────────────────────────────────
export function exportTdsReturnToExcel(
  entries: any[],
  fiscalYear: string,
  companyName: string
): void {
  if (!entries?.length) return;

  const headers = [
    "S.N.",
    "Deductee Name",
    "Deductee PAN",
    "Nature of Payment (Section)",
    "Payment Date (BS)",
    "Gross Payment Amount",
    "TDS Rate (%)",
    "TDS Amount Deducted",
    "Remarks"
  ];

  const rows = entries.map((e: any, idx: number) => [
    idx + 1,
    e.partyName || "",
    e.partyPAN || "",
    `${e.paymentNature || ""} (${e.section || ""})`,
    e.dateBS || e.date || "",
    Number(e.grossAmount) || 0,
    Number(e.tdsRate) || 0,
    Number(e.tdsAmount) || 0,
    e.remarks || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [`${companyName} — TDS Return (FY ${fiscalYear})`],
    [],
    headers,
    ...rows,
  ]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TDS Return");
  XLSX.writeFile(wb, `TDS_Return_FY${fiscalYear}.xlsx`);
}
