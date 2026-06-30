import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/reports/ReportShell";
import AccountTreeRenderer, { ReportDepth, ReportNode } from "../components/reports/AccountTreeRenderer";
import ReportOptionsModal, { ReportOptions } from "../components/reports/ReportOptionsModal";
import LedgerDrillPanel from "../components/reports/LedgerDrillPanel";
import RebuildBalancesAction from "../components/reports/RebuildBalancesAction";
import { getDB } from "../lib/db";
import { getProfitDecimalPlaces } from "../lib/utils";

// ── buildPLTree — keep exactly as original ────────────────────────────────────
function buildPLTree(
  accounts: any[],
  txMap: Record<string, number>,
  type: "income" | "expense",
): ReportNode[] {
  const filtered = accounts.filter(
    (a) => String(a.type ?? "").toLowerCase() === type,
  );

  const buildNode = (account: any): ReportNode => {
    const children = filtered
      .filter((a) => a.parentId === account.id)
      .map(buildNode);

    const direct = txMap[account.id] ?? 0;
    const childSum = children.reduce((s, c) => s + c.balance, 0);
    const balance = account.isGroup ? childSum : direct;

    return {
      id: account.id,
      name: account.name,
      code: account.code,
      level: account.isGroup
        ? account.level === "subgroup"
          ? "subgroup"
          : "group"
        : "ledger",
      balance,
      isGroup: !!account.isGroup,
      children,
    };
  };

  return filtered
    .filter((a) => !a.parentId || !filtered.find((p) => p.id === a.parentId))
    .map(buildNode);
}

// ── MonthlyRow type ───────────────────────────────────────────────────────────
interface MonthlyRow {
  month: string;
  directIncome: number;
  indirectIncome: number;
  directExpense: number;
  indirectExpense: number;
  netProfit: number;
}

// ── flattenTree helper ────────────────────────────────────────────────────────
function flattenTree(
  nodes: ReportNode[],
  rows: { name: string; balance: number }[] = [],
): { name: string; balance: number }[] {
  for (const n of nodes) {
    rows.push({ name: n.name, balance: n.balance });
    if (n.children) flattenTree(n.children, rows);
  }
  return rows;
}

// ── hasDirectIndirectLabels ───────────────────────────────────────────────────
function hasDirectIndirectLabels(accounts: any[]): boolean {
  return accounts.some((a) => {
    const g = String(a.group ?? a.subGroup ?? a.groupName ?? "").toLowerCase();
    const n = String(a.name ?? "").toLowerCase();
    return g.includes("direct") || g.includes("indirect") || n.includes("direct") || n.includes("indirect");
  });
}

function isDirectAccount(a: any): boolean {
  const g = String(a.group ?? a.subGroup ?? a.groupName ?? "").toLowerCase();
  const n = String(a.name ?? "").toLowerCase();
  return g.includes("direct") || n.includes("direct");
}

function isIndirectAccount(a: any): boolean {
  const g = String(a.group ?? a.subGroup ?? a.groupName ?? "").toLowerCase();
  const n = String(a.name ?? "").toLowerCase();
  return g.includes("indirect") || n.includes("indirect");
}

const ProfitLoss: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, fiscalYears } = useStore();

  // State
  const [modalOpen, setModalOpen] = useState(true);
  const [reportOptions, setReportOptions] = useState<ReportOptions | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [drillPanel, setDrillPanel] = useState<{
    open: boolean;
    accountId: string | null;
    accountName: string;
  }>({ open: false, accountId: null, accountName: "" });
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [showPrevYear, setShowPrevYear] = useState(false);
  const [activeTab, setActiveTab] = useState<"pl" | "ie">("pl");

  // Load branches
  useEffect(() => {
    const load = async () => {
      try {
        const db = getDB();
        const rows = await (db as any).table("branches").toArray();
        setBranches(rows.map((r: any) => ({ id: r.id, name: r.name ?? r.id })));
      } catch {
        setBranches([]);
      }
    };
    load();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleExport();
      }
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
      if (e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        // Navigate to trial balance via store
        try {
          const store = useStore.getState() as any;
          if (store.setCurrentPage) store.setCurrentPage("trial-balance");
        } catch {}
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOptions]);

  // TX Map computation
  const txMap = useMemo((): Record<string, number> => {
    if (!reportOptions) return {};
    const { fromDate, toDate, branchId } = reportOptions;
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (!v.date) continue;
      if (v.date < fromDate || v.date > toDate) continue;
      if (branchId !== "all" && v.branchId && v.branchId !== branchId) continue;
      if (v.status !== "posted") continue;
      for (const l of v.lines ?? []) {
        if (!l.accountId) continue;
        if (!(l.accountId in map)) map[l.accountId] = 0;
        map[l.accountId] += Number(l.credit ?? 0) - Number(l.debit ?? 0);
      }
    }
    return map;
  }, [reportOptions, vouchers]);

  // Previous year TX map
  const prevFiscalYear = useMemo(() => {
    if (!currentFiscalYear) return null;
    return (
      fiscalYears.find((fy: any) => fy.endDate && fy.endDate < currentFiscalYear.startDate) ?? null
    );
  }, [fiscalYears, currentFiscalYear]);

  const prevTxMap = useMemo((): Record<string, number> => {
    if (!showPrevYear || !prevFiscalYear) return {};
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (!v.date) continue;
      if (v.date < prevFiscalYear.startDate || v.date > prevFiscalYear.endDate) continue;
      if (v.status !== "posted") continue;
      for (const l of v.lines ?? []) {
        if (!l.accountId) continue;
        if (!(l.accountId in map)) map[l.accountId] = 0;
        map[l.accountId] += Number(l.credit ?? 0) - Number(l.debit ?? 0);
      }
    }
    return map;
  }, [showPrevYear, prevFiscalYear, vouchers]);

  // Detect direct/indirect labels
  const hasLabels = useMemo(() => hasDirectIndirectLabels(accounts), [accounts]);

  // Build trees
  const incomeAccounts = useMemo(
    () => accounts.filter((a) => String(a.type ?? "").toLowerCase() === "income"),
    [accounts],
  );
  const expenseAccounts = useMemo(
    () => accounts.filter((a) => String(a.type ?? "").toLowerCase() === "expense"),
    [accounts],
  );

  const directIncomeTree = useMemo(
    () =>
      hasLabels
        ? buildPLTree(incomeAccounts.filter(isDirectAccount), txMap, "income")
        : buildPLTree(incomeAccounts, txMap, "income"),
    [incomeAccounts, txMap, hasLabels],
  );

  const indirectIncomeTree = useMemo(
    () =>
      hasLabels
        ? buildPLTree(incomeAccounts.filter(isIndirectAccount), txMap, "income")
        : [],
    [incomeAccounts, txMap, hasLabels],
  );

  const directExpenseTree = useMemo(
    () =>
      hasLabels
        ? buildPLTree(expenseAccounts.filter(isDirectAccount), txMap, "expense")
        : buildPLTree(expenseAccounts, txMap, "expense"),
    [expenseAccounts, txMap, hasLabels],
  );

  const indirectExpenseTree = useMemo(
    () =>
      hasLabels
        ? buildPLTree(expenseAccounts.filter(isIndirectAccount), txMap, "expense")
        : [],
    [expenseAccounts, txMap, hasLabels],
  );

  // Income & Expenditure tab trees (indirect only)
  const ieIncomeTree = useMemo(
    () => buildPLTree(incomeAccounts.filter(isIndirectAccount), txMap, "income"),
    [incomeAccounts, txMap],
  );
  const ieExpenseTree = useMemo(
    () =>
      buildPLTree(
        expenseAccounts.filter(
          (a) => isIndirectAccount(a) || String(a.group ?? a.name ?? "").toLowerCase().includes("admin"),
        ),
        txMap,
        "expense",
      ),
    [expenseAccounts, txMap],
  );

  // Totals
  const totalDirectIncome = useMemo(
    () => directIncomeTree.reduce((s, n) => s + n.balance, 0),
    [directIncomeTree],
  );
  const totalIndirectIncome = useMemo(
    () => indirectIncomeTree.reduce((s, n) => s + n.balance, 0),
    [indirectIncomeTree],
  );
  const totalIncome = totalDirectIncome + totalIndirectIncome;

  const totalDirectExpense = useMemo(
    () => directExpenseTree.reduce((s, n) => s + n.balance, 0),
    [directExpenseTree],
  );
  const totalIndirectExpense = useMemo(
    () => indirectExpenseTree.reduce((s, n) => s + n.balance, 0),
    [indirectExpenseTree],
  );
  const totalExpense = totalDirectExpense + totalIndirectExpense;

  const netProfit = totalIncome - totalExpense;

  // Monthly data computation
  const monthlyData = useMemo((): MonthlyRow[] | null => {
    if (!reportOptions?.monthlyVariant) return null;
    const { fromDate, toDate } = reportOptions;
    const byMonth: Record<string, MonthlyRow> = {};

    for (const v of vouchers) {
      if (!v.date || v.date < fromDate || v.date > toDate) continue;
      if (v.status !== "posted") continue;
      const month = v.date.slice(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = {
          month,
          directIncome: 0,
          indirectIncome: 0,
          directExpense: 0,
          indirectExpense: 0,
          netProfit: 0,
        };
      }
      for (const l of v.lines ?? []) {
        const acc = accounts.find((a) => a.id === l.accountId);
        if (!acc) continue;
        const t = String(acc.type ?? "").toLowerCase();
        const net = Number(l.credit ?? 0) - Number(l.debit ?? 0);
        if (t === "income") {
          if (isDirectAccount(acc)) byMonth[month].directIncome += net;
          else byMonth[month].indirectIncome += net;
        } else if (t === "expense") {
          if (isDirectAccount(acc)) byMonth[month].directExpense += net;
          else byMonth[month].indirectExpense += net;
        }
      }
    }

    const rows = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
    return rows.map((r) => ({
      ...r,
      netProfit:
        r.directIncome + r.indirectIncome - r.directExpense - r.indirectExpense,
    }));
  }, [reportOptions, vouchers, accounts]);

  // Toggle accordion
  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Node click
  const handleNodeClick = useCallback((node: ReportNode) => {
    if (node.level === "ledger") {
      setDrillPanel({ open: true, accountId: node.id, accountName: node.name });
    }
  }, []);

  // Export
  const handleExport = useCallback(() => {
    if (!reportOptions) return;
    const dp = getProfitDecimalPlaces();
    const allRows = [
      ...flattenTree(directIncomeTree),
      ...flattenTree(indirectIncomeTree),
      ...flattenTree(directExpenseTree),
      ...flattenTree(indirectExpenseTree),
    ];
    const lines = [
      "Name,Balance",
      ...allRows.map((r) => `"${r.name}",${r.balance.toFixed(dp)}`),
    ];
    const csv = lines.join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `ProfitLoss_${reportOptions.toDate}.csv`;
    a.click();
  }, [reportOptions, directIncomeTree, indirectIncomeTree, directExpenseTree, indirectExpenseTree]);

  const dp = getProfitDecimalPlaces();

  const fmtAmt = (n: number) =>
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });

  // Common tree props
  const treeProps = {
    depth: "detailed" as ReportDepth,
    expandedIds,
    onToggle: handleToggle,
    onNodeClick: handleNodeClick,
    altBalanceMap: showPrevYear ? prevTxMap : undefined,
    showAltColumn: showPrevYear,
  };

  const extraActions = (
    <>
      <RebuildBalancesAction />
      <button
        onClick={() => setShowPrevYear((v) => !v)}
        className={`h-8 px-3 text-[12px] font-medium rounded-md border ${
          showPrevYear
            ? "bg-[#1557b0] text-white border-[#1557b0]"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        Compare Prev Year
      </button>
      <button
        onClick={() => setModalOpen(true)}
        className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
      >
        Reconfigure
      </button>
    </>
  );

  // Tab strip
  const tabs = [
    {
      label: "Profit & Loss A/c",
      value: "pl",
      active: activeTab === "pl",
      onClick: () => setActiveTab("pl"),
    },
    {
      label: "Income & Expenditure A/c",
      value: "ie",
      active: activeTab === "ie",
      onClick: () => setActiveTab("ie"),
    },
  ];

  return (
    <>
      <ReportOptionsModal
        title="Profit & Loss A/c"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onGenerate={(opts) => {
          setReportOptions(opts);
          setModalOpen(false);
        }}
        showBranchSelector={branches.length > 0}
        showMonthlyVariant
        fiscalYears={fiscalYears}
        currentFiscalYear={currentFiscalYear ?? {}}
        branches={branches}
      />

      <ReportShell
        title="Profit & Loss"
        subtitle={
          reportOptions
            ? `${reportOptions.fromDate} to ${reportOptions.toDate}`
            : "Configure to generate report"
        }
        onPrint={() => window.print()}
        onExport={handleExport}
        extraActions={extraActions}
        tabs={tabs}
      >
        {(depth: ReportDepth) => {
          if (!reportOptions) {
            return (
              <div className="flex items-center justify-center py-20 text-gray-500 text-[12px]">
                Click "Generate Report" to build the P&amp;L Statement.
              </div>
            );
          }

          // Monthly summary view
          if (reportOptions.monthlyVariant && monthlyData) {
            return (
              <div>
                <div className="no-print mb-3">
                  <button
                    onClick={() =>
                      setReportOptions((o) => o ? { ...o, monthlyVariant: false } : o)
                    }
                    className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
                  >
                    ← Back to Summary
                  </button>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead className="bg-[#f5f6fa] border-b border-gray-200">
                      <tr>
                        {[
                          "Month",
                          "Direct Income",
                          "Indirect Income",
                          "Total Income",
                          "Direct Exp",
                          "Indirect Exp",
                          "Total Exp",
                          "Net Profit",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((row) => (
                        <tr key={row.month} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-700">{row.month}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmtAmt(row.directIncome)}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmtAmt(row.indirectIncome)}</td>
                          <td className="px-3 py-2 font-mono text-right font-semibold">
                            {fmtAmt(row.directIncome + row.indirectIncome)}
                          </td>
                          <td className="px-3 py-2 font-mono text-right">{fmtAmt(row.directExpense)}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmtAmt(row.indirectExpense)}</td>
                          <td className="px-3 py-2 font-mono text-right font-semibold">
                            {fmtAmt(row.directExpense + row.indirectExpense)}
                          </td>
                          <td
                            className={`px-3 py-2 font-mono text-right font-bold ${
                              row.netProfit >= 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {fmtAmt(row.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          // Income & Expenditure tab
          if (activeTab === "ie") {
            const ieIncome = ieIncomeTree.reduce((s, n) => s + n.balance, 0);
            const ieExpense = ieExpenseTree.reduce((s, n) => s + n.balance, 0);
            const ieSurplus = ieIncome - ieExpense;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                      <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Indirect Income
                      </h3>
                    </div>
                    <table className="w-full">
                      <AccountTreeRenderer nodes={ieIncomeTree} {...treeProps} depth={depth} />
                    </table>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                      <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Indirect / Admin Expenses
                      </h3>
                    </div>
                    <table className="w-full">
                      <AccountTreeRenderer nodes={ieExpenseTree} {...treeProps} depth={depth} />
                    </table>
                  </div>
                </div>
                <div
                  className={`rounded-lg border p-4 ${
                    ieSurplus >= 0
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[13px]">
                      {ieSurplus >= 0 ? "Surplus" : "Deficit"}
                    </span>
                    <span className="font-mono font-bold text-[15px]">
                      {fmtAmt(ieSurplus)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }

          // P&L tab
          const layout = reportOptions.layout;

          if (layout === "horizontal") {
            return (
              <div>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#1557b0] text-white text-[12px] font-semibold">
                        <th className="px-3 py-2 text-left w-1/2">Expenses</th>
                        <th className="px-3 py-2 text-right w-24">Amount</th>
                        <th className="px-3 py-2 text-left w-1/2 border-l border-blue-400">Income</th>
                        <th className="px-3 py-2 text-right w-24">Amount</th>
                      </tr>
                    </thead>
                    <PLTFormatBody
                      incomeNodes={[...directIncomeTree, ...indirectIncomeTree]}
                      expenseNodes={[...directExpenseTree, ...indirectExpenseTree]}
                      totalIncome={totalIncome}
                      totalExpense={totalExpense}
                      netProfit={netProfit}
                      fmtAmt={fmtAmt}
                    />
                  </table>
                </div>
                {drillPanel.open && (
                  <LedgerDrillPanel
                    open={drillPanel.open}
                    onClose={() => setDrillPanel((p) => ({ ...p, open: false }))}
                    accountId={drillPanel.accountId}
                    accountName={drillPanel.accountName}
                    fromDate={reportOptions.fromDate}
                    toDate={reportOptions.toDate}
                    vouchers={vouchers}
                    onOpenVoucher={(id) => console.log("Open voucher:", id)}
                  />
                )}
              </div>
            );
          }

          // Vertical layout
          return (
            <div className="space-y-4">
              {/* Direct Income */}
              {hasLabels && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Direct Income
                    </h3>
                  </div>
                  <table className="w-full">
                    <AccountTreeRenderer nodes={directIncomeTree} {...treeProps} depth={depth} />
                  </table>
                </div>
              )}

              {/* Indirect Income */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {hasLabels ? "Indirect Income" : "Income"}
                  </h3>
                </div>
                <table className="w-full">
                  <AccountTreeRenderer
                    nodes={hasLabels ? indirectIncomeTree : directIncomeTree}
                    {...treeProps}
                    depth={depth}
                  />
                </table>
              </div>

              {/* Total Income */}
              <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded px-3 py-2 flex justify-between text-[12px] font-bold">
                <span>Total Income</span>
                <span className="font-mono">{fmtAmt(totalIncome)}</span>
              </div>

              {/* Direct Expense */}
              {hasLabels && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Direct Expenses
                    </h3>
                  </div>
                  <table className="w-full">
                    <AccountTreeRenderer nodes={directExpenseTree} {...treeProps} depth={depth} />
                  </table>
                </div>
              )}

              {/* Indirect Expense */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {hasLabels ? "Indirect Expenses" : "Expenses"}
                  </h3>
                </div>
                <table className="w-full">
                  <AccountTreeRenderer
                    nodes={hasLabels ? indirectExpenseTree : directExpenseTree}
                    {...treeProps}
                    depth={depth}
                  />
                </table>
              </div>

              {/* Total Expense */}
              <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded px-3 py-2 flex justify-between text-[12px] font-bold">
                <span>Total Expenses</span>
                <span className="font-mono">{fmtAmt(totalExpense)}</span>
              </div>

              {/* Net Profit/Loss */}
              <div
                className={`rounded-lg border p-4 ${
                  netProfit >= 0
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[13px]">
                    Net {netProfit >= 0 ? "Profit" : "Loss"}
                  </span>
                  <span className="font-mono font-bold text-[15px]">{fmtAmt(netProfit)}</span>
                </div>
              </div>

              {/* Drill-down panel */}
              {drillPanel.open && (
                <LedgerDrillPanel
                  open={drillPanel.open}
                  onClose={() => setDrillPanel((p) => ({ ...p, open: false }))}
                  accountId={drillPanel.accountId}
                  accountName={drillPanel.accountName}
                  fromDate={reportOptions.fromDate}
                  toDate={reportOptions.toDate}
                  vouchers={vouchers}
                  onOpenVoucher={(id) => console.log("Open voucher:", id)}
                />
              )}
            </div>
          );
        }}
      </ReportShell>
    </>
  );
};

// ── PL T-Format Body ──────────────────────────────────────────────────────────
interface PLTFormatBodyProps {
  incomeNodes: ReportNode[];
  expenseNodes: ReportNode[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  fmtAmt: (n: number) => string;
}

function flattenForTFormat(nodes: ReportNode[], rows: ReportNode[] = []): ReportNode[] {
  for (const n of nodes) {
    rows.push(n);
    if (n.children) flattenForTFormat(n.children, rows);
  }
  return rows;
}

const PLTFormatBody: React.FC<PLTFormatBodyProps> = ({
  incomeNodes,
  expenseNodes,
  totalIncome,
  totalExpense,
  netProfit,
  fmtAmt,
}) => {
  const leftFlat = flattenForTFormat(expenseNodes);
  const rightFlat = flattenForTFormat(incomeNodes);
  const len = Math.max(leftFlat.length, rightFlat.length);

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < len; i++) {
    const l = leftFlat[i];
    const r = rightFlat[i];
    rows.push(
      <tr key={i} className="border-b border-gray-100 text-[12px]">
        <td className="px-3 py-1.5 text-gray-700">{l?.name ?? ""}</td>
        <td className="px-3 py-1.5 font-mono text-right text-gray-700">
          {l ? fmtAmt(l.balance) : ""}
        </td>
        <td className="px-3 py-1.5 text-gray-700 border-l border-gray-200">{r?.name ?? ""}</td>
        <td className="px-3 py-1.5 font-mono text-right text-gray-700">
          {r ? fmtAmt(r.balance) : ""}
        </td>
      </tr>,
    );
  }

  return (
    <tbody>
      {rows}
      {/* Totals row */}
      <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
        <td className="px-3 py-2 text-gray-800">Total Expenses</td>
        <td className="px-3 py-2 font-mono text-right text-gray-800">{fmtAmt(totalExpense)}</td>
        <td className="px-3 py-2 text-gray-800 border-l border-gray-200">Total Income</td>
        <td className="px-3 py-2 font-mono text-right text-gray-800">{fmtAmt(totalIncome)}</td>
      </tr>
      <tr className="bg-[#eef2ff] font-bold text-[12px]">
        <td className="px-3 py-2 text-gray-800">{netProfit > 0 ? "Net Profit" : ""}</td>
        <td className="px-3 py-2 font-mono text-right text-gray-800">{netProfit > 0 ? fmtAmt(netProfit) : ""}</td>
        <td className="px-3 py-2 text-gray-800 border-l border-gray-200">{netProfit < 0 ? "Net Loss" : ""}</td>
        <td className="px-3 py-2 font-mono text-right text-gray-800">{netProfit < 0 ? fmtAmt(Math.abs(netProfit)) : ""}</td>
      </tr>
    </tbody>
  );
};

export default ProfitLoss;
