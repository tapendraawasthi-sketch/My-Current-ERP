// @ts-nocheck
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TdsEntry, Party, CompanySettings } from "./types";
import { ADToBSString } from "./nepaliDate";
import { formatNumber } from "./utils";

export function generateTDSCertificate(params: {
  party: Party;
  entries: TdsEntry[];
  period: { startDate: string; endDate: string };
  settings: CompanySettings;
}): void {
  const { party, entries, period, settings } = params;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title section
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TDS CERTIFICATE", pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("(Under Income Tax Act, 2058)", pageWidth / 2, 27, { align: "center" });

  // Deductor box (left)
  doc.rect(10, 35, 92, 40);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DEDUCTOR DETAILS", 12, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${settings.name}`, 12, 48);
  doc.text(`PAN: ${settings.panNumber}`, 12, 54);
  doc.text(`Address: ${settings.address || ""}`, 12, 60);
  doc.text(
    `Period: ${ADToBSString(period.startDate) || period.startDate} to ${ADToBSString(period.endDate) || period.endDate}`,
    12,
    66,
  );
  doc.text(`Phone: ${settings.phone || ""}`, 12, 72);

  // Deductee box (right)
  doc.rect(106, 35, 94, 40);
  doc.setFont("helvetica", "bold");
  doc.text("DEDUCTEE DETAILS", 108, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${party.name}`, 108, 48);
  doc.text(`PAN: ${party.pan || "N/A"}`, 108, 54);
  doc.text(`Address: ${party.address || ""}`, 108, 60);

  // TDS table
  const total = entries.reduce(
    (s, e) => ({
      gross: s.gross + e.grossAmount,
      tds: s.tds + e.tdsAmount,
      net: s.net + e.netAmount,
    }),
    { gross: 0, tds: 0, net: 0 },
  );

  autoTable(doc, {
    startY: 82,
    head: [
      [
        "S.N.",
        "Date (BS)",
        "Nature",
        "Section",
        "Gross Amount",
        "TDS Rate",
        "TDS Amount",
        "Net Paid",
      ],
    ],
    body: entries.map((e, i) => [
      i + 1,
      e.dateNepali || ADToBSString(e.date) || e.date,
      e.tdsType,
      e.section || "88",
      formatNumber(e.grossAmount),
      `${e.tdsRate}%`,
      formatNumber(e.tdsAmount),
      formatNumber(e.netAmount),
    ]),
    foot: [
      [
        "",
        "",
        "",
        "TOTAL",
        formatNumber(total.gross),
        "",
        formatNumber(total.tds),
        formatNumber(total.net),
      ],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
    footStyles: { fontStyle: "bold", fillColor: [243, 244, 246] },
  });

  // Signature block
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.line(15, finalY, 75, finalY);
  doc.line(135, finalY, 195, finalY);
  doc.setFontSize(8);
  doc.text("Signature of Deductee", 15, finalY + 5);
  doc.text("Signature of Deductor (with seal)", 135, finalY + 5);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, finalY + 15, {
    align: "center",
  });

  doc.save(`TDS_Certificate_${party.name.replace(/\s+/g, "_")}_${period.endDate}.pdf`);
}

