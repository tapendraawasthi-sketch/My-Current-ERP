// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import { formatADToBS } from "../lib/nepaliDate";
import { generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Download, Printer, Search, Calendar, ChevronDown, ChevronUp, RotateCcw, ChevronRight } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function displayMoney(v: number): string {
  if (!v || Math.abs(v) < 0.01) return "-";
  return money(v);
}

interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  nameNepali?: string;
  type: string;
  level: string;
  isGroup: boolean;
  parentId?: string;
  openingDr: number;
  openingCr: number;
  periodDr: number;
  periodCr: number;
  closingDr: number;
  closingCr: number;
  hasChildren?: boolean;
  expanded?: boolean;
  children?: TrialBalanceRow[];
}

const allColumns = [
  { key: "account", label: "Account Name" },
  { key: "openingDr", label: "Opening Dr" },
  { key: "openingCr", label: "Opening Cr" },
  { key: "periodDr", label: "Period Dr" },
  { key: "periodCr", label: "Period Cr" },
  { key: "closingDr", label: "Closing Dr" },
  { key: "closingCr", label: "Closing Cr" },
];

const TrialBalance: React.FC = () => {
  const { accounts, vouchers, fiscalYears, currentFiscalYear, companySettings, costCenters } = useStore();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate || "");
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0); // 0: Standard, 1: Condensed, 2: Vertical, 3: Comparative, 4: Cost Center
  const [selectedCostCenter, setSelectedCostCenter] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Compute trial balance data
  const computeTrialBalance = (
    accs: any[],
    vouchs: any[],
    fromAD: string,
    toAD: string
  ) => {
    const result = new Map();
    
    const filteredVouchers = vouchs.filter(
      (v) => v.status !== 'cancelled' && v.status !== 'draft'
    );

    const prevYearVouchers = filteredVouchers.filter(
      (v) => new Date(v.date) < new Date(fromAD)
    );

    const periodVouchers = filteredVouchers.filter(
      (v) => new Date(v.date) >= new Date(fromAD) && new Date(v.date) <= new Date(toAD)
    );

    const processVoucherLines = (lines, isPrevYear = false) => {
      lines.forEach((line) => {
        const accId = line.accountId;
        if (!result.has(accId)) {
          result.set(accId, {
            openingDr: 0,
            openingCr: 0,
            periodDr: 0,
            periodCr: 0,
            closingDr: 0,
            closingCr: 0,
          });
        }
        
        const entry = result.get(accId);
        if (isPrevYear) {
          entry.openingDr += line.debit || 0;
          entry.openingCr += line.credit || 0;
        } else {
          entry.periodDr += line.debit || 0;
          entry.periodCr += line.credit || 0;
        }
      });
    };

    // Initialize with opening balances
    accs.forEach((acc) => {
      result.set(acc.id, {
        openingDr: acc.openingBalanceDr || 0,
        openingCr: acc.openingBalanceCr || 0,
        periodDr: 0,
        periodCr: 0,
        closingDr: 0,
        closingCr: 0,
      });
    });

    // Add previous year transactions to opening
    prevYearVouchers.forEach((v) => {
      if (v.lines) {
        processVoucherLines(v.lines, true);
      }
    });

    // Add period transactions
    periodVouchers.forEach((v) => {
      if (v.lines) {
        processVoucherLines(v.lines, false);
      }
    });

    // Calculate closing balances and handle groups
    const allAccountsMap = new Map(accs.map(acc => [acc.id, acc]));
    
    accs.forEach((acc) => {
      const entry = result.get(acc.id);
      if (entry) {
        entry.closingDr = entry.openingDr + entry.periodDr;
        entry.closingCr = entry.openingCr + entry.periodCr;
      }
      
      if (acc.isGroup) {
        let groupTotal = {
          openingDr: 0,
          openingCr: 0,
          periodDr: 0,
          periodCr: 0,
          closingDr: 0,
          closingCr: 0,
        };
        
        accs.forEach(childAcc => {
          if (childAcc.parentId === acc.id) {
            const childEntry = result.get(childAcc.id);
            if (childEntry) {
              groupTotal.openingDr += childEntry.openingDr;
              groupTotal.openingCr += childEntry.openingCr;
              groupTotal.periodDr += childEntry.periodDr;
              groupTotal.periodCr += childEntry.periodCr;
              groupTotal.closingDr += childEntry.closingDr;
              groupTotal.closingCr += childEntry.closingCr;
            }
          }
        });
        
        // Update group's values
        if (entry) {
          Object.assign(entry, groupTotal);
        } else {
          result.set(acc.id, groupTotal);
        }
      }
    });

    return result;
  };

  const trialBalanceData = useMemo(() => {
    if (!currentFiscalYear) return new Map();
    return computeTrialBalance(accounts, vouchers, fromDate, toDate);
  }, [accounts, vouchers, fromDate, toDate]);

  const previousYearData = useMemo(() => {
    if (!currentFiscalYear) return new Map();
    const prevStart = new Date(currentFiscalYear.startDate);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    const prevEnd = new Date(currentFiscalYear.endDate);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
    return computeTrialBalance(accounts, vouchers, prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]);
  }, [accounts, vouchers, currentFiscalYear]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [accounts, searchTerm]);

  // Build tree structure for standard view
  const buildTree = (): TrialBalanceRow[] => {
    const map = new Map<string, TrialBalanceRow>();
    
    // For standard view tree we use all accounts to maintain hierarchy, 
    // but we can flag those that match the search term if needed later.
    accounts.forEach(acc => {
      const data = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      const row: TrialBalanceRow = {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        nameNepali: acc.nameNepali,
        type: acc.type,
        level: acc.level,
        isGroup: acc.isGroup,
        parentId: acc.parentId,
        openingDr: data.openingDr,
        openingCr: data.openingCr,
        periodDr: data.periodDr,
        periodCr: data.periodCr,
        closingDr: data.closingDr,
        closingCr: data.closingCr,
        hasChildren: accounts.some(child => child.parentId === acc.id),
        expanded: expandedGroups.has(acc.id),
      };
      map.set(acc.id, row);
    });

    // Build parent-child relationships
    const rootNodes: TrialBalanceRow[] = [];
    map.forEach(row => {
      if (!row.parentId) {
        rootNodes.push(row);
      } else {
        const parent = map.get(row.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(row);
        }
      }
    });

    return rootNodes;
  };

  const renderTree = (nodes: TrialBalanceRow[], depth = 0) => {
    return nodes.map(node => {
      const hasBalance = node.openingDr !== 0 || node.openingCr !== 0 || 
                        node.periodDr !== 0 || node.periodCr !== 0 ||
                        node.closingDr !== 0 || node.closingCr !== 0;
      
      if (!showZeroBalances && !hasBalance && !node.isGroup) {
        return null;
      }

      // If search is active, skip rows that don't match (simple name match, tree logic may hide parents if not careful)
      if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase()) && !node.code.toLowerCase().includes(searchTerm.toLowerCase()) && !node.isGroup) {
        return null;
      }

      const isHidden = depth > 0 && !expandedGroups.has(node.parentId || '');
      
      if (isHidden) return null;

      return (
        <React.Fragment key={node.id}>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="px-3 py-2.5 text-[12px] text-gray-700" style={{ paddingLeft: `${depth * 16 + 12}px` }}>
              <div className="flex items-center gap-1.5">
                {node.isGroup ? (
                  <button 
                    onClick={() => toggleGroup(node.id)}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="w-3.5 inline-block" />
                )}
                <span className={node.isGroup ? 'font-semibold text-gray-900' : ''}>
                  {node.name}
                </span>
              </div>
            </td>
            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(node.openingDr)}</td>
            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(node.openingCr)}</td>
            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(node.periodDr)}</td>
            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(node.periodCr)}</td>
            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(node.closingDr)}</td>
            <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(node.closingCr)}</td>
          </tr>
          {node.expanded && node.children && renderTree(node.children, depth + 1)}
        </React.Fragment>
      );
    }).filter(Boolean);
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const expandAll = () => {
    const allGroupIds = new Set<string>();
    accounts.forEach(acc => {
      if (acc.isGroup) {
        allGroupIds.add(acc.id);
      }
    });
    setExpandedGroups(allGroupIds);
  };

  const exportToExcel = () => {
    // Implementation would depend on active tab
    toast.success("Export functionality would go here");
  };

  const condensedData = useMemo(() => {
    const debitTypes = ['asset', 'expense'];
    const creditTypes = ['liability', 'equity', 'income'];
    
    const debitGroups = filteredAccounts.filter(acc => 
      acc.isGroup && !acc.parentId && debitTypes.includes(acc.type)
    ).map(acc => {
      const data = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      return {
        ...acc,
        ...data
      };
    });
    
    const creditGroups = filteredAccounts.filter(acc => 
      acc.isGroup && !acc.parentId && creditTypes.includes(acc.type)
    ).map(acc => {
      const data = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      return {
        ...acc,
        ...data
      };
    });
    
    return { debitGroups, creditGroups };
  }, [filteredAccounts, trialBalanceData]);

  const verticalData = useMemo(() => {
    const typeOrder = ['asset', 'liability', 'equity', 'income', 'expense'];
    const orderedAccounts = [...filteredAccounts].sort((a, b) => {
      const typeIndexA = typeOrder.indexOf(a.type);
      const typeIndexB = typeOrder.indexOf(b.type);
      if (typeIndexA !== typeIndexB) return typeIndexA - typeIndexB;
      return a.name.localeCompare(b.name);
    });

    return orderedAccounts.map(acc => {
      const data = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      const netBalance = (data.closingDr - data.closingCr);
      return {
        ...acc,
        drBalance: data.closingDr,
        crBalance: data.closingCr,
        netBalance
      };
    });
  }, [filteredAccounts, trialBalanceData]);

  const comparativeData = useMemo(() => {
    return filteredAccounts.map(acc => {
      const currData = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      const prevData = previousYearData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      
      return {
        ...acc,
        currDr: currData.closingDr,
        currCr: currData.closingCr,
        prevDr: prevData.closingDr,
        prevCr: prevData.closingCr,
        varianceDr: currData.closingDr - prevData.closingDr,
        varianceCr: currData.closingCr - prevData.closingCr
      };
    });
  }, [filteredAccounts, trialBalanceData, previousYearData]);

  const costCenterData = useMemo(() => {
    // If cost center filtering is needed, implement here
    // For now, just return standard data
    return filteredAccounts.map(acc => {
      const data = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
      return {
        ...acc,
        ...data
      };
    });
  }, [filteredAccounts, trialBalanceData]);

  const grandTotal = useMemo(() => {
    let totalOpeningDr = 0;
    let totalOpeningCr = 0;
    let totalPeriodDr = 0;
    let totalPeriodCr = 0;
    let totalClosingDr = 0;
    let totalClosingCr = 0;
    
    // Total calculation always uses the full accounts list for accuracy
    accounts.forEach(acc => {
      // Avoid double counting by only summing parent-less nodes if they contain everything,
      // or leaf nodes. Based on how computeTrialBalance calculates group totals, 
      // summing only root level items gives the grand total.
      if (!acc.parentId) {
        const data = trialBalanceData.get(acc.id) || { openingDr: 0, openingCr: 0, periodDr: 0, periodCr: 0, closingDr: 0, closingCr: 0 };
        totalOpeningDr += data.openingDr;
        totalOpeningCr += data.openingCr;
        totalPeriodDr += data.periodDr;
        totalPeriodCr += data.periodCr;
        totalClosingDr += data.closingDr;
        totalClosingCr += data.closingCr;
      }
    });
    
    return {
      openingDr: totalOpeningDr,
      openingCr: totalOpeningCr,
      periodDr: totalPeriodDr,
      periodCr: totalPeriodCr,
      closingDr: totalClosingDr,
      closingCr: totalClosingCr
    };
  }, [accounts, trialBalanceData]);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <style>
        {`
          @media print {
            .print-hidden { display: none !important; }
            .print-only { display: block !important; }
          }
        `}
      </style>
      
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4 print-hidden">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">View and export standard, condensed, and comparative trial balance reports</p>
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
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4 print-hidden border-b border-gray-200 pb-4">
          {['Standard', 'Condensed', 'Vertical', 'Comparative', 'Cost Center'].map((tabName, index) => (
            <button
              key={index}
              className={`h-8 px-4 text-[12px] font-medium rounded-md transition-colors ${
                activeTab === index 
                  ? 'bg-[#1557b0] text-white' 
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tabName}
            </button>
          ))}
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 print-hidden">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Search Account</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="h-8 pl-8 pr-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              />
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            </div>
          </div>
          {activeTab === 4 && (
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Cost Center</label>
              <select
                value={selectedCostCenter}
                onChange={(e) => setSelectedCostCenter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
              >
                <option value="">All Cost Centers</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.id}>{cc.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4 mb-4 print-hidden">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showZeroBalances}
              onChange={(e) => setShowZeroBalances(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
            />
            <span className="text-[12px] font-medium text-gray-700">Show Zero Balances</span>
          </label>
          
          {activeTab === 0 && (
            <>
              <div className="h-4 w-px bg-gray-300" />
              <button
                onClick={expandAll}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#1557b0] hover:text-[#0f4a96]"
              >
                <RotateCcw size={14} />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1.5 text-[12px] font-medium text-[#1557b0] hover:text-[#0f4a96]"
              >
                <ChevronUp size={14} />
                Collapse All
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Standard View */}
      {activeTab === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Opening Dr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Opening Cr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Period Dr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Period Cr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Closing Dr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Closing Cr</th>
                </tr>
              </thead>
              <tbody>
                {renderTree(buildTree())}
                <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                  <td className="px-3 py-2.5 text-gray-900">Grand Total</td>
                  <td className="px-3 py-2.5 text-gray-900 font-mono text-right">{displayMoney(grandTotal.openingDr)}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-mono text-right">{displayMoney(grandTotal.openingCr)}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-mono text-right">{displayMoney(grandTotal.periodDr)}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-mono text-right">{displayMoney(grandTotal.periodCr)}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-mono text-right">{displayMoney(grandTotal.closingDr)}</td>
                  <td className="px-3 py-2.5 text-gray-900 font-mono text-right">{displayMoney(grandTotal.closingCr)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Condensed View */}
      {activeTab === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Debit Side */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-[13px] font-semibold text-gray-800">Assets & Expenses</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {condensedData.debitGroups.map(group => (
                    <tr key={group.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{group.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(group.closingDr - group.closingCr)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-gray-900">Total</td>
                    <td className="px-3 py-2.5 text-gray-900 font-mono text-right">
                      {displayMoney(condensedData.debitGroups.reduce((sum, g) => sum + (g.closingDr - g.closingCr), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Credit Side */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-[13px] font-semibold text-gray-800">Liabilities, Equity & Income</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {condensedData.creditGroups.map(group => (
                    <tr key={group.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{group.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(group.closingCr - group.closingDr)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-gray-900">Total</td>
                    <td className="px-3 py-2.5 text-gray-900 font-mono text-right">
                      {displayMoney(condensedData.creditGroups.reduce((sum, g) => sum + (g.closingCr - g.closingDr), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Vertical View */}
      {activeTab === 2 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dr Balance</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cr Balance</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {verticalData.map(acc => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{acc.name}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.drBalance)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.crBalance)}</td>
                    <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${acc.netBalance < 0 ? 'text-[#dc2626]' : acc.netBalance > 0 ? 'text-[#059669]' : 'text-gray-700'}`}>
                      {displayMoney(Math.abs(acc.netBalance))} {acc.netBalance !== 0 ? (acc.netBalance > 0 ? 'Dr' : 'Cr') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Comparative View */}
      {activeTab === 3 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Curr Dr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Curr Cr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Prev Dr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Prev Cr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Var Dr</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Var Cr</th>
                </tr>
              </thead>
              <tbody>
                {comparativeData.map(acc => (
                  <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{acc.name}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.currDr)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.currCr)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.prevDr)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.prevCr)}</td>
                    <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${Math.abs(acc.varianceDr) > 0.01 ? (acc.varianceDr > 0 ? 'text-[#059669]' : 'text-[#dc2626]') : 'text-gray-700'}`}>
                      {displayMoney(acc.varianceDr)}
                    </td>
                    <td className={`px-3 py-2.5 text-[12px] font-mono text-right ${Math.abs(acc.varianceCr) > 0.01 ? (acc.varianceCr > 0 ? 'text-[#059669]' : 'text-[#dc2626]') : 'text-gray-700'}`}>
                      {displayMoney(acc.varianceCr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Cost Center View */}
      {activeTab === 4 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {costCenterData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Code</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Opening Dr</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Opening Cr</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Period Dr</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Period Cr</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Closing Dr</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Closing Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {costCenterData.map(acc => (
                    <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{acc.code}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{acc.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.openingDr)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.openingCr)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.periodDr)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.periodCr)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.closingDr)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">{displayMoney(acc.closingCr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500 text-[12px]">No cost center data available</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrialBalance;
