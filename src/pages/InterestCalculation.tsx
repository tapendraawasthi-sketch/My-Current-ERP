// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, PaymentStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const InterestCalculation: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("interest-calculation");
  
  const { invoices, parties, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reportType, setReportType] = useState<"receivables" | "payables">("receivables");
  const [interestRate, setInterestRate] = useState(18);
  const [calcFrom, setCalcFrom] = useState<"dueDate" | "invoiceDate">("dueDate");
  const [gracePeriod, setGracePeriod] = useState(0);
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Pending states for options modal
  const [pendingReportType, setPendingReportType] = useState(reportType);
  const [pendingInterestRate, setPendingInterestRate] = useState(interestRate);
  const [pendingCalcFrom, setPendingCalcFrom] = useState(calcFrom);
  const [pendingGracePeriod, setPendingGracePeriod] = useState(gracePeriod);
  const [pendingAsOnDate, setPendingAsOnDate] = useState(asOnDate);

  const applyOptions = () => {
    setReportType(pendingReportType);
    setInterestRate(pendingInterestRate);
    setCalcFrom(pendingCalcFrom);
    setGracePeriod(pendingGracePeriod);
    setAsOnDate(pendingAsOnDate);
    setOptionsOpen(false);
  };

  // Helper function to calculate days between dates
  const daysBetween = (from: string, to: string): number => {
    const d1 = new Date(from).getTime();
    const d2 = new Date(to).getTime();
    return Math.max(0, Math.floor((d2 - d1) / (1000*60*60*24)));
  };

  // Compute interest data
  const interestData = useMemo(() => {
    if (!invoices) return { rows: [], grandTotalPrincipal: 0, grandTotalInterest: 0, totalInterest: 0 };

    // Filter invoices based on report type
    const filteredInvoices = (invoices || []).filter(inv => {
      const isReceivable = reportType === "receivables" && inv.type === "sales-invoice";
      const isPayable = reportType === "payables" && inv.type === "purchase-invoice";
      return (isReceivable || isPayable) && 
             inv.status === "posted" && 
             inv.paymentStatus !== "paid";
    });

    const result = [];
    let currentParty = null;
    let partyTotalPrincipal = 0;
    let partyTotalInterest = 0;

    // Sort by party then by date
    filteredInvoices.sort((a, b) => {
      if (a.partyName !== b.partyName) {
        return (a.partyName || "").localeCompare(b.partyName || "");
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    filteredInvoices.forEach(inv => {
      const outstanding = (inv.grandTotal || 0) - (inv.paidAmount || 0);
      if (outstanding <= 0) return; // Skip if nothing outstanding

      // Determine the from date
      const fromDate = calcFrom === "dueDate" ? (inv.dueDate || inv.date) : inv.date;
      const effectiveFromDate = new Date(fromDate);
      effectiveFromDate.setDate(effectiveFromDate.getDate() + gracePeriod);
      const effectiveFromDateStr = effectiveFromDate.toISOString().split('T')[0];

      // Calculate days
      const days = daysBetween(effectiveFromDateStr, asOnDate);

      // Calculate interest
      let interest = 0;
      if (days > 0) {
        interest = (outstanding * interestRate / 100 / 365) * days;
      }
      interest = Number(interest.toFixed(2));

      // Add subtotal row when party changes
      if (currentParty !== inv.partyName && currentParty !== null) {
        result.push({
          id: `subtotal-${currentParty}`,
          party: `Subtotal for ${currentParty}`,
          billRef: "",
          principal: partyTotalPrincipal,
          fromDate: "",
          toDate: "",
          days: "",
          rate: "",
          interest: partyTotalInterest,
          isSubtotal: true
        });
        partyTotalPrincipal = 0;
        partyTotalInterest = 0;
      }

      currentParty = inv.partyName;

      result.push({
        id: inv.id,
        party: inv.partyName || "Unknown",
        billRef: inv.invoiceNo || inv.voucherNo || "—",
        principal: outstanding,
        fromDate: effectiveFromDateStr,
        toDate: asOnDate,
        days,
        rate: interestRate,
        interest
      });

      partyTotalPrincipal += outstanding;
      partyTotalInterest += interest;
    });

    // Add final subtotal
    if (currentParty !== null) {
      result.push({
        id: `subtotal-${currentParty}`,
        party: `Subtotal for ${currentParty}`,
        billRef: "",
        principal: partyTotalPrincipal,
        fromDate: "",
        toDate: "",
        days: "",
        rate: "",
        interest: partyTotalInterest,
        isSubtotal: true
      });
    }

    // Calculate grand totals
    const grandTotalPrincipal = result.reduce((sum, row) => {
      if (!row.isSubtotal) return sum + (row.principal || 0);
      return sum;
    }, 0);

    const grandTotalInterest = result.reduce((sum, row) => {
      if (!row.isSubtotal) return sum + (row.interest || 0);
      return sum;
    }, 0);

    if (result.length > 0) {
      // Add grand total row
      result.push({
        id: "grand-total",
        party: "GRAND TOTAL",
        billRef: "",
        principal: grandTotalPrincipal,
        fromDate: "",
        toDate: "",
        days: "",
        rate: "",
        interest: grandTotalInterest,
        isTotal: true
      });
    }

    return {
      rows: result,
      grandTotalPrincipal,
      grandTotalInterest,
      totalInterest: grandTotalInterest
    };
  }, [invoices, reportType, interestRate, calcFrom, gracePeriod, asOnDate]);

  // Summary text
  const summaryText = reportType === "receivables" 
    ? `Total Interest Receivable: Rs. ${formatNumber(interestData.totalInterest)}`
    : `Total Interest Payable: Rs. ${formatNumber(interestData.totalInterest)}`;

  // Render cell with appropriate formatting
  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isSubtotal) {
      if (columnKey === "party") {
        return <span className="font-semibold text-gray-800">{value}</span>;
      }
      if (columnKey === "principal" || columnKey === "interest") {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (row.isTotal) {
      if (columnKey === "party") {
        return <span className="font-bold text-gray-800">GRAND TOTAL</span>;
      }
      if (["principal", "interest"].includes(columnKey)) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (["principal", "interest"].includes(columnKey)) {
      return <span className="font-mono">{formatNumber(value)}</span>;
    }

    if (columnKey === "rate" && value !== "") {
      return `${value}%`;
    }

    if (["days", "fromDate", "toDate"].includes(columnKey) && row.isSubtotal) {
      return "";
    }

    return value;
  };

  return (
    <ReportShell
      title="Interest Calculation"
      subtitle="Auto-calculated interest on outstanding balances"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`As on ${asOnDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingReportType(reportType);
        setPendingInterestRate(interestRate);
        setPendingCalcFrom(calcFrom);
        setPendingGracePeriod(gracePeriod);
        setPendingAsOnDate(asOnDate);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Calculate & Print" },
        { label: "Export to Excel" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            As On: 
            <input 
              type="date" 
              value={asOnDate} 
              onChange={e => setAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
        </div>
      }
    >
      {/* Control panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-white border border-gray-200 rounded-md shadow-sm">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Report Type</label>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-md w-fit">
            <button
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${reportType === "receivables" ? "bg-white text-[#1557b0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              onClick={() => setReportType("receivables")}
            >
              Receivables
            </button>
            <button
              className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${reportType === "payables" ? "bg-white text-[#1557b0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              onClick={() => setReportType("payables")}
            >
              Payables
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Annual Interest Rate (%)</label>
          <input
            type="number"
            value={interestRate}
            onChange={e => setInterestRate(parseFloat(e.target.value) || 0)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            min="0"
            step="0.01"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Grace Period (Days)</label>
          <input
            type="number"
            value={gracePeriod}
            onChange={e => setGracePeriod(parseInt(e.target.value) || 0)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            min="0"
          />
        </div>
        
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Calculation From</label>
          <select
            value={calcFrom}
            onChange={e => setCalcFrom(e.target.value as "dueDate" | "invoiceDate")}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
          >
            <option value="dueDate">From Due Date</option>
            <option value="invoiceDate">From Invoice Date</option>
          </select>
        </div>
      </div>

      {/* Summary box */}
      <div className="bg-[#eef2ff] border border-[#c7d2fe] text-[#1557b0] p-3 text-[13px] font-semibold rounded-md mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {summaryText}
        </span>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        <ReportGrid 
          columns={[
            { key: "party", label: "Party Name" },
            { key: "billRef", label: "Bill Ref" },
            { key: "principal", label: "Principal Amount", align: "right" },
            { key: "fromDate", label: "From Date" },
            { key: "toDate", label: "To Date (As On)" },
            { key: "days", label: "Days", align: "right" },
            { key: "rate", label: "Rate %", align: "right" },
            { key: "interest", label: "Interest (Rs.)", align: "right" }
          ]} 
          data={interestData.rows} 
          getRowClassName={(row) => {
            if (row.isSubtotal) return "bg-[#f8fafc] border-y border-gray-200";
            if (row.isTotal) return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
            return "";
          }}
          renderCell={renderCell}
        />
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Interest Calculation Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Report Type
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="radio" 
                  name="reportType" 
                  value="receivables"
                  checked={pendingReportType === "receivables"}
                  onChange={() => setPendingReportType("receivables")}
                  className="text-[#1557b0] focus:ring-[#1557b0]"
                />
                Receivables
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input 
                  type="radio" 
                  name="reportType" 
                  value="payables"
                  checked={pendingReportType === "payables"}
                  onChange={() => setPendingReportType("payables")}
                  className="text-[#1557b0] focus:ring-[#1557b0]"
                />
                Payables
              </label>
            </div>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Annual Interest Rate (%) 
            <input
              type="number"
              value={pendingInterestRate}
              onChange={e => setPendingInterestRate(parseFloat(e.target.value) || 0)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              min="0"
              step="0.01"
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Calculation From 
            <select
              value={pendingCalcFrom}
              onChange={e => setPendingCalcFrom(e.target.value as "dueDate" | "invoiceDate")}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="dueDate">From Due Date</option>
              <option value="invoiceDate">From Invoice Date</option>
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Grace Period (Days) 
            <input
              type="number"
              value={pendingGracePeriod}
              onChange={e => setPendingGracePeriod(parseInt(e.target.value) || 0)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              min="0"
            />
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
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default InterestCalculation;
