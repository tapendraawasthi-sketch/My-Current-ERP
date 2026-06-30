import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/reports/ReportShell";
import AccountTreeRenderer, { ReportDepth, ReportNode } from "../components/reports/AccountTreeRenderer";
import ReportOptionsModal, { ReportOptions } from "../components/reports/ReportOptionsModal";
import LedgerDrillPanel from "../components/reports/LedgerDrillPanel";
import RebuildBalancesAction from "../components/reports/RebuildBalancesAction";
import { getDB } from "../lib/db";
import { getProfitDecimalPlaces } from "../lib/utils";

// ── buildTree — keep exactly as original ─────────────────────────────────────
function buildTree(
  accounts: any[],
  balanceMap: Record<string, number>,
  type: "asset" | "liability" | "equity" | string,
): ReportNode[] {
  const filtered = accounts.filter(
    (a) => String(a.type ?? "").toLowerCase() === type,
  );

  const buildNode = (account: any, depth: number): ReportNode => {
    const children = filtered
      .filter((a) => a.parentId === account.id)
      .map((a) => buildNode(a, depth + 1));

    const directBalance = balanceMap[account.id] ?? account.balance ?? 0;
    const childrenBalance = children.reduce((s, c) => s + c.balance, 0);
    const balance = account.isGroup ? childrenBalance : directBalance;

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
    .map((a) => buildNode(a, 0));
}

// ── applyClosingStockOverride ────────────────────────────────────────────────
function applyClosingStockOverride(tree: ReportNode[], overrideValue: number): ReportNode[] {
  return tree.map((node) => {
    if (node.name.toLowerCase().includes("closing stock")) {
      return { ...node, balance: overrideValue };
    }
    if (node.children.length > 0) {
      const patchedChildren = applyClosingStockOverride(node.children, overrideValue);
      const newBalance = node.isGroup
        ? patchedChildren.reduce((s, c) => s + c.balance, 0)
        : node.balance;
      return { ...node, children: patchedChildren, balance: newBalance };
    }
    return node;
  });
}

// ── flattenTree for CSV export ───────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
const BalanceSheet: React.FC = () => {
  const {
    accounts,
    vouchers,
    currentFiscalYear,
    fiscalYears,
  } = useStore();

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
  const [closingStockOverride, setClosingStockOverride] = useState<number | null>(null);
  const [editingClosingStock, setEditingClosingStock] = useState(false);
  const [closingStockInput, setClosingStockInput] = useState("");
  const [showPrevYear, setShowPrevYear] = useState(false);

  // Load branches from IndexedDB
  useEffect(() => {
    const load = async () => {
      try {
        const db = getDB();
        const rows = await (db as any).table("branches").toArray();
        setBranches(
          rows.map((r: any) => ({ id: r.id, name: r.name ?? r.id })),
        );
      } catch {
        setBranches([]);
      }
    };
    load();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setModalOpen(true);
      }
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        handleExport();
      }
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOptions, showPrevYear]);

  // Balance map computation
  const balanceMap = useMemo((): Record<string, number> => {
    if (!reportOptions) return {};
    const { fromDate, toDate, branchId } = reportOptions;
    const map: Record<string, number> = {};

    // Opening balances
    for (const a of accounts) {
      map[a.id] = Number(a.openingBalance ?? 0);
    }

    // Add voucher lines
    for (const v of vouchers) {
      if (!v.date) continue;
      if (v.date < fromDate || v.date > toDate) continue;
      if (branchId !== "all" && v.branchId && v.branchId !== branchId) continue;
      if (v.status !== "posted") continue;
      for (const l of v.lines ?? []) {
        if (!l.accountId) continue;
        if (!(l.accountId in map)) map[l.accountId] = 0;
        map[l.accountId] += Number(l.debit ?? 0) - Number(l.credit ?? 0);
      }
    }
    return map;
  }, [reportOptions, accounts, vouchers]);

  // Previous year balance map
  const prevFiscalYear = useMemo(() => {
    if (!currentFiscalYear) return null;
    return (
      fiscalYears.find(
        (fy: any) => fy.endDate && fy.endDate < currentFiscalYear.startDate,
      ) ?? null
    );
  }, [fiscalYears, currentFiscalYear]);

  const prevBalanceMap = useMemo((): Record<string, number> => {
    if (!showPrevYear || !prevFiscalYear) return {};
    const map: Record<string, number> = {};
    for (const a of accounts) {
      map[a.id] = Number(a.openingBalance ?? 0);
    }
    for (const v of vouchers) {
      if (!v.date) continue;
      if (v.date < prevFiscalYear.startDate || v.date > prevFiscalYear.endDate) continue;
      if (v.status !== "posted") continue;
      for (const l of v.lines ?? []) {
        if (!l.accountId) continue;
        if (!(l.accountId in map)) map[l.accountId] = 0;
        map[l.accountId] += Number(l.debit ?? 0) - Number(l.credit ?? 0);
      }
    }
    return map;
  }, [showPrevYear, prevFiscalYear, accounts, vouchers]);

  // Build trees
  const rawAssetTree = useMemo(
    () => buildTree(accounts, balanceMap, "asset"),
    [accounts, balanceMap],
  );

  const assetTree = useMemo(() => {
    if (closingStockOverride !== null) {
      return applyClosingStockOverride(rawAssetTree, closingStockOverride);
    }
    return rawAssetTree;
  }, [rawAssetTree, closingStockOverride]);

  const liabilityTree = useMemo(
    () => buildTree(accounts, balanceMap, "liability"),
    [accounts, balanceMap],
  );
  const equityTree = useMemo(
    () => buildTree(accounts, balanceMap, "equity"),
    [accounts, balanceMap],
  );

  // Totals
  const totalAssets = useMemo(
    () => assetTree.reduce((s, n) => s + n.balance, 0),
    [assetTree],
  );
  const totalLiabEquity = useMemo(
    () =>
      liabilityTree.reduce((s, n) => s + n.balance, 0) +
      equityTree.reduce((s, n) => s + n.balance, 0),
    [liabilityTree, equityTree],
  );
  const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 1;

  // Toggle accordion
  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Node click — drill down
  const handleNodeClick = useCallback((node: ReportNode) => {
    if (node.level === "ledger") {
      setDrillPanel({ open: true, accountId: node.id, accountName: node.name });
    }
  }, []);

  // CSV Export
  const handleExport = useCallback(() => {
    if (!reportOptions) return;
    const rows = [
      ...flattenTree(assetTree),
      ...flattenTree(liabilityTree),
      ...flattenTree(equityTree),
    ];
    const dp = getProfitDecimalPlaces();
    const lines = [
      showPrevYear ? "Name,Balance,Prev Year" : "Name,Balance",
      ...rows.map((r) => {
        const bal = r.balance.toFixed(dp);
        const prev = showPrevYear
          ? "," + (prevBalanceMap[r.name] ?? 0).toFixed(dp)
          : "";
        return `"${r.name}",${bal}${prev}`;
      }),
    ];
    const csv = lines.join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `BalanceSheet_${reportOptions.toDate}.csv`;
    a.click();
  }, [reportOptions, assetTree, liabilityTree, equityTree, showPrevYear, prevBalanceMap]);

  // Check localStorage for manual closing-stock mode
  const manualStockMode =
    typeof window !== "undefined"
      ? localStorage.getItem("cfg_bs_stock_updation") === "Manually"
      : false;

  const showStockEditIcon = manualStockMode || closingStockOverride !== null;

  // Common props for AccountTreeRenderer
  const treeProps = {
    depth: "detailed" as ReportDepth,
    expandedIds,
    onToggle: handleToggle,
    onNodeClick: handleNodeClick,
    altBalanceMap: showPrevYear ? prevBalanceMap : undefined,
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

  return (
    <>
      {/* Options Modal */}
      <ReportOptionsModal
        title="Balance Sheet"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onGenerate={(opts) => {
          setReportOptions(opts);
          setModalOpen(false);
        }}
        showBranchSelector={branches.length > 0}
        fiscalYears={fiscalYears}
        currentFiscalYear={currentFiscalYear ?? {}}
        branches={branches}
      />

      <ReportShell
        title="Balance Sheet"
        subtitle={
          reportOptions
            ? `As of ${reportOptions.toDate}`
            : "Configure to generate report"
        }
        onPrint={() => window.print()}
        onExport={handleExport}
        extraActions={extraActions}
      >
        {(depth: ReportDepth) => {
          if (!reportOptions) {
            return (
              <div className="flex items-center justify-center py-20 text-gray-500 text-[12px]">
                Click "Generate Report" to build the Balance Sheet.
              </div>
            );
          }

          const layout = reportOptions.layout;

          return (
            <div>
              {/* Balanced indicator */}
              <div className="no-print flex justify-end mb-3">
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded border ${
                    isBalanced
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {isBalanced ? "Balanced ✓" : "Unbalanced ✗"}
                </span>
              </div>

              {layout === "vertical" ? (
                /* Vertical (two-column grid) layout */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Assets */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                      <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Assets
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <AccountTreeRenderer
                          nodes={assetTree}
                          depth={depth}
                          {...treeProps}
                        />
                        <tfoot>
                          <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                            <td className="px-3 py-2 text-gray-800">Total Assets</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">
                              {totalAssets.toLocaleString("en-IN", {
                                minimumFractionDigits: getProfitDecimalPlaces(),
                                maximumFractionDigits: getProfitDecimalPlaces(),
                              })}
                            </td>
                            {showPrevYear && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Liabilities + Equity */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                      <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Liabilities &amp; Equity
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <AccountTreeRenderer
                          nodes={[...liabilityTree, ...equityTree]}
                          depth={depth}
                          creditNature
                          {...treeProps}
                        />
                        <tfoot>
                          <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                            <td className="px-3 py-2 text-gray-800">
                              Total Liabilities &amp; Equity
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">
                              {totalLiabEquity.toLocaleString("en-IN", {
                                minimumFractionDigits: getProfitDecimalPlaces(),
                                maximumFractionDigits: getProfitDecimalPlaces(),
                              })}
                            </td>
                            {showPrevYear && <td />}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* Horizontal / T-format layout */
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#1557b0] text-white text-[12px] font-semibold">
                        <th className="px-3 py-2 text-left w-1/2">Liabilities &amp; Equity</th>
                        <th className="px-3 py-2 text-right w-24">Amount</th>
                        <th className="px-3 py-2 text-left w-1/2 border-l border-blue-400">Assets</th>
                        <th className="px-3 py-2 text-right w-24">Amount</th>
                      </tr>
                    </thead>
                    <TFormatBody
                      leftNodes={[...liabilityTree, ...equityTree]}
                      rightNodes={assetTree}
                      depth={depth}
                      treeProps={treeProps}
                      leftTotal={totalLiabEquity}
                      rightTotal={totalAssets}
                    />
                  </table>
                </div>
              )}

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

// ── T-Format inline helper ────────────────────────────────────────────────────
interface TFormatBodyProps {
  leftNodes: ReportNode[];
  rightNodes: ReportNode[];
  depth: ReportDepth;
  treeProps: any;
  leftTotal: number;
  rightTotal: number;
}

function flattenForTFormat(nodes: ReportNode[], rows: ReportNode[] = []): ReportNode[] {
  for (const n of nodes) {
    rows.push(n);
    if (n.children) flattenForTFormat(n.children, rows);
  }
  return rows;
}

const TFormatBody: React.FC<TFormatBodyProps> = ({
  leftNodes,
  rightNodes,
  leftTotal,
  rightTotal,
}) => {
  const dp = getProfitDecimalPlaces();
  const leftFlat = flattenForTFormat(leftNodes);
  const rightFlat = flattenForTFormat(rightNodes);
  const len = Math.max(leftFlat.length, rightFlat.length);

  const fmtN = (n: number) =>
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < len; i++) {
    const l = leftFlat[i];
    const r = rightFlat[i];
    rows.push(
      <tr key={i} className="border-b border-gray-100 text-[12px]">
        <td className="px-3 py-1.5 text-gray-700">{l?.name ?? ""}</td>
        <td className="px-3 py-1.5 font-mono text-right text-gray-700">
          {l ? fmtN(l.balance) : ""}
        </td>
        <td className="px-3 py-1.5 text-gray-700 border-l border-gray-200">{r?.name ?? ""}</td>
        <td className="px-3 py-1.5 font-mono text-right text-gray-700">
          {r ? fmtN(r.balance) : ""}
        </td>
      </tr>,
    );
  }

  return (
    <tbody>
      {rows}
      {/* Totals row */}
      <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
        <td className="px-3 py-2 text-gray-800">Total Liabilities &amp; Equity</td>
        <td className="px-3 py-2 font-mono text-right text-gray-800">{fmtN(leftTotal)}</td>
        <td className="px-3 py-2 text-gray-800 border-l border-gray-200">Total Assets</td>
        <td className="px-3 py-2 font-mono text-right text-gray-800">{fmtN(rightTotal)}</td>
      </tr>
    </tbody>
  );
};

export default BalanceSheet;
