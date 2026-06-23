import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Card, Button, Select, NepaliDatePicker } from "../components/ui";
import { FileSpreadsheet, Printer } from "lucide-react";
import { computeTrialBalance } from "../lib/accounting";
import { exportTrialBalanceToExcel, downloadCSV } from "../lib/exportUtils";
import { generateTrialBalancePDF } from "../lib/printUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { AccountLevel, ReportPeriodPreset, TrialBalanceRow, VoucherStatus } from "../lib/types";
import toast from "react-hot-toast";

const viewOptions = [
  { value: "standard", label: "Standard" },
  { value: "schedule", label: "Schedule View" },
  { value: "comparison", label: "Comparison" },
];

const groupByOptions = [
  { value: "all", label: "All Levels" },
  { value: AccountLevel.GROUP, label: "Group" },
  { value: AccountLevel.SUBGROUP, label: "Subgroup" },
  { value: AccountLevel.LEDGER, label: "Ledger" },
];

const scheduleGroups = [
  { key: "fixed-assets", label: "Schedule of Fixed Assets" },
  { key: "current-assets", label: "Schedule of Current Assets" },
  { key: "long-term-liabilities", label: "Schedule of Secured / Long-term Liabilities" },
  { key: "current-liabilities", label: "Schedule of Current Liabilities & Duties" },
  { key: "shareholders-equity", label: "Schedule of Shareholders Equity / Capital" },
  { key: "other", label: "Schedule of Other Accounts" },
];

const levelOrder = {
  [AccountLevel.GROUP]: 0,
  [AccountLevel.SUBGROUP]: 1,
  [AccountLevel.LEDGER]: 2,
  [AccountLevel.SUBLEDGER]: 3,
};

interface HierarchyRow extends TrialBalanceRow {
  parentId?: string;
  level: AccountLevel;
  accountCode: string;
  accountName: string;
  indent: number;
  isGroup: boolean;
  children: HierarchyRow[];
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
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [displayMode, setDisplayMode] = useState<"condensed" | "detailed">("condensed");
  const [viewMode, setViewMode] = useState<"standard" | "schedule" | "comparison">("standard");
  const [groupBy, setGroupBy] = useState<string>("all");

  useEffect(() => {
    if (currentFiscalYear) {
      setStartDate(currentFiscalYear.startDate);
      setEndDate(currentFiscalYear.endDate);
    }
  }, [currentFiscalYear]);

  // CRITICAL FILTER: posted vouchers only
  const postedVouchers = useMemo(() => {
    return rawVouchers.filter((v) => v.status === VoucherStatus.POSTED);
  }, [rawVouchers]);

  // Calculate TB rows using only posted vouchers
  const rows = useMemo(() => {
    return computeTrialBalance(accounts, postedVouchers, startDate, endDate);
  }, [accounts, postedVouchers, startDate, endDate]);

  const nonZeroFilter = (row: TrialBalanceRow) => {
    if (showZeroBalances) return true;
    return Boolean(
      row.openingDr || row.openingCr || row.debit || row.credit || row.closingDr || row.closingCr,
    );
  };

  const buildHierarchyRows = useMemo(() => {
    const map = new Map<string, HierarchyRow>();

    accounts.forEach((account) => {
      map.set(account.id, {
        accountId: account.id,
        accountCode: account.code || "",
        accountName: account.name,
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
      });
    });

    rows.forEach((row) => {
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

    const accumulate = (node: HierarchyRow) => {
      node.children.sort((a, b) => {
        const levelDiff = (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
        if (levelDiff !== 0) return levelDiff;
        return a.accountCode.localeCompare(b.accountCode);
      });

      node.children.forEach((child) => {
        accumulate(child);
        if (node.isGroup) {
          node.openingDr = roundSum(node.openingDr, child.openingDr);
          node.openingCr = roundSum(node.openingCr, child.openingCr);
          node.debit = roundSum(node.debit, child.debit);
          node.credit = roundSum(node.credit, child.credit);
          node.closingDr = roundSum(node.closingDr, child.closingDr);
          node.closingCr = roundSum(node.closingCr, child.closingCr);
        }
      });
    };

    roots.forEach((root) => accumulate(root));

    const flatRows: HierarchyRow[] = [];
    const flatten = (node: HierarchyRow, depth: number) => {
      node.indent = depth;
      if (node.isGroup || nonZeroFilter(node) || showZeroBalances) {
        flatRows.push(node);
      }
      node.children.forEach((child) => flatten(child, depth + 1));
    };

    roots.sort((a, b) => {
      const orderDiff = (levelOrder[a.level] || 0) - (levelOrder[b.level] || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.accountCode.localeCompare(b.accountCode);
    });
    roots.forEach((root) => flatten(root, 0));

    return flatRows;
  }, [accounts, rows, showZeroBalances]);

  const filteredRows = useMemo(() => {
    return buildHierarchyRows.filter((row) => nonZeroFilter(row));
  }, [buildHierarchyRows, showZeroBalances]);

  const condensedRows = useMemo(() => {
    return filteredRows.filter((row) => {
      if (displayMode === "detailed") return true;
      if (groupBy === "all") return row.isGroup;
      return row.level === groupBy;
    });
  }, [displayMode, filteredRows, groupBy]);

  const scheduledRows = useMemo(() => {
    const scheduleMap = new Map<string, TrialBalanceRow[]>();
    scheduleGroups.forEach((group) => scheduleMap.set(group.key, []));

    rows.forEach((row) => {
      const account = accounts.find((acc) => acc.id === row.accountId);
      if (!account) return;
      const key = classifySchedule(account);
      const list = scheduleMap.get(key) || [];
      list.push(row);
      scheduleMap.set(key, list);
    });

    return scheduleGroups.map((group) => ({
      ...group,
      rows: (scheduleMap.get(group.key) || []).filter(nonZeroFilter),
    }));
  }, [accounts, rows, showZeroBalances]);

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

  const previousRows = useMemo(() => {
    return computeTrialBalance(
      accounts,
      postedVouchers,
      previousRange.startDate,
      previousRange.endDate,
    );
  }, [accounts, postedVouchers, previousRange.startDate, previousRange.endDate]);

  const comparisonRows = useMemo(() => {
    const prevMap = new Map(previousRows.map((row) => [row.accountId, row]));
    return filteredRows.map((row) => {
      const prev = prevMap.get(row.accountId);
      return {
        ...row,
        prevOpeningDr: prev?.openingDr || 0,
        prevOpeningCr: prev?.openingCr || 0,
        prevDebit: prev?.debit || 0,
        prevCredit: prev?.credit || 0,
        prevClosingDr: prev?.closingDr || 0,
        prevClosingCr: prev?.closingCr || 0,
      };
    });
  }, [filteredRows, previousRows]);

  const totals = useMemo(() => {
    const leafRows = filteredRows.filter((r) => !r.isGroup);
    return leafRows.reduce(
      (acc, row) => {
        acc.openingDr = roundSum(acc.openingDr, row.openingDr);
        acc.openingCr = roundSum(acc.openingCr, row.openingCr);
        acc.debit = roundSum(acc.debit, row.debit);
        acc.credit = roundSum(acc.credit, row.credit);
        acc.closingDr = roundSum(acc.closingDr, row.closingDr);
        acc.closingCr = roundSum(acc.closingCr, row.closingCr);
        return acc;
      },
      { openingDr: 0, openingCr: 0, debit: 0, credit: 0, closingDr: 0, closingCr: 0 },
    );
  }, [filteredRows]);

  const comparisonTotals = useMemo(() => {
    const leafComparison = comparisonRows.filter((r) => !r.isGroup);
    return leafComparison.reduce(
      (acc, row) => {
        acc.debit = roundSum(acc.debit, row.debit || 0);
        acc.credit = roundSum(acc.credit, row.credit || 0);
        acc.closingDr = roundSum(acc.closingDr, row.closingDr || 0);
        acc.closingCr = roundSum(acc.closingCr, row.closingCr || 0);
        acc.prevDebit = roundSum(acc.prevDebit, row.prevDebit || 0);
        acc.prevCredit = roundSum(acc.prevCredit, row.prevCredit || 0);
        acc.prevClosingDr = roundSum(acc.prevClosingDr, row.prevClosingDr || 0);
        acc.prevClosingCr = roundSum(acc.prevClosingCr, row.prevClosingCr || 0);
        return acc;
      },
      {
        debit: 0,
        credit: 0,
        closingDr: 0,
        closingCr: 0,
        prevDebit: 0,
        prevCredit: 0,
        prevClosingDr: 0,
        prevClosingCr: 0,
      },
    );
  }, [comparisonRows]);

  const differenceValue = useMemo(() => {
    return Math.abs(totals.closingDr - totals.closingCr);
  }, [totals]);

  const isBalanced = differenceValue < 0.01;

  const handleExport = () => {
    try {
      exportTrialBalanceToExcel(filteredRows);
      toast.success("Trial Balance exported to Excel.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to export Trial Balance.");
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = [
        "Account Code",
        "Account Name",
        "Level",
        "Opening Dr",
        "Opening Cr",
        "Period Dr",
        "Period Cr",
        "Closing Dr",
        "Closing Cr",
      ];
      const csvRows = filteredRows.map((row) => [
        row.accountCode,
        row.accountName,
        row.level,
        row.openingDr,
        row.openingCr,
        row.debit,
        row.credit,
        row.closingDr,
        row.closingCr,
      ]);
      csvRows.push([
        "",
        "Grand Totals",
        "",
        totals.openingDr,
        totals.openingCr,
        totals.debit,
        totals.credit,
        totals.closingDr,
        totals.closingCr,
      ]);
      downloadCSV(headers, csvRows, `Trial_Balance_${endDate}.csv`);
      toast.success("Trial Balance exported to CSV.");
    } catch (error: any) {
      toast.error(error?.message || "Failed to export CSV.");
    }
  };

  const handlePrint = () => {
    try {
      const blob = generateTrialBalancePDF(filteredRows, companySettings, {
        startDate,
        endDate,
        preset: ReportPeriodPreset.CUSTOM,
      });
      const url = URL.createObjectURL(blob);
      const win = window.open(url);
      if (win) win.focus();
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate PDF.");
    }
  };

  const handleRowClick = (row: HierarchyRow) => {
    if (!row.accountId) return;
    setReportFilters({ accountId: row.accountId, selectedReport: undefined });
    setCurrentPage("ledger");
  };

  const grandTotalDebit = totals.closingDr;
  const grandTotalCredit = totals.closingCr;

  return (
    <div className="flex flex-col gap-4 animate-fadeIn select-none text-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Trial Balance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Account-wise debit and credit balances</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            Print PDF
          </Button>
        </div>
      </div>

      {/* Report Header */}
      <div
        className="bg-white border rounded-lg mb-3 overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="text-center py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-[13px] font-bold text-gray-800 uppercase tracking-wide">
            {companySettings?.name}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{companySettings?.address}</div>
          <div className="text-[14px] font-bold text-[#1557b0] mt-1 uppercase">Trial Balance</div>
          <div className="text-[11px] text-gray-500">
            As on {endDate} · FY: {currentFiscalYear?.name}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-gray-200 rounded-md mb-3 no-print">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">From Date:</span>
          <NepaliDatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">To Date:</span>
          <NepaliDatePicker value={endDate} onChange={setEndDate} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">Group By:</span>
          <Select value={groupBy} onChange={setGroupBy} options={groupByOptions} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">Display:</span>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setDisplayMode("condensed")}
              className={`h-8 px-3 text-[12px] font-medium transition ${displayMode === "condensed" ? "bg-[#1557b0] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Condensed
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode("detailed")}
              className={`h-8 px-3 text-[12px] font-medium transition border-l border-gray-300 ${displayMode === "detailed" ? "bg-[#1557b0] text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Detailed
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">View Mode:</span>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setViewMode(option.value as any)}
                className={`h-8 px-3 text-[12px] font-medium transition ${viewMode === option.value ? "bg-[#1557b0] text-white border-r border-gray-300 last:border-r-0" : "bg-white text-gray-700 hover:bg-gray-50 border-r border-gray-300 last:border-r-0"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-gray-500 font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={showZeroBalances}
            onChange={(e) => setShowZeroBalances(e.target.checked)}
            className="form-checkbox h-4 w-4 text-[#1557b0] rounded border-gray-300 focus:ring-[#1557b0]/20"
          />
          Show Zero Balances
        </label>
      </div>

      <Card border padding="md" className="bg-slate-50">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Opening Dr</div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatNumber(totals.openingDr)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Opening Cr</div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatNumber(totals.openingCr)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Period Debit
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatNumber(totals.debit)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              Period Credit
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatNumber(totals.credit)}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Closing Dr</div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatNumber(totals.closingDr)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Closing Cr</div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              {formatNumber(totals.closingCr)}
            </div>
          </div>
        </div>

        <div
          className={`mt-4 p-3 rounded-md text-[12px] font-semibold ${isBalanced ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
        >
          {isBalanced
            ? `✓ In Balance — Total Dr: ${formatNumber(totals.closingDr)} | Total Cr: ${formatNumber(totals.closingCr)}`
            : `⚠ Out of Balance — Difference: ${formatNumber(differenceValue)}`}
        </div>
      </Card>

      {viewMode === "standard" && (
        <Card border padding="none">
          <div className="overflow-x-auto">
            <table className="data-table sticky-thead">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th className="th-right">Opening Dr</th>
                  <th className="th-right">Opening Cr</th>
                  <th className="th-right">Period Dr</th>
                  <th className="th-right">Period Cr</th>
                  <th className="th-right">Closing Dr</th>
                  <th className="th-right">Closing Cr</th>
                </tr>
              </thead>
              <tbody>
                {(displayMode === "condensed" ? condensedRows : filteredRows).map((row) => (
                  <tr
                    key={row.accountId}
                    onClick={() => handleRowClick(row)}
                    className="cursor-pointer"
                  >
                    <td className="font-mono">{row.accountCode}</td>
                    <td>
                      <div
                        className={`truncate ${row.level === AccountLevel.GROUP ? "font-bold" : row.level === AccountLevel.SUBGROUP ? "font-semibold" : "font-normal"}`}
                        style={{ paddingLeft: `${(row.indent || 0) * 16 + 10}px` }}
                      >
                        {row.accountName}
                      </div>
                    </td>
                    <td className="amt">{row.openingDr ? formatNumber(row.openingDr) : "—"}</td>
                    <td className="amt">{row.openingCr ? formatNumber(row.openingCr) : "—"}</td>
                    <td className="amt amt-dr">{row.debit ? formatNumber(row.debit) : "—"}</td>
                    <td className="amt amt-cr">{row.credit ? formatNumber(row.credit) : "—"}</td>
                    <td className="amt amt-dr">
                      {row.closingDr ? formatNumber(row.closingDr) : "—"}
                    </td>
                    <td className="amt amt-cr">
                      {row.closingCr ? formatNumber(row.closingCr) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                  <td colSpan={2} className="px-3 py-2.5 font-bold text-[12px] uppercase">
                    Grand Total
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(totals.openingDr)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(totals.openingCr)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(totals.debit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(totals.credit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(grandTotalDebit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(grandTotalCredit)}
                  </td>
                </tr>
                {/* Difference Row */}
                <tr
                  className={
                    isBalanced ? "bg-green-50 font-bold" : "bg-red-50 text-red-700 font-bold"
                  }
                >
                  <td colSpan={2} className="px-3 py-2 text-[12px] uppercase">
                    Difference
                  </td>
                  <td colSpan={4}></td>
                  <td colSpan={2} className="text-right px-3 font-mono text-[13px]">
                    {isBalanced ? "0.00" : formatNumber(differenceValue)}
                  </td>
                </tr>
                <tr style={{ background: "#111827", color: "white" }}>
                  <td colSpan={6} className="px-3 py-1.5 font-bold text-[10px] uppercase">
                    Balanced Status
                  </td>
                  <td colSpan={2} className="text-center px-3 py-1.5">
                    {isBalanced ? (
                      <span className="text-green-400 font-bold text-[10px]">✓ BALANCED</span>
                    ) : (
                      <span className="text-red-400 font-bold text-[10px]">✗ UNBALANCED</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {viewMode === "schedule" && (
        <div className="space-y-4">
          {scheduledRows.map((group) => (
            <Card key={group.key} border padding="none">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 bg-slate-50">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                    {group.label}
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {group.rows.length} account(s)
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Period: {startDate} to {endDate}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table sticky-thead">
                  <thead>
                    <tr>
                      <th>Account Code</th>
                      <th>Account Name</th>
                      <th className="th-right">Opening Dr</th>
                      <th className="th-right">Opening Cr</th>
                      <th className="th-right">Period Dr</th>
                      <th className="th-right">Period Cr</th>
                      <th className="th-right">Closing Dr</th>
                      <th className="th-right">Closing Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={row.accountId}
                        onClick={() => handleRowClick(row as any)}
                        className="cursor-pointer"
                      >
                        <td className="font-mono">{row.accountId}</td>
                        <td>
                          <div className="font-normal" style={{ paddingLeft: "10px" }}>
                            {accounts.find((a) => a.id === row.accountId)?.name || ""}
                          </div>
                        </td>
                        <td className="amt">{row.openingDr ? formatNumber(row.openingDr) : "—"}</td>
                        <td className="amt">{row.openingCr ? formatNumber(row.openingCr) : "—"}</td>
                        <td className="amt amt-dr">{row.debit ? formatNumber(row.debit) : "—"}</td>
                        <td className="amt amt-cr">
                          {row.credit ? formatNumber(row.credit) : "—"}
                        </td>
                        <td className="amt amt-dr">
                          {row.closingDr ? formatNumber(row.closingDr) : "—"}
                        </td>
                        <td className="amt amt-cr">
                          {row.closingCr ? formatNumber(row.closingCr) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "comparison" && (
        <Card border padding="none">
          <div className="border-b border-gray-200 px-5 py-4 bg-slate-50">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              Comparison Period
            </div>
            <div className="text-sm font-semibold text-slate-700">
              Current: {startDate} to {endDate} • Previous: {previousRange.startDate} to{" "}
              {previousRange.endDate}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table sticky-thead">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th className="th-right">Curr Dr</th>
                  <th className="th-right">Curr Cr</th>
                  <th className="th-right">Curr Closing Dr</th>
                  <th className="th-right">Curr Closing Cr</th>
                  <th className="th-right">Prev Dr</th>
                  <th className="th-right">Prev Cr</th>
                  <th className="th-right">Prev Closing Dr</th>
                  <th className="th-right">Prev Closing Cr</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.accountId}
                    onClick={() => handleRowClick(row)}
                    className="cursor-pointer"
                  >
                    <td className="font-mono">{row.accountCode}</td>
                    <td>
                      <div
                        className={`truncate ${row.level === AccountLevel.GROUP ? "font-bold" : row.level === AccountLevel.SUBGROUP ? "font-semibold" : "font-normal"}`}
                        style={{ paddingLeft: `${(row.indent || 0) * 16 + 10}px` }}
                      >
                        {row.accountName}
                      </div>
                    </td>
                    <td className="amt amt-dr">{row.debit ? formatNumber(row.debit) : "—"}</td>
                    <td className="amt amt-cr">{row.credit ? formatNumber(row.credit) : "—"}</td>
                    <td className="amt amt-dr">
                      {row.closingDr ? formatNumber(row.closingDr) : "—"}
                    </td>
                    <td className="amt amt-cr">
                      {row.closingCr ? formatNumber(row.closingCr) : "—"}
                    </td>
                    <td className="amt amt-dr">
                      {row.prevDebit ? formatNumber(row.prevDebit) : "—"}
                    </td>
                    <td className="amt amt-cr">
                      {row.prevCredit ? formatNumber(row.prevCredit) : "—"}
                    </td>
                    <td className="amt amt-dr">
                      {row.prevClosingDr ? formatNumber(row.prevClosingDr) : "—"}
                    </td>
                    <td className="amt amt-cr">
                      {row.prevClosingCr ? formatNumber(row.prevClosingCr) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                  <td colSpan={2} className="px-3 py-2.5 font-bold text-[12px] uppercase">
                    Grand Total
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.debit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.credit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.closingDr)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.closingCr)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.prevDebit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.prevCredit)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.prevClosingDr)}
                  </td>
                  <td className="text-right px-3 font-mono font-bold text-[13px]">
                    {formatNumber(comparisonTotals.prevClosingCr)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

function classifySchedule(account: any): string {
  const groupText = (account.group || "").toLowerCase();
  const type = account.type;

  if (type === "asset") {
    if (
      groupText.includes("fixed") ||
      groupText.includes("non-current") ||
      groupText.includes("nca")
    ) {
      return "fixed-assets";
    }
    return "current-assets";
  }

  if (type === "liability") {
    if (
      groupText.includes("current") ||
      groupText.includes("duties") ||
      groupText.includes("tax")
    ) {
      return "current-liabilities";
    }
    return "long-term-liabilities";
  }

  if (type === "equity") {
    return "shareholders-equity";
  }

  return "other";
}

function roundSum(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

export default TrialBalance;
