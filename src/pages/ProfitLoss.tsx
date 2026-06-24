// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Profit & Loss / Income Statement report page.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Badge, Button, Select } from "../components/ui";
import { FileSpreadsheet, Printer, Activity, ChevronRight, ChevronDown } from "lucide-react";
import { computeProfitLoss } from "../lib/accounting";
import { formatNumber, dateToAD } from "../lib/utils";
import toast from "react-hot-toast";
import { PillTitle, FormPanel } from "../components/BusyShell";
import jsPDF from "jspdf";
import "jspdf-autotable";

const ProfitLoss: React.FC = () => {
  const accounts = useStore(state => state.accounts);
  const vouchers = useStore(state => state.vouchers);
  const invoices = useStore(state => state.invoices);
  const companySettings = useStore(state => state.companySettings);
  const currentFiscalYear = useStore(state => state.currentFiscalYear);
  const [startDate, setStartDate] = useState<string>(
    currentFiscalYear?.startDate || "2026-07-16"
  );
  const [endDate, setEndDate] = useState<string>(
    currentFiscalYear?.endDate || "2027-07-15"
  );
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const plData = useMemo(() => {
    return computeProfitLoss(accounts, vouchers, invoices || [], startDate, endDate);
  }, [accounts, vouchers, invoices, startDate, endDate]);

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
      doc.text("Statement of Profit & Loss", 14, 22);
      doc.setFontSize(10);
      doc.text(`For the period: ${startDate} to ${endDate}`, 14, 28);
      
      const tableData = [
        ["Sales Revenue", formatNumber(plData.sections.salesRevenue)],
        ["Less: Purchase Returns", formatNumber(plData.sections.purchaseReturns)],
        ["Less: Cost of Goods Sold", formatNumber(plData.sections.costOfGoodsSold)],
        ["Gross Profit", formatNumber(plData.grossProfit)],
        ["Less: Operating Expenses", formatNumber(plData.sections.operatingExpenses)],
        ["Less: Admin Expenses", formatNumber(plData.sections.adminExpenses)],
        ["Operating Profit", formatNumber(plData.operatingProfit)],
        ["Add: Other Income", formatNumber(plData.sections.otherIncome)],
        ["Less: Financing Costs", formatNumber(plData.sections.financingCosts)],
        ["Less: Tax Provision", formatNumber(plData.sections.taxProvision)],
        ["Net Profit After Tax", formatNumber(plData.netProfit)],
      ];

      (doc as any).autoTable({
        startY: 35,
        head: [["Particulars", "Amount (Rs.)"]],
        body: tableData,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [21, 87, 176] }
      });

      doc.save(`Profit_Loss_${endDate}.pdf`);
      toast.success("PDF exported successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    }
  };

  const renderSection = (title: string, amount: number, isTotal = false) => {
    const breakdown = plData.ledgerBreakdown.filter(l => {
      const g = l.groupName.toLowerCase();
      const n = l.ledgerName.toLowerCase();
      if (title.toLowerCase().includes("sales")) return g.includes("sales") || n.includes("sales");
      if (title.toLowerCase().includes("goods sold") || title.toLowerCase().includes("cogs")) return g.includes("cost") || g.includes("direct") || g.includes("purchase");
      if (title.toLowerCase().includes("admin")) return g.includes("admin") || g.includes("office");
      if (title.toLowerCase().includes("operating")) return (!g.includes("admin") && !g.includes("office") && !g.includes("finance") && !g.includes("tax"));
      if (title.toLowerCase().includes("finance")) return g.includes("finance") || g.includes("interest");
      if (title.toLowerCase().includes("tax")) return g.includes("tax");
      if (title.toLowerCase().includes("other income")) return !g.includes("sales");
      return false;
    });
    
    const hasChildren = breakdown.length > 0 && !isTotal;
    const isExpanded = expandedGroups.has(title);

    return (
      <div className={`border-b border-[#9DC07A] last:border-0 ${isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""}`}>
        <div 
          className={`flex items-center justify-between px-3 py-2.5 ${hasChildren ? "cursor-pointer hover:bg-[#EBF5E2]" : ""} ${isTotal ? "font-bold text-[#1557b0]" : ""}`}
          onClick={() => hasChildren && toggleGroup(title)}
        >
          <div className="flex items-center gap-2">
            {hasChildren && (
              isExpanded ? <ChevronDown className="w-4 h-4 text-[#000000]" /> : <ChevronRight className="w-4 h-4 text-[#000000]" />
            )}
            {!hasChildren && <span className="w-4" />}
            <span className={`text-[12px] ${isTotal ? "text-[#1557b0]" : "text-[#000000]"}`}>{title}</span>
          </div>
          <span className="font-mono text-[12px] text-right">{formatNumber(amount)}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="bg-[#EBF5E2] border-y border-[#9DC07A] pb-2 pt-1">
            {breakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between pl-10 pr-3 py-1.5 hover:bg-[#EBF5E2]">
                <span className="text-[11px] text-[#000000]">{item.ledgerName} <span className="text-[#000000]">({item.groupName})</span></span>
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
      <PillTitle title="Profit & Loss Account" icon={Activity} />
      
      <FormPanel>
        <div className="flex items-end gap-4 mb-4 no-print">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-[#000000] mb-1">From Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-[#000000] mb-1">To Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
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
          <h3 className="text-[14px] font-semibold mt-2">Statement of Profit & Loss</h3>
          <p className="text-[11px] text-[#000000]">For the period: {startDate} to {endDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 border border-[#9DC07A] rounded-lg bg-white overflow-hidden shadow-sm">
          {/* Revenue Side */}
          <div className="border-r border-[#9DC07A]">
            <div className="bg-[#f5f6fa] border-b border-[#9DC07A] px-3 py-2.5">
              <h3 className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Revenue & Direct Incomes</h3>
            </div>
            {renderSection("Sales Revenue", plData.sections.salesRevenue)}
            {renderSection("Less: Purchase Returns", plData.sections.purchaseReturns)}
            {renderSection("Less: Cost of Goods Sold", plData.sections.costOfGoodsSold)}
            {renderSection("Gross Profit", plData.grossProfit, true)}
            
            <div className="mt-4">
              <div className="bg-[#f5f6fa] border-y border-[#9DC07A] px-3 py-2.5">
                <h3 className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Other Incomes</h3>
              </div>
              {renderSection("Other Income", plData.sections.otherIncome)}
            </div>
          </div>

          {/* Expenses Side */}
          <div>
            <div className="bg-[#f5f6fa] border-b border-[#9DC07A] px-3 py-2.5">
              <h3 className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Expenses</h3>
            </div>
            {renderSection("Operating Expenses", plData.sections.operatingExpenses)}
            {renderSection("Administrative Expenses", plData.sections.adminExpenses)}
            {renderSection("Operating Profit", plData.operatingProfit, true)}
            
            <div className="mt-4">
              <div className="bg-[#f5f6fa] border-y border-[#9DC07A] px-3 py-2.5">
                <h3 className="text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Finance & Taxes</h3>
              </div>
              {renderSection("Financing Costs / Interest", plData.sections.financingCosts)}
              {renderSection("Profit Before Tax", plData.operatingProfit + plData.sections.otherIncome - plData.sections.financingCosts, true)}
              {renderSection("Tax Provision", plData.sections.taxProvision)}
            </div>
          </div>
        </div>

        <div className="mt-6 border-2 border-[#1557b0] rounded-lg bg-[#eef2ff] px-4 py-3 flex items-center justify-between shadow-sm">
          <span className="text-[14px] font-bold text-[#1557b0]">Net Profit After Tax</span>
          <span className="font-mono text-[16px] font-bold text-[#1557b0]">Rs. {formatNumber(plData.netProfit)}</span>
        </div>
      </FormPanel>
    </div>
  );
};

export default ProfitLoss;

