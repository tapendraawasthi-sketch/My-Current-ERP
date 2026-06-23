/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { useStore } from "../store/useStore";
import {
  Invoice,
  JournalEntry,
  Account,
  TrialBalanceRow,
  LedgerEntry,
  Party,
  Item,
  StockSummaryRow,
  StockMovement,
  Warehouse,
  CompanySettings,
} from "./types";

// ==========================================
// 1. RAW EXCEL GENERATORS & STYLING HELPERS
// ==========================================

function applySheetStyling(
  ws: XLSX.WorkSheet,
  config: {
    headerRowIndex: number;
    numericColIndices: number[];
    colWidths?: number[];
    totalRowIndices?: number[];
  },
): void {
  if (!ws["!ref"]) return;
  const range = XLSX.utils.decode_range(ws["!ref"]);

  // Column widths
  if (config.colWidths) {
    ws["!cols"] = config.colWidths.map((w) => ({ wch: w }));
  }

  // Header row styling
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: config.headerRowIndex, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      fill: { patternType: "solid", fgColor: { rgb: "1D4ED8" } },
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 9 },
      alignment: { horizontal: "center", wrapText: true },
      border: { bottom: { style: "thin", color: { rgb: "000000" } } },
    };
  }

  // Number formatting for data rows
  for (let r = config.headerRowIndex + 1; r <= range.e.r; r++) {
    for (const c of config.numericColIndices) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      ws[addr].s = { numFmt: "#,##0.00", alignment: { horizontal: "right" } };
    }
    // Alternating row bg
    if (r % 2 === 0) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr] && !ws[addr].s) ws[addr].s = {};
        if (ws[addr])
          ws[addr].s = {
            ...ws[addr].s,
            fill: { patternType: "solid", fgColor: { rgb: "F9FAFB" } },
          };
      }
    }
  }

  // Total rows styling
  if (config.totalRowIndices) {
    for (const r of config.totalRowIndices) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
          font: { bold: true },
          border: { top: { style: "thin", color: { rgb: "000000" } } },
          fill: { patternType: "solid", fgColor: { rgb: "EFF6FF" } },
        };
      }
    }
  }
}

function addReportHeaderRows(
  settings: CompanySettings,
  reportTitle: string,
  period: string,
): (string | number)[][] {
  return [
    [settings.name || "Company"],
    [`PAN: ${settings.panNumber || ""} | ${settings.address || ""}`],
    [reportTitle],
    [`Period: ${period}`],
    [], // empty row before headers
  ];
}

export function workbookFromArray(
  headers: string[],
  rows: (string | number)[][],
  sheetName: string = "Sheet1",
): XLSX.WorkBook {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetStyling(ws, { headerRowIndex: 0, numericColIndices: [] });
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

// ==========================================
// 2. TRANSACTION REGISTERS EXPORT
// ==========================================

export function exportInvoicesToExcel(
  invoices: Invoice[],
  filename: string = "Invoices_Register.xlsx",
): void {
  const headers = [
    "Date(AD)",
    "Date(BS)",
    "Invoice No",
    "Particulars Party",
    "PAN/VAT",
    "Transaction Type",
    "Original SubTotal",
    "Discount Amount",
    "Taxable Valuation",
    "Exempt Valuation",
    "VAT Collected (13%)",
    "TDS Amount",
    "Round Off",
    "GRAND TOTAL",
    "Mode of Pay",
    "Payment Status",
    "Status",
  ];

  const rows = invoices.map((i) => [
    i.date,
    i.dateNepali,
    i.invoiceNo,
    i.partyName,
    i.partyPan || "Unregistered",
    i.type,
    i.subTotal,
    i.discountAmount,
    i.taxableAmount,
    i.exemptAmount,
    i.vatAmount,
    i.tdsAmount || 0,
    i.roundOff || 0,
    i.grandTotal,
    i.paymentMode,
    i.paymentStatus,
    i.status,
  ]);

  const wb = workbookFromArray(headers, rows, "Invoices");
  downloadWorkbook(wb, filename);
}

export function exportVouchersToExcel(
  vouchers: JournalEntry[],
  accounts: Account[],
  filename: string = "Vouchers_Ledger.xlsx",
): void {
  const headers = [
    "Date(AD)",
    "Date(BS)",
    "Voucher No",
    "Voucher Type",
    "L/F Account Code",
    "Account Particulars",
    "Debit (Dr)",
    "Credit (Cr)",
    "Line Narriction",
    "Voucher Narration",
    "Status",
  ];

  const rows: (string | number)[][] = [];

  for (const v of vouchers) {
    for (const line of v.lines) {
      const acc = accounts.find((a) => a.id === line.accountId);
      rows.push([
        v.date,
        v.dateNepali,
        v.voucherNo,
        v.type,
        acc?.code || "",
        acc?.name || line.accountName || "Unknown Account",
        line.debit,
        line.credit,
        line.narration || "",
        v.narration,
        v.status,
      ]);
    }
  }

  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetStyling(ws, {
    headerRowIndex: 0,
    numericColIndices: [6, 7],
    colWidths: [14, 12, 12, 15, 15, 30, 12, 12, 20, 20, 10],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "General ledger Log");
  downloadWorkbook(wb, filename);
}

// ==========================================
// 3. MASTER REGISTERS EXPORT
// ==========================================

export function exportTrialBalanceToExcel(
  rowsData: TrialBalanceRow[],
  filename: string = "Trial_Balance.xlsx",
): void {
  const printDate = new Date().toLocaleDateString();
  let companyName = "Your Company";
  let period = "All Dates";

  try {
    const state = useStore.getState();
    if (state.companySettings) {
      companyName =
        state.companySettings.name || state.companySettings.companyNameEn || "Your Company";
    }
    if (state.currentFiscalYear) {
      period = `${state.currentFiscalYear.startDate} to ${state.currentFiscalYear.endDate}`;
    }
  } catch (e) {
    console.error("Error fetching state", e);
  }

  const headerRows = [
    [companyName],
    [`Period: ${period}`],
    [`Print Date: ${printDate}`],
    [], // empty separator row
  ];

  const headers = [
    "Account Code",
    "Account Particulars",
    "Level",
    "Opening Debit (Dr)",
    "Opening Credit (Cr)",
    "FY Period Debit",
    "FY Period Credit",
    "Closing Debit (Dr)",
    "Closing Credit (Cr)",
  ];

  const rows = rowsData.map((r) => [
    r.accountCode,
    r.accountName,
    r.level,
    r.openingDr,
    r.openingCr,
    r.debit,
    r.credit,
    r.closingDr,
    r.closingCr,
  ]);

  const aoa = [...headerRows, headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths: Account Code: 12, Account Name: 40, Debit/Credit columns: 15
  ws["!cols"] = [
    { wch: 12 }, // Account Code
    { wch: 40 }, // Account Name / Particulars
    { wch: 10 }, // Level
    { wch: 15 }, // Opening Debit
    { wch: 15 }, // Opening Credit
    { wch: 15 }, // FY Period Debit
    { wch: 15 }, // FY Period Credit
    { wch: 15 }, // Closing Debit
    { wch: 15 }, // Closing Credit
  ];

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    // 1. Top metadata rows
    if (r === 0) {
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[addr]) {
        ws[addr].s = { font: { bold: true, sz: 12, color: { rgb: "1557B0" } } };
      }
      continue;
    }
    if (r === 1 || r === 2) {
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[addr]) {
        ws[addr].s = { font: { italic: true, sz: 9 } };
      }
      continue;
    }

    // 2. Column headers row (r === 4)
    if (r === 4) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) {
          ws[addr].s = {
            fill: { patternType: "solid", fgColor: { rgb: "1557B0" } }, // primary blue
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 9 },
            alignment: { horizontal: "center" },
            border: { bottom: { style: "thin", color: { rgb: "000000" } } },
          };
        }
      }
      continue;
    }

    // 3. Data rows (r >= 5)
    if (r >= 5) {
      const rowIdx = r - 5;
      const rowData = rowsData[rowIdx];
      if (!rowData) continue;

      const isGroup = rowData.level === "group" || rowData.level === "subgroup";

      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) continue;

        // Initialize cell style
        if (!ws[addr].s) ws[addr].s = {};

        // Apply numeric formatting to Debit/Credit columns (columns 3 to 8)
        if (c >= 3 && c <= 8) {
          if (typeof ws[addr].v === "number") {
            ws[addr].s.numFmt = "#,##0.00";
          }
          ws[addr].s.alignment = { horizontal: "right" };
        }

        // Bold any group/header rows
        if (isGroup) {
          ws[addr].s.font = { bold: true, sz: 9 };
          ws[addr].s.fill = { patternType: "solid", fgColor: { rgb: "F1F5F9" } };
        } else {
          // Alternating backgrounds for leaf rows
          if (r % 2 === 0) {
            ws[addr].s.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
          }
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
  downloadWorkbook(wb, filename);
}

export function exportLedgerToExcel(
  accountName: string,
  entries: LedgerEntry[],
  filename?: string,
): void {
  const headers = [
    "Date(AD)",
    "Date(BS)",
    "Voucher Ref No",
    "Voucher Type",
    "Particulars Narration",
    "Debit Posting (Dr)",
    "Credit Posting (Cr)",
    "Cumulative Balance",
    "Balance Type",
  ];

  const rows = entries.map((e) => [
    e.date,
    e.dateNepali,
    e.voucherNo,
    e.voucherType,
    e.narration,
    e.debit,
    e.credit,
    e.balance,
    e.balanceType,
  ]);

  const safeFilename =
    filename || `${accountName.replace(/[\s/\\?%*:|"<>]/g, "_")}_Ledger_Statement.xlsx`;
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  applySheetStyling(ws, {
    headerRowIndex: 0,
    numericColIndices: [5, 6, 7],
    colWidths: [12, 14, 15, 15, 35, 15, 15, 15, 12],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Statement Ledger");
  downloadWorkbook(wb, safeFilename);
}

export function exportPartiestoExcel(
  parties: Party[],
  filename: string = "Party_Directory.xlsx",
): void {
  const headers = [
    "Party Code",
    "Name En",
    "Name Np",
    "Profile Type",
    "PAN Registration",
    "VAT Registration",
    "Phone",
    "Email Address",
    "Opening Balance Type",
    "Opening Balance",
    "Opening Balance Date",
    "Credit Limit Amount",
    "Credit Limits Days",
    "Tds subject",
    "Tds Default Rate",
    "Address info",
    "Status",
  ];

  const rows = parties.map((p) => [
    p.code,
    p.name,
    p.nameNepali || "",
    p.type,
    p.pan || "Unregistered",
    p.vatNo || "",
    p.phone,
    p.email || "",
    p.openingBalanceType || "Dr",
    p.openingBalance || 0,
    p.openingBalanceDate || "",
    p.creditLimit || 0,
    p.creditDays || 0,
    p.subjectToTds ? "Yes" : "No",
    p.tdsRate || 0,
    `${p.address || ""} ${p.city || ""} ${p.wardNo || ""}`,
    p.isActive ? "Active" : "Inactive",
  ]);

  const wb = workbookFromArray(headers, rows, "Parties directory");
  downloadWorkbook(wb, filename);
}

export function exportItemsToExcel(
  items: Item[],
  stockData: StockSummaryRow[],
  filename: string = "Stock_Inventory.xlsx",
): void {
  const headers = [
    "Item Code",
    "Particulars En",
    "Particulars Np",
    "Inventory Type",
    "Billing Unit",
    "Buying Base Price",
    "Selling Base Price",
    "MRP Limit",
    "Taxable (13% VAT)",
    "Reorder Threshold",
    "Current Stock Count",
    "Current Valuation Average Rate",
    "Current Inventory Asset Value",
    "Status",
  ];

  const rows = items.map((item) => {
    const stock = stockData.find((s) => s.itemId === item.id);
    return [
      item.code,
      item.name,
      item.nameNepali || "",
      item.type,
      item.unit || "BOX",
      item.purchaseRate,
      item.salesRate,
      item.mrp || 0,
      item.isTaxable ? "Yes" : "No",
      item.reorderLevel || 0,
      stock ? stock.closingQty : 0,
      stock ? stock.closingRate : 0,
      stock ? stock.closingValue : 0,
      item.isActive ? "Active" : "Inactive",
    ];
  });

  const wb = workbookFromArray(headers, rows, "Items Masters Inventory");
  downloadWorkbook(wb, filename);
}

export function exportVatAnnexToExcel(
  type: "A" | "B" | "C",
  data: any,
  period: string,
  filename?: string,
): void {
  const safeFilename = filename || `Annex_${type}_Vat_Report_Month_${period}.xlsx`;
  const headers = [
    "S.No.",
    "Invoice Date",
    "Invoice Bill Ref No.",
    "Party Customer Name/Supplier",
    "Supplier/Buyer PAN/VAT",
    "Taxable Turnover (Rs.)",
    "VAT Collected Portion (Rs.)",
    "Exempted Turnover (Rs.)",
    "Total Gross Sales Value (Rs.)",
  ];

  const rows = data.rows.map((row: any) => [
    row.sNo,
    row.date,
    row.billNo,
    row.partyName,
    row.partyPan,
    row.taxableAmt,
    row.vatAmt,
    row.exemptAmt,
    row.totalAmt,
  ]);

  rows.push([
    "",
    "SUMMATIONS",
    "",
    "VAT RETURN PORTION TOTALS",
    "",
    data.totals.taxable,
    data.totals.vat,
    data.totals.exempt,
    data.totals.total,
  ]);

  const wb = workbookFromArray(headers, rows, `Annex ${type} Book`);
  downloadWorkbook(wb, safeFilename);
}

export function exportStockMovementsToExcel(
  movements: StockMovement[],
  items: Item[],
  warehouses: Warehouse[],
  filename: string = "Stock_Movements_Trace.xlsx",
): void {
  const headers = [
    "Date(AD)",
    "Date(BS)",
    "Movement Type",
    "Item Code",
    "Item Particulars",
    "Warehouse Store",
    "Quantity Moved Factor",
    "Unit Transaction Rate",
    "Sub Amount",
    "Reference Doc No",
    "Reference Type",
    "Narrication Details",
  ];

  const rows = movements.map((m) => {
    const item = items.find((i) => i.id === m.itemId);
    const wh = warehouses.find((w) => w.id === m.warehouseId);
    return [
      m.date,
      m.dateNepali,
      m.type,
      item?.code || "N/A",
      m.itemName,
      wh?.name || m.warehouseName || "Main Store",
      m.qty,
      m.rate,
      m.amount,
      m.referenceNo || "",
      m.referenceType || "",
      m.narration || "",
    ];
  });

  const wb = workbookFromArray(headers, rows, "Movements register");
  downloadWorkbook(wb, filename);
}

export function downloadCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string,
): void {
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map((row) =>
      row
        .map((field) => {
          const str = String(field);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPLStatementToExcel(
  data: any,
  filename: string = "Profit_And_Loss.xlsx",
): void {
  const headers = ["Account Code", "Account Particulars", "Amount (Rs.)"];
  const rows: any[] = [];

  rows.push(["CORE OPERATING REVENUE"]);
  if (data.income) {
    data.income.forEach((r: any) => {
      rows.push([r.accountCode, r.accountName, r.amount]);
    });
  }
  rows.push(["", "Total Operating Income", data.totalIncome || 0]);
  rows.push([]);

  rows.push(["OPERATING EXPENSES"]);
  if (data.expenses) {
    data.expenses.forEach((r: any) => {
      rows.push([r.accountCode, r.accountName, r.amount]);
    });
  }
  rows.push(["", "Total Operating Expenses", data.totalExpenses || 0]);
  rows.push([]);

  rows.push(["SUMMARY"]);
  rows.push(["", "Gross Profit", data.grossProfit]);
  rows.push(["", "Net profit Yield", data.netProfit]);

  const wb = workbookFromArray(headers, rows, "Profit And Loss");
  downloadWorkbook(wb, filename);
}

export function exportBalanceSheetToExcel(
  data: any,
  filename: string = "Balance_Sheet.xlsx",
): void {
  const headers = ["Account Code", "Account Particulars", "Amount (Rs.)"];
  const rows: any[] = [];

  rows.push(["ASSETS"]);
  if (data.assets) {
    data.assets.forEach((r: any) => {
      rows.push([r.accountCode, r.accountName, r.amount]);
    });
  }
  rows.push(["", "Total Assets", data.totalAssets]);
  rows.push([]);

  rows.push(["LIABILITIES"]);
  if (data.liabilities) {
    data.liabilities.forEach((r: any) => {
      rows.push([r.accountCode, r.accountName, r.amount]);
    });
  }
  rows.push(["", "Total Liabilities", data.totalLiabilities]);
  rows.push([]);

  rows.push(["EQUITY"]);
  if (data.equity) {
    data.equity.forEach((r: any) => {
      rows.push([r.accountCode, r.accountName, r.amount]);
    });
  }
  rows.push(["", "Total Equity", data.totalEquity]);

  const wb = workbookFromArray(headers, rows, "Balance Sheet");
  downloadWorkbook(wb, filename);
}
