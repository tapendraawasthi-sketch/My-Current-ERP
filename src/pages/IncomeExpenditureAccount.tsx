import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/reports/ReportShell";
import AccountTreeRenderer, { ReportDepth, ReportNode } from "../components/reports/AccountTreeRenderer";
import ReportOptionsModal, { ReportOptions } from "../components/reports/ReportOptionsModal";
import LedgerDrillPanel from "../components/reports/LedgerDrillPanel";
import RebuildBalancesAction from "../components/reports/RebuildBalancesAction";
import { getDB } from "../lib/db";
import { getProfitDecimalPlaces } from "../lib/utils";
import { formatADToBS } from "../lib/nepaliDate";

function buildPLTree(
  accounts: any[],
  txMap: Record<string, number>,
  type: "income" | "expense",
): ReportNode[] {
  const filtered = accounts.filter((a) => String(a.type ?? "").toLowerCase() === type);
  const buildNode = (account: any): ReportNode => {
    const children = filtered.filter((a) => a.parentId === account.id).map(buildNode);
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

function isIEAccount(a: any): boolean {
  const g = String(a.group ?? a.subGroup ?? a.groupName ?? a.name ?? "").toLowerCase();
  return g.includes("indirect") || g.includes("admin");
}

const IncomeExpenditureAccount: React.FC = () => {
  const { accounts, vouchers, currentFiscalYear, fiscalYears } = useStore();

  const [modalOpen, setModalOpen] = useState(true);
  const [reportOptions, setReportOptions] = useState<ReportOptions | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [drillPanel, setDrillPanel] = useState<{
    open: boolean;
    accountId: string | null;
    accountName: string;
  }>({ open: false, accountId: null, accountName: "" });
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "e") { e.preventDefault(); handleExport(); }
      if (e.altKey && e.key.toLowerCase() === "p") { e.preventDefault(); window.print(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOptions]);

  const txMap = useMemo((): Record<string, number> => {
    if (!reportOptions) return {};
    const { fromDate, toDate, branchId } = reportOptions;
    const map: Record<string, number> = {};
    for (const v of vouchers) {
      if (!v.date || v.date < fromDate || v.date > toDate) continue;
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

  // Filter to IE accounts only
  const ieIncomeAccounts = useMemo(
    () => accounts.filter((a) => String(a.type ?? "").toLowerCase() === "income" && isIEAccount(a)),
    [accounts],
  );
  const ieExpenseAccounts = useMemo(
    () => accounts.filter((a) => String(a.type ?? "").toLowerCase() === "expense" && isIEAccount(a)),
    [accounts],
  );

  const incomeTree = useMemo(
    () => buildPLTree(ieIncomeAccounts, txMap, "income"),
    [ieIncomeAccounts, txMap],
  );
  const expenseTree = useMemo(
    () => buildPLTree(ieExpenseAccounts, txMap, "expense"),
    [ieExpenseAccounts, txMap],
  );

  const totalIncome = incomeTree.reduce((s, n) => s + n.balance, 0);
  const totalExpense = expenseTree.reduce((s, n) => s + n.balance, 0);
  const surplus = totalIncome - totalExpense;

  const dp = getProfitDecimalPlaces();
  const fmtAmt = (n: number) =>
    Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((node: ReportNode) => {
    if (node.level === "ledger") {
      setDrillPanel({ open: true, accountId: node.id, accountName: node.name });
    }
  }, []);

  const handleExport = useCallback(() => {
    if (!reportOptions) return;
    const rows = [
      ...incomeTree.map((n) => ({ name: n.name, balance: n.balance })),
      ...expenseTree.map((n) => ({ name: n.name, balance: n.balance })),
    ];
    const csv = ["Name,Balance", ...rows.map((r) => `"${r.name}",${r.balance.toFixed(dp)}`)].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `IncomeExpenditure_${reportOptions.toDate}.csv`;
    a.click();
  }, [reportOptions, incomeTree, expenseTree, dp]);

  const treeProps = {
    depth: "detailed" as ReportDepth,
    expandedIds,
    onToggle: handleToggle,
    onNodeClick: handleNodeClick,
  };

  const extraActions = (
    <>
      <RebuildBalancesAction />
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
      <ReportOptionsModal
        title="Income & Expenditure Account"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onGenerate={(opts) => { setReportOptions(opts); setModalOpen(false); }}
        showBranchSelector={branches.length > 0}
        fiscalYears={fiscalYears}
        currentFiscalYear={currentFiscalYear ?? {}}
        branches={branches}
      />

      <ReportShell
        title="Income &amp; Expenditure Account"
        subtitle="For non-profit / trust entities — Nepal Accounting Standards"
        onPrint={() => window.print()}
        onExport={handleExport}
        extraActions={extraActions}
      >
        {(depth: ReportDepth) => {
          if (!reportOptions) {
            return (
              <div className="flex items-center justify-center py-20 text-gray-500 text-[12px]">
                Configure and generate the report.
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <div style={{
                textAlign: "center",
                padding: "16px 0 12px",
                borderBottom: "1px solid #e5e7eb",
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  {useStore.getState().companySettings?.companyNameEn || useStore.getState().companySettings?.name || "Company Name"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 3 }}>
                  Income &amp; Expenditure Account
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  For the period from {formatADToBS(reportOptions.fromDate)} to {formatADToBS(reportOptions.toDate)}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                  ({reportOptions.fromDate} to {reportOptions.toDate})
                </div>
                {useStore.getState().companySettings?.panNumber && (
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                    PAN: {useStore.getState().companySettings?.panNumber}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Income */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Indirect Income
                    </h3>
                  </div>
                  <table className="w-full">
                    <AccountTreeRenderer nodes={incomeTree} {...treeProps} depth={depth} />
                    <tfoot>
                      <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                        <td className="px-3 py-2 text-gray-800">Total Income</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-800">
                          {fmtAmt(totalIncome)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Expenses */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Indirect / Admin Expenses
                    </h3>
                  </div>
                  <table className="w-full">
                    <AccountTreeRenderer nodes={expenseTree} {...treeProps} depth={depth} />
                    <tfoot>
                      <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                        <td className="px-3 py-2 text-gray-800">Total Expenses</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-800">
                          {fmtAmt(totalExpense)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Surplus / Deficit */}
              <table className="w-full">
                <tbody>
                  <tr style={{
                    background: surplus >= 0 ? "#f0fdf4" : "#fef2f2",
                    borderTop: "2px solid #d1d5db",
                    boxShadow: `inset 0 -4px 0 0 ${surplus >= 0 ? "#86efac" : "#fca5a5"}, inset 0 -7px 0 0 ${surplus >= 0 ? "#f0fdf4" : "#fef2f2"}, inset 0 -8px 0 0 ${surplus >= 0 ? "#86efac" : "#fca5a5"}`,
                  }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                        {surplus >= 0 ? "Surplus for the Period" : "Deficit for the Period"}
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", fontStyle: "italic", marginTop: 2 }}>
                        {surplus >= 0
                          ? "Transferred to Corpus / General Fund"
                          : "Charged to Corpus / General Fund"}
                      </div>
                    </td>
                    <td className="num-cell-bold" style={{ color: surplus >= 0 ? "#059669" : "#dc2626", fontSize: 14, padding: "12px 16px", textAlign: "right" }}>
                      {Math.abs(surplus).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>

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

export default IncomeExpenditureAccount;
