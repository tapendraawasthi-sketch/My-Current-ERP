// src/lib/tdsCertificate.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber } from "./utils";

export function generateTDSCertificate(
  companySettings: any,
  party: any,
  tdsEntries: Array<{
    period: string;
    grossAmount: number;
    tdsType: string;
    tdsRate: number;
    tdsAmount: number;
  }>
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TDS CERTIFICATE", pageW / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Deductor: ${companySettings?.name || ""}`, 14, 35);
  doc.text(`PAN: ${companySettings?.panNumber || ""}`, 14, 41);
  doc.text(`Deductee: ${party?.name || ""}`, 14, 47);
  doc.text(`Deductee PAN: ${party?.pan || ""}`, 14, 53);

  const tableData = tdsEntries.map((e, i) => [
    i + 1,
    e.period,
    e.tdsType,
    `${e.tdsRate}%`,
    `Rs. ${formatNumber(e.grossAmount)}`,
    `Rs. ${formatNumber(e.tdsAmount)}`,
  ]);

  autoTable(doc, {
    startY: 60,
    head: [["#", "Period", "Nature of Payment", "Rate", "Gross Amount", "TDS Amount"]],
    body: tableData,
    foot: [[
      "", "", "", "Total",
      `Rs. ${formatNumber(tdsEntries.reduce((s, e) => s + e.grossAmount, 0))}`,
      `Rs. ${formatNumber(tdsEntries.reduce((s, e) => s + e.tdsAmount, 0))}`,
    ]],
    theme: "grid",
    headStyles: { fillColor: [61, 107, 37], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: [212, 234, 189], fontStyle: "bold", fontSize: 8 },
  });

  return doc.output("blob");
}
