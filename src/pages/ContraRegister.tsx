// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherType, VoucherStatus } from "../lib/types";
import ReportShell from "../components/reporting/ReportShell";
import ReportGrid from "../components/reporting/ReportGrid";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const ContraRegister: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("contra-register");
  
  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [searchText, setSearchText] = useState("");
  
  // Pending states for options modal
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);
  const [pendingSearchText, setPendingSearchText] = useState(searchText);

  const applyOptions = () => {
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setSearchText(pendingSearchText);
    setOptionsOpen(false);
  };

  // Compute contra data
  const data = useMemo(() => {
    if (!vouchers) return [];

    let filteredVouchers = vouchers.filter(v => 
      v.type === "contra" &&
      v.status === "posted" &&
      v.date >= startDate &&
      v.date <= endDate
    );

    // Apply search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filteredVouchers = filteredVouchers.filter(v =>
        v.voucherNo.toLowerCase().includes(lowerSearch) ||
        v.narration?.toLowerCase().includes(lowerSearch)
      );
    }

    // Process vouchers to extract from/to accounts
    const processed = filteredVouchers.map(v => {
      // Find debit and credit lines
      const debitLine = v.lines.find(line => line.debit > 0);
      const creditLine = v.lines.find(line => line.credit > 0);
      
      // Get account names
      const fromAccount = accounts.find(acc => acc.id === creditLine?.accountId);
      const toAccount = accounts.find(acc => acc.id === debitLine?.accountId);
      
      return {
        id: v.id,
        date: v.date,
        voucherNo: v.voucherNo,
        fromAccount: fromAccount?.name || "Unknown",
        toAccount: toAccount?.name || "Unknown",
        amount: v.totalDebit || 0,
        narration: v.narration || "—"
      };
    });

    // Add total row
    if (processed.length > 0) {
      const totalAmount = processed.reduce((sum, row) => sum + row.amount, 0);

      processed.push({
        id: "total",
        date: "",
        voucherNo: "TOTAL",
        fromAccount: "",
        toAccount: "",
        amount: totalAmount,
        narration: "",
        isTotal: true
      });
    }

    return processed;
  }, [vouchers, accounts, startDate, endDate, searchText]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!vouchers || !accounts) return { cashToBank: 0, bankToCash: 0, bankToBank: 0 };

    const filteredVouchers = vouchers.filter(v => 
      v.type === "contra" &&
      v.status === "posted" &&
      v.date >= startDate &&
      v.date <= endDate
    );

    let cashToBank = 0;
    let bankToCash = 0;
    let bankToBank = 0;

    filteredVouchers.forEach(v => {
      const debitLine = v.lines.find(line => line.debit > 0);
      const creditLine = v.lines.find(line => line.credit > 0);
      
      if (debitLine && creditLine) {
        const fromAcc = accounts.find(acc => acc.id === creditLine.accountId);
        const toAcc = accounts.find(acc => acc.id === debitLine.accountId);
        
        if (fromAcc && toAcc) {
          const fromIsCash = fromAcc.name.toLowerCase().includes("cash");
          const toIsCash = toAcc.name.toLowerCase().includes("cash");
          const fromIsBank = fromAcc.name.toLowerCase().includes("bank");
          const toIsBank = toAcc.name.toLowerCase().includes("bank");
          
          if (fromIsCash && toIsBank) cashToBank += debitLine.debit;
          else if (fromIsBank && toIsCash) bankToCash += debitLine.debit;
          else if (fromIsBank && toIsBank) bankToBank += debitLine.debit;
        }
      }
    });

    return { cashToBank, bankToCash, bankToBank };
  }, [vouchers, accounts, startDate, endDate]);

  const columns = [
    { key: "date", label: "Date" },
    { key: "voucherNo", label: "Vch No" },
    { key: "fromAccount", label: "From Account" },
    { key: "toAccount", label: "To Account" },
    { key: "narration", label: "Narration" },
    { key: "amount", label: "Amount", align: "right" }
  ];

  // Custom cell rendering
  const renderCell = (columnKey: string, value: any, row: any) => {
    if (row.isTotal) {
      if (columnKey === "voucherNo") {
        return <span className="font-bold text-gray-800">TOTAL</span>;
      }
      if (columnKey === "amount") {
        return <span className="font-bold font-mono text-gray-800">{formatNumber(value)}</span>;
      }
      return ""; // Hide other values in total row
    }

    if (columnKey === "amount") {
      return (
        <span className="font-mono" style={{ color: value < 0 ? "#dc2626" : "inherit" }}>
          {formatNumber(value)}
        </span>
      );
    }
    
    if (columnKey === "narration") {
      return <span className="text-[11px] text-gray-500 italic">{value}</span>;
    }

    return value;
  };

  return (
    <ReportShell
      title="Contra Register"
      subtitle="Cash and bank transfer vouchers"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setPendingSearchText(searchText);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
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
          
          <input
            type="text"
            placeholder="Search voucher no, narration..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
          />
        </>
      }
    >
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-[12px]">
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Cash → Bank</div>
          <div className="text-[14px] font-mono font-medium text-gray-800">Rs. {formatNumber(summaryStats.cashToBank)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Bank → Cash</div>
          <div className="text-[14px] font-mono font-medium text-gray-800">Rs. {formatNumber(summaryStats.bankToCash)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Bank → Bank</div>
          <div className="text-[14px] font-mono font-medium text-gray-800">Rs. {formatNumber(summaryStats.bankToBank)}</div>
        </div>
      </div>
      
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <ReportGrid 
          columns={columns} 
          data={data} 
          getRowClassName={(row) => row.isTotal ? "bg-[#eef2ff] border-t-2 border-[#c7d2fe]" : ""}
          renderCell={renderCell}
        />
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Contra Register Options"
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

export default ContraRegister;
