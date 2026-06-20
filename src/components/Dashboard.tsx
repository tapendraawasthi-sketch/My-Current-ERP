/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import {
  computeProfitLoss,
  computeOutstandingReceivables,
  computeOutstandingPayables,
} from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { formatCurrency, formatNumber } from "../lib/utils";
import Card from "./ui/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Plus,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  ShieldAlert,
  FileText,
  BadgeDollarSign,
  PlusCircle,
  FolderOpen,
} from "lucide-react";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";

import { useIsMobile } from "../hooks/use-mobile";

const COLORS = ["#1d4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const Dashboard: React.FC = () => {
  const isMobile = useIsMobile();
  const {
    accounts,
    vouchers,
    invoices,
    items,
    parties,
    warehouses,
    stockMovements,
    isDbReady,
    setCurrentPage,
    setReportFilters,
    setEditingVoucherId,
    currentFiscalYear,
    companySettings,
  } = useStore();

  // 1. KPI COMPUTATIONS
  const cashBankBalance = useMemo(() => {
    const cashBankAccts = accounts.filter(
      (a) =>
        !a.isGroup &&
        (a.id === "acc-cash" ||
          a.id === "acc-nabil-bank" ||
          a.group?.toLowerCase().includes("bank") ||
          a.group?.toLowerCase().includes("cash") ||
          a.name.toLowerCase().includes("bank") ||
          a.name.toLowerCase().includes("cash")),
    );
    return cashBankAccts.reduce((sum, a) => sum + (a.balance || 0), 0);
  }, [accounts]);

  const todaySales = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayBills = invoices.filter(
      (i) =>
        i.type === VoucherType.SALES_INVOICE &&
        i.status === VoucherStatus.POSTED &&
        i.date === todayStr,
    );
    const total = todayBills.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    return { total, count: todayBills.length };
  }, [invoices]);

  const todayPurchases = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayBills = invoices.filter(
      (i) =>
        i.type === VoucherType.PURCHASE_INVOICE &&
        i.status === VoucherStatus.POSTED &&
        i.date === todayStr,
    );
    const total = todayBills.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    return { total, count: todayBills.length };
  }, [invoices]);

  const activePL = useMemo(() => {
    if (!currentFiscalYear) return { netProfit: 0, revenue: 0, totalExpenses: 0 };
    return computeProfitLoss(
      accounts,
      vouchers,
      currentFiscalYear.startDate,
      currentFiscalYear.endDate,
    );
  }, [accounts, vouchers, currentFiscalYear]);

  const currentFYNetProfit = activePL.netProfit || 0;

  // 2. RECEIVABLES & PAYABLES OUTSTANDING
  const receivables = useMemo(() => {
    return computeOutstandingReceivables(parties, invoices, vouchers);
  }, [parties, invoices, vouchers]);

  const payables = useMemo(() => {
    return computeOutstandingPayables(parties, invoices, vouchers);
  }, [parties, invoices, vouchers]);

  // Top list views
  const topReceivables = useMemo(() => receivables.parties.slice(0, 5), [receivables]);
  const topPayables = useMemo(() => payables.parties.slice(0, 5), [payables]);

  // 3. MONTHLY SALES VS PURCHASES CHART BS MONTHS
  const monthlyTrendData = useMemo(() => {
    const base = [
      { key: "04", name: "Shrawan", sales: 0, purchase: 0, purchases: 0 },
      { key: "05", name: "Bhadra", sales: 0, purchase: 0, purchases: 0 },
      { key: "06", name: "Ashoj", sales: 0, purchase: 0, purchases: 0 },
      { key: "07", name: "Kartik", sales: 0, purchase: 0, purchases: 0 },
      { key: "08", name: "Mangsir", sales: 0, purchase: 0, purchases: 0 },
      { key: "09", name: "Poush", sales: 0, purchase: 0, purchases: 0 },
      { key: "10", name: "Magh", sales: 0, purchase: 0, purchases: 0 },
      { key: "11", name: "Falgun", sales: 0, purchase: 0, purchases: 0 },
      { key: "12", name: "Chaitra", sales: 0, purchase: 0, purchases: 0 },
      { key: "01", name: "Baishakh", sales: 0, purchase: 0, purchases: 0 },
      { key: "02", name: "Jestha", sales: 0, purchase: 0, purchases: 0 },
      { key: "03", name: "Ashadh", sales: 0, purchase: 0, purchases: 0 },
    ];

    invoices.forEach((inv) => {
      if (inv.status !== VoucherStatus.POSTED) return;
      if (currentFiscalYear) {
        if (inv.date < currentFiscalYear.startDate || inv.date > currentFiscalYear.endDate) return;
      }
      const month = inv.date.split("-")[1];
      const match = base.find((b) => b.key === month);
      if (match) {
        const amt = inv.grandTotal || 0;
        if (inv.type === VoucherType.SALES_INVOICE) {
          match.sales = Math.round((match.sales + amt) * 100) / 100;
        } else if (inv.type === VoucherType.PURCHASE_INVOICE) {
          match.purchase = Math.round((match.purchase + amt) * 100) / 100;
          match.purchases = Math.round((match.purchases + amt) * 100) / 100;
        }
      }
    });

    return base;
  }, [invoices, currentFiscalYear]);

  // 4. ACCOUNT-WISE EXPENSES PIE CHART
  const expenseBreakdown = useMemo(() => {
    const expenseCategoryMap: { [key: string]: number } = {};
    accounts.forEach((acc) => {
      if (acc.type === "expense" && !acc.isGroup) {
        const groupName = acc.group || "Operating Expenses";
        expenseCategoryMap[groupName] = (expenseCategoryMap[groupName] || 0) + (acc.balance || 0);
      }
    });

    return Object.entries(expenseCategoryMap)
      .map(([name, value]) => ({ name, value: Math.abs(value) }))
      .filter((e) => e.value > 0);
  }, [accounts]);

  // 5. REGULAR SKELETON LOADER
  const isLoading = !isDbReady;

  // 6. RECENT POSTED VOUCHERS
  const recentVouchers = useMemo(() => {
    return [...vouchers]
      .filter((v) => v.status === VoucherStatus.POSTED)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [vouchers]);

  // 7. ALERT TRACKING Engine
  const lowStockAlerts = useMemo(() => {
    const positions = computeAllStockPositions(stockMovements, items, warehouses);
    return positions
      .filter((pos) => {
        const item = items.find((i) => i.id === pos.itemId);
        const threshold = item?.reorderLevel || 10;
        return pos.closingQty < threshold;
      })
      .map((pos) => {
        const item = items.find((i) => i.id === pos.itemId);
        return {
          id: `low-stock-${pos.itemId}`,
          type: "warning" as const,
          message: `Low Stock: ${pos.itemName} is running low at ${pos.closingQty} ${pos.unit || "units"} (Safety reorder cue: <= ${item?.reorderLevel || 10}).`,
          actionText: "View Items",
          onClick: () => setCurrentPage("items"),
        };
      });
  }, [stockMovements, items, warehouses, setCurrentPage]);

  const overduePayableAlerts = useMemo(() => {
    return payables.parties
      .filter((p) => p.daysOverdue > 30)
      .slice(0, 3)
      .map((p) => ({
        id: `overdue-payable-${p.partyId}`,
        type: "error" as const,
        message: `Overdue Liability: Outstanding Rs. ${formatNumber(p.amount)} with supplier ${p.partyName} is overdue by ${p.daysOverdue} days.`,
        actionText: "Report Ledger",
        onClick: () => {
          setCurrentPage("reports");
          setReportFilters({ selectedReport: "payables" });
        },
      }));
  }, [payables, setCurrentPage, setReportFilters]);

  const unpostedVouchersAlert = useMemo(() => {
    const drafts = vouchers.filter((v) => v.status === VoucherStatus.DRAFT);
    if (drafts.length === 0) return [];
    return [
      {
        id: "unposted-vouchers",
        type: "info" as const,
        message: `Unposted Bookkeeping: There are ${drafts.length} accounting vouchers currently saved in Draft waiting to be posted.`,
        actionText: "Review Drawer",
        onClick: () => setCurrentPage("vouchers"),
      },
    ];
  }, [vouchers, setCurrentPage]);

  const activeAlerts = useMemo(() => {
    return [...lowStockAlerts, ...overduePayableAlerts, ...unpostedVouchersAlert];
  }, [lowStockAlerts, overduePayableAlerts, unpostedVouchersAlert]);

  // 8. BANK / CASH DETAILS
  const bankAndCashAccounts = useMemo(() => {
    return accounts
      .filter(
        (a) =>
          !a.isGroup &&
          (a.id === "acc-cash" ||
            a.id === "acc-nabil-bank" ||
            a.group?.toLowerCase().includes("bank") ||
            a.group?.toLowerCase().includes("cash") ||
            a.name.toLowerCase().includes("bank") ||
            a.name.toLowerCase().includes("cash")),
      )
      .map((a) => ({
        id: a.id,
        name: a.name,
        code: a.code,
        balance: a.balance || 0,
      }));
  }, [accounts]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 select-none animate-pulse">
        <div className="h-14 bg-gray-100 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 border border-gray-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-gray-100 border border-gray-200 rounded-xl"></div>
          <div className="h-80 bg-gray-100 border border-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const handleQuickLink = (linkType: string) => {
    setEditingVoucherId(null);
    switch (linkType) {
      case "sales-invoice":
        setCurrentPage("sales-invoice");
        break;
      case "purchase-invoice":
        setCurrentPage("purchase-invoice");
        break;
      case "receipt":
        setCurrentPage("receipt");
        break;
      case "payment":
        setCurrentPage("payment");
        break;
      case "journal":
        setCurrentPage("journal");
        break;
      case "reports":
        setCurrentPage("trial-balance");
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4">
      {/* Dynamic App Shell Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            Dashboard
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Overview for {companySettings?.name || "Your Company"} — Fiscal Year{" "}
            {currentFiscalYear?.name || "2083/84"}
          </p>
        </div>
        <div className="text-[11px] text-gray-500 shrink-0 bg-white border border-gray-200 rounded-md px-3 py-1.5 hidden md:flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#059669]"></span>
          <span>FY {currentFiscalYear?.name}</span>
        </div>
      </div>

      {/* Quick Navigate Button Row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCurrentPage("sales-register")}
          className="px-3 py-1 text-[11px] text-[#1557b0] bg-[#dbeafe] hover:bg-[#bfdbfe] rounded-md font-medium"
        >
          Sales Register
        </button>
        <button
          onClick={() => setCurrentPage("purchase-register")}
          className="px-3 py-1 text-[11px] text-[#1557b0] bg-[#dbeafe] hover:bg-[#bfdbfe] rounded-md font-medium"
        >
          Purchase Register
        </button>
        <button
          onClick={() => setCurrentPage("day-book")}
          className="px-3 py-1 text-[11px] text-[#1557b0] bg-[#dbeafe] hover:bg-[#bfdbfe] rounded-md font-medium"
        >
          Day Book
        </button>
        <button
          onClick={() => setCurrentPage("trial-balance")}
          className="px-3 py-1 text-[11px] text-[#1557b0] bg-[#dbeafe] hover:bg-[#bfdbfe] rounded-md font-medium"
        >
          Trial Balance
        </button>
        <button
          onClick={() => setCurrentPage("profit-loss")}
          className="px-3 py-1 text-[11px] text-[#1557b0] bg-[#dbeafe] hover:bg-[#bfdbfe] rounded-md font-medium"
        >
          P&L
        </button>
        <button
          onClick={() => setCurrentPage("stock-summary")}
          className="px-3 py-1 text-[11px] text-[#1557b0] bg-[#dbeafe] hover:bg-[#bfdbfe] rounded-md font-medium"
        >
          Stock Summary
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="kpi-card" style={{ "--kpi-color": "#1557b0" } as React.CSSProperties}>
          <div className="kpi-label">Cash & Bank</div>
          <div className="kpi-value">{formatCurrency(cashBankBalance)}</div>
          <div className="kpi-meta"><span className="text-gray-400">Total liquid balance</span></div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#15803d" } as React.CSSProperties}>
          <div className="kpi-label">Today's Sales</div>
          <div className="kpi-value">{formatCurrency(todaySales?.total ?? 0)}</div>
          <div className="kpi-meta"><span className="text-green-600 font-semibold">{todaySales?.count ?? 0} bills</span><span className="text-gray-400 ml-1">today</span></div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#b45309" } as React.CSSProperties}>
          <div className="kpi-label">Receivables</div>
          <div className="kpi-value">{formatCurrency(receivables?.total ?? 0)}</div>
          <div className="kpi-meta"><span className="text-amber-600 font-semibold">{receivables?.parties?.length ?? 0} parties</span><span className="text-gray-400 ml-1">outstanding</span></div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": currentFYNetProfit >= 0 ? "#15803d" : "#dc2626" } as React.CSSProperties}>
          <div className="kpi-label">Net Profit (FY)</div>
          <div className="kpi-value" style={{ color: currentFYNetProfit >= 0 ? "#15803d" : "#dc2626" }}>{formatCurrency(Math.abs(currentFYNetProfit ?? 0))}</div>
          <div className="kpi-meta">
            <span className={currentFYNetProfit >= 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>{currentFYNetProfit >= 0 ? "▲ Profit" : "▼ Loss"}</span>
            <span className="text-gray-400 ml-1">{currentFiscalYear?.name}</span>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-3 flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--border)" }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mr-1">Quick Add:</span>
        {[
          { label: "Sales Invoice", page: "billing", color: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
          { label: "Receipt Voucher", page: "receipt", color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
          { label: "Payment Voucher", page: "payment", color: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
          { label: "Journal Entry", page: "journal", color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100" },
          { label: "Contra Voucher", page: "contra", color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
        ].map(({ label, page, color }) => (
          <button key={page} type="button" onClick={() => setCurrentPage(page)} className={`h-7 px-3 text-[11px] font-semibold border rounded-md transition-colors ${color}`}>
            + {label}
          </button>
        ))}
      </div>

      {/* OUTSTANDINGS SECOND ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outstanding Receivables card */}
        <Card
          title={`Receivables Outstandings (${formatCurrency(receivables.total)})`}
          subtitle="Outstanding customer balances"
          border
          padding="none"
          action={
            <button
              onClick={() => {
                setCurrentPage("reports");
                setReportFilters({ selectedReport: "receivables" });
              }}
              className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1"
            >
              Analyze aging <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="relative p-5">
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {topReceivables.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-bold">
                  No outstanding customer balances.
                </div>
              ) : (
                topReceivables.map((p) => (
                  <div
                    key={p.partyId}
                    className="px-5 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPage("party-statement");
                      setReportFilters({ partyId: p.partyId });
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-gray-800 truncate">
                        {p.partyName}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 font-bold">
                        Overdue: {p.daysOverdue} days
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setCurrentPage("aging-report")}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
              >
                View All &rarr;
              </button>
            </div>
          </div>
        </Card>

        {/* Outstanding Payables card */}
        <Card
          title={`Payables Outstandings (${formatCurrency(payables.total)})`}
          subtitle="Outstanding vendor balances"
          border
          padding="none"
          action={
            <button
              onClick={() => {
                setCurrentPage("reports");
                setReportFilters({ selectedReport: "payables" });
              }}
              className="text-xs text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1"
            >
              Analyze aging <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="relative p-5">
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {topPayables.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 font-bold">
                  No outstanding vendor balances.
                </div>
              ) : (
                topPayables.map((p) => (
                  <div
                    key={p.partyId}
                    className="px-5 py-3 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPage("party-statement");
                      setReportFilters({ partyId: p.partyId });
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-gray-800 truncate">
                        {p.partyName}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5 font-bold">
                        Overdue: {p.daysOverdue} days
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setCurrentPage("aging-report")}
                className="text-xs text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
              >
                View All &rarr;
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* QUICK ACTIONS PANEL & ALERTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick links shortcuts dashboard layout (grid of 6 in 2x3) */}
        <div className="lg:col-span-2">
          <Card title="Quick Actions" subtitle="Create new transactions" border>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <button
                onClick={() => handleQuickLink("sales-invoice")}
                className="p-4 bg-blue-50/40 rounded-xl border border-blue-100 flex flex-col items-center text-center justify-center gap-2 hover:bg-blue-50 transition-all group hover:border-blue-200"
              >
                <div className="p-2.5 bg-blue-600 rounded-lg text-white group-hover:scale-105 transition-transform">
                  <PlusCircle className="h-[18px] w-[18px]" />
                </div>
                <span className="text-xs font-extrabold text-blue-900">New Sales Invoice</span>
                <span className="text-[10px] text-blue-400">Customer invoices</span>
              </button>

              <button
                onClick={() => handleQuickLink("purchase-invoice")}
                className="p-4 bg-orange-50/40 rounded-xl border border-orange-100 flex flex-col items-center text-center justify-center gap-2 hover:bg-orange-50 transition-all group hover:border-orange-200"
              >
                <div className="p-2.5 bg-orange-600 rounded-lg text-white group-hover:scale-105 transition-transform">
                  <PlusCircle className="h-[18px] w-[18px]" />
                </div>
                <span className="text-xs font-extrabold text-orange-900">New Purchase Invoice</span>
                <span className="text-[10px] text-orange-400">Vendor invoices</span>
              </button>

              <button
                onClick={() => handleQuickLink("receipt")}
                className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-100 flex flex-col items-center text-center justify-center gap-2 hover:bg-emerald-50 transition-all group hover:border-emerald-200"
              >
                <div className="p-2.5 bg-emerald-600 rounded-lg text-white group-hover:scale-105 transition-transform">
                  <Wallet className="h-[18px] w-[18px]" />
                </div>
                <span className="text-xs font-extrabold text-emerald-900">New Receipt</span>
                <span className="text-[10px] text-emerald-400">Record payments received</span>
              </button>

              <button
                onClick={() => handleQuickLink("payment")}
                className="p-4 bg-red-50/40 rounded-xl border border-red-100 flex flex-col items-center text-center justify-center gap-2 hover:bg-red-50 transition-all group hover:border-red-200"
              >
                <div className="p-2.5 bg-red-600 rounded-lg text-white group-hover:scale-105 transition-transform">
                  <TrendingDown className="h-[18px] w-[18px]" />
                </div>
                <span className="text-xs font-extrabold text-red-900">New Payment</span>
                <span className="text-[10px] text-red-400">Record payments made</span>
              </button>

              <button
                onClick={() => handleQuickLink("journal")}
                className="p-4 bg-purple-50/40 rounded-xl border border-purple-100 flex flex-col items-center text-center justify-center gap-2 hover:bg-purple-50 transition-all group hover:border-purple-200"
              >
                <div className="p-2.5 bg-purple-600 rounded-lg text-white group-hover:scale-105 transition-transform">
                  <FileText className="h-[18px] w-[18px]" />
                </div>
                <span className="text-xs font-extrabold text-purple-900">New Journal</span>
                <span className="text-[10px] text-purple-400">Adjusting entries</span>
              </button>

              <button
                onClick={() => handleQuickLink("reports")}
                className="p-4 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center text-center justify-center gap-2 hover:bg-slate-150 transition-all group"
              >
                <div className="p-2.5 bg-slate-700 rounded-lg text-white group-hover:scale-105 transition-transform">
                  <FolderOpen className="h-[18px] w-[18px]" />
                </div>
                <span className="text-xs font-extrabold text-slate-900">View Reports</span>
                <span className="text-[10px] text-slate-400">Financial statements</span>
              </button>
            </div>
          </Card>
        </div>

        {/* ALERTS & EXPOSURES */}
        <div className="flex flex-col gap-6">
          <Card title="Alerts & Notifications" subtitle="Items requiring your attention" border>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-72 pr-1.5">
              {activeAlerts.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-gray-400 flex flex-col items-center justify-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-full text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <span>Audit exceptions clear. Everything looks pristine!</span>
                </div>
              ) : (
                activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border flex flex-col gap-2.5 leading-none text-xs transition-shadow hover:shadow-sm
                      ${alert.type === "error" ? "bg-red-50/45 border-red-150 text-red-950" : ""}
                      ${alert.type === "warning" ? "bg-amber-50/45 border-amber-150 text-amber-950" : ""}
                      ${alert.type === "info" ? "bg-blue-50/45 border-blue-150 text-blue-950" : ""}
                    `}
                  >
                    <div className="flex items-start gap-2">
                      <div className="shrink-0 mt-0.5">
                        {alert.type === "error" && <ShieldAlert className="h-4 w-4 text-red-655" />}
                        {alert.type === "warning" && (
                          <AlertTriangle className="h-4 w-4 text-amber-655" />
                        )}
                        {alert.type === "info" && (
                          <AlertTriangle className="h-4 w-4 text-blue-650" />
                        )}
                      </div>
                      <p className="font-bold leading-relaxed">{alert.message}</p>
                    </div>

                    <button
                      onClick={alert.onClick}
                      className={`text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded inline-flex items-center justify-center self-end transition-colors
                        ${alert.type === "error" ? "bg-red-100 hover:bg-red-200 text-red-900" : ""}
                        ${alert.type === "warning" ? "bg-amber-100 hover:bg-amber-200 text-amber-900" : ""}
                        ${alert.type === "info" ? "bg-blue-100 hover:bg-blue-200 text-blue-900" : ""}
                      `}
                    >
                      {alert.actionText}
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* MID PANEL CHART VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (Col span 2) */}
        <div className="lg:col-span-2">
          <Card title="Sales vs Purchases — Monthly Trend" subtitle="Current fiscal year" border>
            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height={isMobile ? 180 : 300}>
                <BarChart
                  data={monthlyTrendData}
                  margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <RechartsTooltip
                    formatter={(value) => [`Rs. ${formatNumber(value as number)}`, undefined]}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar
                    dataKey="sales"
                    name="Cash & Credit Sales Output"
                    fill="#1d4ed8"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                    onClick={() => setCurrentPage("sales-register")}
                    cursor="pointer"
                  />
                  <Bar
                    dataKey="purchases"
                    name="Inventory Purchase Input"
                    fill="#ea580c"
                    radius={[4, 4, 0, 0]}
                    barSize={20}
                    onClick={() => setCurrentPage("purchase-register")}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Expenses Pie breakdown */}
        <div>
          <Card title="Expense Breakdown" subtitle="By category" border>
            <div className="h-72 w-full flex flex-col items-center justify-center">
              {expenseBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                  No expense data for this period
                </div>
              ) : (
                <>
                  <div className="h-56 w-full relative">
                    <ResponsiveContainer width="100%" height={isMobile ? 180 : 300}>
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value) => [`Rs. ${formatNumber(value as number)}`, undefined]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie labels custom legends */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-2 max-h-16 overflow-y-auto">
                    {expenseBreakdown.slice(0, 5).map((entry, i) => (
                      <div
                        key={entry.name}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500"
                      >
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        ></span>
                        <span className="truncate max-w-[90px]">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* BANK CODES SUB PANELS */}
      <Card title="Bank & Cash Balances" subtitle="Current balances" border>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bankAndCashAccounts.length === 0 ? (
            <div className="py-4 text-center text-xs text-gray-400 font-bold block col-span-full">
              No registered bank accounts found. Configure your financial settings page.
            </div>
          ) : (
            bankAndCashAccounts.map((acct) => (
              <div
                key={acct.id}
                className="p-4 bg-slate-50 border border-gray-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center justify-between"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-gray-400 font-bold tracking-normal uppercase">
                    {acct.code || "COA"}
                  </span>
                  <span className="text-xs font-bold text-slate-800 truncate mt-0.5">
                    {acct.name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono text-xs font-bold block ${acct.balance >= 0 ? "text-blue-700" : "text-red-500"}`}
                  >
                    {formatCurrency(acct.balance)}
                  </span>
                  <span className="text-[10px] mt-0.5 bg-blue-50 text-blue-700 font-extrabold px-1.5 py-0.5 rounded leading-none inline-block">
                    {acct.balance >= 0 ? "Active" : "Overdrawn"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* BOTTOM PANEL: RECENT POSTED VOUCHERS TABLE */}
      <Card
        title="Recent Vouchers"
        subtitle="Last 10 posted entries"
        border
        padding="none"
        action={
          <button
            onClick={() => setCurrentPage("vouchers")}
            className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
          >
            Voucher Register
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[12%]">
                  Date (BS)
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[15%]">
                  Voucher Code
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[13%]">
                  Voucher Type
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[35%]">
                  Primary Narration
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[12.5%]">
                  Debit Balance
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-[12.5%]">
                  Credit Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentVouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-2.5 text-center text-xs text-gray-400 font-semibold"
                  >
                    No vouchers found. Start by creating a journal entry or invoice.
                  </td>
                </tr>
              ) : (
                recentVouchers.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setEditingVoucherId(v.id);
                      setCurrentPage("vouchers-new");
                    }}
                    className="hover:bg-slate-50/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">
                      {v.dateNepali || v.date}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-semibold">
                      {v.voucherNo}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                        {v.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 max-w-[280px] truncate">
                      {v.narration}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[12px] text-gray-700">
                      {v.totalDebit > 0 ? formatCurrency(v.totalDebit) : "-"}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-right text-[12px] text-gray-700">
                      {v.totalCredit > 0 ? formatCurrency(v.totalCredit) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
