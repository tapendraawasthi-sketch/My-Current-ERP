// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import {
  Invoice,
  JournalEntry,
  CompanySettings,
  Party,
  Item,
  Account,
  TrialBalanceRow,
  ReportFilters,
  LedgerEntry,
  StockSummaryRow,
} from "./types";
import { formatCurrency, formatNumber, numberToWords, roundTo2 as round2 } from "./utils";

// ==========================================
// PDF PAGE SETUP CONSTANTS
// ==========================================
export const PAGE_WIDTH = 210; // A4 Width in mm
export const PAGE_HEIGHT = 297; // A4 Height in mm
export const MARGIN = 15;
export const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
export const HEADER_HEIGHT = 45;
export const FOOTER_HEIGHT = 20;

export const FONT_SIZES = {
  title: 14,
  subtitle: 11,
  heading: 10,
  body: 9,
  small: 7.5,
};

export const COLORS = {
  primary: [30, 58, 95] as [number, number, number], // #1e3a5f
  secondary: [37, 99, 235] as [number, number, number], // #2563eb
  text: [30, 30, 30] as [number, number, number], // Custom deep charcoal
  light: [240, 240, 240] as [number, number, number], // Soft light grey
  border: [200, 200, 200] as [number, number, number], // Accent border grey
};

// ==========================================
// GLOBAL PDF REUSABLE BUILDERS
// ==========================================

export function addCompanyHeader(
  doc: jsPDF,
  company: CompanySettings,
  reportTitle: string,
  periodLabel?: string,
): number {
  let y = 18;

  // Company Name English
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(FONT_SIZES.title);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text(company.name, PAGE_WIDTH / 2, y, { align: "center" });
  y += 6;

  // Company Name Nepali (optional)
  if (company.nameNepali) {
    doc.setFontSize(FONT_SIZES.subtitle);
    doc.setTextColor(55, 65, 81);
    doc.text(company.nameNepali, PAGE_WIDTH / 2, y, { align: "center" });
    y += 5;
  }

  // Address and Contact
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(107, 114, 128);

  const taxIdStr = company.vatNumber
    ? `PAN/VAT: ${company.panNumber}`
    : `PAN Number: ${company.panNumber}`;

  doc.text(`${company.address} | Phone: ${company.phone || "N/A"}`, PAGE_WIDTH / 2, y, {
    align: "center",
  });
  y += 4.5;
  doc.text(`${taxIdStr} | Email: ${company.email || "N/A"}`, PAGE_WIDTH / 2, y, {
    align: "center",
  });
  y += 7;

  // Title Box
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(reportTitle.toUpperCase(), PAGE_WIDTH / 2, y, { align: "center" });
  y += 5;

  if (periodLabel) {
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(FONT_SIZES.body);
    doc.setTextColor(75, 85, 99);
    doc.text(periodLabel, PAGE_WIDTH / 2, y, { align: "center" });
    y += 4;
  }

  // Divider Line
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

  return y + 8;
}

export function addPageFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  generatedBy?: string,
): void {
  const y = PAGE_HEIGHT - 12;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.small);
  doc.setTextColor(156, 163, 175);

  const timestamp = new Date().toLocaleString();
  const createdText = `Sutra ERP | Generated/Printed: ${timestamp} ${generatedBy ? `by ${generatedBy}` : ""}`;
  doc.text(createdText, MARGIN, y);

  const pagingText = `Page ${pageNum} of ${totalPages}`;
  doc.text(pagingText, PAGE_WIDTH - MARGIN, y, { align: "right" });
}

export function addStampArea(doc: jsPDF, y: number): void {
  const width = 36;
  const height = 18;
  const x = PAGE_WIDTH - MARGIN - width;

  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.rect(x, y, width, height, "S");

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.small);
  doc.setTextColor(156, 163, 175);
  doc.text("OFFICIAL STAMP", x + width / 2, y + height / 2 + 2, { align: "center" });
}

// ==========================================
// 3. INVOICE PDF GENERATION
// ==========================================

export async function generateInvoicePDF(
  invoice: Invoice,
  company: CompanySettings,
  party: Party,
  items: Item[],
): Promise<Blob> {
  const doc = new jsPDF();

  // 1. Company letterhead at top
  const yStart = addCompanyHeader(doc, company, "", ""); // Print letterhead only, title skipped
  let y = yStart - 12; // Adjust y-coordinate because title was skipped in addCompanyHeader

  // 2. "TAX INVOICE" title in blue centered
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]); // blue
  doc.text("TAX INVOICE", PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;

  // 10. QR code block if companySettings has QR enabled
  if ((company as any).qrEnabled) {
    try {
      const qrString = [
        invoice.invoiceNo,
        invoice.dateNepali,
        invoice.partyPan || "",
        (invoice.taxableAmount || 0).toFixed(2),
        (invoice.vatAmount || 0).toFixed(2),
        invoice.grandTotal.toFixed(2),
      ].join("|");
      const qrDataUrl = await QRCode.toDataURL(qrString, { width: 80, margin: 1 });
      doc.addImage(qrDataUrl, "PNG", PAGE_WIDTH - 38, 12, 28, 28);
      doc.setFontSize(6);
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
      doc.text("Fiscal Bill / कर बिजक", PAGE_WIDTH - 38, 42);
    } catch (e) {
      console.error("Error generating QR code", e);
    }
  }

  // 3 & 4. Customer details on the left, Invoice details box on the right
  const boxWidth = (PAGE_WIDTH - 2 * MARGIN - 10) / 2;
  const boxHeight = 28;

  // Left Box: Customer Details
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, boxWidth, boxHeight);

  // Right Box: Invoice Details
  doc.rect(MARGIN + boxWidth + 10, y, boxWidth, boxHeight);

  // Left Box Content
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(FONT_SIZES.heading);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text("BILL TO:", MARGIN + 4, y + 5);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.text(party.name, MARGIN + 4, y + 10);
  doc.text(`Address: ${party.address || "N/A"}`, MARGIN + 4, y + 15, { maxWidth: boxWidth - 8 });
  doc.text(`PAN/VAT: ${invoice.partyPan || party.pan || "Unregistered"}`, MARGIN + 4, y + 23);

  // Right Box Content
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(FONT_SIZES.heading);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text("INVOICE DETAILS:", MARGIN + boxWidth + 14, y + 5);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.text(`Invoice No: ${invoice.invoiceNo}`, MARGIN + boxWidth + 14, y + 10);
  doc.text(`Date: ${invoice.date} / ${invoice.dateNepali}`, MARGIN + boxWidth + 14, y + 15);
  doc.text(`Payment Mode: ${invoice.paymentMode.toUpperCase()}`, MARGIN + boxWidth + 14, y + 20);
  doc.text(
    `Payment Status: ${invoice.paymentStatus.toUpperCase()}`,
    MARGIN + boxWidth + 14,
    y + 24,
  );

  y += boxHeight + 6;

  // 5. Line items table with a blue header row
  const tableHeaders = [
    "S.N.",
    "Item Particulars",
    "HSN",
    "Qty",
    "Unit",
    "Rate",
    "Dis %",
    "Taxable Amt",
    "VAT",
    "Total",
  ];
  const tableBody = invoice.lines.map((l, index) => {
    return [
      index + 1,
      l.itemName,
      l.itemCode || "N/A",
      l.qty,
      l.unit || "PCS",
      l.rate.toFixed(2),
      (l.discountPercent || 0) > 0 ? `${l.discountPercent}%` : "-",
      (l.netAmount || 0).toFixed(2),
      (l.vatRate || 0) > 0 ? `${l.vatRate}%` : "Exempt",
      (l.totalAmount || 0).toFixed(2),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: FONT_SIZES.small, textColor: [31, 41, 55] },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 50 },
      2: { cellWidth: 15 },
      3: { cellWidth: 12, halign: "right" },
      4: { cellWidth: 12 },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 14, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 15, halign: "right" },
      9: { cellWidth: 20, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  y = finalY;

  // 6. Right-aligned totals box
  const totalsBoxWidth = 70;
  const totalsBoxHeight = 35;
  const totalsX = PAGE_WIDTH - MARGIN - totalsBoxWidth;

  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setFillColor(250, 250, 250);
  doc.rect(totalsX, y, totalsBoxWidth, totalsBoxHeight, "FD");

  let totalsY = y + 5;
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

  doc.text("Sub Total:", totalsX + 4, totalsY);
  doc.text(formatNumber(excelRound(invoice.subTotal)), PAGE_WIDTH - MARGIN - 4, totalsY, {
    align: "right",
  });
  totalsY += 5;

  doc.text("Discount Total:", totalsX + 4, totalsY);
  doc.text(formatNumber(excelRound(invoice.discountAmount)), PAGE_WIDTH - MARGIN - 4, totalsY, {
    align: "right",
  });
  totalsY += 5;

  doc.text("Taxable Amount:", totalsX + 4, totalsY);
  doc.text(formatNumber(excelRound(invoice.taxableAmount)), PAGE_WIDTH - MARGIN - 4, totalsY, {
    align: "right",
  });
  totalsY += 5;

  doc.text("VAT Collected (13%):", totalsX + 4, totalsY);
  doc.text(formatNumber(excelRound(invoice.vatAmount)), PAGE_WIDTH - MARGIN - 4, totalsY, {
    align: "right",
  });
  totalsY += 6;

  // Line separator before grand total
  doc.line(totalsX, totalsY - 2, PAGE_WIDTH - MARGIN, totalsY - 2);

  doc.setFont("Helvetica", "bold");
  doc.text("GRAND TOTAL:", totalsX + 4, totalsY);
  doc.text(formatCurrency(excelRound(invoice.grandTotal)), PAGE_WIDTH - MARGIN - 4, totalsY, {
    align: "right",
  });

  // 7. Amount in words line
  doc.setFont("Helvetica", "bold");
  doc.text("Amount in Words:", MARGIN, y);
  doc.setFont("Helvetica", "normal");
  const words = numberToWords(excelRound(invoice.grandTotal));
  doc.text(words.english, MARGIN, y + 5, { maxWidth: 100 });
  doc.text(words.nepali, MARGIN, y + 13, { maxWidth: 100 });

  // 8. Narration/Notes field
  if (invoice.narration) {
    doc.setFont("Helvetica", "bold");
    doc.text("Narration/Notes:", MARGIN, y + 22);
    doc.setFont("Helvetica", "normal");
    doc.text(invoice.narration, MARGIN, y + 27, { maxWidth: 100 });
  }

  y += Math.max(totalsBoxHeight, 35) + 6;
  addStampArea(doc, y);

  const sigY = PAGE_HEIGHT - 32;
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(FONT_SIZES.body);

  doc.line(MARGIN, sigY, MARGIN + 40, sigY);
  doc.text("Prepared By", MARGIN + 20, sigY + 4, { align: "center" });

  doc.line(PAGE_WIDTH / 2 - 20, sigY, PAGE_WIDTH / 2 + 20, sigY);
  doc.text("Checked By", PAGE_WIDTH / 2, sigY + 4, { align: "center" });

  doc.line(PAGE_WIDTH - MARGIN - 40, sigY, PAGE_WIDTH - MARGIN, sigY);
  doc.text("Authorized Signatory", PAGE_WIDTH - MARGIN - 20, sigY + 4, { align: "center" });

  // 9. "This is a computer-generated invoice" footer line
  doc.setFont("Helvetica", "italic");
  doc.setFontSize(FONT_SIZES.small);
  doc.setTextColor(128, 128, 128);
  doc.text("This is a computer-generated invoice.", PAGE_WIDTH / 2, PAGE_HEIGHT - 18, {
    align: "center",
  });

  addPageFooter(doc, 1, 1);

  return doc.output("blob");
}

// ==========================================
// 4. VOUCHER PDF GENERATION
// ==========================================

export function generateVoucherPDF(
  voucher: JournalEntry,
  company: CompanySettings,
  accounts: Account[],
): Blob {
  const doc = new jsPDF();
  const title = `${voucher.type.replace("-", " ")} Voucher`.toUpperCase();
  const yStart = addCompanyHeader(doc, company, title, `Voucher No: ${voucher.voucherNo}`);

  let y = yStart;
  doc.setFontSize(FONT_SIZES.body);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

  doc.setFont("Helvetica", "bold");
  doc.text("VOUCHER META:", MARGIN, y);
  y += 5.5;

  doc.setFont("Helvetica", "normal");
  doc.text(`Transaction Date (AD): ${voucher.date}`, MARGIN, y);
  doc.text(`Fiscal Year: 2083/84`, PAGE_WIDTH - MARGIN - 60, y);
  y += 4.5;
  doc.text(`Transaction Date (BS): ${voucher.dateNepali}`, MARGIN, y);
  if (voucher.referenceNo) {
    doc.text(`Reference Ref: ${voucher.referenceNo}`, PAGE_WIDTH - MARGIN - 60, y);
  }
  y += 10;

  const tableHeaders = [
    "S.N.",
    "Account Head Particulars",
    "Narration Breakdown",
    "Debit (DR)",
    "Credit (CR)",
  ];
  const tableBody = voucher.lines.map((l, index) => {
    const accountName =
      l.accountName || accounts.find((a) => a.id === l.accountId)?.name || "Unknown Account";
    return [
      index + 1,
      accountName,
      l.narration || "",
      l.debit > 0 ? l.debit.toFixed(2) : "-",
      l.credit > 0 ? l.credit.toFixed(2) : "-",
    ];
  });

  tableBody.push([
    "",
    "TOTAL VOUCHER SUMMARY",
    "",
    voucher.totalDebit.toFixed(2),
    voucher.totalCredit.toFixed(2),
  ]);

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: FONT_SIZES.small },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 65 },
      2: { cellWidth: 55 },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  y = finalY;

  doc.setFont("Helvetica", "bold");
  doc.text("General Narration:", MARGIN, y);
  doc.setFont("Helvetica", "normal");
  doc.text(voucher.narration, MARGIN, y + 5, { maxWidth: CONTENT_WIDTH });

  y += 15;
  doc.setFont("Helvetica", "bold");
  doc.text("In Words:", MARGIN, y);
  doc.setFont("Helvetica", "normal");
  const words = numberToWords(excelRound(voucher.totalDebit));
  doc.text(words.english, MARGIN, y + 5, { maxWidth: CONTENT_WIDTH });

  const sigY = PAGE_HEIGHT - 32;

  doc.line(MARGIN, sigY, MARGIN + 40, sigY);
  doc.text("Prepared By", MARGIN + 20, sigY + 4, { align: "center" });

  doc.line(PAGE_WIDTH / 2 - 20, sigY, PAGE_WIDTH / 2 + 20, sigY);
  doc.text("Approved By", PAGE_WIDTH / 2, sigY + 4, { align: "center" });

  doc.line(PAGE_WIDTH - MARGIN - 40, sigY, PAGE_WIDTH - MARGIN, sigY);
  doc.text("Receiver / Sign", PAGE_WIDTH - MARGIN - 20, sigY + 4, { align: "center" });

  addPageFooter(doc, 1, 1);

  return doc.output("blob");
}

// ==========================================
// 5. MASTER REPORTS GENERATORS
// ==========================================

export function generateTrialBalancePDF(
  rows: TrialBalanceRow[],
  company: CompanySettings,
  filters: ReportFilters,
): Blob {
  const doc = new jsPDF();
  const periodStr = `Period: ${filters.startDate} to ${filters.endDate}`;
  const yStart = addCompanyHeader(doc, company, "Trial Balance", periodStr);

  const tableHeaders = [
    "Account Code",
    "Account Particulars",
    "Opening Dr",
    "Opening Cr",
    "Debit (FY)",
    "Credit (FY)",
    "Closing Dr",
    "Closing Cr",
  ];
  const tableBody = rows.map((r) => [
    r.accountCode,
    r.accountName,
    r.openingDr > 0 ? r.openingDr.toFixed(2) : "-",
    r.openingCr > 0 ? r.openingCr.toFixed(2) : "-",
    r.debit > 0 ? r.debit.toFixed(2) : "-",
    r.credit > 0 ? r.credit.toFixed(2) : "-",
    r.closingDr > 0 ? r.closingDr.toFixed(2) : "-",
    r.closingCr > 0 ? r.closingCr.toFixed(2) : "-",
  ]);

  const totals = rows.reduce(
    (acc, val) => {
      acc.opDr = round2(acc.opDr + val.openingDr);
      acc.opCr = round2(acc.opCr + val.openingCr);
      acc.dr = round2(acc.dr + val.debit);
      acc.cr = round2(acc.cr + val.credit);
      acc.clDr = round2(acc.clDr + val.closingDr);
      acc.clCr = round2(acc.clCr + val.closingCr);
      return acc;
    },
    { opDr: 0, opCr: 0, dr: 0, cr: 0, clDr: 0, clCr: 0 },
  );

  tableBody.push([
    "",
    "GRAND TOTALS",
    totals.opDr.toFixed(2),
    totals.opCr.toFixed(2),
    totals.dr.toFixed(2),
    totals.cr.toFixed(2),
    totals.clDr.toFixed(2),
    totals.clCr.toFixed(2),
  ]);

  autoTable(doc, {
    startY: yStart,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: FONT_SIZES.small },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 45 },
      2: { cellWidth: 19, halign: "right" },
      3: { cellWidth: 19, halign: "right" },
      4: { cellWidth: 19, halign: "right" },
      5: { cellWidth: 19, halign: "right" },
      6: { cellWidth: 19, halign: "right" },
      7: { cellWidth: 19, halign: "right" },
    },
  });

  addPageFooter(doc, 1, 1);
  return doc.output("blob");
}

export function generatePLPDF(
  data: {
    income: any[];
    expenses: any[];
    grossProfit: number;
    netProfit: number;
    totalIncome: number;
    totalExpenses: number;
  },
  company: CompanySettings,
  filters: ReportFilters,
): Blob {
  const doc = new jsPDF();
  const periodStr = `Period: ${filters.startDate} to ${filters.endDate}`;
  const yStart = addCompanyHeader(doc, company, "Profit & Loss Statement", periodStr);

  let y = yStart;
  doc.setFontSize(FONT_SIZES.heading);
  doc.setFont("Helvetica", "bold");
  doc.text("PARTICULARS", MARGIN, y);
  doc.text("AMOUNT (Rs.)", PAGE_WIDTH - MARGIN, y, { align: "right" });

  y += 4;
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  doc.setFont("Helvetica", "bold");
  doc.text("1. OPERATING INCOME & REVENUES", MARGIN, y);
  y += 5.5;

  doc.setFont("Helvetica", "normal");
  for (const inc of data.income) {
    doc.text(inc.accountName, MARGIN + 6, y);
    doc.text(inc.amount.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }

  doc.setFont("Helvetica", "bold");
  doc.text("Total Inflow Revenues:", MARGIN + 6, y);
  doc.text(data.totalIncome.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 8;

  doc.text("2. OPERATING EXPENSES", MARGIN, y);
  y += 5.5;

  doc.setFont("Helvetica", "normal");
  for (const exp of data.expenses) {
    doc.text(exp.accountName, MARGIN + 6, y);
    doc.text(`(${exp.amount.toFixed(2)})`, PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }

  doc.setFont("Helvetica", "bold");
  doc.text("Total Outflow Operating Expenses:", MARGIN + 6, y);
  doc.text(`(${data.totalExpenses.toFixed(2)})`, PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 10;

  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;
  doc.setFontSize(11);
  doc.text("NET TRANSACTIONS PROFIT / (LOSS):", MARGIN, y);
  doc.text(formatCurrency(data.netProfit), PAGE_WIDTH - MARGIN, y, { align: "right" });

  addPageFooter(doc, 1, 1);
  return doc.output("blob");
}

export function generateBalanceSheetPDF(
  data: {
    assets: any[];
    liabilities: any[];
    equity: any[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    isBalanced: boolean;
  },
  company: CompanySettings,
  asOfDate: string,
): Blob {
  const doc = new jsPDF();
  const yStart = addCompanyHeader(
    doc,
    company,
    "Statement of Assets & Liabilities",
    `As of Date: ${asOfDate}`,
  );

  let y = yStart;
  doc.setFontSize(FONT_SIZES.heading);
  doc.setFont("Helvetica", "bold");
  doc.text("PARTICULARS & RESOURCES", MARGIN, y);
  doc.text("BALANCE (Rs.)", PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 4;
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  doc.setFont("Helvetica", "bold");
  doc.text("A. APPLICATION OF FUNDS (ASSETS)", MARGIN, y);
  y += 5.5;

  doc.setFont("Helvetica", "normal");
  for (const ast of data.assets) {
    doc.text(ast.accountName, MARGIN + 6, y);
    doc.text(ast.amount.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }
  doc.setFont("Helvetica", "bold");
  doc.text("Total Assets Valuation:", MARGIN + 6, y);
  doc.text(data.totalAssets.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 10;

  doc.text("B. SOURCES OF FUNDS (LIABILITIES)", MARGIN, y);
  y += 5.5;

  doc.setFont("Helvetica", "normal");
  for (const liab of data.liabilities) {
    doc.text(liab.accountName, MARGIN + 6, y);
    doc.text(liab.amount.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }
  doc.setFont("Helvetica", "bold");
  doc.text("Total Obligations / Liabilities:", MARGIN + 6, y);
  doc.text(data.totalLiabilities.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 10;

  doc.text("C. SHAREHOLDERS CAPITAL / RETENTION", MARGIN, y);
  y += 5.5;

  doc.setFont("Helvetica", "normal");
  for (const eq of data.equity) {
    doc.text(eq.accountName, MARGIN + 6, y);
    doc.text(eq.amount.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5;
  }
  doc.setFont("Helvetica", "bold");
  doc.text("Total Shareholders Equity:", MARGIN + 6, y);
  doc.text(data.totalEquity.toFixed(2), PAGE_WIDTH - MARGIN, y, { align: "right" });
  y += 10;

  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  const totalSources = round2(data.totalLiabilities + data.totalEquity);

  doc.text("SUMMARY VERIFICATION STATUS:", MARGIN, y);
  const statusStr = data.isBalanced
    ? "BALANCED ✓"
    : `UNBALANCED (Diff: ${formatNumber(Math.abs(round2(data.totalAssets - totalSources)))})`;
  doc.text(statusStr, PAGE_WIDTH - MARGIN, y, { align: "right" });

  addPageFooter(doc, 1, 1);
  return doc.output("blob");
}

export function generateLedgerPDF(
  accountName: string,
  data: {
    openingBalance: number;
    openingType: "Dr" | "Cr";
    entries: LedgerEntry[];
    closingBalance: number;
    closingType: "Dr" | "Cr";
    totalDebit: number;
    totalCredit: number;
  },
  company: CompanySettings,
  filters: ReportFilters,
): Blob {
  const doc = new jsPDF();
  const subTitle = `Account Ledger: ${accountName} | Period: ${filters.startDate} to ${filters.endDate}`;
  const yStart = addCompanyHeader(doc, company, "General Ledger, Book Statement", subTitle);

  const tableHeaders = [
    "Date (BS)",
    "Voucher No",
    "Particulars / Narration",
    "Debit (DR)",
    "Credit (CR)",
    "Cumulative",
  ];

  const tableBody = [];

  tableBody.push([
    "",
    "OPENING BAL",
    "B/F Balance forward",
    data.openingType === "Dr" ? data.openingBalance.toFixed(2) : "-",
    data.openingType === "Cr" ? data.openingBalance.toFixed(2) : "-",
    `${data.openingBalance.toFixed(2)} ${data.openingType}`,
  ]);

  for (const entry of data.entries) {
    tableBody.push([
      entry.dateNepali,
      entry.voucherNo,
      entry.narration,
      entry.debit > 0 ? entry.debit.toFixed(2) : "-",
      entry.credit > 0 ? entry.credit.toFixed(2) : "-",
      `${entry.balance.toFixed(2)} ${entry.balanceType}`,
    ]);
  }

  tableBody.push([
    "",
    "SUMMATION",
    "Period Ending Closing Valuation Balance",
    data.totalDebit.toFixed(2),
    data.totalCredit.toFixed(2),
    `${data.closingBalance.toFixed(2)} ${data.closingType}`,
  ]);

  autoTable(doc, {
    startY: yStart,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: FONT_SIZES.small },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 64 },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
    },
  });

  addPageFooter(doc, 1, 1);
  return doc.output("blob");
}

export function generatePartyStatementPDF(
  party: Party,
  data: {
    openingBalance: number;
    openingType: "Dr" | "Cr";
    entries: any[];
    closingBalance: number;
    closingType: "Dr" | "Cr";
    totalDebit: number;
    totalCredit: number;
  },
  company: CompanySettings,
  filters: ReportFilters,
): Blob {
  const doc = new jsPDF();
  const subTitle = `Party Ledger Statement: ${party.name} (${party.type.toUpperCase()}) | PAN: ${party.pan || "N/A"}`;
  const yStart = addCompanyHeader(doc, company, "Statement Account Ledger", subTitle);

  const tableHeaders = [
    "Date",
    "Invoice/Ref",
    "Narration Details",
    "Sales/Dr",
    "Receipts/Cr",
    "Balance",
  ];

  const tableBody = [];

  tableBody.push([
    "",
    "OPENING BAL",
    "Account Balance carried forward",
    data.openingType === "Dr" ? data.openingBalance.toFixed(2) : "-",
    data.openingType === "Cr" ? data.openingBalance.toFixed(2) : "-",
    `${data.openingBalance.toFixed(2)} ${data.openingType}`,
  ]);

  for (const entry of data.entries) {
    tableBody.push([
      entry.date,
      entry.voucherNo,
      entry.narration,
      entry.debit > 0 ? entry.debit.toFixed(2) : "-",
      entry.credit > 0 ? entry.credit.toFixed(2) : "-",
      `${entry.balance.toFixed(2)} ${entry.balanceType}`,
    ]);
  }

  tableBody.push([
    "",
    "SUMMARY",
    "Closing Valuation Statement",
    data.totalDebit.toFixed(2),
    data.totalCredit.toFixed(2),
    `${data.closingBalance.toFixed(2)} ${data.closingType}`,
  ]);

  autoTable(doc, {
    startY: yStart,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: FONT_SIZES.small },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 25 },
      2: { cellWidth: 63 },
      3: { cellWidth: 23, halign: "right" },
      4: { cellWidth: 23, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
    },
  });

  addPageFooter(doc, 1, 1);
  return doc.output("blob");
}

export function generateStockSummaryPDF(
  rows: StockSummaryRow[],
  company: CompanySettings,
  filters: ReportFilters,
): Blob {
  const doc = new jsPDF();
  const periodStr = `As of Date: ${filters.endDate}`;
  const yStart = addCompanyHeader(doc, company, "Inventory Stock Summary", periodStr);

  const tableHeaders = [
    "Code",
    "Item Particulars",
    "Unit",
    "Opening Qty",
    "In Qty",
    "Out Qty",
    "Closing Qty",
    "Avg Rate",
    "Closing Value",
  ];
  const tableBody = rows.map((r) => [
    r.itemCode,
    r.itemName,
    r.unit,
    r.openingQty,
    r.inQty,
    r.outQty,
    r.closingQty,
    r.closingRate.toFixed(2),
    r.closingValue.toFixed(2),
  ]);

  const totals = rows.reduce(
    (acc, val) => {
      acc.opQty += val.openingQty;
      acc.inQty += val.inQty;
      acc.outQty += val.outQty;
      acc.clQty += val.closingQty;
      acc.clVal = round2(acc.clVal + val.closingValue);
      return acc;
    },
    { opQty: 0, inQty: 0, outQty: 0, clQty: 0, clVal: 0 },
  );

  tableBody.push([
    "",
    "SUMMATION TOTALS",
    "",
    totals.opQty.toFixed(1),
    totals.inQty.toFixed(1),
    totals.outQty.toFixed(1),
    totals.clQty.toFixed(1),
    "",
    totals.clVal.toFixed(2),
  ]);

  autoTable(doc, {
    startY: yStart,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: FONT_SIZES.small },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 44 },
      2: { cellWidth: 14 },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 16, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 20, halign: "right" },
    },
  });

  addPageFooter(doc, 1, 1);
  return doc.output("blob");
}

function excelRound(value: number): number {
  return Math.round(value * 100) / 100;
}
