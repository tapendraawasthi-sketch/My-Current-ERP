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
