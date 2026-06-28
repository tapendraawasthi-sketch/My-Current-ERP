// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  CreditCard,
  DollarSign,
  Users,
  ShoppingCart,
  Bell,
  ArrowUp,
  ArrowDown,
  Star,
  Activity,
  CheckCircle,
  FileText,
  Clock,
  LayoutDashboard
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const cardClass = "bg-white border border-gray-200 rounded-md shadow-sm p-5";
const tableHeadClass = "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const primaryBtn =
  "h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors flex items-center justify-center gap-1.5 shadow-sm";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function monthStartISO() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];
}

function isPosted(row: any) {
  return !row?.status || row.status === "posted";
}

function isSalesInvoice(i: any) {
  return i?.type === "sales-invoice" || i?.type === "sales";
}

function isPurchaseInvoice(i: any) {
  return i?.type === "purchase-invoice" || i?.type === "purchase";
}

function stockForItem(item: any, stockMovements: any[]) {
  return (stockMovements || [])
    .filter((m) => m.itemId === item.id)
    .reduce((s, m) => {
      const qty = Number(m.quantity || m.qty || 0);
      const type = String(m.type || "").toLowerCase();
      if (type === "in" || type === "purchase" || type.includes("in")) return s + qty;
      return s - qty;
    }, Number(item.currentStock || 0));
}

function navigateToPage(page: string) {
  try {
    const store = useStore.getState ? useStore.getState() : null;
    if (store?.setCurrentPage) {
      store.setCurrentPage(page);
      return;
    }
  } catch {}

  window.location.hash = "#/" + page;
}

export default function Dashboard() {
  const {
    accounts = [],
    vouchers = [],
    invoices = [],
    items = [],
    stockMovements = [],
    parties = [],
    employees = [],
    companySettings = {},
    currentFiscalYear = {},
    currentUser = {},
  } = useStore();

  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const dashData = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const fyStart = currentFiscalYear?.startDate || monthStart;

    const todaySales = (invoices || [])
      .filter((i) => isSalesInvoice(i) && i.date === today && isPosted(i))
      .reduce((s, i) => s + Number(i.grandTotal || i.amount || 0), 0);

    const yesterdaySales = (invoices || [])
      .filter((i) => isSalesInvoice(i) && i.date === yesterday && isPosted(i))
      .reduce((s, i) => s + Number(i.grandTotal || i.amount || 0), 0);

    const salesTrend = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;

    const totalReceivables = (invoices || [])
      .filter(
        (i) =>
          isSalesInvoice(i) &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
          isPosted(i),
      )
      .reduce((s, i) => s + Number(i.grandTotal || i.amount || 0), 0);

    const overdueReceivables = (invoices || [])
      .filter(
        (i) =>
          isSalesInvoice(i) &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
          isPosted(i) &&
          i.dueDate &&
          i.dueDate < today,
      )
      .reduce((s, i) => s + Number(i.grandTotal || i.amount || 0), 0);

    const totalPayables = (invoices || [])
      .filter(
        (i) =>
          isPurchaseInvoice(i) &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
          isPosted(i),
      )
      .reduce((s, i) => s + Number(i.grandTotal || i.amount || 0), 0);

    const cashBankAccounts = (accounts || [])
      .filter(
        (a) =>
          a.type === "asset" &&
          (String(a.name || "").toLowerCase().includes("cash") ||
            String(a.name || "").toLowerCase().includes("bank")),
      )
      .map((a) => ({ ...a, balance: Number(a.balance || 0) }));

    const cashBankBalance = cashBankAccounts.reduce((s, a) => s + Number(a.balance || 0), 0);

    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);

      const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];

      const mSales = (invoices || [])
        .filter((inv) => isSalesInvoice(inv) && inv.date >= mStart && inv.date <= mEnd && isPosted(inv))
        .reduce((s, inv) => s + Number(inv.grandTotal || inv.amount || 0), 0);

      const mExp = (invoices || [])
        .filter((inv) => isPurchaseInvoice(inv) && inv.date >= mStart && inv.date <= mEnd && isPosted(inv))
        .reduce((s, inv) => s + Number(inv.grandTotal || inv.amount || 0), 0);

      monthlyData.push({
        month: d.toLocaleString("default", { month: "short" }),
        sales: mSales,
        expenses: mExp,
        profit: mSales - mExp,
      });
    }

    const aging = { d30: 0, d60: 0, d90: 0, d90plus: 0 };

    (invoices || [])
      .filter(
        (i) =>
          isSalesInvoice(i) &&
          (i.paymentStatus === "unpaid" || i.paymentStatus === "partial") &&
          isPosted(i),
      )
      .forEach((i) => {
        if (!i.dueDate) return;
        const days = Math.floor((new Date().getTime() - new Date(i.dueDate).getTime()) / 86400000);
        if (days <= 0) return;
        const amt = Number(i.grandTotal || i.amount || 0);
        if (days <= 30) aging.d30 += amt;
        else if (days <= 60) aging.d60 += amt;
        else if (days <= 90) aging.d90 += amt;
        else aging.d90plus += amt;
      });

    const customerSales: Record<string, number> = {};
    (invoices || [])
      .filter((i) => isSalesInvoice(i) && i.date >= monthStart && isPosted(i))
      .forEach((i) => {
        customerSales[i.partyId || "walk-in"] =
          (customerSales[i.partyId || "walk-in"] || 0) + Number(i.grandTotal || i.amount || 0);
      });

    const topCustomers = Object.entries(customerSales)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 10)
      .map(([id, amt]) => ({
        party: (parties || []).find((p) => p.id === id) || { name: "Walk-in Customer" },
        amount: amt,
        ytd: (invoices || [])
          .filter((i) => isSalesInvoice(i) && isPosted(i) && i.partyId === id && i.date >= fyStart)
          .reduce((s, inv) => s + Number(inv.grandTotal || inv.amount || 0), 0),
      }));

    const alertItems = (items || [])
      .map((item) => {
        const stock = stockForItem(item, stockMovements || []);
        const reorder = Number(item.reorderLevel || item.minimumStock || 0);
        return { ...item, computedStock: stock, reorderLevelValue: reorder, shortage: Math.max(0, reorder - stock) };
      })
      .filter((item) => item.reorderLevelValue > 0 && item.computedStock <= item.reorderLevelValue);

    const monthlyExpenseByAccount = {};
    const expenseAccounts = (accounts || []).filter((a) => a.type === "expense");

    (vouchers || [])
      .filter((v) => isPosted(v) && v.date >= monthStart)
      .forEach((v) => {
        (v.lines || []).forEach((l) => {
          const acc =
            (accounts || []).find((a) => a.id === l.accountId) ||
            (accounts || []).find((a) => a.name === l.accountName);
          if (acc?.type === "expense") {
            monthlyExpenseByAccount[acc.id || acc.name] =
              (monthlyExpenseByAccount[acc.id || acc.name] || 0) + Number(l.debit || 0);
          }
        });
      });

    const expenseBreakdown = expenseAccounts
      .map((acc) => ({
        ...acc,
        monthlyAmt: Number(monthlyExpenseByAccount[acc.id || acc.name] || 0),
      }))
      .filter((acc) => acc.monthlyAmt > 0)
      .sort((a, b) => b.monthlyAmt - a.monthlyAmt)
      .slice(0, 8);

    const maxExpense = Math.max(...expenseBreakdown.map((e) => e.monthlyAmt), 1);

    return {
      todaySales,
      yesterdaySales,
      salesTrend,
      totalReceivables,
      overdueReceivables,
      totalPayables,
      cashBankBalance,
      cashBankAccounts,
      monthlyData,
      aging,
      topCustomers,
      alertItems,
      expenseBreakdown,
      maxExpense,
    };
  }, [invoices, accounts, items, stockMovements, parties, currentFiscalYear, vouchers, nowTick]);

  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const pendingApprovals = (vouchers || []).filter((v) => v.status === "submitted").length;
  const maxVal = Math.max(...dashData.monthlyData.map((m) => Math.max(m.sales, m.expenses)), 1);

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="text-[#1557b0]" size={20} />
            {greeting}, {currentUser?.name || "User"}! 👋
          </h1>
          <p className="text-[12px] text-gray-500 mt-1">
            <span className="font-medium text-gray-700">{companySettings?.name || "Sutra ERP"}</span>
            <span className="mx-2 text-gray-300">|</span>
            Fiscal Year: {currentFiscalYear?.name || currentFiscalYear?.fiscalYearBS || "Current FY"}
            <span className="mx-2 text-gray-300">|</span>
            Today: {new Date().toLocaleDateString("en-IN", { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 px-2.5 py-1.5 rounded-md text-[11px] font-medium shadow-sm">
            <CheckCircle size={12} className="text-green-600" />
            CBMS Connected
          </div>
        </div>
      </div>

      {pendingApprovals > 0 && (
        <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 shadow-sm mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] font-medium">
            <Bell size={15} className="text-amber-600 animate-pulse" /> 
            <span><span className="font-bold">{pendingApprovals}</span> voucher(s) pending your approval.</span>
          </div>
          <button
            className="h-7 px-3 bg-white text-amber-700 text-[11px] font-semibold border border-amber-300 rounded hover:bg-amber-100 transition-colors shadow-sm flex items-center gap-1"
            onClick={() => navigateToPage("maker-checker")}
          >
            Review Now
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Today's Revenue</div>
            <div className="bg-blue-50 text-blue-600 rounded-md p-2">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-[24px] font-bold text-gray-900 mb-1">NPR {money(dashData.todaySales)}</div>
          <div className="flex items-center gap-1.5">
            {dashData.salesTrend >= 0 ? (
              <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-0.5">
                <ArrowUp size={12} /> {dashData.salesTrend.toFixed(1)}%
              </span>
            ) : (
              <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-0.5">
                <ArrowDown size={12} /> {Math.abs(dashData.salesTrend).toFixed(1)}%
              </span>
            )}
            <span className="text-[10px] text-gray-500">vs yesterday</span>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Accounts Receivable</div>
            <div className="bg-emerald-50 text-emerald-600 rounded-md p-2">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="text-[24px] font-bold text-gray-900 mb-1">NPR {money(dashData.totalReceivables)}</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Total Customer Dues</span>
            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
              <AlertTriangle size={10} /> Overdue: {money(dashData.overdueReceivables)}
            </span>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Accounts Payable</div>
            <div className="bg-amber-50 text-amber-600 rounded-md p-2">
              <ShoppingCart size={16} />
            </div>
          </div>
          <div className="text-[24px] font-bold text-gray-900 mb-1">NPR {money(dashData.totalPayables)}</div>
          <div className="text-[11px] text-gray-500">Vendor Dues Outstanding</div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Available Balance</div>
            <div className="bg-gray-100 text-gray-600 rounded-md p-2">
              <TrendingUp size={16} />
            </div>
          </div>
          <div
            className={`text-[24px] font-bold mb-1 ${
              dashData.cashBankBalance >= 0 ? "text-gray-900" : "text-red-600"
            }`}
          >
            NPR {money(dashData.cashBankBalance)}
          </div>
          <div className="text-[11px] text-gray-500">Total Cash & Bank Accounts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className={`${cardClass} lg:col-span-2 flex flex-col`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
                <Activity size={16} className="text-[#1557b0]" /> Monthly Sales & Expenses
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Performance over the last 12 months</p>
            </div>
            <div className="flex gap-4 text-[11px] font-medium bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
              <span className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#1557b0] rounded-sm shadow-sm" /> Sales
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-400 rounded-sm shadow-sm opacity-90" /> Expenses
              </span>
            </div>
          </div>

          <div className="flex items-end gap-2 h-[200px] mt-auto relative border-b border-gray-200 pb-1">
            {/* Horizontal grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 z-0 pb-1">
               <div className="border-t border-gray-400 w-full"></div>
               <div className="border-t border-gray-400 w-full"></div>
               <div className="border-t border-gray-400 w-full"></div>
               <div className="border-t border-gray-400 w-full"></div>
            </div>
            
            {dashData.monthlyData.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 z-10 group">
                <div className="w-full flex gap-1 justify-center items-end" style={{ height: "170px" }}>
                  <div
                    style={{ height: m.sales > 0 ? (m.sales / maxVal) * 165 + "px" : "2px", minHeight: 2 }}
                    className="w-[45%] max-w-[20px] bg-[#1557b0] rounded-t-sm cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                    title={`Sales: NPR ${money(m.sales)}`}
                  />
                  <div
                    style={{
                      height: m.expenses > 0 ? (m.expenses / maxVal) * 165 + "px" : "2px",
                      minHeight: 2,
                    }}
                    className="w-[45%] max-w-[20px] bg-red-400 rounded-t-sm opacity-90 cursor-pointer hover:opacity-75 transition-opacity shadow-sm"
                    title={`Expenses: NPR ${money(m.expenses)}`}
                  />
                </div>
                <div className="text-[10px] font-medium text-gray-500 group-hover:text-gray-900 transition-colors uppercase tracking-wider">{m.month}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-gray-500" /> Cash & Bank
            </h2>
            <button className="text-[11px] text-[#1557b0] font-medium hover:underline" onClick={() => navigateToPage("banking")}>View All</button>
          </div>
          
          <div className="bg-gray-50 rounded-md border border-gray-100 p-1 mb-4 shadow-inner">
            <div className="flex justify-between items-center p-2">
              <span className="text-[12px] font-semibold text-gray-600">Total Balance</span>
              <span className={`text-[15px] font-bold ${dashData.cashBankBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                NPR {money(dashData.cashBankBalance)}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {dashData.cashBankAccounts.length === 0 ? (
              <div className="text-[12px] py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-md">No cash/bank accounts configured</div>
            ) : (
              <>
                {dashData.cashBankAccounts.slice(0, 6).map((acc) => (
                  <div key={acc.id || acc.name} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 mr-3">
                      <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <DollarSign size={12} />
                      </div>
                      <span className="text-[12px] font-medium text-gray-700 truncate">{acc.name}</span>
                    </div>
                    <span
                      className={`text-[12px] font-semibold shrink-0 ${
                        acc.balance >= 0 ? "text-gray-900" : "text-red-600"
                      }`}
                    >
                      {money(acc.balance)}
                    </span>
                  </div>
                ))}
                {dashData.cashBankAccounts.length > 6 && (
                  <div className="text-[11px] text-center text-gray-500 pt-3 pb-1 font-medium bg-gray-50 rounded-md mt-2 border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => navigateToPage("banking")}>
                    View {dashData.cashBankAccounts.length - 6} more accounts
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className={cardClass}>
          <h2 className="text-[14px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gray-500" /> Receivables Aging
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md p-3 text-center bg-green-50 border border-green-200 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-1.5">1-30 Days</div>
              <div className="font-bold text-[14px] text-green-900">{money(dashData.aging.d30)}</div>
            </div>
            <div className="rounded-md p-3 text-center bg-amber-50 border border-amber-200 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1.5">31-60 Days</div>
              <div className="font-bold text-[14px] text-amber-900">{money(dashData.aging.d60)}</div>
            </div>
            <div className="rounded-md p-3 text-center bg-orange-50 border border-orange-200 shadow-sm transition-transform hover:-translate-y-0.5">
              <div className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide mb-1.5">61-90 Days</div>
              <div className="font-bold text-[14px] text-orange-900">{money(dashData.aging.d90)}</div>
            </div>
            <div className="rounded-md p-3 text-center bg-red-50 border border-red-200 shadow-sm transition-transform hover:-translate-y-0.5 relative overflow-hidden">
              <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-1.5 relative z-10">90+ Days</div>
              <div className="font-bold text-[14px] text-red-900 relative z-10">{money(dashData.aging.d90plus)}</div>
              {dashData.aging.d90plus > 0 && <div className="absolute top-0 right-0 w-8 h-8 bg-red-100 rounded-bl-full -mr-2 -mt-2"></div>}
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
              <Star size={16} className="text-amber-500 fill-amber-500/20" /> Top Customers This Month
            </h2>
          </div>
          
          {dashData.topCustomers.length === 0 ? (
            <div className="text-center text-[12px] text-gray-500 py-8 border border-dashed border-gray-200 rounded-md">No sales data for this month</div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={tableHeadClass}>Rank</th>
                    <th className={tableHeadClass}>Customer Name</th>
                    <th className={`${tableHeadClass} text-right`}>This Month</th>
                    <th className={`${tableHeadClass} text-right`}>YTD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashData.topCustomers.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="bg-white hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 text-[12px] text-gray-500 font-medium">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${idx === 0 ? "bg-amber-100 text-amber-700 font-bold" : idx === 1 ? "bg-gray-200 text-gray-700 font-bold" : idx === 2 ? "bg-orange-100 text-orange-800 font-bold" : "bg-gray-50"}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-medium">
                        {row.party?.name || "Unknown"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 text-right font-semibold">NPR {money(row.amount)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-500 text-right">NPR {money(row.ytd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
              <Package size={16} className="text-gray-500" /> Items Below Reorder Level
            </h2>
            <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded text-[11px] font-bold shadow-sm">
              {dashData.alertItems.length} Alerts
            </span>
          </div>

          {dashData.alertItems.length === 0 ? (
            <div className="text-center text-[12px] text-green-600 py-8 bg-green-50 border border-dashed border-green-200 rounded-md font-medium flex flex-col items-center gap-2">
              <CheckCircle size={24} className="text-green-500" />
              All items are above their reorder levels
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-md max-h-[250px] overflow-y-auto">
              <table className="w-full border-collapse sticky-header">
                <thead className="sticky top-0 bg-[#f5f6fa] z-10 shadow-sm">
                  <tr>
                    <th className={tableHeadClass}>Item</th>
                    <th className={`${tableHeadClass} text-center`}>Stock</th>
                    <th className={`${tableHeadClass} text-center`}>Reorder</th>
                    <th className={`${tableHeadClass} text-center text-red-600`}>Shortage</th>
                    <th className={tableHeadClass}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dashData.alertItems.slice(0, 10).map((item) => (
                    <tr
                      key={item.id}
                      className={item.computedStock <= 0 ? "bg-red-50/50 hover:bg-red-50 transition-colors" : "bg-orange-50/50 hover:bg-orange-50 transition-colors"}
                    >
                      <td className="px-3 py-2 text-[12px]">
                        <div className="font-medium text-gray-900 truncate max-w-[150px]" title={item.name}>{item.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{item.code || "-"}</div>
                      </td>
                      <td className="px-3 py-2 text-[12px] text-center font-bold text-gray-700">{item.computedStock}</td>
                      <td className="px-3 py-2 text-[12px] text-center text-gray-500">{item.reorderLevelValue}</td>
                      <td className="px-3 py-2 text-[12px] text-center font-bold text-red-600">
                        {item.shortage}
                      </td>
                      <td className="px-3 py-2 text-[12px]">
                        <button
                          className="h-6 px-2 bg-white text-[#1557b0] border border-[#1557b0] hover:bg-blue-50 text-[10px] font-medium rounded transition-colors"
                          onClick={() => {
                            navigateToPage("purchase-order");
                          }}
                        >
                          Create PO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-gray-800 flex items-center gap-2">
              <FileText size={16} className="text-gray-500" /> Expense Categories
            </h2>
            <span className="text-[11px] text-gray-500 font-medium">This Month</span>
          </div>
          
          {dashData.expenseBreakdown.length === 0 ? (
            <div className="text-center text-[12px] py-8 text-gray-500 border border-dashed border-gray-200 rounded-md">No expense activity this month</div>
          ) : (
            <div className="space-y-3">
              {dashData.expenseBreakdown.map((acc) => (
                <div key={acc.id || acc.name} className="flex items-center gap-3 group">
                  <span className="text-[11px] w-28 font-medium text-gray-700 truncate" title={acc.name}>{acc.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      style={{ width: (acc.monthlyAmt / dashData.maxExpense) * 100 + "%" }}
                      className="h-2 bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-1000 ease-out group-hover:from-red-500 group-hover:to-red-600"
                    />
                  </div>
                  <span className="text-[11px] w-24 text-right font-semibold text-gray-800 whitespace-nowrap">NPR {money(acc.monthlyAmt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <h2 className="text-[14px] font-bold text-gray-800 mb-4 flex items-center gap-2">
           ⚡ Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "New Invoice", page: "sales-invoice", icon: <FileText size={14}/> },
            { label: "New Purchase", page: "purchase-invoice", icon: <ShoppingCart size={14}/> },
            { label: "Journal Entry", page: "journal-voucher", icon: <FileText size={14}/> },
            { label: "View Reports", page: "trial-balance", icon: <Activity size={14}/> },
            { label: "Receive Payment", page: "receipt", icon: <DollarSign size={14}/> },
            { label: "Stock Status", page: "inventory-analysis", icon: <Package size={14}/> },
          ].map((action) => (
            <button key={action.page} onClick={() => navigateToPage(action.page)} className={`${primaryBtn} py-1.5`}>
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
