// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const VouchersRegister: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("vouchers-register");
  
  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingTypeFilter, setPendingTypeFilter] = useState(typeFilter);
  const [pendingStatusFilter, setPendingStatusFilter] = useState(statusFilter);
  const [pendingSearchText, setPendingSearchText] = useState(searchText);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setTypeFilter(pendingTypeFilter);
    setStatusFilter(pendingStatusFilter);
    setSearchText(pendingSearchText);
    setPage(1);
    setOptionsOpen(false);
  };

  // Compute vouchers register data
  const registerData = useMemo(() => {
    if (!vouchers) return { rows: [], totalDebit: 0, totalCredit: 0, filteredCount: 0 };

    // Filter vouchers
    let filteredVouchers = vouchers.filter(v => 
      v.date >= startDate && 
      v.date <= endDate
    );

    if (typeFilter !== "all") {
      filteredVouchers = filteredVouchers.filter(v => 
        (typeFilter === "sales" && v.type.includes("sales")) ||
        (typeFilter === "purchase" && v.type.includes("purchase")) ||
        (typeFilter === "receipt" && v.type === "receipt") ||
        (typeFilter === "payment" && v.type === "payment") ||
        (typeFilter === "journal" && v.type === "journal") ||
        (typeFilter === "contra" && v.type === "contra") ||
        (typeFilter === "credit-note" && v.type === "credit-note") ||
        (typeFilter === "debit-note" && v.type === "debit-note")
      );
    }

    if (statusFilter !== "all") {
      filteredVouchers = filteredVouchers.filter(v => v.status === statusFilter);
    }

    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filteredVouchers = filteredVouchers.filter(v => 
        (v.voucherNo || "").toLowerCase().includes(lowerSearch) || 
        (v.narration || "").toLowerCase().includes(lowerSearch)
      );
    }

    // Calculate totals
    const totalDebit = filteredVouchers.reduce((sum, v) => sum + (v.totalDebit || 0), 0);
    const totalCredit = filteredVouchers.reduce((sum, v) => sum + (v.totalCredit || 0), 0);

    // Process vouchers for display
    const processedVouchers = filteredVouchers.map(v => {
      // Get party or first non-cash account name
      let partyOrLedger = "Miscellaneous";
      const nonCashLine = v.lines?.find(line => {
        const acc = accounts?.find(a => a.id === line.accountId);
        return acc && 
               !acc.name.toLowerCase().includes("cash") && 
               !acc.name.toLowerCase().includes("bank");
      });
      
      if (nonCashLine) {
        const acc = accounts?.find(a => a.id === nonCashLine.accountId);
        partyOrLedger = acc?.name || "Unknown";
      } else if (v.partyName) {
        partyOrLedger = v.partyName;
      }

      // Format voucher type
      let voucherTypeLabel = v.type;
      switch(v.type) {
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
          voucherTypeLabel = v.type ? v.type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : "Unknown";
      }

      return {
        id: v.id,
        date: v.date,
        voucherType: voucherTypeLabel,
        voucherNo: v.voucherNo || "—",
        partyOrLedger,
        narration: v.narration || "—",
        debit: v.totalDebit || 0,
        credit: v.totalCredit || 0,
        status: v.status || "draft"
      };
    });

    // Add total row
    if (processedVouchers.length > 0) {
      processedVouchers.push({
        id: "total",
        date: "",
        voucherType: "TOTAL",
        voucherNo: "",
        partyOrLedger: "",
        narration: "",
        debit: totalDebit,
        credit: totalCredit,
        status: "",
        isTotal: true
      });
    }

    return {
      rows: processedVouchers,
      totalDebit,
      totalCredit,
      filteredCount: filteredVouchers.length
    };
  }, [vouchers, accounts, startDate, endDate, typeFilter, statusFilter, searchText]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(registerData.filteredCount / pageSize));
  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    // We only slice the regular rows, then manually append the total row if it exists
    const hasTotal = registerData.rows.length > 0 && registerData.rows[registerData.rows.length - 1].isTotal;
    const regularRows = hasTotal ? registerData.rows.slice(0, -1) : registerData.rows;
    const paginatedRegular = regularRows.slice(startIndex, startIndex + pageSize);
    
    if (hasTotal && paginatedRegular.length > 0) {
      return [...paginatedRegular, registerData.rows[registerData.rows.length - 1]];
    }
    return paginatedRegular;
  }, [registerData.rows, page, pageSize]);

  // Type options
  const typeOptions = [
    { value: "all", label: "All Types" },
    { value: "sales", label: "Sales" },
    { value: "purchase", label: "Purchase" },
    { value: "receipt", label: "Receipt" },
    { value: "payment", label: "Payment" },
    { value: "journal", label: "Journal" },
    { value: "contra", label: "Contra" },
    { value: "credit-note", label: "Credit Note" },
    { value: "debit-note", label: "Debit Note" }
  ];

  // Status options
  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "posted", label: "Posted" },
    { value: "draft", label: "Draft" },
    { value: "cancelled", label: "Cancelled" }
  ];

  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "voucherType") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (columnKey === "debit" || columnKey === "credit") {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return "";
    }

    if (columnKey === "debit" || columnKey === "credit") {
      if (!value || value === 0) return "—";
      return <span className="font-mono text-gray-700">{formatNumber(value)}</span>;
    }
    
    if (columnKey === "status") {
      let badgeClass = "bg-gray-100 text-gray-700";
      if (value === "posted") badgeClass = "bg-green-100 text-green-700";
      else if (value === "cancelled") badgeClass = "bg-red-100 text-red-700 border border-red-200";
      
      return (
        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md ${badgeClass}`}>
          {value}
        </span>
      );
    }
    
    if (columnKey === "narration") {
      return (
        <div className="max-w-[200px] truncate text-gray-500 italic text-[11px]" title={value}>
          {value}
        </div>
      );
    }
    
    if (columnKey === "partyOrLedger") {
      return <span className="font-medium text-gray-800">{value}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Vouchers Register"
      subtitle="All vouchers in chronological order"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingTypeFilter(typeFilter);
        setPendingStatusFilter(statusFilter);
        setPendingSearchText(searchText);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <div className="flex items-center gap-2 flex-wrap">
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
          
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <div className="relative ml-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search no, narration..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[180px]"
            />
          </div>
        </div>
      }
    >
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto flex-1">
          <ReportGrid 
            columns={[
              { key: "date", label: "Date" },
              { key: "voucherType", label: "Vch Type" },
              { key: "voucherNo", label: "Vch No" },
              { key: "partyOrLedger", label: "Party / Account" },
              { key: "narration", label: "Narration" },
              { key: "debit", label: "Debit", align: "right" },
              { key: "credit", label: "Credit", align: "right" },
              { key: "status", label: "Status", align: "center" }
            ]} 
            data={paginatedRows} 
            getRowClassName={(row) => {
              if (row.isTotal) return "bg-[#eef2ff] border-t-2 border-[#c7d2fe]";
              if (row.status === "cancelled") return "bg-red-50 opacity-75 hover:opacity-100 hover:bg-red-100";
              return "";
            }}
            renderCell={renderCell}
          />
        </div>
        
        {/* Modern Pagination Footer */}
        {registerData.filteredCount > 0 && (
          <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-200 sm:px-6 mt-auto">
            <div className="text-[12px] text-gray-700">
              Showing <span className="font-semibold text-gray-900">{Math.min((page - 1) * pageSize + 1, registerData.filteredCount)}</span> to <span className="font-semibold text-gray-900">{Math.min(page * pageSize, registerData.filteredCount)}</span> of <span className="font-semibold text-gray-900">{registerData.filteredCount}</span> entries
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center px-3 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-md">
                Page {page} of {totalPages}
              </div>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Vouchers Register Options"
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
              value={pendingTypeFilter}
              onChange={e => setPendingTypeFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {typeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Status 
            <select
              value={pendingStatusFilter}
              onChange={e => setPendingStatusFilter(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Search 
            <input
              type="text"
              value={pendingSearchText}
              onChange={e => setPendingSearchText(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
              placeholder="Search voucher no, narration..."
            />
          </label>
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default VouchersRegister;
