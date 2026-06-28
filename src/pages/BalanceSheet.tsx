// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { buildBalanceSheetData } from "../lib/nepalFinancialStatements";
import * as XLSX from "xlsx";
import { Printer, Download, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatADToBS } from "../lib/nepaliDate";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function displayMoney(v: number): string {
  if (!v || Math.abs(v) < 0.01) return "-";
  return money(v);
}

// Helper function to compute account balance
function computeAccountBalance(accountId: string, accounts: any[], vouchers: any[], asOfDate: string) {
  const account = accounts.find(acc => acc.id === accountId);
  if (!account) return 0;

  let balance = (account.openingBalanceDr || 0) - (account.openingBalanceCr || 0);

  const relevantVouchers = vouchers.filter(v => 
    v.status === 'posted' && 
    new Date(v.date) <= new Date(asOfDate)
  );

  relevantVouchers.forEach(voucher => {
    if (voucher.lines) {
      voucher.lines.forEach(line => {
        if (line.accountId === accountId) {
          balance += (line.debit || 0) - (line.credit || 0);
        }
      });
    }
  });

  return balance;
}

function groupAccounts(accounts: any[], vouchers: any[], asOfDate: string) {
  const grouped = {
    capitalEquity: [] as any[],
    longTermLiabilities: [] as any[],
    currentLiabilities: [] as any[],
    fixedAssets: [] as any[],
    currentAssets: [] as any[],
    totalEquity: 0,
    totalLongTermLiabilities: 0,
    totalCurrentLiabilities: 0,
    totalFixedAssets: 0,
    totalCurrentAssets: 0
  };

  accounts.forEach(acc => {
    const balance = computeAccountBalance(acc.id, accounts, vouchers, asOfDate);
    
    if (acc.type === "equity" || acc.name.toLowerCase().includes("capital") || acc.name.toLowerCase().includes("reserve") || acc.name.toLowerCase().includes("retained")) {
      grouped.capitalEquity.push({ ...acc, balance });
      grouped.totalEquity += balance;
    } 
    else if (acc.type === "liability") {
      if (acc.name.toLowerCase().includes("loan") || acc.name.toLowerCase().includes("borrowing") || acc.name.toLowerCase().includes("mortgage")) {
        grouped.longTermLiabilities.push({ ...acc, balance });
        grouped.totalLongTermLiabilities += balance;
      } else {
        grouped.currentLiabilities.push({ ...acc, balance });
        grouped.totalCurrentLiabilities += balance;
      }
    }
    else if (acc.type === "asset") {
      if (acc.isGroup === false && 
          (acc.name.toLowerCase().includes("fixed") || 
           acc.name.toLowerCase().includes("property") || 
           acc.name.toLowerCase().includes("equipment") || 
           acc.name.toLowerCase().includes("vehicle") || 
           acc.name.toLowerCase().includes("machinery") || 
           acc.name.toLowerCase().includes("building") || 
           acc.name.toLowerCase().includes("land") || 
           acc.name.toLowerCase().includes("furniture"))) {
        grouped.fixedAssets.push({ ...acc, balance });
        grouped.totalFixedAssets += balance;
      } else {
        grouped.currentAssets.push({ ...acc, balance });
        grouped.totalCurrentAssets += balance;
      }
    }
  });

  return grouped;
}

const BalanceSheet: React.FC = () => {
  const { accounts, vouchers, companySettings, currentFiscalYear } = useStore();
  const [asOnDate, setAsOnDate] = useState(currentFiscalYear?.endDate || "");
  const [activeTab, setActiveTab] = useState(0); 
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());

  const previousYearVouchers = useMemo(() => {
    if (!currentFiscalYear) return [];
    return vouchers.filter(v => 
      v.status === 'posted' && 
      new Date(v.date) < new Date(currentFiscalYear.startDate)
    );
  }, [vouchers, currentFiscalYear]);

  const currentYearVouchers = useMemo(() => {
    if (!asOnDate) return [];
    return vouchers.filter(v => 
      v.status === 'posted' && 
      new Date(v.date) <= new Date(asOnDate)
    );
  }, [vouchers, asOnDate]);

  const groupedAccounts = useMemo(() => {
    return groupAccounts(accounts, currentYearVouchers, asOnDate);
  }, [accounts, currentYearVouchers, asOnDate]);

  const previousGroupedAccounts = useMemo(() => {
    if (!currentFiscalYear) return groupAccounts(accounts, [], currentFiscalYear?.startDate || "");
    return groupAccounts(accounts, previousYearVouchers, currentFiscalYear.startDate);
  }, [accounts, previousYearVouchers, currentFiscalYear]);

  const totalAssets = groupedAccounts.totalFixedAssets + groupedAccounts.totalCurrentAssets;
  const totalLiabilitiesAndEquity = groupedAccounts.totalEquity + groupedAccounts.totalLongTermLiabilities + groupedAccounts.totalCurrentLiabilities;
  const balanceDifference = Math.abs(totalAssets - totalLiabilitiesAndEquity);

  const scheduleMap: Record<string, string> = {
    "Share Capital": "Sch 1",
    "Reserves & Surplus": "Sch 2",
    "Long-term Borrowings": "Sch 3",
    "Long-term Provisions": "Sch 4",
    "Short-term Borrowings": "Sch 5",
    "Trade Payables": "Sch 6",
    "Other Current Liabilities": "Sch 7",
    "Short-term Provisions": "Sch 8",
    "Fixed Assets": "Sch 9",
    "Investments": "Sch 10",
    "Inventories": "Sch 11",
    "Trade Receivables": "Sch 12",
    "Cash & Bank": "Sch 13",
    "Loans & Advances": "Sch 14"
  };

  const toggleSchedule = (schedule: string) => {
    setExpandedSchedules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(schedule)) {
        newSet.delete(schedule);
      } else {
        newSet.add(schedule);
      }
      return newSet;
    });
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    let wsData: any[] = [];
    
    if (activeTab === 0) {
      wsData = [
        ["Particulars", "Current Year", "Previous Year"],
        ["EQUITY AND LIABILITIES", "", ""],
        ["Shareholders' Equity", "", ""],
        ...groupedAccounts.capitalEquity.map(acc => [acc.name, money(acc.balance), money(previousGroupedAccounts.capitalEquity.find(p => p.id === acc.id)?.balance || 0)]),
        ["Total Equity", money(groupedAccounts.totalEquity), money(previousGroupedAccounts.totalEquity)],
        ["NON-CURRENT LIABILITIES", "", ""],
        ...groupedAccounts.longTermLiabilities.map(acc => [acc.name, money(acc.balance), money(previousGroupedAccounts.longTermLiabilities.find(p => p.id === acc.id)?.balance || 0)]),
        ["Total Non-Current Liabilities", money(groupedAccounts.totalLongTermLiabilities), money(previousGroupedAccounts.totalLongTermLiabilities)],
        ["CURRENT LIABILITIES", "", ""],
        ...groupedAccounts.currentLiabilities.map(acc => [acc.name, money(acc.balance), money(previousGroupedAccounts.currentLiabilities.find(p => p.id === acc.id)?.balance || 0)]),
        ["Total Current Liabilities", money(groupedAccounts.totalCurrentLiabilities), money(previousGroupedAccounts.totalCurrentLiabilities)],
        ["TOTAL EQUITY AND LIABILITIES", money(totalLiabilitiesAndEquity), money(previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities)],
        ["ASSETS", "", ""],
        ["FIXED ASSETS", "", ""],
        ...groupedAccounts.fixedAssets.map(acc => [acc.name, money(acc.balance), money(previousGroupedAccounts.fixedAssets.find(p => p.id === acc.id)?.balance || 0)]),
        ["Total Fixed Assets", money(groupedAccounts.totalFixedAssets), money(previousGroupedAccounts.totalFixedAssets)],
        ["CURRENT ASSETS", "", ""],
        ...groupedAccounts.currentAssets.map(acc => [acc.name, money(acc.balance), money(previousGroupedAccounts.currentAssets.find(p => p.id === acc.id)?.balance || 0)]),
        ["Total Current Assets", money(groupedAccounts.totalCurrentAssets), money(previousGroupedAccounts.totalCurrentAssets)],
        ["TOTAL ASSETS", money(totalAssets), money(previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets)]
      ];
    }
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
    XLSX.writeFile(wb, `Balance_Sheet_${asOnDate}.xlsx`);
    toast.success("Balance Sheet exported to Excel");
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            .print-container { width: 100% !important; padding: 0 !important; }
            body { background-color: white !important; }
          }
        `}
      </style>
      
      <div className="print-container">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 no-print">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Balance Sheet</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">As on {formatADToBS(asOnDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{companySettings?.name || "Company Name"}</h1>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">{companySettings?.nameNepali || "कम्पनीको नाम"}</h2>
          <p className="text-sm text-gray-600">{companySettings?.address || "Address"}</p>
          <p className="text-sm text-gray-600">PAN No: {companySettings?.panNumber || companySettings?.vatNumber || "—"}</p>
          <p className="text-sm font-semibold text-gray-800 mt-2">Balance Sheet as at {formatADToBS(asOnDate)}</p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4 items-end no-print">
          <div className="flex flex-wrap gap-2 flex-grow border-b border-gray-200 pb-4">
            {["Vertical (NAS)", "Horizontal (T-Format)", "Comparative", "With Schedules"].map((tab, index) => (
              <button
                key={index}
                className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors ${
                  activeTab === index 
                    ? 'bg-[#1557b0] text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab(index)}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="pb-4">
            <label className="block text-[11px] font-medium text-gray-600 mb-1">As on Date</label>
            <input
              type="date"
              value={asOnDate}
              onChange={(e) => setAsOnDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] min-w-[150px]"
            />
          </div>
        </div>
        
        {/* Balance Sheet Content */}
        {balanceDifference > 1 && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-2 rounded mb-4 text-[12px] font-semibold flex items-center justify-center">
            ⚠ Balance Sheet does not balance. Difference: NPR {money(balanceDifference)}
          </div>
        )}

        {activeTab === 0 && ( // Vertical (NAS)
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Particulars</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current Year</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Previous Year</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 font-bold border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900" colSpan={3}>EQUITY AND LIABILITIES</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Shareholders' Equity</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.capitalEquity.map(acc => {
                    const prevBalance = previousGroupedAccounts.capitalEquity.find(p => p.id === acc.id)?.balance || 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Equity</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalEquity)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalEquity)}</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">NON-CURRENT LIABILITIES</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.longTermLiabilities.map(acc => {
                    const prevBalance = previousGroupedAccounts.longTermLiabilities.find(p => p.id === acc.id)?.balance || 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Non-Current Liabilities</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalLongTermLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalLongTermLiabilities)}</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">CURRENT LIABILITIES</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.currentLiabilities.map(acc => {
                    const prevBalance = previousGroupedAccounts.currentLiabilities.find(p => p.id === acc.id)?.balance || 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Current Liabilities</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalCurrentLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalCurrentLiabilities)}</td>
                  </tr>
                  
                  <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900">TOTAL EQUITY AND LIABILITIES</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalLiabilitiesAndEquity)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities)}</td>
                  </tr>
                  
                  <tr className="bg-gray-50 font-bold border-t-4 border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900" colSpan={3}>ASSETS</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">FIXED ASSETS</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.fixedAssets.map(acc => {
                    const prevBalance = previousGroupedAccounts.fixedAssets.find(p => p.id === acc.id)?.balance || 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Fixed Assets</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalFixedAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalFixedAssets)}</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">CURRENT ASSETS</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.currentAssets.map(acc => {
                    const prevBalance = previousGroupedAccounts.currentAssets.find(p => p.id === acc.id)?.balance || 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Current Assets</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalCurrentAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalCurrentAssets)}</td>
                  </tr>
                  
                  <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900">TOTAL ASSETS</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 1 && ( // Horizontal (T-Format)
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Capital & Liabilities */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-[13px] font-semibold text-gray-800">CAPITAL & LIABILITIES</h2>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-max border-collapse">
                  <tbody>
                    <tr className="bg-gray-50 font-semibold border-b border-gray-200">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800">Shareholders' Equity</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalEquity)}</td>
                    </tr>
                    {groupedAccounts.capitalEquity.map(acc => (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                      </tr>
                    ))}
                    
                    <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800">Non-Current Liabilities</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalLongTermLiabilities)}</td>
                    </tr>
                    {groupedAccounts.longTermLiabilities.map(acc => (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                      </tr>
                    ))}
                    
                    <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800">Current Liabilities</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalCurrentLiabilities)}</td>
                    </tr>
                    {groupedAccounts.currentLiabilities.map(acc => (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] px-3 py-2.5 flex justify-between">
                <span className="text-[12px] font-bold text-gray-900">TOTAL CAPITAL & LIABILITIES</span>
                <span className="text-[12px] font-bold text-gray-900 font-mono">{displayMoney(totalLiabilitiesAndEquity)}</span>
              </div>
            </div>
            
            {/* Right Column - Assets */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-[13px] font-semibold text-gray-800">ASSETS</h2>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-max border-collapse">
                  <tbody>
                    <tr className="bg-gray-50 font-semibold border-b border-gray-200">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800">Fixed Assets</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalFixedAssets)}</td>
                    </tr>
                    {groupedAccounts.fixedAssets.map(acc => (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                      </tr>
                    ))}
                    
                    <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800">Current Assets</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalCurrentAssets)}</td>
                    </tr>
                    {groupedAccounts.currentAssets.map(acc => (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] px-3 py-2.5 flex justify-between">
                <span className="text-[12px] font-bold text-gray-900">TOTAL ASSETS</span>
                <span className="text-[12px] font-bold text-gray-900 font-mono">{displayMoney(totalAssets)}</span>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 2 && ( // Comparative
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Particulars</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current Year NPR</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Previous Year NPR</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Change NPR</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Change %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 font-bold border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900" colSpan={5}>EQUITY AND LIABILITIES</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Shareholders' Equity</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.capitalEquity.map(acc => {
                    const prevBalance = previousGroupedAccounts.capitalEquity.find(p => p.id === acc.id)?.balance || 0;
                    const change = acc.balance - prevBalance;
                    const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {displayMoney(change)}
                        </td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {changePercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-white font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Non-Current Liabilities</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.longTermLiabilities.map(acc => {
                    const prevBalance = previousGroupedAccounts.longTermLiabilities.find(p => p.id === acc.id)?.balance || 0;
                    const change = acc.balance - prevBalance;
                    const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {displayMoney(change)}
                        </td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {changePercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-white font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Current Liabilities</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.currentLiabilities.map(acc => {
                    const prevBalance = previousGroupedAccounts.currentLiabilities.find(p => p.id === acc.id)?.balance || 0;
                    const change = acc.balance - prevBalance;
                    const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {displayMoney(change)}
                        </td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {changePercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900">TOTAL EQUITY AND LIABILITIES</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalLiabilitiesAndEquity)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalLiabilitiesAndEquity - (previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities))}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{((totalLiabilitiesAndEquity - (previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities)) / ((previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities) || 1) * 100).toFixed(2)}%</td>
                  </tr>
                  
                  <tr className="bg-gray-50 font-bold border-t-4 border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900" colSpan={5}>ASSETS</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Fixed Assets</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.fixedAssets.map(acc => {
                    const prevBalance = previousGroupedAccounts.fixedAssets.find(p => p.id === acc.id)?.balance || 0;
                    const change = acc.balance - prevBalance;
                    const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {displayMoney(change)}
                        </td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {changePercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-white font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Current Assets</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.currentAssets.map(acc => {
                    const prevBalance = previousGroupedAccounts.currentAssets.find(p => p.id === acc.id)?.balance || 0;
                    const change = acc.balance - prevBalance;
                    const changePercent = prevBalance !== 0 ? (change / prevBalance) * 100 : 0;
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: '24px' }}>{acc.name}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {displayMoney(change)}
                        </td>
                        <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#dc2626]' : 'text-gray-700'}`}>
                          {changePercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                  
                  <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900">TOTAL ASSETS</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalAssets - (previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets))}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{((totalAssets - (previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets)) / ((previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets) || 1) * 100).toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {activeTab === 3 && ( // With Schedules
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Particulars</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current Year</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Previous Year</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 font-bold border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900" colSpan={4}>EQUITY AND LIABILITIES</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Shareholders' Equity</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.capitalEquity.map(acc => {
                    const prevBalance = previousGroupedAccounts.capitalEquity.find(p => p.id === acc.id)?.balance || 0;
                    const schedule = scheduleMap[acc.name] || "";
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 flex items-center" style={{ paddingLeft: '24px' }}>
                          {schedule && (
                            <button 
                              className="mr-1 text-[#1557b0]"
                              onClick={() => toggleSchedule(schedule)}
                            >
                              {expandedSchedules.has(schedule) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">{schedule}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Equity</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalEquity)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalEquity)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">Sch 1-2</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">NON-CURRENT LIABILITIES</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.longTermLiabilities.map(acc => {
                    const prevBalance = previousGroupedAccounts.longTermLiabilities.find(p => p.id === acc.id)?.balance || 0;
                    const schedule = scheduleMap[acc.name] || "";
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 flex items-center" style={{ paddingLeft: '24px' }}>
                          {schedule && (
                            <button 
                              className="mr-1 text-[#1557b0]"
                              onClick={() => toggleSchedule(schedule)}
                            >
                              {expandedSchedules.has(schedule) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">{schedule}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Non-Current Liabilities</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalLongTermLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalLongTermLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">Sch 3-4</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">CURRENT LIABILITIES</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.currentLiabilities.map(acc => {
                    const prevBalance = previousGroupedAccounts.currentLiabilities.find(p => p.id === acc.id)?.balance || 0;
                    const schedule = scheduleMap[acc.name] || "";
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 flex items-center" style={{ paddingLeft: '24px' }}>
                          {schedule && (
                            <button 
                              className="mr-1 text-[#1557b0]"
                              onClick={() => toggleSchedule(schedule)}
                            >
                              {expandedSchedules.has(schedule) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">{schedule}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Current Liabilities</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalCurrentLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalCurrentLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">Sch 5-8</td>
                  </tr>
                  
                  <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900">TOTAL EQUITY AND LIABILITIES</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalLiabilitiesAndEquity)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(previousGroupedAccounts.totalEquity + previousGroupedAccounts.totalLongTermLiabilities + previousGroupedAccounts.totalCurrentLiabilities)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 text-center"></td>
                  </tr>
                  
                  <tr className="bg-gray-50 font-bold border-t-4 border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900" colSpan={4}>ASSETS</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">FIXED ASSETS</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.fixedAssets.map(acc => {
                    const prevBalance = previousGroupedAccounts.fixedAssets.find(p => p.id === acc.id)?.balance || 0;
                    const schedule = scheduleMap[acc.name] || "";
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 flex items-center" style={{ paddingLeft: '24px' }}>
                          {schedule && (
                            <button 
                              className="mr-1 text-[#1557b0]"
                              onClick={() => toggleSchedule(schedule)}
                            >
                              {expandedSchedules.has(schedule) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">{schedule}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Fixed Assets</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalFixedAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalFixedAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">Sch 9</td>
                  </tr>
                  
                  <tr className="bg-white font-semibold">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">CURRENT ASSETS</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                  {groupedAccounts.currentAssets.map(acc => {
                    const prevBalance = previousGroupedAccounts.currentAssets.find(p => p.id === acc.id)?.balance || 0;
                    const schedule = scheduleMap[acc.name] || "";
                    return (
                      <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 flex items-center" style={{ paddingLeft: '24px' }}>
                          {schedule && (
                            <button 
                              className="mr-1 text-[#1557b0]"
                              onClick={() => toggleSchedule(schedule)}
                            >
                              {expandedSchedules.has(schedule) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          {acc.name}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.balance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(prevBalance)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">{schedule}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-semibold border-t border-b border-gray-200">
                    <td className="px-3 py-2.5 text-[12px] text-gray-800">Total Current Assets</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(groupedAccounts.totalCurrentAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-800 font-mono text-right">{displayMoney(previousGroupedAccounts.totalCurrentAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600 text-center">Sch 10-14</td>
                  </tr>
                  
                  <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] text-gray-900">TOTAL ASSETS</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(totalAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 font-mono text-right">{displayMoney(previousGroupedAccounts.totalFixedAssets + previousGroupedAccounts.totalCurrentAssets)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-900 text-center"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BalanceSheet;

