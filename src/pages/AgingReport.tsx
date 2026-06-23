/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { Clock, Printer, Download } from "lucide-react";
import { Button } from "../components/ui";
import { computeAgingReport } from "../lib/accounting";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function AgingReport() {
  const invoices = useStore(state => state.invoices);
  const parties = useStore(state => state.parties);
  const companySettings = useStore(state => state.companySettings);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [searchTerm, setSearchTerm] = useState("");

  const agingData = useMemo(() => {
    let data = computeAgingReport(invoices, parties, asOfDate, partyType);
    if (searchTerm) {
      data = data.filter(d => d.partyName.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return data;
  }, [invoices, parties, asOfDate, partyType, searchTerm]);

  const totals = useMemo(() => {
    return agingData.reduce((acc, row) => ({
      current: acc.current + row.current,
      days1to30: acc.days1to30 + row.days1to30,
      days31to60: acc.days31to60 + row.days31to60,
      days61to90: acc.days61to90 + row.days61to90,
      days91to180: acc.days91to180 + row.days91to180,
      days181to365: acc.days181to365 + row.days181to365,
      over365: acc.over365 + row.over365,
      total: acc.total + row.total,
    }), {
      current: 0, days1to30: 0, days31to60: 0, days61to90: 0, 
      days91to180: 0, days181to365: 0, over365: 0, total: 0
    });
  }, [agingData]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("landscape");
      doc.setFontSize(16);
      doc.text(companySettings?.companyName || "Sutra ERP", 14, 15);
      doc.setFontSize(12);
      doc.text(`Aging Report (${partyType === "customer" ? "Receivables" : "Payables"})`, 14, 22);
      doc.setFontSize(10);
      doc.text(`As of Date: ${asOfDate}`, 14, 28);
      
      const tableData = agingData.map(row => [
        row.partyName,
        row.contactPhone || "N/A",
        formatNumber(row.current),
        formatNumber(row.days1to30),
        formatNumber(row.days31to60),
        formatNumber(row.days61to90),
        formatNumber(row.days91to180),
        formatNumber(row.days181to365),
        formatNumber(row.over365),
        formatNumber(row.total)
      ]);

      // Add totals row
      tableData.push([
        "TOTAL",
        "",
        formatNumber(totals.current),
        formatNumber(totals.days1to30),
        formatNumber(totals.days31to60),
        formatNumber(totals.days61to90),
        formatNumber(totals.days91to180),
        formatNumber(totals.days181to365),
        formatNumber(totals.over365),
        formatNumber(totals.total)
      ]);

      (doc as any).autoTable({
        startY: 35,
        head: [["Party", "Phone", "Current", "1-30", "31-60", "61-90", "91-180", "181-365", ">365", "Total"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 87, 176] },
        footStyles: { fillColor: [238, 242, 255], textColor: [21, 87, 176], fontStyle: "bold" },
        foot: [tableData[tableData.length - 1]],
      });

      doc.save(`Aging_Report_${partyType}_${asOfDate}.pdf`);
      toast.success("PDF exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <div className="space-y-4">
      <PillTitle title={`Aging Report: ${partyType === "customer" ? "Receivables" : "Payables"}`} icon={Clock} />
      
      <FormPanel>
        <div className="flex items-end gap-4 mb-6 no-print">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Party Type</label>
            <select 
              value={partyType} 
              onChange={e => setPartyType(e.target.value as any)}
              className="h-8 px-2.5 w-40 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] bg-white"
            >
              <option value="customer">Receivables (Customers)</option>
              <option value="supplier">Payables (Suppliers)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">As Of Date</label>
            <input 
              type="date" 
              value={asOfDate} 
              onChange={e => setAsOfDate(e.target.value)}
              className="h-8 px-2.5 w-40 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Search Party</label>
            <input 
              type="text" 
              placeholder="Search by name..."
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8 px-2.5 w-full max-w-xs text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-8" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print
            </Button>
            <Button className="h-8 bg-[#1557b0] hover:bg-[#0f4a96] text-white" onClick={handleExportPDF}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="print-only hidden mb-6 text-center">
          <h2 className="text-[15px] font-bold text-gray-900">{companySettings?.companyName || "Company Name"}</h2>
          <h3 className="text-[14px] font-semibold mt-2">Aging Report - {partyType === "customer" ? "Receivables" : "Payables"}</h3>
          <p className="text-[11px] text-gray-500">As of Date: {asOfDate}</p>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white overflow-x-auto shadow-sm">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party Name</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">1-30 Days</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">31-60 Days</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">61-90 Days</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">91-180 Days</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">181-365 Days</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">&gt; 365 Days</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-bold text-[#1557b0] uppercase tracking-wide">Total Balance</th>
              </tr>
            </thead>
            <tbody>
              {agingData.map(row => (
                <tr key={row.partyId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-[12px] text-gray-800 font-medium">{row.partyName}</td>
                  <td className="px-3 py-2.5 text-[11px] text-gray-500">{row.contactPhone || "-"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono text-gray-700">{row.current > 0 ? formatNumber(row.current) : "-"}</td>
                  <td className={`px-3 py-2.5 text-[12px] text-right font-mono ${row.days1to30 > 0 ? "bg-amber-50 text-amber-700" : "text-gray-400"}`}>{row.days1to30 > 0 ? formatNumber(row.days1to30) : "-"}</td>
                  <td className={`px-3 py-2.5 text-[12px] text-right font-mono ${row.days31to60 > 0 ? "bg-orange-50 text-orange-700" : "text-gray-400"}`}>{row.days31to60 > 0 ? formatNumber(row.days31to60) : "-"}</td>
                  <td className={`px-3 py-2.5 text-[12px] text-right font-mono ${row.days61to90 > 0 ? "bg-red-50 text-red-600" : "text-gray-400"}`}>{row.days61to90 > 0 ? formatNumber(row.days61to90) : "-"}</td>
                  <td className={`px-3 py-2.5 text-[12px] text-right font-mono ${row.days91to180 > 0 ? "bg-red-100 text-red-700" : "text-gray-400"}`}>{row.days91to180 > 0 ? formatNumber(row.days91to180) : "-"}</td>
                  <td className={`px-3 py-2.5 text-[12px] text-right font-mono ${row.days181to365 > 0 ? "bg-red-200 text-red-800" : "text-gray-400"}`}>{row.days181to365 > 0 ? formatNumber(row.days181to365) : "-"}</td>
                  <td className={`px-3 py-2.5 text-[12px] text-right font-mono ${row.over365 > 0 ? "bg-red-300 text-red-900 font-bold" : "text-gray-400"}`}>{row.over365 > 0 ? formatNumber(row.over365) : "-"}</td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono font-bold text-[#1557b0]">{formatNumber(row.total)}</td>
                </tr>
              ))}
              {agingData.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[12px] text-gray-500">
                    No outstanding {partyType === "customer" ? "receivables" : "payables"} found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td colSpan={2} className="px-3 py-3 text-[12px] font-bold text-[#1557b0] text-right">GRAND TOTAL</td>
                <td className="px-3 py-3 text-[12px] font-bold text-[#1557b0] text-right font-mono">{formatNumber(totals.current)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-amber-700 text-right font-mono">{formatNumber(totals.days1to30)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-orange-700 text-right font-mono">{formatNumber(totals.days31to60)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-red-700 text-right font-mono">{formatNumber(totals.days61to90)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-red-700 text-right font-mono">{formatNumber(totals.days91to180)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-red-800 text-right font-mono">{formatNumber(totals.days181to365)}</td>
                <td className="px-3 py-3 text-[12px] font-bold text-red-900 text-right font-mono">{formatNumber(totals.over365)}</td>
                <td className="px-3 py-3 text-[14px] font-bold text-[#1557b0] text-right font-mono">{formatNumber(totals.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </FormPanel>
    </div>
  );
}
