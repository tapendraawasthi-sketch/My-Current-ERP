import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { computeDashboardMetrics } from "../lib/accounting";
import { getBSTodayLong, getBSToday, getNepaliWeekday } from "../lib/nepaliDate";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
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
  Wallet,
  ArrowRightLeft,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle,
} from "lucide-react";
import { VoucherType, VoucherStatus, PaymentStatus, PartyType } from "../lib/types";

const COLORS = ["#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0284c7"];

const Dashboard: React.FC = () => {
  const {
    accounts,
    vouchers,
    invoices,
    items,
    billWiseEntries,
    stockMovements,
    companySettings,
    currentFiscalYear,
    setCurrentPage,
  } = useStore();

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [prefs, setPrefs] = useState({
    showKPIs: true,
    showCharts: true,
    showAlerts: true,
    showHealth: true,
  });

  const symbol = companySettings?.currencySymbol || "Rs.";
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  
  // Header Dates
  const nepaliDateStr = useMemo(() => {
    try {
      return getBSTodayLong();
    } catch {
      return getBSToday();
    }
  }, []);
  const weekdayStr = useMemo(() => {
    try {
      return getNepaliWeekday(new Date());
    } catch {
      return new Date().toLocaleDateString("en-US", { weekday: "long" });
    }
  }, []);

  const metrics = useMemo(() => {
    return computeDashboardMetrics(
      invoices,
      vouchers,
      stockMovements,
      items,
      billWiseEntries,
      accounts,
      currentFiscalYear,
      todayStr
    );
  }, [invoices, vouchers, stockMovements, items, billWiseEntries, accounts, currentFiscalYear, todayStr]);

  // Chart 1: Sales vs Collections (last 6 BS months simplified using AD months for Recharts)
  const salesVsCollectionsData = useMemo(() => {
    const data: { month: string; Sales: number; Collections: number }[] = [];
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const label = d.toLocaleString("default", { month: "short" });
      return { prefix: `${year}-${month}`, label };
    });

    months.forEach(({ prefix, label }) => {
      let mSales = 0;
      let mColl = 0;

      invoices.forEach(inv => {
        if (inv.status === VoucherStatus.POSTED && inv.type === VoucherType.SALES_INVOICE && inv.date.startsWith(prefix)) {
          mSales += inv.grandTotal;
        }
      });
      vouchers.forEach(v => {
        if (v.status === VoucherStatus.POSTED && v.type === VoucherType.RECEIPT && v.date.startsWith(prefix)) {
          mColl += v.totalCredit;
        }
      });

      data.push({
        month: label,
        Sales: Math.max(0, mSales),
        Collections: Math.max(0, mColl),
      });
    });

    return data;
  }, [invoices, vouchers]);

  // Chart 2: Cash Flow AreaChart 30-day
  const cashFlowTrendData = useMemo(() => {
    const data: { date: string; Balance: number }[] = [];
    const days = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split("T")[0];
    });

    // Simplify: just track relative movement for the chart to show trend
    let runningBalance = metrics.cashBalance + metrics.bankBalance;
    
    // We walk backwards to find historical balance, then reverse
    const reversedData = [];
    for (let i = days.length - 1; i >= 0; i--) {
      reversedData.push({
        date: days[i].slice(5),
        Balance: runningBalance,
      });
      // subtract movement of that day to get previous day's balance
      let movement = 0;
      vouchers.forEach(v => {
        if (v.status === VoucherStatus.POSTED && v.date === days[i]) {
          v.lines.forEach(line => {
            const acc = accounts.find(a => a.id === line.accountId);
            if (acc && (acc.code === '1001' || acc.code === '1002' || acc.name.toLowerCase().includes('cash') || acc.name.toLowerCase().includes('bank'))) {
              movement += (line.debit || 0) - (line.credit || 0);
            }
          });
        }
      });
      runningBalance -= movement;
    }
    return reversedData.reverse();
  }, [vouchers, accounts, metrics.cashBalance, metrics.bankBalance]);

  // Chart 3: Sales Mix (Top 5 Items)
  const topItemsData = useMemo(() => {
    const sales: Record<string, number> = {};
    invoices.forEach(inv => {
      if (inv.type !== VoucherType.SALES_INVOICE || inv.status !== VoucherStatus.POSTED) return;
      inv.lines.forEach(line => {
        if (line.itemId) {
          sales[line.itemName] = (sales[line.itemName] || 0) + (line.amount || 0);
        }
      });
    });
    return Object.entries(sales)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [invoices]);

  // Alerts Data
  const overdueEntries = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return billWiseEntries
      .filter(b => b.type === 'Dr' && b.status !== PaymentStatus.PAID)
      .map(b => {
        const amt = b.amount - (b.clearedAmount || 0);
        const diff = Math.floor((today.getTime() - new Date(b.dueDate).getTime()) / (1000*3600*24));
        return { ...b, remainingAmount: amt, daysOverdue: diff };
      })
      .filter(b => b.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5);
  }, [billWiseEntries]);

  // Health Score Logic
  const healthScore = useMemo(() => {
    let score = 0;
    
    // 1. Collection Efficiency
    const avgDays = 45; // Placeholder
    if (avgDays <= 30) score += 25;
    else score += 25 * (30 / avgDays);
    
    // 2. Gross Profit Margin
    const gpMargin = metrics.monthSales ? (metrics.grossProfit / metrics.monthSales) * 100 : 0;
    if (gpMargin > 20) score += 25;
    else score += 25 * (gpMargin / 20);
    
    // 3. Current Ratio
    const currentAssets = metrics.cashBalance + metrics.bankBalance + metrics.totalReceivable;
    const currentLiabs = metrics.totalPayable;
    const ratio = currentLiabs ? currentAssets / currentLiabs : 2;
    if (ratio > 1.5) score += 25;
    else score += 25 * (ratio / 1.5);
    
    // 4. Overdue Payables
    const hasOverduePayables = false; // Placeholder
    if (!hasOverduePayables) score += 25;

    return Math.round(score);
  }, [metrics]);

  const healthColor = healthScore >= 80 ? "bg-green-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-6 page-wrapper text-xs select-none">
      {/* Header Strip */}
      <div className="flex items-center justify-between border-b pb-4 mb-2 border-gray-200">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Business Dashboard</h1>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
            <span>आज: {weekdayStr}, {nepaliDateStr}</span>
            <span>•</span>
            <span>Current FY: आर्थिक वर्ष {currentFiscalYear?.name}</span>
          </div>
        </div>
        <button
          onClick={() => setIsCustomizing(!isCustomizing)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          {isCustomizing ? "Done Customizing" : "Customize"}
        </button>
      </div>

      {isCustomizing && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-center gap-6 mb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={prefs.showKPIs} onChange={(e) => setPrefs(p => ({...p, showKPIs: e.target.checked}))} className="rounded text-[#1557b0] focus:ring-[#1557b0]" />
            <span className="font-medium">Show KPI Cards</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={prefs.showCharts} onChange={(e) => setPrefs(p => ({...p, showCharts: e.target.checked}))} className="rounded text-[#1557b0] focus:ring-[#1557b0]" />
            <span className="font-medium">Show Charts</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={prefs.showAlerts} onChange={(e) => setPrefs(p => ({...p, showAlerts: e.target.checked}))} className="rounded text-[#1557b0] focus:ring-[#1557b0]" />
            <span className="font-medium">Show Alerts</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={prefs.showHealth} onChange={(e) => setPrefs(p => ({...p, showHealth: e.target.checked}))} className="rounded text-[#1557b0] focus:ring-[#1557b0]" />
            <span className="font-medium">Show Health Score</span>
          </label>
        </div>
      )}

      {/* ROW 1: KPI Cards */}
      {prefs.showKPIs && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="kpi-card bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col justify-between h-[100px]">
            <div>
              <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Today's Sales</div>
              <div className="kpi-value mt-1 font-extrabold text-[20px] text-gray-900">{symbol} {formatNumber(metrics.todaySales)}</div>
            </div>
            <div className="kpi-meta mt-2 flex items-center justify-between text-[10px]">
              <span className={metrics.salesGrowth >= 0 ? "text-green-600 flex items-center gap-0.5 font-semibold" : "text-red-600 flex items-center gap-0.5 font-semibold"}>
                {metrics.salesGrowth >= 0 ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                {Math.abs(metrics.salesGrowth).toFixed(0)}% vs last mo
              </span>
            </div>
          </div>
          <div className="kpi-card bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col justify-between h-[100px]">
            <div>
              <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Month Sales</div>
              <div className="kpi-value mt-1 font-extrabold text-[20px] text-gray-900">{symbol} {formatNumber(metrics.monthSales)}</div>
            </div>
          </div>
          <div className="kpi-card bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col justify-between h-[100px]">
            <div>
              <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Total Receivable</div>
              <div className="kpi-value mt-1 font-extrabold text-[20px] text-gray-900">{symbol} {formatNumber(metrics.totalReceivable)}</div>
            </div>
            <div className="kpi-meta mt-2 flex items-center justify-between text-[10px]">
              <span className="text-red-600 font-semibold">{formatNumber(metrics.overdueReceivable)} Overdue</span>
            </div>
          </div>
          <div className="kpi-card bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col justify-between h-[100px]">
            <div>
              <div className="kpi-label text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Cash + Bank</div>
              <div className="kpi-value mt-1 font-extrabold text-[20px] text-gray-900">{symbol} {formatNumber(metrics.cashBalance + metrics.bankBalance)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ROW 2: Charts */}
      {prefs.showCharts && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px]">
          <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col">
            <h3 className="text-[12px] font-bold text-gray-700 mb-4">Sales vs Collections</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesVsCollectionsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} width={60} tickFormatter={(v) => (v > 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                  <RechartsTooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "11px" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="Sales" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Collections" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col">
            <h3 className="text-[12px] font-bold text-gray-700 mb-4">Cash Flow (30 Days)</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowTrendData}>
                  <defs>
                    <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" minTickGap={20} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "11px" }} />
                  <Area type="monotone" dataKey="Balance" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorBal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col">
            <h3 className="text-[12px] font-bold text-gray-700 mb-4">Sales Mix</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topItemsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {topItemsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => [`${symbol} ${formatNumber(value)}`, "Sales"]} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "11px" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ROW 3: Alerts */}
      {prefs.showAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Overdue Receivables */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500" /> Overdue Receivables</h3>
              <button onClick={() => setCurrentPage("aging-report")} className="text-[10px] text-blue-600 font-semibold hover:underline">View All</button>
            </div>
            <div className="space-y-3">
              {overdueEntries.length === 0 ? (
                <div className="text-gray-400 text-center py-4">No overdue receivables</div>
              ) : (
                overdueEntries.map(e => (
                  <div key={e.id} className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-semibold text-gray-800">{e.partyName}</div>
                      <div className="text-gray-500">{e.refNo}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{symbol} {formatNumber(e.remainingAmount)}</div>
                      <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block mt-0.5 ${e.daysOverdue > 60 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {e.daysOverdue} Days
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts</h3>
              <button onClick={() => setCurrentPage("inventory-report")} className="text-[10px] text-blue-600 font-semibold hover:underline">View All</button>
            </div>
            <div className="space-y-3 text-center py-6">
               <div className="text-[24px] font-bold text-gray-800">{metrics.lowStockCount}</div>
               <div className="text-gray-500 text-[11px]">Items below minimum reorder level</div>
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5"><ClipboardCheck className="w-4 h-4 text-blue-500" /> Pending Actions</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                <div>
                  <div className="font-bold text-blue-900">Voucher Approvals</div>
                  <div className="text-blue-700 text-[10px]">{metrics.pendingApprovalsCount} pending requests</div>
                </div>
                <button onClick={() => setCurrentPage("approval-queue")} className="bg-white px-2 py-1 rounded text-blue-700 font-semibold border border-blue-200 hover:bg-blue-100 transition-colors">Review</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROW 4: Business Health Score */}
      {prefs.showHealth && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-bold text-gray-800 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500"/> Business Health Score</h3>
            <span className={`text-[16px] font-black ${healthScore >= 80 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {healthScore} / 100
            </span>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex">
            <div className={`h-full ${healthColor} transition-all duration-1000 ease-out`} style={{ width: `${healthScore}%` }} />
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-gray-500 font-medium">
            <span>Score components: Collection Efficiency, Margin, Current Ratio, Payables</span>
            <span>{healthScore >= 80 ? "Excellent standing" : healthScore >= 50 ? "Needs attention" : "Critical state"}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
