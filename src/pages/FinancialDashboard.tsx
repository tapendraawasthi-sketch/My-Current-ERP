// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, AlertTriangle, CheckCircle, BarChart2,
  PieChart, Activity, ArrowUpRight, ArrowDownRight,
  Calendar, Download, RefreshCw, Target, Zap,
  CreditCard, FileText, Clock, Shield
} from "lucide-react";
import * as XLSX from "xlsx";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number): string {
  if (Math.abs(n) >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (Math.abs(n) >= 100000)   return (n / 100000).toFixed(2) + " L";
  if (Math.abs(n) >= 1000)     return (n / 1000).toFixed(1) + " K";
  return fmt(n);
}
function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 1000) / 10 : 0;
}

// ── Account classifiers ────────────────────────────────────────────────────
const kw = {
  sales:      ["sales","revenue","turnover","income","service income"],
  purchase:   ["purchase","cost of goods","cogs","raw material"],
  expense:    ["expense","salary","wages","rent","utility","depreciation","interest paid","insurance","marketing","transport"],
  asset:      ["asset","fixed asset","property","equipment","receivable","debtor","cash","bank","inventory","stock","prepaid"],
  liability:  ["liability","payable","creditor","loan","overdraft","tax payable","vat payable"],
  equity:     ["equity","capital","reserve","retained"],
  currentAsset: ["cash","bank","receivable","debtor","inventory","stock","prepaid","current asset"],
  currentLiab:  ["payable","creditor","short term","current liab","vat payable","tax payable"],
  cash:       ["cash","petty cash"],
  bank:       ["bank","current account","savings account"],
  debtor:     ["receivable","debtor","sundry debtor"],
  creditor:   ["payable","creditor","sundry creditor"],
};

function matchKw(name: string, grp: string, keys: string[]): boolean {
  const s = (name + " " + grp).toLowerCase();
  return keys.some(k => s.includes(k));
}

export default function FinancialDashboard() {
  const {
    accounts = [], vouchers = [], stockItems = [],
    stockMovements = [], fixedAssets = [],
    employees = [], payrollRuns = [],
    approvalRequests = [], pdcRegister = [],
    recurringTemplates = [],
    currentFiscalYear, companySettings,
  } = useStore();

  const [period, setPeriod] = useState<"month" | "quarter" | "ytd" | "custom">("month");
  const [customFrom, setCustomFrom] = useState(new Date().getFullYear() + "-01-01");
  const [customTo,   setCustomTo]   = useState(new Date().toISOString().slice(0, 10));
  const [drillDown, setDrillDown]   = useState<string | null>(null);

  // ── Compute date range ────────────────────────────────────────────────────
  const { fromDate, toDate, prevFrom, prevTo } = useMemo(() => {
    const today = new Date();
    const yyyy  = today.getFullYear();
    const mm    = today.getMonth();
    const dd    = today.getDate();

    let from: Date, to: Date, pf: Date, pt: Date;

    if (period === "month") {
      from = new Date(yyyy, mm, 1);
      to   = new Date(yyyy, mm, dd);
      pf   = new Date(yyyy, mm - 1, 1);
      pt   = new Date(yyyy, mm - 1, dd);
    } else if (period === "quarter") {
      const q = Math.floor(mm / 3);
      from = new Date(yyyy, q * 3, 1);
      to   = today;
      pf   = new Date(yyyy, (q - 1) * 3, 1);
      pt   = new Date(yyyy, q * 3, 0);
    } else if (period === "ytd") {
      const fyStart = currentFiscalYear?.startDate
        ? new Date(currentFiscalYear.startDate)
        : new Date(yyyy, 3, 1); // April 1 for Nepal FY
      from = fyStart;
      to   = today;
      pf   = new Date(fyStart.getFullYear() - 1, fyStart.getMonth(), fyStart.getDate());
      pt   = new Date(from.getTime() - 1);
    } else {
      from = new Date(customFrom);
      to   = new Date(customTo);
      const diff = to.getTime() - from.getTime();
      pf   = new Date(from.getTime() - diff);
      pt   = new Date(from.getTime() - 1);
    }

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return { fromDate: iso(from), toDate: iso(to), prevFrom: iso(pf), prevTo: iso(pt) };
  }, [period, customFrom, customTo, currentFiscalYear]);

  // ── Filter vouchers ───────────────────────────────────────────────────────
  const curVouchers  = useMemo(() => vouchers.filter(v => v.date >= fromDate && v.date <= toDate),  [vouchers, fromDate, toDate]);
  const prevVouchers = useMemo(() => vouchers.filter(v => v.date >= prevFrom && v.date <= prevTo), [vouchers, prevFrom, prevTo]);

  // ── Sum by keyword classification ─────────────────────────────────────────
  function sumByKw(voucherList: any[], keys: string[]): number {
    let total = 0;
    voucherList.forEach(v => {
      (v.entries || v.lineItems || []).forEach((e: any) => {
        const acc = accounts.find((a: any) => String(a.id) === String(e.accountId || e.ledgerId));
        if (!acc) return;
        if (matchKw(acc.name || "", acc.group || acc.accountGroup || "", keys)) {
          total += Math.abs(e.amount || e.debit || e.credit || 0);
        }
      });
    });
    return total;
  }

  // ── Balance at date ───────────────────────────────────────────────────────
  function balanceByKw(upToDate: string, keys: string[]): number {
    let total = 0;
    vouchers.filter(v => v.date <= upToDate).forEach(v => {
      (v.entries || v.lineItems || []).forEach((e: any) => {
        const acc = accounts.find((a: any) => String(a.id) === String(e.accountId || e.ledgerId));
        if (!acc) return;
        if (matchKw(acc.name || "", acc.group || acc.accountGroup || "", keys)) {
          total += (e.debit || 0) - (e.credit || 0);
        }
      });
    });
    return Math.abs(total);
  }

  // ── Core P&L metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const revenue      = sumByKw(curVouchers,  kw.sales);
    const prevRevenue  = sumByKw(prevVouchers, kw.sales);
    const purchases    = sumByKw(curVouchers,  kw.purchase);
    const expenses     = sumByKw(curVouchers,  kw.expense);
    const grossProfit  = revenue - purchases;
    const netProfit    = grossProfit - expenses;
    const grossMargin  = pct(grossProfit, revenue);
    const netMargin    = pct(netProfit, revenue);
    const revenueGrowth = pct(revenue - prevRevenue, prevRevenue || 1);

    const totalAssets      = balanceByKw(toDate, kw.asset);
    const totalLiabilities = balanceByKw(toDate, kw.liability);
    const equity           = totalAssets - totalLiabilities;
    const currentAssets    = balanceByKw(toDate, kw.currentAsset);
    const currentLiabs     = balanceByKw(toDate, kw.currentLiab);
    const currentRatio     = currentLiabs > 0 ? Math.round((currentAssets / currentLiabs) * 100) / 100 : 0;
    const cashBalance      = balanceByKw(toDate, kw.cash);
    const bankBalance      = balanceByKw(toDate, kw.bank);
    const totalReceivables = balanceByKw(toDate, kw.debtor);
    const totalPayables    = balanceByKw(toDate, kw.creditor);
    const debtToEquity     = equity > 0 ? Math.round((totalLiabilities / equity) * 100) / 100 : 0;
    const returnOnAssets   = totalAssets > 0 ? pct(netProfit, totalAssets) : 0;
    const returnOnEquity   = equity > 0 ? pct(netProfit, equity) : 0;

    const stockValue = (stockItems || []).reduce((s: number, item: any) => {
      const rate = item.valuationRate || item.purchaseRate || 0;
      const qty  = item.closingQty || item.openingQty || 0;
      return s + rate * qty;
    }, 0);

    return {
      revenue, prevRevenue, revenueGrowth,
      purchases, expenses, grossProfit, netProfit,
      grossMargin, netMargin,
      totalAssets, totalLiabilities, equity,
      currentAssets, currentLiabs, currentRatio,
      cashBalance, bankBalance, totalReceivables, totalPayables,
      debtToEquity, returnOnAssets, returnOnEquity,
      stockValue,
    };
  }, [curVouchers, prevVouchers, accounts, toDate]);

  // ── Monthly revenue chart data (last 6 months) ────────────────────────────
  const monthlyData = useMemo(() => {
    const months: { label: string; from: string; to: string }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const from = d.toISOString().slice(0, 10);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const to = last.toISOString().slice(0, 10);
      months.push({
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        from, to,
      });
    }
    return months.map(m => {
      const mv = vouchers.filter(v => v.date >= m.from && v.date <= m.to);
      return {
        label: m.label,
        revenue:  sumByKw(mv, kw.sales),
        expense:  sumByKw(mv, kw.expense),
        profit:   sumByKw(mv, kw.sales) - sumByKw(mv, kw.purchase) - sumByKw(mv, kw.expense),
      };
    });
  }, [vouchers, accounts]);

  const maxMonthlyRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  // ── Operational alerts ────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { type: "error" | "warning" | "info"; message: string }[] = [];
    const pendingApprovals = approvalRequests.filter(r => r.status === "pending").length;
    if (pendingApprovals > 0) list.push({ type: "warning", message: `${pendingApprovals} voucher(s) pending approval` });

    const overduePDC = (pdcRegister || []).filter((p: any) => {
      const d = new Date(p.chequeDate || p.dueDate || "");
      return d < new Date() && (p.status === "pending" || p.status === "received");
    }).length;
    if (overduePDC > 0) list.push({ type: "error", message: `${overduePDC} post-dated cheque(s) overdue` });

    const dueRecurring = (recurringTemplates || []).filter((t: any) => {
      if (!t.isActive) return false;
      const days = Math.round((new Date(t.nextDueDate).getTime() - Date.now()) / 86400000);
      return days <= (t.reminderDaysBefore || 3);
    }).length;
    if (dueRecurring > 0) list.push({ type: "warning", message: `${dueRecurring} recurring voucher(s) due for posting` });

    if (metrics.currentRatio > 0 && metrics.currentRatio < 1) {
      list.push({ type: "error", message: `Current ratio ${metrics.currentRatio} below 1 – liquidity risk` });
    }
    if (metrics.netMargin < 0) {
      list.push({ type: "error", message: `Net margin negative (${metrics.netMargin}%) – business is loss-making` });
    }
    if (metrics.totalReceivables > metrics.revenue * 0.3) {
      list.push({ type: "warning", message: "Receivables >30% of revenue – review collection" });
    }
    if (list.length === 0) list.push({ type: "info", message: "All key indicators are healthy." });
    return list;
  }, [approvalRequests, pdcRegister, recurringTemplates, metrics]);

  // ── Export dashboard snapshot ─────────────────────────────────────────────
  const exportSnapshot = () => {
    const data = [
      { "Metric": "Revenue",            "Value": metrics.revenue },
      { "Metric": "Gross Profit",        "Value": metrics.grossProfit },
      { "Metric": "Net Profit",          "Value": metrics.netProfit },
      { "Metric": "Gross Margin %",      "Value": metrics.grossMargin },
      { "Metric": "Net Margin %",        "Value": metrics.netMargin },
      { "Metric": "Revenue Growth %",    "Value": metrics.revenueGrowth },
      { "Metric": "Total Assets",        "Value": metrics.totalAssets },
      { "Metric": "Total Liabilities",   "Value": metrics.totalLiabilities },
      { "Metric": "Equity",              "Value": metrics.equity },
      { "Metric": "Current Ratio",       "Value": metrics.currentRatio },
      { "Metric": "Cash Balance",        "Value": metrics.cashBalance },
      { "Metric": "Bank Balance",        "Value": metrics.bankBalance },
      { "Metric": "Total Receivables",   "Value": metrics.totalReceivables },
      { "Metric": "Total Payables",      "Value": metrics.totalPayables },
      { "Metric": "Debt to Equity",      "Value": metrics.debtToEquity },
      { "Metric": "Return on Assets %",  "Value": metrics.returnOnAssets },
      { "Metric": "Return on Equity %",  "Value": metrics.returnOnEquity },
      { "Metric": "Stock Value",         "Value": metrics.stockValue },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dashboard Snapshot");
    XLSX.writeFile(wb, `FinancialDashboard_${fromDate}_to_${toDate}.xlsx`);
  };

  // ── KPI card component ────────────────────────────────────────────────────
  function KPICard({
    label, value, sub, trend, trendValue, color, icon: Icon, drillKey, prefix = "NPR"
  }: any) {
    const isPositiveTrend = trendValue >= 0;
    return (
      <div
        onClick={() => drillKey && setDrillDown(drillDown === drillKey ? null : drillKey)}
        className={`bg-white rounded-2xl shadow-sm border p-5 transition-all ${
          drillKey ? "cursor-pointer hover:shadow-md hover:border-blue-200" : ""
        } ${drillDown === drillKey ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}>
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl bg-${color}-50`}>
            <Icon className={`w-5 h-5 text-${color}-600`}/>
          </div>
          {trendValue !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${isPositiveTrend?"text-green-600":"text-red-600"}`}>
              {isPositiveTrend
                ? <ArrowUpRight className="w-3.5 h-3.5"/>
                : <ArrowDownRight className="w-3.5 h-3.5"/>}
              {Math.abs(trendValue)}%
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-gray-800 font-mono">{value}</div>
        <div className="text-xs font-medium text-gray-500 mt-1">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financial Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {companySettings?.name || "Company"} · {fromDate} to {toDate}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["month","quarter","ytd","custom"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium uppercase transition-all ${
                  period === p ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
                {p}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <>
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
              <input type="date" value={customTo}   onChange={e=>setCustomTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"/>
            </>
          )}
          <button onClick={exportSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700">
            <Download className="w-3.5 h-3.5"/> Export
          </button>
        </div>
      </div>

      {/* ── ALERTS BANNER ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
            a.type==="error"   ? "bg-red-50 border-red-200 text-red-700" :
            a.type==="warning" ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
            "bg-green-50 border-green-200 text-green-700"}`}>
            {a.type==="error"   ? <AlertTriangle className="w-4 h-4 flex-shrink-0"/> :
             a.type==="warning" ? <Clock className="w-4 h-4 flex-shrink-0"/> :
             <CheckCircle className="w-4 h-4 flex-shrink-0"/>}
            {a.message}
          </div>
        ))}
      </div>

      {/* ── P&L KPI CARDS ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Income Statement</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Revenue" value={fmtShort(metrics.revenue)}
            sub={`Prev: ${fmtShort(metrics.prevRevenue)}`}
            trendValue={metrics.revenueGrowth} color="green" icon={TrendingUp} drillKey="revenue"/>
          <KPICard label="Gross Profit" value={fmtShort(metrics.grossProfit)}
            sub={`Margin: ${metrics.grossMargin}%`}
            color="blue" icon={BarChart2} drillKey="gross-profit"/>
          <KPICard label="Total Expenses" value={fmtShort(metrics.expenses)}
            color="orange" icon={TrendingDown} drillKey="expenses"/>
          <KPICard label="Net Profit / (Loss)" value={fmtShort(metrics.netProfit)}
            sub={`Margin: ${metrics.netMargin}%`}
            trendValue={metrics.netMargin} color={metrics.netProfit>=0?"teal":"red"} icon={Activity} drillKey="net-profit"/>
        </div>
      </div>

      {/* ── BALANCE SHEET KPIs ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Balance Sheet</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Total Assets"      value={fmtShort(metrics.totalAssets)}      color="blue"   icon={DollarSign}/>
          <KPICard label="Total Liabilities" value={fmtShort(metrics.totalLiabilities)} color="red"    icon={CreditCard}/>
          <KPICard label="Equity"            value={fmtShort(metrics.equity)}           color="purple" icon={Shield}/>
          <KPICard label="Stock Value"       value={fmtShort(metrics.stockValue)}       color="amber"  icon={Package}/>
        </div>
      </div>

      {/* ── LIQUIDITY & RATIO KPIs ────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Liquidity & Ratios</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Cash Balance" value={fmtShort(metrics.cashBalance)}
            color="green" icon={DollarSign} drillKey="cash"/>
          <KPICard label="Bank Balance" value={fmtShort(metrics.bankBalance)}
            color="teal" icon={CreditCard} drillKey="bank"/>
          <KPICard label="Receivables"  value={fmtShort(metrics.totalReceivables)}
            color="blue" icon={Users} drillKey="receivables"/>
          <KPICard label="Payables"     value={fmtShort(metrics.totalPayables)}
            color="orange" icon={FileText} drillKey="payables"/>
          <KPICard label="Current Ratio" value={metrics.currentRatio.toFixed(2)}
            sub={metrics.currentRatio>=1?"Healthy":"Below 1 – Risk"} color={metrics.currentRatio>=1?"green":"red"} icon={Zap}/>
          <KPICard label="Debt/Equity"   value={metrics.debtToEquity.toFixed(2)}
            color="purple" icon={BarChart2}/>
          <KPICard label="Return on Assets" value={metrics.returnOnAssets + "%"}
            color="blue" icon={Target}/>
          <KPICard label="Return on Equity" value={metrics.returnOnEquity + "%"}
            color="green" icon={TrendingUp}/>
        </div>
      </div>

      {/* ── OPERATIONS KPIs ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Active Employees"    value={employees.filter((e:any)=>e.isActive).length}  color="blue"   icon={Users}/>
          <KPICard label="Last Payroll Gross"  value={fmtShort(payrollRuns.slice(-1)[0]?.totalGross||0)} color="green" icon={DollarSign}/>
          <KPICard label="Pending Approvals"   value={approvalRequests.filter(r=>r.status==="pending").length} color="yellow" icon={Clock}/>
          <KPICard label="Overdue PDC"         value={(pdcRegister||[]).filter((p:any)=>{
            const d = new Date(p.chequeDate||p.dueDate||"");
            return d < new Date() && (p.status==="pending"||p.status==="received");
          }).length} color="red" icon={AlertTriangle}/>
        </div>
      </div>

      {/* ── CHARTS ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue vs Expense bar chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-600"/> Revenue vs Expense (Last 6 Months)
          </h3>
          <div className="flex items-end gap-2 h-36">
            {monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end h-28">
                  <div
                    className="flex-1 bg-blue-400 rounded-t-sm transition-all"
                    style={{ height: `${pct(m.revenue, maxMonthlyRevenue)}%`, minHeight: m.revenue > 0 ? "4px" : "0" }}
                    title={`Revenue: ${fmt(m.revenue)}`}/>
                  <div
                    className="flex-1 bg-orange-300 rounded-t-sm transition-all"
                    style={{ height: `${pct(m.expense, maxMonthlyRevenue)}%`, minHeight: m.expense > 0 ? "4px" : "0" }}
                    title={`Expense: ${fmt(m.expense)}`}/>
                </div>
                <div className="text-xs text-gray-400">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-400 rounded inline-block"/>Revenue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-orange-300 rounded inline-block"/>Expense</span>
          </div>
        </div>

        {/* P&L donut-style summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-green-600"/> Cost Structure
          </h3>
          <div className="space-y-3">
            {[
              { label: "Cost of Goods Sold", value: metrics.purchases, color: "bg-blue-400",   pct: pct(metrics.purchases, metrics.revenue) },
              { label: "Operating Expenses",  value: metrics.expenses,  color: "bg-orange-400", pct: pct(metrics.expenses,  metrics.revenue) },
              { label: "Net Profit",          value: metrics.netProfit, color: metrics.netProfit>=0?"bg-green-500":"bg-red-400",
                pct: Math.abs(pct(metrics.netProfit, metrics.revenue)) },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>{item.label}</span>
                  <span className="font-medium">{fmtShort(item.value)} ({item.pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${item.color}`}
                    style={{ width: `${Math.min(Math.abs(item.pct), 100)}%` }}/>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">
            Revenue base: {fmtShort(metrics.revenue)}
          </div>
        </div>
      </div>

      {/* ── DRILL DOWN PANEL ──────────────────────────────────────────────── */}
      {drillDown && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700 capitalize flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600"/> Drill-Down: {drillDown.replace(/-/g," ")}
            </h3>
            <button onClick={() => setDrillDown(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Date","Voucher","Account","Debit","Credit","Narration"]
                    .map(h=><th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(() => {
                  const kwMap: Record<string, string[]> = {
                    revenue: kw.sales, expenses: kw.expense,
                    "gross-profit": kw.purchase, "net-profit": kw.expense,
                    cash: kw.cash, bank: kw.bank,
                    receivables: kw.debtor, payables: kw.creditor,
                  };
                  const drillKw = kwMap[drillDown] || kw.sales;
                  const rows: any[] = [];
                  curVouchers.forEach(v => {
                    (v.entries || v.lineItems || []).forEach((e: any) => {
                      const acc = accounts.find((a: any) => String(a.id) === String(e.accountId || e.ledgerId));
                      if (!acc) return;
                      if (!matchKw(acc.name||"", acc.group||acc.accountGroup||"", drillKw)) return;
                      rows.push({
                        date: v.date,
                        voucher: v.type || v.voucherType || "—",
                        account: acc.name,
                        debit: e.debit || (e.amount > 0 ? e.amount : 0),
                        credit: e.credit || (e.amount < 0 ? Math.abs(e.amount) : 0),
                        narration: v.narration || v.description || "—",
                      });
                    });
                  });
                  return rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{r.date}</td>
                      <td className="px-3 py-2 capitalize text-xs">{r.voucher}</td>
                      <td className="px-3 py-2 font-medium text-gray-700">{r.account}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{r.debit>0?fmt(r.debit):"—"}</td>
                      <td className="px-3 py-2 text-right text-green-700">{r.credit>0?fmt(r.credit):"—"}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 max-w-48 truncate">{r.narration}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-gray-400 text-right">Showing up to 50 transactions. Use dedicated reports for full detail.</div>
        </div>
      )}

      {/* ── QUICK LINKS ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Navigation</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Trial Balance",    page: "trial-balance",       icon: FileText,   color: "blue"   },
            { label: "P&L Statement",    page: "profit-loss",         icon: TrendingUp,  color: "green"  },
            { label: "Balance Sheet",    page: "balance-sheet",       icon: BarChart2,   color: "purple" },
            { label: "Cash Flow",        page: "cash-flow",           icon: DollarSign,  color: "teal"   },
            { label: "Stock Summary",    page: "stock-summary",       icon: Package,     color: "orange" },
            { label: "Ratio Analysis",   page: "ratio-analysis",      icon: Activity,    color: "indigo" },
            { label: "Payroll",          page: "payroll",             icon: Users,       color: "blue"   },
            { label: "Fixed Assets",     page: "fixed-assets",        icon: Target,      color: "amber"  },
            { label: "VAT Compliance",   page: "statutory-compliance",icon: Shield,      color: "red"    },
            { label: "Approvals",        page: "approval-workflow",   icon: CheckCircle, color: "yellow" },
            { label: "Budget vs Actual", page: "budget-vs-actual",    icon: BarChart2,   color: "purple" },
            { label: "Recurring",        page: "recurring-vouchers",  icon: RefreshCw,   color: "green"  },
          ].map(link => (
            <button key={link.page}
              onClick={() => {
                // Trigger navigation via the store's setCurrentPage or dispatch a custom event
                const event = new CustomEvent("navigate", { detail: link.page });
                window.dispatchEvent(event);
              }}
              className={`flex flex-col items-center gap-2 p-3 bg-${link.color}-50 border border-${link.color}-100 rounded-xl hover:shadow-md hover:border-${link.color}-300 transition-all text-center`}>
              <link.icon className={`w-5 h-5 text-${link.color}-600`}/>
              <span className={`text-xs font-medium text-${link.color}-700`}>{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
