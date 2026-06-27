// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { VoucherStatus } from "../lib/types";
import { buildAccountTree, computeLedgerTotals, computeGroupTotals } from "../lib/reportingHierarchy";
import ReportShell from "../components/reporting/ReportShell";
import ReportOptionsModal from "../components/reporting/ReportOptionsModal";
import { useScreenF12 } from "../hooks/useF12Config";

const GroupSummaryReport: React.FC = () => {
  // Register this screen with F12 system
  const getConfig = useScreenF12("group-summary");
  
  const { vouchers, accounts, companySettings, currentFiscalYear } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "");
  const [expandedGroups, setExpandedGroups] = useState<Map<string, boolean>>(new Map());
  
  // Pending states for options modal
  const [pendingGroupId, setPendingGroupId] = useState(selectedGroupId);
  const [pendingStart, setPendingStart] = useState(startDate);
  const [pendingEnd, setPendingEnd] = useState(endDate);

  const applyOptions = () => {
    setSelectedGroupId(pendingGroupId);
    setStartDate(pendingStart);
    setEndDate(pendingEnd);
    setOptionsOpen(false);
  };

  // Build account tree
  const tree = useMemo(() => buildAccountTree(accounts), [accounts]);

  // Get all groups for dropdown
  const groups = useMemo(() => {
    return (accounts || []).filter(acc => acc.isGroup);
  }, [accounts]);

  // Set default group if not selected
  React.useEffect(() => {
    if (!selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].id);
      setPendingGroupId(groups[0].id);
    }
  }, [selectedGroupId, groups]);

  // Compute ledger totals for the selected date range
  const ledgerTotals = useMemo(() => {
    if (!vouchers || !accounts) return new Map();
    
    const relevantVouchers = vouchers.filter(v => 
      v.status === "posted" && 
      v.date >= startDate && 
      v.date <= endDate
    );

    // Calculate period totals manually since computeLedgerTotals might not be sufficient
    const totals = new Map<string, any>();
    
    // Initialize with opening balances
    accounts.forEach(acc => {
      if (!acc.isGroup) {
        const openingBalance = (acc.openingBalanceDr || 0) - (acc.openingBalanceCr || 0);
        totals.set(acc.id, {
          account: acc,
          openingBalance,
          periodDebit: 0,
          periodCredit: 0,
          closingBalance: openingBalance
        });
      }
    });

    // Calculate period movements
    relevantVouchers.forEach(voucher => {
      voucher.lines.forEach(line => {
        if (totals.has(line.accountId)) {
          const current = totals.get(line.accountId);
          current.periodDebit += line.debit || 0;
          current.periodCredit += line.credit || 0;
          current.closingBalance = current.openingBalance + current.periodDebit - current.periodCredit;
          totals.set(line.accountId, current);
        }
      });
    });

    return totals;
  }, [vouchers, accounts, startDate, endDate]);

  // Format number with Dr/Cr suffix
  const formatDrCr = (value: number) => {
    if (Math.abs(value) < 0.005) return "—";
    const absValue = Math.abs(value);
    return value >= 0 ? `${formatNumber(absValue)} Dr` : `${formatNumber(absValue)} Cr`;
  };

  // Function to recursively build rows for the selected group
  const buildRows = (groupId: string, level: number = 0): any[] => {
    const group = accounts.find(acc => acc.id === groupId);
    if (!group || !group.isGroup) return [];

    // Create row for the group itself
    const groupRow = {
      id: group.id,
      name: group.name,
      type: "group",
      level,
      isGroup: true,
      isExpandable: true
    };

    // Get children of this group
    const children = (accounts || []).filter(acc => acc.parentId === groupId);

    // Calculate totals for this group based on its children
    let totalOpening = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalClosing = 0;

    const childRows: any[] = [];
    const isExpanded = expandedGroups.get(groupId) !== false;

    children.forEach(child => {
      if (child.isGroup) {
        // Handle subgroup
        const subgroupRow = {
          id: child.id,
          name: child.name,
          type: "subgroup",
          level: level + 1,
          isGroup: true,
          isExpandable: true
        };

        // Calculate subgroup totals
        let subTotalOpening = 0;
        let subTotalDebit = 0;
        let subTotalCredit = 0;
        let subTotalClosing = 0;

        const subChildren = (accounts || []).filter(acc => acc.parentId === child.id);
        subChildren.forEach(ledger => {
          if (!ledger.isGroup) {
            const ledgerTotal = ledgerTotals.get(ledger.id);
            if (ledgerTotal) {
              subTotalOpening += ledgerTotal.openingBalance;
              subTotalDebit += ledgerTotal.periodDebit;
              subTotalCredit += ledgerTotal.periodCredit;
              subTotalClosing += ledgerTotal.closingBalance;
            }
          }
        });

        subgroupRow.opening = subTotalOpening;
        subgroupRow.debit = subTotalDebit;
        subgroupRow.credit = subTotalCredit;
        subgroupRow.closing = subTotalClosing;

        totalOpening += subTotalOpening;
        totalDebit += subTotalDebit;
        totalCredit += subTotalCredit;
        totalClosing += subTotalClosing;

        childRows.push(subgroupRow);

        // If subgroup is expanded, add its ledgers
        if (isExpanded && expandedGroups.get(child.id) !== false) {
          const subChildren = (accounts || []).filter(acc => acc.parentId === child.id);
          subChildren.forEach(ledger => {
            if (!ledger.isGroup) {
              const ledgerTotal = ledgerTotals.get(ledger.id);
              if (ledgerTotal) {
                const ledgerRow = {
                  id: ledger.id,
                  name: ledger.name,
                  type: "ledger",
                  level: level + 2,
                  isGroup: false,
                  isExpandable: false,
                  opening: ledgerTotal.openingBalance,
                  debit: ledgerTotal.periodDebit,
                  credit: ledgerTotal.periodCredit,
                  closing: ledgerTotal.closingBalance
                };
                childRows.push(ledgerRow);

                // Add to totals
                totalOpening += ledgerTotal.openingBalance;
                totalDebit += ledgerTotal.periodDebit;
                totalCredit += ledgerTotal.periodCredit;
                totalClosing += ledgerTotal.closingBalance;
              }
            }
          });
        }
      } else {
        // Handle ledger
        const ledgerTotal = ledgerTotals.get(child.id);
        if (ledgerTotal) {
          const ledgerRow = {
            id: child.id,
            name: child.name,
            type: "ledger",
            level: level + 1,
            isGroup: false,
            isExpandable: false,
            opening: ledgerTotal.openingBalance,
            debit: ledgerTotal.periodDebit,
            credit: ledgerTotal.periodCredit,
            closing: ledgerTotal.closingBalance
          };
          childRows.push(ledgerRow);

          // Add to totals
          totalOpening += ledgerTotal.openingBalance;
          totalDebit += ledgerTotal.periodDebit;
          totalCredit += ledgerTotal.periodCredit;
          totalClosing += ledgerTotal.closingBalance;
        }
      }
    });

    // Add calculated totals to group row
    groupRow.opening = totalOpening;
    groupRow.debit = totalDebit;
    groupRow.credit = totalCredit;
    groupRow.closing = totalClosing;

    // Return group row followed by its children (if expanded)
    let result = [groupRow];
    if (isExpanded) {
      result = result.concat(childRows);
    }
    return result;
  };

  // Get rows for the selected group
  const rows = useMemo(() => {
    if (!selectedGroupId) return [];
    return buildRows(selectedGroupId);
  }, [selectedGroupId, expandedGroups, ledgerTotals, accounts]);

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newMap = new Map(prev);
      newMap.set(groupId, !prev.get(groupId));
      return newMap;
    });
  };

  return (
    <ReportShell
      title="Group Summary Report"
      subtitle="Summarized ledger balances by account group"
      companyName={companySettings?.companyNameEn || companySettings?.name}
      periodText={`${startDate} to ${endDate}`}
      onPrint={() => window.print()}
      onOptions={() => {
        setPendingGroupId(selectedGroupId);
        setPendingStart(startDate);
        setPendingEnd(endDate);
        setOptionsOpen(true);
      }}
      actionBarButtons={[
        { label: "Print" },
        { label: "Export" }
      ]}
      toolbarLeft={
        <>
          <label className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
            Select Group: 
            <select 
              value={selectedGroupId} 
              onChange={e => setSelectedGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-[220px]"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          
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
        </>
      }
    >
      <div className="overflow-x-auto w-full border border-gray-200 rounded-md bg-white">
        <table className="w-full text-left whitespace-nowrap">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Opening</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Debit</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Credit</th>
              <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, index) => {
              const paddingLeft = `${(row.level * 20) + 12}px`; // 12px base padding
              const isGroup = row.isGroup;
              const isExpandable = row.isExpandable;
              
              let rowStyle = "bg-white hover:bg-gray-50 text-gray-700";
              if (row.type === "group") rowStyle = "bg-[#f1f5f9] font-semibold text-gray-800 border-y border-gray-200";
              if (row.type === "subgroup") rowStyle = "bg-[#f8fafc] font-medium text-gray-800";
              
              return (
                <tr 
                  key={row.id} 
                  className={`transition-colors ${rowStyle} ${isExpandable ? "cursor-pointer" : ""}`}
                  onClick={() => isExpandable && toggleGroup(row.id)}
                >
                  <td 
                    className="px-3 py-2.5 text-[12px] text-left flex items-center"
                    style={{ paddingLeft }}
                  >
                    {isExpandable ? (
                      <span className="w-4 h-4 mr-1 inline-flex items-center justify-center text-[10px] text-gray-400">
                        {expandedGroups.get(row.id) !== false ? "▼" : "▶"}
                      </span>
                    ) : (
                      <span className="w-4 h-4 mr-1 inline-block"></span> // Placeholder for alignment
                    )}
                    {row.name}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono" style={{ color: row.opening >= 0 ? "#059669" : "#dc2626" }}>
                    {formatDrCr(row.opening)}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono" style={{ color: row.debit > 0 ? "#1557b0" : "inherit" }}>
                    {row.debit > 0 ? formatNumber(row.debit) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono" style={{ color: row.credit > 0 ? "#dc2626" : "inherit" }}>
                    {row.credit > 0 ? formatNumber(row.credit) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono" style={{ color: row.closing >= 0 ? "#059669" : "#dc2626" }}>
                    {formatDrCr(row.closing)}
                  </td>
                </tr>
              );
            })}
            
            {/* Grand total row */}
            {rows.length > 0 && (
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-left">GRAND TOTAL</td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatDrCr(rows.reduce((sum, row) => sum + (row.opening || 0), 0))}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatNumber(rows.reduce((sum, row) => sum + (row.debit || 0), 0))}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatNumber(rows.reduce((sum, row) => sum + (row.credit || 0), 0))}
                </td>
                <td className="px-3 py-2.5 text-[12px] font-bold font-mono text-gray-800 text-right">
                  {formatDrCr(rows.reduce((sum, row) => sum + (row.closing || 0), 0))}
                </td>
              </tr>
            )}
            
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-[12px]">
                  No accounts found for the selected group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <ReportOptionsModal
        open={optionsOpen}
        title="Group Summary Report Options"
        onClose={() => setOptionsOpen(false)}
        onApply={applyOptions}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-gray-600">
            Group 
            <select 
              value={pendingGroupId} 
              onChange={e => setPendingGroupId(e.target.value)}
              className="h-8 px-2.5 text-[12px] font-normal border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          
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
        </div>
      </ReportOptionsModal>
    </ReportShell>
  );
};

export default GroupSummaryReport;
