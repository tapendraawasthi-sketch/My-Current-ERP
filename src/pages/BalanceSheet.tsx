// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Balance Sheet report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button } from "../components/ui";
import { Printer, Layers, ChevronRight, ChevronDown, CheckCircle, AlertTriangle } from "lucide-react";
import { computeBalanceSheet, computeProfitLoss } from "../lib/accounting";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../components/BusyShell";
import jsPDF from "jspdf";
import "jspdf-autotable";

const BalanceSheet: React.FC = () => {
  const accounts = useStore(state => state.accounts);
  const vouchers = useStore(state => state.vouchers);
  const invoices = useStore(state => state.invoices);
  const companySettings = useStore(state => state.companySettings);
  const currentFiscalYear = useStore(state => state.currentFiscalYear);
  const [asOfDate, setAsOfDate] = useState<string>(
    currentFiscalYear?.endDate || "2027-07-15"
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Fixed Assets", "Current Assets", "Share Capital", "Current Liabilities"]));

  useEffect(() => {
    if (currentFiscalYear?.endDate) {
      setAsOfDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const bsData = useMemo(() => {
    // We first compute Net Profit from Profit & Loss, passing the full fiscal year range up to asOfDate
    const fromDate = currentFiscalYear?.startDate || "1970-01-01";
    const pl = computeProfitLoss(accounts, vouchers, invoices || [], fromDate, asOfDate);
    return computeBalanceSheet(accounts, vouchers, invoices || [], asOfDate, pl.netProfit);
  }, [accounts, vouchers, invoices, currentFiscalYear, asOfDate]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(companySettings?.companyName || "Sutra ERP", 14, 15);
      doc.setFontSize(12);
      doc.text("Balance Sheet", 14, 22);
      doc.setFontSize(10);
      doc.text(`As at: ${asOfDate}`, 14, 28);
      
      const tableData = [
        ["ASSETS", ""],
        ["Fixed Assets / Non-Current", formatNumber(bsData.assets.fixedAssets)],
        ["Investments", formatNumber(bsData.assets.investments)],
        ["Current Assets", formatNumber(bsData.assets.currentAssets)],
        ["TOTAL ASSETS", formatNumber(bsData.assets.total)],
        ["", ""],
        ["EQUITY & LIABILITIES", ""],
        ["Share Capital", formatNumber(bsData.liabilities.shareCapital)],
        ["Reserves & Surplus", formatNumber(bsData.liabilities.retainedEarnings)],
        ["Long Term Liabilities", formatNumber(bsData.liabilities.longTermLoans)],
        ["Current Liabilities", formatNumber(bsData.liabilities.currentLiabilities)],
        ["TOTAL EQUITY & LIABILITIES", formatNumber(bsData.liabilities.total)],
      ];

      (doc as any).autoTable({
        startY: 35,
        head: [["Particulars", "Amount (Rs.)"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [21, 87, 176] }
      });

      doc.save(`Balance_Sheet_${asOfDate}.pdf`);
      toast.success("PDF exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    }
  };

  const renderSection = (title: string, amount: number, breakdown: Array<{groupName: string, ledgerName?: string, amount: number}>) => {
    const sectionBreakdown = breakdown.filter(l => {
      const g = l.groupName.toLowerCase();
      if (title.toLowerCase().includes("fixed")) return g.includes("fixed") || g.includes("non-current");
      if (title.toLowerCase().includes("investment")) return g.includes("investment");
      if (title.toLowerCase().includes("current assets")) return !g.includes("fixed") && !g.includes("non-current") && !g.includes("investment");
      
      if (title.toLowerCase().includes("capital")) return g.includes("capital") || g.includes("equity");
      if (title.toLowerCase().includes("reserve")) return g.includes("retained") || g.includes("reserve");
      if (title.toLowerCase().includes("long term")) return g.includes("long term") || g.includes("secured");
      if (title.toLowerCase().includes("current liabilities")) return !g.includes("capital") && !g.includes("equity") && !g.includes("retained") && !g.includes("reserve") && !g.includes("long term") && !g.includes("secured");
      
      return false;
    });

    const hasChildren = sectionBreakdown.length > 0;
    const isExpanded = expandedGroups.has(title);

    return (
      <div className="border-b border-[#9DC07A] last:border-0">
        <div 
          className={`flex items-center justify-between px-3 py-2.5 ${hasChildren ? "cursor-pointer hover:bg-[#EBF5E2]" : ""}`}
          onClick={() => hasChildren && toggleGroup(title)}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              isExpanded ? <ChevronDown className="w-4 h-4 text-[#000000]" /> : <ChevronRight className="w-4 h-4 text-[#000000]" />
            )}
            {!hasChildren && <span className="w-4" />}
            <span className="text-[12px] text-[#000000] font-medium">{title}</span>
          </div>
          <span className="font-mono text-[12px] text-right">{formatNumber(amount)}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="bg-[#EBF5E2] border-y border-[#9DC07A] pb-2 pt-1">
            {sectionBreakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between pl-10 pr-3 py-1.5 hover:bg-[#EBF5E2]">
                <span className="text-[11px] text-[#000000]">{item.ledgerName || item.groupName}</span>
                <span className="text-[11px] font-mono text-[#000000]">{formatNumber(item.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PillTitle title="Balance Sheet" icon={Layers} />
        {bsData.isBalanced ? (
          <Badge className="bg-green-100 text-green-700 border border-green-200 px-3 py-1">
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Balanced
          </Badge>
        ) : (
          <Badge className="bg-red-100 text-red-700 border border-red-200 px-3 py-1">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Not Balanced (Diff: Rs. {formatNumber(bsData.difference)})
          </Badge>
        )}
      </div>
      
      <FormPanel>
        <div className="flex items-end gap-4 mb-4 no-print">
          <div className="w-64">
            <label className="block text-[11px] font-medium text-[#000000] mb-1">As Of Date</label>
            <input 
              type="date" 
              value={asOfDate} 
              onChange={e => setAsOfDate(e.target.value)}
              className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-8" onClick={handleExportPDF}>
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="print-only hidden mb-6 text-center">
          <h2 className="text-[15px] font-bold text-[#000000]">{companySettings?.companyName || "Company Name"}</h2>
          <p className="text-[12px] text-[#000000]">PAN: {companySettings?.panNumber || "N/A"}</p>
          <h3 className="text-[14px] font-semibold mt-2">Balance Sheet</h3>
          <p className="text-[11px] text-[#000000]">As at: {asOfDate} ({currentFiscalYear?.name})</p>
        </div>

        {!bsData.isBalanced && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-[12px] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <strong>Difference: Rs. {formatNumber(bsData.difference)}</strong> — check for unposted vouchers or opening balance mismatches.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 border border-[#9DC07A] rounded-lg bg-white overflow-hidden shadow-sm">
          {/* Assets Side */}
          <div className="border-r border-[#9DC07A]">
            <div className="bg-[#f5f6fa] border-b border-[#9DC07A] px-3 py-2.5">
              <h3 className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Assets</h3>
            </div>
            {renderSection("Fixed Assets / Non-Current", bsData.assets.fixedAssets, bsData.assets.breakdown)}
            {renderSection("Investments", bsData.assets.investments, bsData.assets.breakdown)}
            {renderSection("Current Assets", bsData.assets.currentAssets, bsData.assets.breakdown)}
            
            <div className="mt-auto border-t-2 border-[#c7d2fe] bg-[#eef2ff] flex items-center justify-between px-3 py-3">
              <span className="text-[13px] font-bold text-[#1557b0]">Total Assets</span>
              <span className="font-mono text-[14px] font-bold text-[#1557b0]">{formatNumber(bsData.assets.total)}</span>
            </div>
          </div>

          {/* Liabilities Side */}
          <div className="flex flex-col">
            <div className="bg-[#f5f6fa] border-b border-[#9DC07A] px-3 py-2.5">
              <h3 className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Equity & Liabilities</h3>
            </div>
            {renderSection("Share Capital", bsData.liabilities.shareCapital, bsData.liabilities.breakdown)}
            {renderSection("Reserves & Surplus (inc. Net Profit)", bsData.liabilities.retainedEarnings, bsData.liabilities.breakdown)}
            {renderSection("Long Term Liabilities", bsData.liabilities.longTermLoans, bsData.liabilities.breakdown)}
            {renderSection("Current Liabilities & Provisions", bsData.liabilities.currentLiabilities, bsData.liabilities.breakdown)}
            
            <div className="mt-auto border-t-2 border-[#c7d2fe] bg-[#eef2ff] flex items-center justify-between px-3 py-3">
              <span className="text-[13px] font-bold text-[#1557b0]">Total Equity & Liabilities</span>
              <span className="font-mono text-[14px] font-bold text-[#1557b0]">{formatNumber(bsData.liabilities.total)}</span>
            </div>
          </div>
        </div>
      </FormPanel>
    </div>
  );
};

export default BalanceSheet;

