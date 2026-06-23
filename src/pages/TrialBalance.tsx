import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, NepaliDatePicker } from "../components/ui";
import { computeTrialBalance, computeMultiYearTrialBalance } from "../lib/accounting";
import { formatNumber, dateToAD } from "../lib/utils";
import { AccountLevel, VoucherStatus, TrialBalanceRow } from "../lib/types";
import toast from "react-hot-toast";

interface HierarchyRow extends TrialBalanceRow {
  parentId?: string;
  level: AccountLevel;
  accountCode: string;
  accountName: string;
  accountNameNepali?: string;
  indent: number;
  isGroup: boolean;
  children: HierarchyRow[];
  prevDebit?: number;
  prevCredit?: number;
  prevClosingDr?: number;
  prevClosingCr?: number;
  varianceDr?: number;
  varianceCr?: number;
}

const TrialBalance: React.FC = () => {
  const {
    accounts,
    vouchers: rawVouchers,
    companySettings,
    currentFiscalYear,
    setCurrentPage,
    setReportFilters,
  } = useStore();

  const [startDate, setStartDate] = useState(currentFiscalYear?.startDate || "2026-07-16");
  const [endDate, setEndDate] = useState(currentFiscalYear?.endDate || "2027-07-15");
  
  // New options state
  const [format, setFormat] = useState<"balance_only" | "movement" | "7_column">("7_column");
  const [level, setLevel] = useState<"account" | "group" | "both">("both");
  const [compareWith, setCompareWith] = useState<"none" | "previous_fy">("none");
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [showNepaliNames, setShowNepaliNames] = useState(false);

  // For collapsing/expanding groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  const postedVouchers = useMemo(() => {
    return rawVouchers.filter((v) => v.status === VoucherStatus.POSTED);
  }, [rawVouchers]);

  const previousRange = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const previousEnd = new Date(start.getTime() - 86400000);
    const previousStart = new Date(previousEnd.getTime() - (dayCount - 1) * 86400000);
    return {
      startDate: dateToAD(previousStart),
      endDate: dateToAD(previousEnd),
    };
  }, [startDate, endDate]);

  const baseRows = useMemo(() => {
    if (compareWith === "previous_fy") {
      return computeMultiYearTrialBalance(
        accounts,
        postedVouchers,
        startDate,
        endDate,
        previousRange.startDate,
        previousRange.endDate
      );
    }
    return computeTrialBalance(accounts, postedVouchers, startDate, endDate);
  }, [accounts, postedVouchers, startDate, endDate, compareWith, previousRange]);

  const nonZeroFilter = (row: any) => {
    if (showZeroBalances) return true;
    return Boolean(
      row.openingDr || row.openingCr || row.debit || row.credit || row.closingDr || row.closingCr
    );
  };

  const buildHierarchyRows = useMemo(() => {
    const map = new Map<string, HierarchyRow>();

    accounts.forEach((account) => {
      map.set(account.id, {
        accountId: account.id,
        accountCode: account.code || "",
        accountName: account.name,
        accountNameNepali: account.nameNepali,
        level: account.level,
        parentId: account.parentId,
        isGroup: account.isGroup,
        openingDr: 0,
        openingCr: 0,
        debit: 0,
        credit: 0,
        closingDr: 0,
        closingCr: 0,
        indent: 0,
        children: [],
        prevDebit: 0,
        prevCredit: 0,
        prevClosingDr: 0,
        prevClosingCr: 0,
        varianceDr: 0,
        varianceCr: 0,
      });
    });

    baseRows.forEach((row) => {
      const node = map.get(row.accountId);
      if (node) {
        Object.assign(node, row, {
          indent: 0,
          children: node.children || [],
        });
      }
    });

    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      }
    }

    const roots = Array.from(map.values()).filter(
      (node) => !node.parentId || !map.has(node.parentId),
    );

    const roundSum = (a: number, b: number) => Math.round((a + b) * 100) / 100;

    const accumulate = (node: HierarchyRow) => {
      node.children.forEach((child) => {
        accumulate(child);
        if (node.isGroup) {
          node.openingDr = roundSum(node.openingDr, child.openingDr);
          node.openingCr = roundSum(node.openingCr, child.openingCr);
          node.debit = roundSum(node.debit, child.debit);
          node.credit = roundSum(node.credit, child.credit);
          node.closingDr = roundSum(node.closingDr, child.closingDr);
          node.closingCr = roundSum(node.closingCr, child.closingCr);
          node.prevDebit = roundSum(node.prevDebit || 0, child.prevDebit || 0);
          node.prevCredit = roundSum(node.prevCredit || 0, child.prevCredit || 0);
          node.prevClosingDr = roundSum(node.prevClosingDr || 0, child.prevClosingDr || 0);
          node.prevClosingCr = roundSum(node.prevClosingCr || 0, child.prevClosingCr || 0);
        }
      });
      // Recalculate variance
      node.varianceDr = roundSum(node.closingDr, -(node.prevClosingDr || 0));
      node.varianceCr = roundSum(node.closingCr, -(node.prevClosingCr || 0));
    };

    roots.forEach((root) => accumulate(root));

    const flatRows: HierarchyRow[] = [];
    const flatten = (node: HierarchyRow, depth: number) => {
      node.indent = depth;
      
      const hasBalance = nonZeroFilter(node);
      const isVisibleGroup = node.isGroup && (level === "group" || level === "both");
      const isVisibleAccount = !node.isGroup && (level === "account" || level === "both");
      
      if (hasBalance && (isVisibleGroup || isVisibleAccount)) {
        flatRows.push(node);
      }

      // Only flatten children if group is expanded, or if we're showing flat list
      const shouldShowChildren = level === "account" || expandedGroups.has(node.accountId);
      
      if (level === "account") {
         node.children.forEach((child) => flatten(child, 0)); // no indent for flat account list
      } else if (shouldShowChildren || level === "both") {
         // Default to expanded unless explicitly collapsed? Or default collapsed.
         // Let's just always render and use CSS/state to show/hide.
         // Actually, if we use expandedGroups to filter flatRows:
         if (!node.isGroup || expandedGroups.has(node.accountId) || expandedGroups.size === 0) {
            // Wait, if size is 0, let's expand everything by default.
            node.children.forEach((child) => flatten(child, depth + 1));
         } else {
           node.children.forEach((child) => flatten(child, depth + 1));
         }
      }
    };

    // To make it properly collapsible, we can build the full flat list, but just filter it in render.
    // Let's just build the full hierarchy here.
    const fullFlatRows: HierarchyRow[] = [];
    const buildFull = (n: HierarchyRow, d: number) => {
      n.indent = d;
      fullFlatRows.push(n);
      n.children.forEach(c => buildFull(c, d + 1));
    };
    roots.forEach(r => buildFull(r, 0));

    return fullFlatRows;
  }, [accounts, baseRows, level, showZeroBalances, expandedGroups]);

  // Handle default expansion: if expandedGroups is empty, maybe we expand all?
  // Let's just filter buildHierarchyRows in render.
  const displayRows = useMemo(() => {
    const isNodeVisible = (node: HierarchyRow) => {
      if (!showZeroBalances && !nonZeroFilter(node)) return false;
      if (level === "group" && !node.isGroup) return false;
      if (level === "account" && node.isGroup) return false;
      return true;
    };

    let result = buildHierarchyRows.filter(isNodeVisible);

    // Filter out collapsed children if we are in "both" mode
    if (level === "both") {
       // We only include a node if its parent is expanded (or it's a root).
       // By default let's expand all, so if expandedGroups has a special "COLLAPSED_" marker we hide it?
       // Let's do positive tracking for expanded.
       // Actually, to make it simple, we track 'collapsedGroups'.
       // Since the prompt asks to "collapse/expand on row click", we will track collapsed groups.
    }

    return result;
  }, [buildHierarchyRows, showZeroBalances, level]);

  // Track collapsed groups instead for easier default-expand
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const visibleRows = useMemo(() => {
    let result = displayRows;
    if (level === "both" || level === "group") {
       result = result.filter(row => {
          // A row is visible if NONE of its ancestors are in collapsedGroups
          let current = accounts.find(a => a.id === row.accountId);
          while (current?.parentId) {
             if (collapsedGroups.has(current.parentId)) return false;
             current = accounts.find(a => a.id === current?.parentId);
          }
          return true;
       });
    }
    return result;
  }, [displayRows, collapsedGroups, accounts, level]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const totals = useMemo(() => {
    const leafRows = displayRows.filter((r) => !r.isGroup);
    return leafRows.reduce(
      (acc, row) => {
        acc.openingDr += row.openingDr || 0;
        acc.openingCr += row.openingCr || 0;
        acc.debit += row.debit || 0;
        acc.credit += row.credit || 0;
        acc.closingDr += row.closingDr || 0;
        acc.closingCr += row.closingCr || 0;
        acc.prevDebit += row.prevDebit || 0;
        acc.prevCredit += row.prevCredit || 0;
        acc.prevClosingDr += row.prevClosingDr || 0;
        acc.prevClosingCr += row.prevClosingCr || 0;
        acc.varianceDr += row.varianceDr || 0;
        acc.varianceCr += row.varianceCr || 0;
        return acc;
      },
      { openingDr: 0, openingCr: 0, debit: 0, credit: 0, closingDr: 0, closingCr: 0, prevDebit: 0, prevCredit: 0, prevClosingDr: 0, prevClosingCr: 0, varianceDr: 0, varianceCr: 0 }
    );
  }, [displayRows]);

  const handleRowClick = (row: HierarchyRow) => {
    if (row.isGroup) {
      toggleGroup(row.accountId);
    } else {
      setReportFilters({ accountId: row.accountId, selectedReport: undefined });
      setCurrentPage("ledger");
    }
  };

  const getDisplayName = (row: HierarchyRow) => {
    if (showNepaliNames && row.accountNameNepali) {
      return row.accountNameNepali;
    }
    return row.accountName;
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Account-wise debit and credit balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print PDF
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg mb-3 overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="text-center py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">
            {companySettings?.name}
          </div>
          <div className="text-[14px] font-bold text-[#1557b0] mt-1 uppercase">Trial Balance</div>
          <div className="text-[11px] text-gray-500">
            From {startDate} to {endDate}
          </div>
        </div>
      </div>

      {/* Options Panel */}
      <div className="p-4 bg-white border border-gray-200 rounded-md mb-3 no-print flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[11px] text-gray-600">Format:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={format === "balance_only"} onChange={() => setFormat("balance_only")} /> Balance Only
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={format === "movement"} onChange={() => setFormat("movement")} /> Movement
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={format === "7_column"} onChange={() => setFormat("7_column")} /> 7-Column
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[11px] text-gray-600">Level:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={level === "account"} onChange={() => setLevel("account")} /> Account
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={level === "group"} onChange={() => setLevel("group")} /> Group
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={level === "both"} onChange={() => setLevel("both")} /> Both
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[11px] text-gray-600">Compare with:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={compareWith === "none"} onChange={() => setCompareWith("none")} /> None
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="radio" checked={compareWith === "previous_fy"} onChange={() => setCompareWith("previous_fy")} /> Previous FY
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showZeroBalances} onChange={e => setShowZeroBalances(e.target.checked)} className="form-checkbox text-[#1557b0]" />
            Show Zero Balances
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showNepaliNames} onChange={e => setShowNepaliNames(e.target.checked)} className="form-checkbox text-[#1557b0]" />
            Show Nepali Names
          </label>
        </div>
      </div>

      <Card border padding="none">
        <div className="overflow-x-auto">
          <table className="data-table sticky-thead w-full border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">Account Name</th>
                {format === "7_column" && (
                  <>
                    <th className="th-right">Op.Bal Dr</th>
                    <th className="th-right">Op.Bal Cr</th>
                  </>
                )}
                {(format === "7_column" || format === "movement") && (
                  <>
                    <th className="th-right">Period Debit</th>
                    <th className="th-right">Period Credit</th>
                  </>
                )}
                {(format === "7_column" || format === "balance_only") && (
                  <>
                    <th className="th-right">Cl.Bal Dr</th>
                    <th className="th-right">Cl.Bal Cr</th>
                  </>
                )}
                {compareWith === "previous_fy" && (
                  <>
                    <th className="th-right text-gray-400">PY: Cl.Bal Dr</th>
                    <th className="th-right text-gray-400">PY: Cl.Bal Cr</th>
                    <th className="th-right text-[#b45309]">Variance Dr</th>
                    <th className="th-right text-[#b45309]">Variance Cr</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.accountId}
                  onClick={() => handleRowClick(row)}
                  className={`cursor-pointer border-b border-gray-100 ${row.isGroup ? "bg-[#eef1f8] font-bold text-gray-800" : "hover:bg-[#f8fafc] text-gray-700"}`}
                >
                  <td className="px-3 py-2">
                    <div style={{ paddingLeft: level === 'both' ? `${row.indent * 16}px` : "0px" }} className="flex items-center gap-1">
                      {row.isGroup && level === "both" && (
                        <span className="text-gray-400 w-4 inline-block text-center text-[10px]">
                          {collapsedGroups.has(row.accountId) ? "▶" : "▼"}
                        </span>
                      )}
                      {getDisplayName(row)}
                    </div>
                  </td>
                  {format === "7_column" && (
                    <>
                      <td className="amt text-right px-3">{row.openingDr ? formatNumber(row.openingDr) : "—"}</td>
                      <td className="amt text-right px-3">{row.openingCr ? formatNumber(row.openingCr) : "—"}</td>
                    </>
                  )}
                  {(format === "7_column" || format === "movement") && (
                    <>
                      <td className="amt amt-dr text-right px-3">{row.debit ? formatNumber(row.debit) : "—"}</td>
                      <td className="amt amt-cr text-right px-3">{row.credit ? formatNumber(row.credit) : "—"}</td>
                    </>
                  )}
                  {(format === "7_column" || format === "balance_only") && (
                    <>
                      <td className="amt amt-dr text-right px-3">{row.closingDr ? formatNumber(row.closingDr) : "—"}</td>
                      <td className="amt amt-cr text-right px-3">{row.closingCr ? formatNumber(row.closingCr) : "—"}</td>
                    </>
                  )}
                  {compareWith === "previous_fy" && (
                    <>
                      <td className="amt text-right px-3 text-gray-500">{row.prevClosingDr ? formatNumber(row.prevClosingDr) : "—"}</td>
                      <td className="amt text-right px-3 text-gray-500">{row.prevClosingCr ? formatNumber(row.prevClosingCr) : "—"}</td>
                      <td className="amt text-right px-3 text-[#b45309]">{row.varianceDr ? formatNumber(row.varianceDr) : "—"}</td>
                      <td className="amt text-right px-3 text-[#b45309]">{row.varianceCr ? formatNumber(row.varianceCr) : "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                <td className="px-3 py-2.5 font-bold text-[12px] uppercase">Grand Total</td>
                {format === "7_column" && (
                  <>
                    <td className="text-right px-3 font-mono font-bold text-[13px]">{formatNumber(totals.openingDr)}</td>
                    <td className="text-right px-3 font-mono font-bold text-[13px]">{formatNumber(totals.openingCr)}</td>
                  </>
                )}
                {(format === "7_column" || format === "movement") && (
                  <>
                    <td className="text-right px-3 font-mono font-bold text-[13px]">{formatNumber(totals.debit)}</td>
                    <td className="text-right px-3 font-mono font-bold text-[13px]">{formatNumber(totals.credit)}</td>
                  </>
                )}
                {(format === "7_column" || format === "balance_only") && (
                  <>
                    <td className="text-right px-3 font-mono font-bold text-[13px]">{formatNumber(totals.closingDr)}</td>
                    <td className="text-right px-3 font-mono font-bold text-[13px]">{formatNumber(totals.closingCr)}</td>
                  </>
                )}
                {compareWith === "previous_fy" && (
                  <>
                    <td className="text-right px-3 font-mono font-bold text-[13px] text-gray-500">{formatNumber(totals.prevClosingDr)}</td>
                    <td className="text-right px-3 font-mono font-bold text-[13px] text-gray-500">{formatNumber(totals.prevClosingCr)}</td>
                    <td className="text-right px-3 font-mono font-bold text-[13px] text-[#b45309]">{formatNumber(totals.varianceDr)}</td>
                    <td className="text-right px-3 font-mono font-bold text-[13px] text-[#b45309]">{formatNumber(totals.varianceCr)}</td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default TrialBalance;
