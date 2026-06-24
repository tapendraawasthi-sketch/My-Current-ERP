// src/lib/printUtils.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "./utils";

export async function generateInvoicePDF(
  invoice: any,
  companySettings: any,
  party: any,
  items?: any[]
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
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
  if (invoice.tdsAmount) {
    doc.text(`TDS (${invoice.tdsRate}%): Rs. ${formatNumber(invoice.tdsAmount)}`, totalsX, finalY + 28);
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

export const generatePartyStatementPDF = () => {};
