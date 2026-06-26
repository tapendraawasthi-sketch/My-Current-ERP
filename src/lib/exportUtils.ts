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
    "SN", "Date", "Party Name", "PAN", "Section",
    "Nature of Payment", "Gross Amount", "TDS Rate (%)", "TDS Amount", "Net Amount", "Status"
  ];

  const rows = entries.map((e: any, idx: number) => [
    idx + 1,
    e.dateBS || e.date || "",
    e.partyName || "",
    e.partyPAN || "",
    e.section || "",
    e.paymentNature || "",
    Number(e.grossAmount) || 0,
    Number(e.tdsRate) || 0,
    Number(e.tdsAmount) || 0,
    Number(e.netAmount) || 0,
    e.status || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [`${companyName} — TDS Return (FY ${fiscalYear})`],
    [],
    headers,
    ...rows,
  ]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(String(h).length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.writeFile(wb, `TDS_Return_FY${fiscalYear}.xlsx`);
}

export async function logExport(reportType: string, format: string, fileName: string, status: string = 'success') {
  try {
    await fetch('/api/export/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + sessionStorage.getItem('sutra_token')
      },
      body: JSON.stringify({
        reportType,
        format,
        fileName,
        exportedBy: sessionStorage.getItem('sutra_user_id'),
        status
      })
    });
  } catch (err) {
    console.error('Failed to log export:', err);
  }
}

export async function exportCurrentScreen(
  format: 'excel' | 'pdf' | 'json' | 'csv' | 'xml',
  pageId: string,
  dataFn: () => Promise<any>
) {
  const data = await dataFn();
  if (!data) throw new Error("No data available to export");
  
  const fileName = `${pageId}_export_${new Date().getTime()}`;

  try {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName + '.json';
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      exportToCSV(Array.isArray(data) ? data : data.rows || [], fileName + '.csv');
    } else if (format === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
      const arr = Array.isArray(data) ? data : data.rows || [];
      for (const item of arr) {
        xml += '  <record>\n';
        for (const [k, v] of Object.entries(item)) {
          xml += `    <${k}>${v}</${k}>\n`;
        }
        xml += '  </record>\n';
      }
      xml += '</data>';
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName + '.xml';
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'excel') {
      if (Array.isArray(data)) {
         exportToCSV(data, fileName + '.csv'); // fallback for generic array
      } else if (data.rows) {
         exportToCSV(data.rows, fileName + '.csv'); // fallback
      }
    } else if (format === 'pdf') {
       alert("PDF generic export not implemented. Call specific PDF generator.");
    }

    await logExport(pageId, format, fileName);
  } catch (err: any) {
    await logExport(pageId, format, fileName, 'failed');
    throw err;
  }
}
