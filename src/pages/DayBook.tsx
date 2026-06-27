// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const DayBook: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("day-book");
  
  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("all");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingVoucherTypeFilter, setPendingVoucherTypeFilter] = useState(voucherTypeFilter);
  const [pendingIncludeCancelled, setPendingIncludeCancelled] = useState(includeCancelled);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setVoucherTypeFilter(pendingVoucherTypeFilter);
    setIncludeCancelled(pendingIncludeCancelled);
    setOptionsOpen(false);
  };

  // Compute day book data
  const groupedData = useMemo(() => {
    if (!vouchers) return { days: [], grandTotalDebit: 0, grandTotalCredit: 0 };
    
    // Filter vouchers by date range and type
    let filteredVouchers = vouchers.filter(v => 
      v.date >= startDate && 
      v.date <= endDate && 
      (includeCancelled || v.status !== "cancelled")
    );
    
    if (voucherTypeFilter !== "all") {
      filteredVouchers = filteredVouchers.filter(v => {
        if (voucherTypeFilter === "sales") return v.type.includes("sales");
        if (voucherTypeFilter === "purchase") return v.type.includes("purchase");
        if (voucherTypeFilter === "receipt") return v.type === "receipt";
        if (voucherTypeFilter === "payment") return v.type === "payment";
        if (voucherTypeFilter === "journal") return v.type === "journal";
        if (voucherTypeFilter === "contra") return v.type === "contra";
        if (voucherTypeFilter === "credit-note") return v.type === "credit-note";
        if (voucherTypeFilter === "debit-note") return v.type === "debit-note";
        if (voucherTypeFilter === "stock-journal") return v.type === "stock-journal";
        return v.type === voucherTypeFilter;
      });
    }
    
    // Sort by date then voucher number
    filteredVouchers.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return (a.voucherNo || "").localeCompare(b.voucherNo || "");
    });
    
    // Group by date
    const dateGroups: Record<string, any[]> = {};
    filteredVouchers.forEach(voucher => {
      if (!dateGroups[voucher.date]) {
        dateGroups[voucher.date] = [];
      }
      dateGroups[voucher.date].push(voucher);
    });
    
    // Process each voucher to extract details
    const processedDays = Object.keys(dateGroups).map(date => {
      const dayVouchers = dateGroups[date];
      
      // Process each voucher in the day
      const processedVouchers = dayVouchers.map(voucher => {
        // Get the first non-cash/bank account name from lines
        let partyOrLedger = "Miscellaneous";
        const nonCashBankLine = voucher.lines.find(line => {
          const acc = accounts.find(a => a.id === line.accountId);
          return acc && 
                 !acc.name.toLowerCase().includes("cash") && 
                 !acc.name.toLowerCase().includes("bank");
        });
        
        if (nonCashBankLine) {
          const acc = accounts.find(a => a.id === nonCashBankLine.accountId);
          partyOrLedger = acc?.name || "Unknown";
        } else if (voucher.partyName) {
          partyOrLedger = voucher.partyName;
        }
        
        // Format voucher type
        let voucherTypeLabel = voucher.type;
        switch(voucher.type) {
          case "sales-invoice": voucherTypeLabel = "Sales Invoice"; break;
          case "purchase-invoice": voucherTypeLabel = "Purchase Invoice"; break;
          case "receipt": voucherTypeLabel = "Receipt"; break;
          case "payment": voucherTypeLabel = "Payment"; break;
          case "journal": voucherTypeLabel = "Journal"; break;
          case "contra": voucherTypeLabel = "Contra"; break;
          case "credit-note": voucherTypeLabel = "Credit Note"; break;
          case "debit-note": voucherTypeLabel = "Debit Note"; break;
          case "stock-journal": voucherTypeLabel = "Stock Journal"; break;
          case "sales-return": voucherTypeLabel = "Sales Return"; break;
          case "purchase-return": voucherTypeLabel = "Purchase Return"; break;
          default: 
            voucherTypeLabel = voucher.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
        
        return {
          id: voucher.id,
          date: voucher.date,
          voucherType: voucherTypeLabel,
          voucherNo: voucher.voucherNo || "",
          partyOrLedger,
          narration: voucher.narration || "",
          debit: voucher.totalDebit || 0,
          credit: voucher.totalCredit || 0,
          status: voucher.status
        };
      });
      
      // Calculate day totals
      const dayTotalDebit = processedVouchers.reduce((sum, v) => sum + v.debit, 0);
      const dayTotalCredit = processedVouchers.reduce((sum, v) => sum + v.credit, 0);
      
      return {
        date,
        vouchers: processedVouchers,
        totalDebit: dayTotalDebit,
        totalCredit: dayTotalCredit
      };
    });
    
    // Calculate grand totals
    const grandTotalDebit = processedDays.reduce((sum, day) => sum + day.totalDebit, 0);
    const grandTotalCredit = processedDays.reduce((sum, day) => sum + day.totalCredit, 0);
    
    return {
      days: processedDays,
      grandTotalDebit,
      grandTotalCredit
    };
  }, [vouchers, accounts, startDate, endDate, voucherTypeFilter, includeCancelled]);

  const voucherTypeOptions = [
    { value: "all", label: "All Types" },
    { value: "sales", label: "Sales" },
    { value: "purchase", label: "Purchase" },
    { value: "receipt", label: "Receipt" },
    { value: "payment", label: "Payment" },
    { value: "journal", label: "Journal" },
    { value: "contra", label: "Contra" },
    { value: "credit-note", label: "Credit Note" },
    { value: "debit-note", label: "Debit Note" },
    { value: "stock-journal", label: "Stock Journal" }
  ];

  return (
    <ReportShell
      title="Day Book"
      subtitle="All vouchers by date"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingVoucherTypeFilter(voucherTypeFilter);
        setPendingIncludeCancelled(includeCancelled);
        setOptionsOpen(true);
      }}
      toolbarLeft={
        <>
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            From: 
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            To: 
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Type: 
            <select 
              value={voucherTypeFilter} 
              onChange={e => setVoucherTypeFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {voucherTypeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5 cursor-pointer">
            <input 
              type="checkbox" 
              checked={includeCancelled}
              onChange={e => setIncludeCancelled(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
            />
            Include Cancelled
          </label>
        </>
      }
    >
      <div className="overflow-x-auto w-full border border-gray-200 rounded-md bg-white">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vch Type</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vch No</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party / Ledger</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Narration</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Debit</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {groupedData.days.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-[12px]">
                  No records found for the selected period.
                </td>
              </tr>
            )}
            
            {groupedData.days.map(day => (
              <React.Fragment key={day.date}>
                {/* Vouchers for this day */}
                {day.vouchers.map(voucher => (
                  <tr 
                    key={voucher.id} 
                    className={`hover:bg-gray-50 transition-colors ${voucher.status === "cancelled" ? "text-red-500 line-through" : ""}`}
                  >
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.date}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.voucherType}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.voucherNo}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.partyOrLedger}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{voucher.narration}</td>
                    <td className="px-3 py-2.5 text-[12px] text-right font-mono" style={{ color: voucher.status !== "cancelled" && voucher.debit > 0 ? "#1557b0" : "inherit" }}>
                      {voucher.debit > 0 ? formatNumber(voucher.debit) : ""}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-right font-mono" style={{ color: voucher.status !== "cancelled" && voucher.credit > 0 ? "#dc2626" : "inherit" }}>
                      {voucher.credit > 0 ? formatNumber(voucher.credit) : ""}
                    </td>
                  </tr>
                ))}

                {/* Day subtotal row */}
                <tr className="bg-[#f8fafc] border-t border-b border-gray-200">
                  <td colSpan={4} className="px-3 py-2 text-[11px] font-medium text-gray-600 text-right">Total for {day.date}</td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono font-medium text-gray-700">{formatNumber(day.totalDebit)}</td>
                  <td className="px-3 py-2 text-[12px] text-right font-mono font-medium text-gray-700">{formatNumber(day.totalCredit)}</td>
                </tr>
              </React.Fragment>
            ))}
            
            {/* Grand total row */}
            {groupedData.days.length > 0 && (
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td colSpan={5} className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">GRAND TOTAL</td>
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right font-mono">{formatNumber(groupedData.grandTotalDebit)}</td>
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right font-mono">{formatNumber(groupedData.grandTotalCredit)}</td>
              </tr>
            )}
            
            {/* Unbalanced warning row */}
            {groupedData.grandTotalDebit !== groupedData.grandTotalCredit && (
              <tr className="bg-red-50 border border-red-200">
                <td colSpan={7} className="px-3 py-3 text-[12px] text-center text-red-700 font-bold">
                  ⚠️ WARNING: Debit and Credit totals do not match! System is unbalanced.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Day Book Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            From Date 
            <input 
              type="date" 
              value={pendingStart} 
              onChange={e => setPendingStart(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            To Date 
            <input 
              type="date" 
              value={pendingEnd} 
              onChange={e => setPendingEnd(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Voucher Type 
            <select 
              value={pendingVoucherTypeFilter} 
              onChange={e => setPendingVoucherTypeFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {voucherTypeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          
          <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 cursor-pointer mt-2">
            <input 
              type="checkbox" 
              checked={pendingIncludeCancelled}
              onChange={e => setPendingIncludeCancelled(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]"
            />
            Include Cancelled Vouchers
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default DayBook;
