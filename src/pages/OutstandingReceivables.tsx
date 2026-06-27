// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus, PaymentStatus, VoucherType } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const OutstandingReceivables: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("outstanding-receivables");
  
  const { invoices, parties, companySettings } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [view, setView] = useState<"receivables" | "ageing">("receivables");
  const [asOnDate, setAsOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [ageFrom, setAgeFrom] = useState<"dueDate" | "invoiceDate">("dueDate"); // Due Date vs Invoice Date toggle
  
  // Pending states for options modal
  const [pendingAsOnDate, setPendingAsOnDate] = useState(asOnDate);
  const [pendingSelectedPartyId, setPendingSelectedPartyId] = useState(selectedPartyId);
  const [pendingAgeFrom, setPendingAgeFrom] = useState(ageFrom);

  const applyOptions = () => {
    setAsOnDate(pendingAsOnDate);
    setSelectedPartyId(pendingSelectedPartyId);
    setAgeFrom(pendingAgeFrom);
    setOptionsOpen(false);
  };

  // Helper function to calculate days between dates
  const daysBetween = (dateString1: string, dateString2: string): number => {
    const date1 = new Date(dateString1);
    const date2 = new Date(dateString2);
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  };

  // Get unique parties with outstanding invoices
  const outstandingParties = useMemo(() => {
    const uniquePartyIds = new Set();
    (invoices || []).forEach(inv => {
      if (
        inv.type === "sales-invoice" &&
        inv.status === "posted" &&
        inv.paymentStatus !== "paid" &&
        inv.partyId
      ) {
        uniquePartyIds.add(inv.partyId);
      }
    });
    
    return Array.from(uniquePartyIds).map(id => {
      const party = parties.find(p => p.id === id);
      return { id, name: party?.name || "Unknown" };
    });
  }, [invoices, parties]);

  // Compute receivables data
  const receivablesData = useMemo(() => {
    if (!invoices) return [];

    let filteredInvoices = invoices.filter(inv => 
      inv.type === "sales-invoice" &&
      inv.status === "posted" &&
      inv.paymentStatus !== "paid" &&
      new Date(inv.date) <= new Date(asOnDate)
    );

    if (selectedPartyId) {
      filteredInvoices = filteredInvoices.filter(inv => inv.partyId === selectedPartyId);
    }

    // Sort by party then by date
    filteredInvoices.sort((a, b) => {
      if (a.partyName !== b.partyName) {
        return (a.partyName || "").localeCompare(b.partyName || "");
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const result = [];
    let currentParty = null;
    let partyTotalPending = 0;

    filteredInvoices.forEach(inv => {
      // Skip if party doesn't match filter
      if (selectedPartyId && inv.partyId !== selectedPartyId) return;

      const paidAmount = inv.paidAmount || 0;
      const pending = (inv.grandTotal || 0) - paidAmount;
      
      // Calculate overdue days
      const comparisonDate = ageFrom === "dueDate" ? (inv.dueDate || inv.date) : inv.date;
      const overdueDays = Math.max(0, daysBetween(comparisonDate, asOnDate));

      // Add subtotal row when party changes
      if (currentParty !== inv.partyName && currentParty !== null) {
        result.push({
          id: `subtotal-${currentParty}`,
          party: `Subtotal for ${currentParty}`,
          invoiceNo: "",
          date: "",
          dueDate: "",
          amount: "",
          paidAmount: "",
          pending: partyTotalPending,
          overdueDays: "",
          isSubtotal: true
        });
        partyTotalPending = 0;
      }

      currentParty = inv.partyName;

      result.push({
        id: inv.id,
        party: inv.partyName || "Unknown",
        invoiceNo: inv.invoiceNo || inv.voucherNo || "—",
        date: inv.date,
        dueDate: inv.dueDate || "—",
        amount: inv.grandTotal || 0,
        paidAmount,
        pending,
        overdueDays
      });

      partyTotalPending += pending;
    });

    // Add final subtotal
    if (currentParty !== null) {
      result.push({
        id: `subtotal-${currentParty}`,
        party: `Subtotal for ${currentParty}`,
        invoiceNo: "",
        date: "",
        dueDate: "",
        amount: "",
        paidAmount: "",
        pending: partyTotalPending,
        overdueDays: "",
        isSubtotal: true
      });
    }

    return result;
  }, [invoices, asOnDate, selectedPartyId, ageFrom]);

  // Compute ageing data
  const ageingData = useMemo(() => {
    if (!invoices) return [];

    let filteredInvoices = invoices.filter(inv => 
      inv.type === "sales-invoice" &&
      inv.status === "posted" &&
      inv.paymentStatus !== "paid" &&
      new Date(inv.date) <= new Date(asOnDate)
    );

    if (selectedPartyId) {
      filteredInvoices = filteredInvoices.filter(inv => inv.partyId === selectedPartyId);
    }

    // Group by party
    const partyMap: Record<string, any> = {};
    filteredInvoices.forEach(inv => {
      const partyId = inv.partyId;
      if (!partyMap[partyId]) {
        const party = parties.find(p => p.id === partyId);
        partyMap[partyId] = {
          partyId,
          party: party?.name || "Unknown",
          total: 0,
          current: 0,
          b1to30: 0,
          b31to60: 0,
          b61to90: 0,
          b90plus: 0
        };
      }

      const paidAmount = inv.paidAmount || 0;
      const pending = (inv.grandTotal || 0) - paidAmount;
      const comparisonDate = ageFrom === "dueDate" ? (inv.dueDate || inv.date) : inv.date;
      const days = daysBetween(comparisonDate, asOnDate);

      partyMap[partyId].total += pending;

      if (days < 0) { // Not due yet
        partyMap[partyId].current += pending;
      } else if (days <= 30) {
        partyMap[partyId].b1to30 += pending;
      } else if (days <= 60) {
        partyMap[partyId].b31to60 += pending;
      } else if (days <= 90) {
        partyMap[partyId].b61to90 += pending;
      } else {
        partyMap[partyId].b90plus += pending;
      }
    });

    const result = Object.values(partyMap);

    if (result.length > 0) {
      // Add grand total row
      const grandTotal = {
        id: "grand-total",
        party: "GRAND TOTAL",
        total: result.reduce((sum, party) => sum + party.total, 0),
        current: result.reduce((sum, party) => sum + party.current, 0),
        b1to30: result.reduce((sum, party) => sum + party.b1to30, 0),
        b31to60: result.reduce((sum, party) => sum + party.b31to60, 0),
        b61to90: result.reduce((sum, party) => sum + party.b61to90, 0),
        b90plus: result.reduce((sum, party) => sum + party.b90plus, 0),
        isTotal: true
      };
      return [...result, grandTotal];
    }

    return result;
  }, [invoices, asOnDate, selectedPartyId, ageFrom, parties]);

  // Compute summary stats
  const summaryStats = useMemo(() => {
    const filteredInvoices = (invoices || []).filter(inv => 
      inv.type === "sales-invoice" &&
      inv.status === "posted" &&
      inv.paymentStatus !== "paid" &&
      new Date(inv.date) <= new Date(asOnDate)
    );

    let relevantInvoices = filteredInvoices;
    if (selectedPartyId) {
      relevantInvoices = filteredInvoices.filter(inv => inv.partyId === selectedPartyId);
    }

    let totalOutstanding = 0;
    let overdueAmount = 0;
    let dueThisWeek = 0;

    const today = new Date(asOnDate);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    relevantInvoices.forEach(inv => {
      const paidAmount = inv.paidAmount || 0;
      const pending = (inv.grandTotal || 0) - paidAmount;
      totalOutstanding += pending;

      // Calculate overdue days
      const comparisonDate = ageFrom === "dueDate" ? (inv.dueDate || inv.date) : inv.date;
      const overdueDays = Math.max(0, daysBetween(comparisonDate, asOnDate));

      if (overdueDays > 0) {
        overdueAmount += pending;
      }

      // Check if due within 7 days
      if (inv.dueDate) {
        const daysUntilDue = daysBetween(asOnDate, inv.dueDate);
        if (daysUntilDue >= 0 && daysUntilDue <= 7) {
          dueThisWeek += pending;
        }
      }
    });

    return { totalOutstanding, overdueAmount, dueThisWeek };
  }, [invoices, asOnDate, selectedPartyId, ageFrom]);

  // Render cell with appropriate formatting
  const renderReceivablesCell = (columnKey: string, value: any, row: any) => {
    if (row.isSubtotal) {
      if (columnKey === "party") {
        return <span className="font-semibold text-gray-800">{value}</span>;
      }
      if (columnKey === "pending") {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (columnKey === "amount" || columnKey === "paidAmount" || columnKey === "pending") {
      return <span className="font-mono">{formatNumber(value)}</span>;
    }

    if (columnKey === "overdueDays") {
      if (value === 0 || value === "" || value === undefined) {
        return <span className="text-gray-400">—</span>;
      } else if (value <= 30) {
        return <span className="text-amber-600 font-medium">{value}</span>;
      } else if (value <= 60) {
        return <span className="text-red-600 font-semibold">{value}</span>;
      } else {
        return <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{value}</span>;
      }
    }

    return value;
  };

  const renderAgeingCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "party") {
        return <span className="font-bold text-gray-800">{value}</span>;
      }
      if (["total", "current", "b1to30", "b31to60", "b61to90", "b90plus"].includes(columnKey)) {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (columnKey === "b90plus" && value > 0) {
      return <span className="font-mono text-red-600 font-medium">{formatNumber(value)}</span>;
    }

    if (["total", "current", "b1to30", "b31to60", "b61to90", "b90plus"].includes(columnKey)) {
      return <span className="font-mono">{value > 0 ? formatNumber(value) : "—"}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Outstanding Receivables"
      subtitle="Customer dues and ageing analysis"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`As on ${asOnDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingAsOnDate(asOnDate);
        setPendingSelectedPartyId(selectedPartyId);
        setPendingAgeFrom(ageFrom);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <>
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            As On: 
            <input 
              type="date" 
              value={asOnDate} 
              onChange={e => setAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <select
            value={selectedPartyId}
            onChange={e => setSelectedPartyId(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[200px]"
          >
            <option value="">All Parties</option>
            {outstandingParties.map(party => (
              <option key={party.id} value={party.id}>{party.name}</option>
            ))}
          </select>
        </>
      }
    >
      {/* View toggle buttons */}
      <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded-md w-fit">
        <button
          className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${view === "receivables" ? "bg-white text-[#1557b0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          onClick={() => setView("receivables")}
        >
          Detailed Receivables
        </button>
        <button
          className={`px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors ${view === "ageing" ? "bg-white text-[#1557b0] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          onClick={() => setView("ageing")}
        >
          Ageing Analysis
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-[12px]">
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Outstanding</div>
          <div className="text-[14px] font-mono font-bold text-gray-800">Rs. {formatNumber(summaryStats.totalOutstanding)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Overdue Amount</div>
          <div className="text-[14px] font-mono font-bold text-red-600">Rs. {formatNumber(summaryStats.overdueAmount)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Due This Week</div>
          <div className="text-[14px] font-mono font-bold text-amber-600">Rs. {formatNumber(summaryStats.dueThisWeek)}</div>
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden mb-6">
        {view === "receivables" ? (
          <ReportGrid 
            columns={[
              { key: "party", label: "Party Name" },
              { key: "invoiceNo", label: "Bill No" },
              { key: "date", label: "Bill Date" },
              { key: "dueDate", label: "Due Date" },
              { key: "amount", label: "Bill Amount", align: "right" },
              { key: "paidAmount", label: "Paid", align: "right" },
              { key: "pending", label: "Pending", align: "right" },
              { key: "overdueDays", label: "Overdue Days", align: "right" }
            ]} 
            data={receivablesData} 
            getRowClassName={(row) => row.isSubtotal ? "bg-[#f8fafc] border-y border-gray-200" : ""}
            renderCell={renderReceivablesCell}
          />
        ) : (
          <ReportGrid 
            columns={[
              { key: "party", label: "Party" },
              { key: "total", label: "Total Outstanding", align: "right" },
              { key: "current", label: "Not Due", align: "right" },
              { key: "b1to30", label: "1-30 Days", align: "right" },
              { key: "b31to60", label: "31-60 Days", align: "right" },
              { key: "b61to90", label: "61-90 Days", align: "right" },
              { key: "b90plus", label: ">90 Days", align: "right" }
            ]} 
            data={ageingData} 
            getRowClassName={(row) => row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""}
            renderCell={renderAgeingCell}
          />
        )}
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Outstanding Receivables Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            As On Date 
            <input 
              type="date" 
              value={pendingAsOnDate} 
              onChange={e => setPendingAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" 
            />
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Party Filter 
            <select
              value={pendingSelectedPartyId}
              onChange={e => setPendingSelectedPartyId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Parties</option>
              {outstandingParties.map(party => (
                <option key={party.id} value={party.id}>{party.name}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Calculate Ageing From 
            <select
              value={pendingAgeFrom}
              onChange={e => setPendingAgeFrom(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="dueDate">Due Date</option>
              <option value="invoiceDate">Invoice Date</option>
            </select>
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default OutstandingReceivables;
