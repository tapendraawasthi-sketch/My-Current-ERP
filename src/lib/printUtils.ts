// src/lib/printUtils.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "./utils";

import QRCode from "qrcode";

export async function generateInvoicePDF(
  invoice: any,
  companySettings: any,
  party: any,
  items?: any[]
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await renderCbmsQrOnInvoicePdf(doc, invoice, companySettings);

  const companyName = companySettings?.companyNameEn || companySettings?.name || "Company";
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageW / 2, 15, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.address || "", pageW / 2, 21, { align: "center" });
  doc.text(`Phone: ${companySettings?.phone || ""} | PAN: ${companySettings?.panNumber || ""}`, pageW / 2, 26, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", pageW / 2, 35, { align: "center" });

  // Invoice details
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice No: ${invoice.invoiceNo || ""}`, 14, 45);
  doc.text(`Date: ${invoice.dateNepali || invoice.date || ""}`, 14, 50);
  doc.text(`Party: ${party?.name || invoice.partyName || ""}`, 14, 55);
  if (party?.pan || invoice.partyPan) {
    doc.text(`PAN: ${party?.pan || invoice.partyPan}`, 14, 60);
  }

  // Line items table
  const lineData = (invoice.lines || []).map((l: any, idx: number) => [
    idx + 1,
    l.itemName || "",
    l.qty || 0,
    l.unit || "pcs",
    formatNumber(l.rate),
    `${l.discountPercent || 0}%`,
    formatNumber(l.taxableAmount || l.netAmount || 0),
    `${l.vatRate || 0}%`,
    formatNumber(l.vatAmount || 0),
    formatNumber(l.totalAmount || l.netAmount || 0),
  ]);

  autoTable(doc, {
    startY: 68,
    head: [["#", "Item", "Qty", "Unit", "Rate", "Disc%", "Taxable", "VAT%", "VAT", "Total"]],
    body: lineData,
    theme: "grid",
    headStyles: { fillColor: [61, 107, 37], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 45 }, 2: { cellWidth: 12 },
      3: { cellWidth: 12 }, 4: { cellWidth: 18 }, 5: { cellWidth: 12 },
      6: { cellWidth: 18 }, 7: { cellWidth: 12 }, 8: { cellWidth: 18 },
      9: { cellWidth: 18 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;

  // Totals
  const totalsX = pageW - 70;
  doc.setFontSize(8);
  doc.text(`Sub Total: Rs. ${formatNumber(invoice.subTotal)}`, totalsX, finalY + 8);
  doc.text(`Discount: Rs. ${formatNumber(invoice.discountAmount)}`, totalsX, finalY + 13);
  doc.text(`Taxable: Rs. ${formatNumber(invoice.taxableAmount)}`, totalsX, finalY + 18);
  doc.text(`VAT (13%): Rs. ${formatNumber(invoice.vatAmount)}`, totalsX, finalY + 23);
  if (Number(invoice.tdsAmount) > 0) {
    doc.text("TDS Amount", 150, finalY + 20, { align: "right" });
    doc.text(formatNumber(invoice.tdsAmount), 195, finalY + 20, { align: "right" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Grand Total: Rs. ${formatNumber(invoice.grandTotal)}`, totalsX, finalY + 35);

  // Signature lines
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const sigY = finalY + 55;
  doc.line(14, sigY, 60, sigY);
  doc.line(80, sigY, 126, sigY);
  doc.line(150, sigY, 196, sigY);
  doc.text("Prepared By", 14, sigY + 4);
  doc.text("Checked By", 80, sigY + 4);
  doc.text("Authorized Signatory", 150, sigY + 4);

  return doc.output("blob");
}

export function generateVoucherPDF(
  voucher: any,
  companySettings: any,
  accounts?: any[]
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const companyName = companySettings?.companyNameEn || companySettings?.name || "Company";
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageW / 2, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.address || "", pageW / 2, 22, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${(voucher.type || "").toUpperCase()} VOUCHER`, pageW / 2, 32, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Voucher No: ${voucher.voucherNo}`, 14, 42);
  doc.text(`Date (BS): ${voucher.dateNepali || ""}`, 14, 48);
  doc.text(`Date (AD): ${voucher.date || ""}`, 14, 53);

  const lineData = (voucher.lines || []).map((l: any, idx: number) => [
    idx + 1,
    l.accountName || "",
    l.narration || "",
    l.debit > 0 ? `Rs. ${formatNumber(l.debit)}` : "-",
    l.credit > 0 ? `Rs. ${formatNumber(l.credit)}` : "-",
  ]);

  autoTable(doc, {
    startY: 60,
    head: [["#", "Account", "Narration", "Debit", "Credit"]],
    body: lineData,
    foot: [
      ["", "TOTAL", "", `Rs. ${formatNumber(voucher.totalDebit)}`, `Rs. ${formatNumber(voucher.totalCredit)}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [61, 107, 37], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: [212, 234, 189], textColor: 0, fontStyle: "bold", fontSize: 8 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(9);
  doc.text(`Narration: ${voucher.narration || ""}`, 14, finalY + 10);

  const sigY = finalY + 30;
  doc.line(14, sigY, 60, sigY);
  doc.line(80, sigY, 126, sigY);
  doc.line(150, sigY, 196, sigY);
  doc.text("Prepared By", 14, sigY + 4);
  doc.text("Approved By", 80, sigY + 4);
  doc.text("Received By", 150, sigY + 4);

  return doc.output("blob");
}

export function generatePartyStatementPDF(
  party: any,
  statement: any,
  companySettings: any,
  options?: { startDate?: string; endDate?: string; preset?: string }
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const companyName = companySettings?.companyNameEn || companySettings?.name || "Company";
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, pageW / 2, 15, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(companySettings?.address || "", pageW / 2, 21, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PARTY LEDGER STATEMENT", pageW / 2, 30, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Party: ${party?.name || ""}`, 14, 40);
  if (options?.startDate) {
    doc.text(`Period: ${options.startDate} to ${options.endDate || ""}`, 14, 46);
  }

  const rows = (statement?.rows || []).map((r: any) => [
    r.date || "",
    r.voucherNo || "",
    r.narration || "",
    r.debit > 0 ? `Rs. ${formatNumber(r.debit)}` : "-",
    r.credit > 0 ? `Rs. ${formatNumber(r.credit)}` : "-",
    `Rs. ${formatNumber(r.balance)}`,
  ]);

  autoTable(doc, {
    startY: 52,
    head: [["Date", "Voucher No", "Narration", "Debit", "Credit", "Balance"]],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [61, 107, 37], textColor: 255, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Closing Balance: Rs. ${formatNumber(statement?.closingBalance || 0)}`, 14, finalY + 8);

  return doc.output("blob");
}

interface PrintableInvoice {
  invoiceNo: string;
  date: string;
  dateNepali?: string;
  partyPan?: string;
  taxableAmount?: number;
  vatAmount?: number;
  grandTotal?: number;
  cbmsSubmitted?: boolean;
  cbmsIrn?: string;
  cbmsQrString?: string;
  cbmsSubmittedAt?: string;
}

interface PrintableCompanySettings {
  panNumber?: string;
  vatNumber?: string;
}

function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

export function buildInvoiceQrString(
  invoice: PrintableInvoice,
  companySettings: PrintableCompanySettings,
) {
  if (invoice.cbmsQrString) return invoice.cbmsQrString;

  if (!invoice.cbmsIrn) return "";

  return [
    invoice.cbmsIrn,
    invoice.invoiceNo,
    invoice.dateNepali || invoice.date,
    companySettings.panNumber || companySettings.vatNumber || "",
    invoice.partyPan || "",
    money(invoice.taxableAmount),
    money(invoice.vatAmount),
    money(invoice.grandTotal),
  ].join("|");
}

export async function renderCbmsQrOnInvoicePdf(
  doc: jsPDF,
  invoice: PrintableInvoice,
  companySettings: PrintableCompanySettings,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  const qrX = pageWidth - 42;
  const qrY = 12;
  const qrSize = 28;

  if (invoice.cbmsSubmitted && invoice.cbmsIrn) {
    const qrString = buildInvoiceQrString(invoice, companySettings);

    const qrDataUrl = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 160,
    });

    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

    doc.setFontSize(6);
    doc.setTextColor(40, 40, 40);

    doc.text(`IRN: ${invoice.cbmsIrn}`, qrX, qrY + qrSize + 4, {
      maxWidth: qrSize + 8,
    });

    doc.text(
      `Submitted: ${invoice.cbmsSubmittedAt || ""}`,
      qrX,
      qrY + qrSize + 8,
      {
        maxWidth: qrSize + 8,
      },
    );

    doc.setTextColor(0, 0, 0);
    return;
  }

  // Warning watermark when invoice is not submitted to CBMS
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(24);

  const pageHeight = doc.internal.pageSize.getHeight();

  doc.text("CBMS NOT SUBMITTED", pageWidth / 2, pageHeight / 2, {
    align: "center",
    angle: 35,
  });

  doc.setFontSize(8);
  doc.text("CBMS NOT SUBMITTED", qrX - 4, qrY + 10);

  doc.setTextColor(0, 0, 0);
}
