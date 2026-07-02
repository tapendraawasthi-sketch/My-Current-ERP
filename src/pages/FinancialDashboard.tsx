// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import {
  AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Wallet,
  Landmark, Users, Package, RefreshCw, FileSpreadsheet,
} from "lucide-react";
import { getBSTodayLong } from "../lib/nepaliDate";

function money(n: number): string {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  return `${sign}Rs. ${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function groupLower(a: any): string {
  return (a?.group || a?.groupName || "").toString().toLowerCase();
}

const FinancialDashboard: React.FC = () => {
  const { accounts, vouchers, invoices, items, parties, stockMovements, companySettings, currentFiscalYear } =
    useStore();

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(true);

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 8) + "01";
  const fyStart = currentFiscalYear?.startDate || `${today.slice(0, 4)}-07-16`;

  // ── Section 14.2: Today's activity digest ──
  const todaysVouchers = useMemo(() => (vouchers || []).filter((v: any) => v.date === today && v.status === "posted"), [vouchers, today]);
  const todaysInvoices = useMemo(() => (invoices || []).filter((i: any) => i.date === today && i.status === "posted"), [invoices, today]);
  const todaysReceipts = useMemo(() => todaysVouchers.filter((v: any) => v.type === "receipt"), [todaysVouchers]);
  const todaysPayments = useMemo(() => todaysVouchers.filter((v: any) => v.type === "payment"), [todaysVouchers]);
  const netCashFlowToday = useMemo(
    () => todaysReceipts.reduce((s, v: any) => s + (v.grandTotal || v.totalDebit || 0), 0)
      - todaysPayments.reduce((s, v: any) => s + (v.grandTotal || v.totalDebit || 0), 0),
    [todaysReceipts, todaysPayments],
  );

  // ── Section 2.3: Today's Net Profit / MTD Profit / AR-AP / Cash&Bank ──
  const computeProfitForPeriod = (fromDate: string) => {
    const salesInv = (invoices || []).filter(
      (i: any) => i.status === "posted" && i.date >= fromDate && i.date <= today && (i.type === "sales-invoice"),
    );
    const purchInv = (invoices || []).filter(
      (i: any) => i.status === "posted" && i.date >= fromDate && i.date <= today && (i.type === "purchase-invoice"),
    );
    const revenue = salesInv.reduce((s, i: any) => s + (i.grandTotal || 0), 0);
    const cogs = purchInv.reduce((s, i: any) => s + (i.grandTotal || 0), 0);
    const gross = revenue - cogs;
    return { revenue, cogs, gross };
  };

  const todayProfit = useMemo(() => computeProfitForPeriod(today), [invoices, today]);
  const mtdProfit = useMemo(() => computeProfitForPeriod(monthStart), [invoices, monthStart, today]);
  const ytdProfit = useMemo(() => computeProfitForPeriod(fyStart), [invoices, fyStart, today]);

  const receivables = useMemo(
    () =>
      (invoices || [])
        .filter((i: any) => i.type === "sales-invoice" && i.status === "posted" && (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"))
        .reduce((s, i: any) => s + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0),
    [invoices],
  );
  const payables = useMemo(
    () =>
      (invoices || [])
        .filter((i: any) => i.type === "purchase-invoice" && i.status === "posted" && (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"))
        .reduce((s, i: any) => s + ((i.grandTotal || 0) - (i.paidAmount || 0)), 0),
    [invoices],
  );
  const netArAp = receivables - payables;

  const cashBankBalance = useMemo(() => {
    const cash = (accounts || []).filter((a: any) => groupLower(a).includes("cash") && !a.isGroup);
    const bank = (accounts || []).filter((a: any) => groupLower(a).includes("bank") && !a.isGroup);
    return [...cash, ...bank].reduce((s, a: any) => s + (a.balance || 0), 0);
  }, [accounts]);

  // ── Section 2.4: Balance Sheet Snapshot ──
  const balanceSheet = useMemo(() => {
    const live = (accounts || []).filter((a: any) => !a.isGroup);
    const currentAssets = live.filter((a: any) => groupLower(a).includes("current asset")).reduce((s, a: any) => s + (a.balance || 0), 0);
    const fixedAssets = live.filter((a: any) => groupLower(a).includes("fixed asset")).reduce((s, a: any) => s + (a.balance || 0), 0);
    const currentLiabilities = live.filter((a: any) => groupLower(a).includes("current liab")).reduce((s, a: any) => s + (a.balance || 0), 0);
    const longTermLiabilities = live.filter((a: any) => groupLower(a).includes("loan") || groupLower(a).includes("long term")).reduce((s, a: any) => s + (a.balance || 0), 0);
    const equity = live.filter((a: any) => groupLower(a).includes("capital") || groupLower(a).includes("equity")).reduce((s, a: any) => s + (a.balance || 0), 0);
    return {
      currentAssets, fixedAssets, totalAssets: currentAssets + fixedAssets,
      currentLiabilities, longTermLiabilities, equity,
      totalLiabEquity: currentLiabilities + longTermLiabilities + equity,
    };
  }, [accounts]);

  // ── Section 2.6: Monthly chart data via recharts ──
  const chartData = useMemo(() => {
    const months: { key: string; label: string }[] = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push({ key: dt.toISOString().slice(0, 7), label: dt.toLocaleDateString("en-US", { month: "short" }) });
    }
    return months.map(({ key, label }) => {
      const sales = (invoices || [])
        .filter((i: any) => i.type === "sales-invoice" && i.status === "posted" && i.date?.startsWith(key))
        .reduce((s, i: any) => s + (i.grandTotal || 0), 0);
      const expenses = (invoices || [])
        .filter((i: any) => i.type === "purchase-invoice" && i.status === "posted" && i.date?.startsWith(key))
        .reduce((s, i: any) => s + (i.grandTotal || 0), 0);
      return { month: label, Sales: sales, Expenses: expenses, Net: sales - expenses };
    });
  }, [invoices]);

  // ── Section 2.9: Stock alerts (collapsible banner, not full widget) ──
  const reorderAlerts = useMemo(() => {
    return (items || []).filter((item: any) => {
      const reorderQty = item.reorderLevel || item.minStockLevel || 0;
      if (reorderQty <= 0) return false;
      const currentStock = (stockMovements || [])
        .filter((m: any) => m.itemId === item.id)
        .reduce((s: number, m: any) => {
          const qty = Number(m.quantity || m.qty || 0);
          const t = String(m.type || "").toLowerCase();
          return t.includes("in") ? s + qty : s - qty;
        }, 0);
      return currentStock <= reorderQty;
    });
  }, [items, stockMovements]);

  // ── Section 2.8: Aging buckets (horizontal proportional bars) ──
  const agingBuckets = useMemo(() => {
    const buckets = [
      { label: "0-30", from: 0, to: 30, amount: 0, color: "#22c55e" },
      { label: "31-60", from: 31, to: 60, amount: 0, color: "#f59e0b" },
      { label: "61-90", from: 61, to: 90, amount: 0, color: "#f97316" },
      { label: "90+", from: 91, to: Infinity, amount: 0, color: "#ef4444" },
    ];
    (invoices || [])
      .filter((i: any) => i.type === "sales-invoice" && i.status === "posted" && (i.paymentStatus === "unpaid" || i.paymentStatus === "partial"))
      .forEach((i: any) => {
        const balance = (i.grandTotal || 0) - (i.paidAmount || 0);
        if (balance <= 0) return;
        const days = Math.max(0, Math.floor((Date.now() - new Date(i.date).getTime()) / 86400000));
        const bucket = buckets.find((b) => days >= b.from && days <= b.to) || buckets[buckets.length - 1];
        bucket.amount += balance;
      });
    const total = buckets.reduce((s, b) => s + b.amount, 0) || 1;
    return { buckets, total };
  }, [invoices]);

  // ── Top customers this month ──
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    (invoices || [])
      .filter((i: any) => i.type === "sales-invoice" && i.status === "posted" && i.date >= monthStart)
      .forEach((i: any) => {
        map[i.partyName] = (map[i.partyName] || 0) + (i.grandTotal || 0);
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [invoices, monthStart]);

  // ── Section 2.10: Expense breakdown (collapsible) ──
  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    (accounts || []).filter((a: any) => !a.isGroup && groupLower(a).includes("expense")).forEach((a: any) => {
      map[a.group || "Other"] = (map[a.group || "Other"] || 0) + Math.abs(a.balance || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [accounts]);

  const companyName = companySettings?.companyNameEn || companySettings?.name || "Company";
  const bsDate = getBSTodayLong();
  const fyLabel = currentFiscalYear?.name || currentFiscalYear?.fiscalYearBS || "—";

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Section 2.2: Financial Date Banner (replaces the emoji greeting) */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-3">
        <div className="flex items-center gap-2 text-[13px] text-gray-700 flex-wrap">
          <span className="font-semibold text-gray-800">{bsDate}</span>
          <span className="text-gray-300">|</span>
          <span>AD: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
          <span className="text-gray-300">|</span>
          <span>FY {fyLabel}</span>
          <span className="text-gray-300">|</span>
          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Books Open
          </span>
        </div>
        <button className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Section 2.9: Alert banner (only when there are alerts) */}
      {reorderAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span>{reorderAlerts.length} item(s) below reorder level need attention</span>
          </div>
          <button
            onClick={() => setAlertsOpen((v) => !v)}
            className="text-[11px] font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
          >
            View Details {alertsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
      {reorderAlerts.length > 0 && alertsOpen && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 -mt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {reorderAlerts.slice(0, 8).map((item: any) => (
              <div key={item.id} className="text-[11px] text-gray-600 border border-gray-100 rounded px-2 py-1.5">
                {item.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 14.2: Today's Activity Digest */}
      <div className="bg-white border border-gray-200 rounded-lg px-5 py-2.5 flex items-center gap-6 text-[12px] flex-wrap">
        <span className="text-gray-500">Today's Activity:</span>
        <span className="text-gray-700">Vouchers Posted: <strong>{todaysVouchers.length}</strong></span>
        <span className="text-gray-700">Invoices: <strong>{todaysInvoices.length}</strong></span>
        <span className="text-gray-700">Receipts: <strong>{money(todaysReceipts.reduce((s: number, v: any) => s + (v.grandTotal || v.totalDebit || 0), 0))}</strong></span>
        <span className="text-gray-700">Payments: <strong>{money(todaysPayments.reduce((s: number, v: any) => s + (v.grandTotal || v.totalDebit || 0), 0))}</strong></span>
        <span className={netCashFlowToday >= 0 ? "text-green-700" : "text-red-600"}>
          Net Cash Flow Today: <strong>{money(netCashFlowToday)}</strong>
        </span>
      </div>

      {/* Section 2.3: KPI cards — Net Profit / MTD Profit / AR-AP / Cash&Bank */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Today's Net Profit</span>
            {todayProfit.gross >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
          </div>
          <div className={`text-[24px] font-bold ${todayProfit.gross >= 0 ? "text-green-600" : "text-red-600"}`}>{money(todayProfit.gross)}</div>
          <div className="text-[11px] text-gray-500 mt-1">Revenue: {money(todayProfit.revenue)} | COGS: {money(todayProfit.cogs)}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Month-to-Date Profit</span>
            <TrendingUp className="h-4 w-4 text-[#1557b0]" />
          </div>
          <div className="text-[24px] font-bold text-gray-800">{money(mtdProfit.gross)}</div>
          <div className="text-[11px] text-gray-500 mt-1">Revenue: {money(mtdProfit.revenue)} | COGS: {money(mtdProfit.cogs)}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Net AR/AP Position</span>
            <Landmark className="h-4 w-4 text-[#1557b0]" />
          </div>
          <div className={`text-[24px] font-bold ${netArAp >= 0 ? "text-green-600" : "text-red-600"}`}>{money(netArAp)}</div>
          <div className="text-[11px] text-gray-500 mt-1">Receivables: {money(receivables)} | Payables: {money(payables)}</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cash &amp; Bank Position</span>
            <Wallet className="h-4 w-4 text-[#1557b0]" />
          </div>
          <div className="text-[24px] font-bold text-gray-800">{money(cashBankBalance)}</div>
          <div className="text-[11px] text-gray-500 mt-1">Liquid assets available</div>
        </div>
      </div>

      {/* Section 2.4: Balance Sheet Snapshot */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-[13px] font-semibold text-gray-800 mb-4">Balance Sheet Summary as of Today</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Assets</div>
            {[
              ["Current Assets", balanceSheet.currentAssets],
              ["Fixed Assets", balanceSheet.fixedAssets],
            ].map(([label, val]: any) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-gray-100 text-[12px]">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-800">{money(val)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 text-[13px] font-bold text-gray-800">
              <span>Total Assets</span>
              <span>{money(balanceSheet.totalAssets)}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Liabilities &amp; Equity</div>
            {[
              ["Current Liabilities", balanceSheet.currentLiabilities],
              ["Long-term Liabilities", balanceSheet.longTermLiabilities],
              ["Equity / Capital", balanceSheet.equity],
            ].map(([label, val]: any) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-gray-100 text-[12px]">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-800">{money(val)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 text-[13px] font-bold text-gray-800">
              <span>Total Liabilities + Equity</span>
              <span>{money(balanceSheet.totalLiabEquity)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2.5: P&L Summary (YTD) */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-[13px] font-semibold text-gray-800 mb-4">Profit &amp; Loss Summary (Year to Date)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-[24px] font-bold text-gray-800">{money(ytdProfit.revenue)}</div>
            <div className="text-[11px] text-gray-500 mt-1">Total Revenue (FY to date)</div>
            <div className="text-[11px] text-gray-400 mt-0.5">This month: {money(mtdProfit.revenue)}</div>
          </div>
          <div>
            <div className="text-[24px] font-bold text-gray-800">{money(ytdProfit.cogs)}</div>
            <div className="text-[11px] text-gray-500 mt-1">Total Expenses (FY to date)</div>
            <div className="text-[11px] text-gray-400 mt-0.5">This month: {money(mtdProfit.cogs)}</div>
          </div>
          <div>
            <div className={`text-[24px] font-bold ${ytdProfit.gross >= 0 ? "text-green-600" : "text-red-600"}`}>{money(ytdProfit.gross)}</div>
            <div className="text-[11px] text-gray-500 mt-1">Net Profit (FY to date)</div>
            <div className="text-[11px] text-gray-400 mt-0.5">This month: {money(mtdProfit.gross)}</div>
          </div>
        </div>
      </div>

      {/* Section 2.6: recharts monthly bar chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-[13px] font-semibold text-gray-800 mb-3">Monthly Sales vs Expenses</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => money(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Sales" fill="#1557b0" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Section 2.8: Aging (proportional bars) + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-4">Receivables Aging</h3>
          <div className="space-y-3">
            {agingBuckets.buckets.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                  <span>{b.label} days</span>
                  <span className="font-medium">{money(b.amount)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(b.amount / agingBuckets.total) * 100}%`, background: b.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-[13px] font-semibold text-gray-800 mb-4">Top Customers This Month</h3>
          <table className="w-full text-[12px]">
            <tbody>
              {topCustomers.map(([name, total]) => (
                <tr key={name} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 text-gray-700">{name}</td>
                  <td className="py-2 text-right font-medium text-gray-800">{money(total)}</td>
                </tr>
              ))}
              {topCustomers.length === 0 && (
                <tr><td className="py-4 text-center text-gray-400" colSpan={2}>No sales recorded this month.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2.10: Expense breakdown, collapsible */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <button
          onClick={() => setExpenseOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-[13px] font-semibold text-gray-800"
        >
          Financial Insights: Expense Breakdown This Month
          {expenseOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </button>
        {expenseOpen && (
          <div className="px-5 pb-5 space-y-2">
            {expenseBreakdown.map(([label, amount]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-600 w-40 truncate">{label}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1557b0] rounded-full"
                    style={{ width: `${Math.min(100, (amount / (expenseBreakdown[0]?.[1] || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-medium text-gray-700 w-24 text-right">{money(amount)}</span>
              </div>
            ))}
            {expenseBreakdown.length === 0 && (
              <p className="text-[12px] text-gray-400">No expense data available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialDashboard;
