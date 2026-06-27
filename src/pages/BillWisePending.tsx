// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const BillWisePending: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("bill-wise-pending");
  
  const { invoices, parties, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"both" | "receivables" | "payables">("both");
  const [partySearch, setPartySearch] = useState("");
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  
  // Pending states for options modal
  const [pendingTypeFilter, setPendingTypeFilter] = useState(typeFilter);
  const [pendingAsOnDate, setPendingAsOnDate] = useState(asOnDate);
  const [pendingShowOnlyOverdue, setPendingShowOnlyOverdue] = useState(showOnlyOverdue);

  const applyOptions = () => {
    setTypeFilter(pendingTypeFilter);
    setAsOnDate(pendingAsOnDate);
    setShowOnlyOverdue(pendingShowOnlyOverdue);
    setOptionsOpen(false);
  };

  // Helper function to calculate days between dates
  const daysBetween = (dateString1: string, dateString2: string): number => {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  };

  // Compute bill-wise pending data
  const reportData = useMemo(() => {
    if (!invoices) return { groupedData: [], summary: { receivable: 0, payable: 0, net: 0 } };

    // Filter invoices
    let filteredInvoices = invoices.filter(inv => 
      inv.paymentStatus !== "paid" && 
      inv.status === "posted"
    );

    // Apply type filter
    if (typeFilter === "receivables") {
      filteredInvoices = filteredInvoices.filter(inv => 
        inv.type === "sales-invoice" || inv.type === "sales-return"
      );
    } else if (typeFilter === "payables") {
      filteredInvoices = filteredInvoices.filter(inv => 
        inv.type === "purchase-invoice" || inv.type === "purchase-return"
      );
    }

    // Apply party search filter
    if (partySearch) {
      const lowerSearch = partySearch.toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv => 
        (inv.partyName || "").toLowerCase().includes(lowerSearch)
      );
    }

    // Group by party
    const partyMap = new Map();
    filteredInvoices.forEach(inv => {
      if (!partyMap.has(inv.partyId)) {
        partyMap.set(inv.partyId, {
          partyName: inv.partyName || "Unknown",
          invoices: [],
          totalPending: 0
        });
      }

      const partyData = partyMap.get(inv.partyId);
      
      // Calculate pending amount
      const billAmount = inv.grandTotal || 0;
      const paidAmount = inv.paidAmount || 0;
      const pendingAmount = billAmount - paidAmount;
      
      // Calculate overdue days
      const dueDate = inv.dueDate || inv.date;
      const overdueDays = daysBetween(dueDate, asOnDate);

      // Apply overdue filter
      if (showOnlyOverdue && overdueDays <= 0) return;

      const invoiceData = {
        id: inv.id,
        invoiceNo: inv.invoiceNo || inv.voucherNo || "—",
        date: inv.date,
        dueDate: inv.dueDate || "—",
        billAmount,
        paidAmount,
        pendingAmount,
        overdueDays,
        type: inv.type,
        partyId: inv.partyId
      };

      partyData.invoices.push(invoiceData);
      partyData.totalPending += pendingAmount;
    });

    // Build grouped data
    const groupedData = [];
    let totalReceivable = 0;
    let totalPayable = 0;

    for (const [partyId, partyData] of partyMap.entries()) {
      // Add party header row
      groupedData.push({
        id: `party-${partyId}`,
        partyOrInvoice: partyData.partyName,
        isParty: true,
        totalPending: partyData.totalPending
      });

      // Add invoice rows
      partyData.invoices.forEach(inv => {
        groupedData.push({
          id: inv.id,
          partyOrInvoice: inv.invoiceNo,
          date: inv.date,
          dueDate: inv.dueDate,
          billAmount: inv.billAmount,
          paidAmount: inv.paidAmount,
          pendingAmount: inv.pendingAmount,
          overdueDays: inv.overdueDays,
          type: inv.type,
          isInvoice: true
        });

        // Update summary
        if (inv.type.includes("sales")) {
          totalReceivable += inv.pendingAmount;
        } else if (inv.type.includes("purchase")) {
          totalPayable += inv.pendingAmount;
        }
      });

      // Add party subtotal row
      groupedData.push({
        id: `subtotal-${partyId}`,
        partyOrInvoice: `Subtotal for ${partyData.partyName}`,
        billAmount: "",
        paidAmount: "",
        pendingAmount: partyData.totalPending,
        isSubtotal: true
      });
    }

    // Add grand total row
    if (groupedData.length > 0) {
      const grandTotalPaid = groupedData.filter(row => row.isInvoice).reduce((sum, row) => sum + (row.paidAmount || 0), 0);
      const grandTotalPending = groupedData.filter(row => row.isInvoice).reduce((sum, row) => sum + (row.pendingAmount || 0), 0);

      groupedData.push({
        id: "grand-total",
        partyOrInvoice: "GRAND TOTAL",
        date: "",
        dueDate: "",
        billAmount: "",
        paidAmount: grandTotalPaid,
        pendingAmount: grandTotalPending,
        overdueDays: "",
        type: "",
        isGrandTotal: true
      });
    }

    return {
      groupedData,
      summary: {
        receivable: totalReceivable,
        payable: totalPayable,
        net: totalReceivable - totalPayable
      }
    };
  }, [invoices, typeFilter, partySearch, asOnDate, showOnlyOverdue]);

  return (
    <ReportShell
      title="Bill-wise Pending"
      subtitle="Unpaid invoices grouped by party"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`As on ${asOnDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingTypeFilter(typeFilter);
        setPendingAsOnDate(asOnDate);
        setPendingShowOnlyOverdue(showOnlyOverdue);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            As On: 
            <input 
              type="date" 
              value={asOnDate} 
              onChange={e => setAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[130px]" 
            />
          </label>
          
          <div className="h-4 w-px bg-gray-300 mx-1"></div>

          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Type: 
            <select 
              value={typeFilter} 
              onChange={e => setTypeFilter(e.target.value as any)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="both">Both</option>
              <option value="receivables">Receivables (Sales)</option>
              <option value="payables">Payables (Purchases)</option>
            </select>
          </label>
          
          <div className="relative ml-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search party..."
              value={partySearch}
              onChange={e => setPartySearch(e.target.value)}
              className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[160px]"
            />
          </div>
          
          <label className="text-[12px] font-medium text-gray-700 flex items-center gap-1.5 ml-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showOnlyOverdue}
              onChange={e => setShowOnlyOverdue(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show only overdue
          </label>
        </div>
      }
    >
      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total Receivable</span>
          <span className="text-2xl font-bold mt-1 text-[#059669] font-mono">
            Rs. {formatNumber(reportData.summary.receivable)}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total Payable</span>
          <span className="text-2xl font-bold mt-1 text-[#1557b0] font-mono">
            Rs. {formatNumber(reportData.summary.payable)}
          </span>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm flex flex-col">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Net Position</span>
          <span className={`text-2xl font-bold mt-1 font-mono tracking-tight ${reportData.summary.net >= 0 ? "text-[#059669]" : "text-[#dc2626]"}`}>
            Rs. {formatNumber(reportData.summary.net)}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6 shadow-sm">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-[#f5f6fa] border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party / Invoice</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bill Amount</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Paid Amount</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pending Amount</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Overdue Days</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reportData.groupedData.map((row, index) => {
              if (row.isParty) {
                return (
                  <tr key={row.id} className="bg-[#f8fafc] font-semibold text-gray-800 border-y border-gray-200">
                    <td colSpan={8} className="px-3 py-2.5">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#1557b0]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {row.partyOrInvoice}
                        </span>
                        <span className="font-mono text-[#1557b0]">Total Pending: Rs. {formatNumber(row.totalPending)}</span>
                      </div>
                    </td>
                  </tr>
                );
              } else if (row.isSubtotal) {
                return (
                  <tr key={row.id} className="bg-gray-50 font-semibold text-gray-700">
                    <td colSpan={5} className="px-3 py-2.5 pl-9 text-gray-500 text-[11px] uppercase tracking-wide">{row.partyOrInvoice}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#1557b0]">{formatNumber(row.pendingAmount)}</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                );
              } else if (row.isInvoice) {
                // Determine row background based on overdue days
                let bgColor = "hover:bg-gray-50 transition-colors";
                let overdueClass = "text-gray-700";
                
                if (row.overdueDays > 60) {
                  bgColor = "bg-red-50 hover:bg-red-100 transition-colors";
                  overdueClass = "text-red-600 font-bold";
                } else if (row.overdueDays > 30) {
                  bgColor = "bg-amber-50 hover:bg-amber-100 transition-colors";
                  overdueClass = "text-amber-600 font-bold";
                } else if (row.overdueDays > 0) {
                  overdueClass = "text-amber-600 font-medium";
                }
                
                return (
                  <tr key={row.id} className={bgColor}>
                    <td className="px-3 py-2.5 pl-9 text-gray-700 font-medium">{row.partyOrInvoice}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.date}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.dueDate}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{formatNumber(row.billAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-gray-600">{row.paidAmount > 0 ? formatNumber(row.paidAmount) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#d97706] font-medium">{formatNumber(row.pendingAmount)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${overdueClass}`}>
                      {row.overdueDays > 0 ? row.overdueDays : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {row.type.includes("sales") ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md bg-green-100 text-green-700">Sales</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md bg-blue-100 text-blue-700">Purchase</span>
                      )}
                    </td>
                  </tr>
                );
              } else if (row.isGrandTotal) {
                return (
                  <tr key={row.id} className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-3 text-gray-900">{row.partyOrInvoice}</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">{row.paidAmount === 0 ? "—" : formatNumber(row.paidAmount)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[#1557b0] text-[14px]">{formatNumber(row.pendingAmount)}</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3"></td>
                  </tr>
                );
              }
              return null;
            })}
            
            {reportData.groupedData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500 italic">No pending bills found for the selected criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Bill-wise Pending Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Type 
            <select 
              value={pendingTypeFilter} 
              onChange={e => setPendingTypeFilter(e.target.value as any)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="both">Both</option>
              <option value="receivables">Receivables (Sales)</option>
              <option value="payables">Payables (Purchases)</option>
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            As On Date 
            <input 
              type="date" 
              value={pendingAsOnDate} 
              onChange={e => setPendingAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer pt-2">
            <input 
              type="checkbox" 
              checked={pendingShowOnlyOverdue}
              onChange={e => setPendingShowOnlyOverdue(e.target.checked)}
              className="w-4 h-4 text-[#1557b0] border-gray-300 rounded focus:ring-[#1557b0]"
            />
            Show Only Overdue Bills
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default BillWisePending;
