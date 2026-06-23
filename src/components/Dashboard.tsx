import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { computeOutstandingReceivables } from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { formatNumber, dateToAD } from "../lib/utils";
import { formatADToBS, getDaysInNepaliMonth } from "../lib/nepaliDate";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  AlertTriangle,
  Clock,
  Landmark,
  FileCheck,
  RefreshCw
} from "lucide-react";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import { useIsMobile } from "../hooks/use-mobile";

const Dashboard: React.FC = () => {
  const isMobile = useIsMobile();
  const isDbReady = useStore(state => state.isDbReady);
  const accounts = useStore(state => state.accounts);
  const vouchers = useStore(state => state.vouchers);
  const invoices = useStore(state => state.invoices);
  const items = useStore(state => state.items);
  const parties = useStore(state => state.parties);
  const warehouses = useStore(state => state.warehouses);
  const stockMovements = useStore(state => state.stockMovements);

  const todayAD = new Date().toISOString().split("T")[0];
  const yesterdayAD = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const todayBS = formatADToBS(todayAD);

  // 1. TODAY'S SALES
  const salesToday = useMemo(() => {
    let todayTotal = 0;
    let yesterdayTotal = 0;

    invoices.forEach(inv => {
      if (inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED) {
        if (inv.date === todayAD) todayTotal += (inv.grandTotal || 0);
        else if (inv.date === yesterdayAD) yesterdayTotal += (inv.grandTotal || 0);
      }
    });

    let trend = 0;
    if (yesterdayTotal > 0) trend = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;

    return { total: todayTotal, trend };
  }, [invoices, todayAD, yesterdayAD]);

  // 2. OUTSTANDING RECEIVABLES
  const receivables = useMemo(() => {
    const data = computeOutstandingReceivables(parties, invoices, vouchers);
    let overdueCount = 0;
    invoices.forEach(inv => {
      if (inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED) {
        if (inv.paymentStatus === PaymentStatus.UNPAID || inv.paymentStatus === PaymentStatus.PARTIAL) {
          if (inv.dueDate && inv.dueDate < todayAD) {
            overdueCount++;
          }
        }
      }
    });
    return { total: data.totalAmount, overdueCount };
  }, [parties, invoices, vouchers, todayAD]);

  // 3. CASH & BANK BALANCE
  const cashAndBank = useMemo(() => {
    const list = accounts.filter(a => 
      a.group === "Current Assets" && 
      (a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"))
    );
    const total = list.reduce((sum, a) => sum + (a.balance || 0), 0);
    return { total, list };
  }, [accounts]);

  // 4. VAT LIABILITY
  const vatLiability = useMemo(() => {
    const vatLedgers = accounts.filter(a => a.name.toLowerCase().includes("vat payable"));
    const ledgerBalance = vatLedgers.reduce((sum, a) => sum + (a.balance || 0), 0);

    const currentMonthPrefix = todayBS.substring(0, 7);
    let inputVat = 0;
    let outputVat = 0;

    invoices.forEach(inv => {
      if (inv.status === VoucherStatus.POSTED && formatADToBS(inv.date).startsWith(currentMonthPrefix)) {
        if (inv.type === VoucherType.SALES_INVOICE) outputVat += (inv.vatAmount || 0);
        else if (inv.type === VoucherType.PURCHASE_INVOICE) inputVat += (inv.vatAmount || 0);
        else if (inv.type === VoucherType.SALES_RETURN) outputVat -= (inv.vatAmount || 0);
        else if (inv.type === VoucherType.PURCHASE_RETURN) inputVat -= (inv.vatAmount || 0);
      }
    });

    const parts = todayBS.split("-");
    let nextYear = parseInt(parts[0]);
    let nextMonth = parseInt(parts[1]) + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    const dueDateBS = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-25`;

    return { 
      total: ledgerBalance + (outputVat - inputVat), 
      dueDateBS 
    };
  }, [accounts, invoices, todayBS]);

  // 5. REVENUE THIS MONTH
  const revenueThisMonthData = useMemo(() => {
    const currentMonthPrefix = todayBS.substring(0, 7);
    const [yy, mm, dd] = todayBS.split("-");
    const daysInMonth = getDaysInNepaliMonth(parseInt(yy), parseInt(mm));

    const dailyMap: Record<number, number> = {};
    for (let i = 1; i <= daysInMonth; i++) dailyMap[i] = 0;

    invoices.forEach(inv => {
      if (inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED) {
        const bsDate = formatADToBS(inv.date);
        if (bsDate.startsWith(currentMonthPrefix)) {
          const day = parseInt(bsDate.split("-")[2]);
          dailyMap[day] += (inv.grandTotal || 0);
        }
      }
    });

    return Object.keys(dailyMap).map(day => ({
      day: day.padStart(2, '0'),
      revenue: dailyMap[parseInt(day)]
    }));
  }, [invoices, todayBS]);

  // 6. TOP 5 PARTIES
  const topParties = useMemo(() => {
    const partyStats: Record<string, {name: string, outstanding: number, oldestUnpaid: string, limit: number}> = {};
    
    parties.forEach(p => {
      partyStats[p.id] = { name: p.name, outstanding: 0, oldestUnpaid: "9999-99-99", limit: p.creditLimit || 0 };
    });

    invoices.forEach(inv => {
      if (inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED && (inv.paymentStatus === PaymentStatus.UNPAID || inv.paymentStatus === PaymentStatus.PARTIAL)) {
        if (partyStats[inv.partyId]) {
          partyStats[inv.partyId].outstanding += ((inv.grandTotal || 0) - (inv.paidAmount || 0));
          if (inv.date < partyStats[inv.partyId].oldestUnpaid) {
            partyStats[inv.partyId].oldestUnpaid = inv.date;
          }
        }
      }
    });

    return Object.values(partyStats)
      .filter(p => p.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5)
      .map(p => {
        let overdueDays = 0;
        if (p.oldestUnpaid !== "9999-99-99") {
          overdueDays = Math.floor((new Date(todayAD).getTime() - new Date(p.oldestUnpaid).getTime()) / 86400000);
        }
        return { ...p, overdueDays: overdueDays > 0 ? overdueDays : 0 };
      });
  }, [parties, invoices, todayAD]);

  // 7. RECENT VOUCHERS
  const recentVouchers = useMemo(() => {
    return [...vouchers]
      .filter(v => v.status === VoucherStatus.POSTED)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [vouchers]);

  // 8. STOCK ALERTS
  const stockAlerts = useMemo(() => {
    const positions = computeAllStockPositions(stockMovements, items, warehouses);
    return positions
      .filter(pos => {
        const item = items.find(i => i.id === pos.itemId);
        const reorder = item?.reorderLevel || 0;
        return pos.qty <= reorder;
      })
      .map(pos => {
        const item = items.find(i => i.id === pos.itemId);
        return {
          id: pos.itemId,
          name: item?.name || "Unknown",
          qty: pos.qty,
          reorderLevel: item?.reorderLevel || 0,
          unit: item?.baseUnit || "pcs"
        };
      })
      .slice(0, 10);
  }, [stockMovements, items, warehouses]);

  // 10. COMPLIANCE KEY DATES
  const complianceDates = useMemo(() => {
    const parts = todayBS.split("-");
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    
    const ssfDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-15`;
    const vatTdsDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-25`;

    const taxDates = [
      `${year}-09-13`,
      `${year}-12-13`,
      `${year + 1}-03-13`
    ];
    let nextTaxDate = taxDates.find(d => d >= todayBS) || `${year + 1}-03-13`;

    return [
      { name: "SSF Contribution", date: ssfDate, passed: false },
      { name: "VAT Return", date: vatTdsDate, passed: false },
      { name: "TDS Return", date: vatTdsDate, passed: false },
      { name: "Advance Tax", date: nextTaxDate, passed: false },
    ];
  }, [todayBS]);

  if (!isDbReady) {
    return <div className="p-8 flex justify-center"><RefreshCw className="animate-spin text-[var(--color-accent)]" /></div>;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      
      {/* TOP ROW: KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="kpi-card" style={{ "--kpi-color": "var(--color-accent)" } as any}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Today's Sales (BS {todayBS})</p>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">Rs. {formatNumber(salesToday.total)}</h3>
            </div>
            <div className="p-2 bg-[var(--color-surface-sunken)] rounded-md">
              <TrendingUp className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            {salesToday.trend > 0 ? (
              <span className="flex items-center text-[11px] font-bold text-[var(--color-positive)] bg-[var(--color-positive-bg)] px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3 mr-1" /> +{salesToday.trend.toFixed(1)}%
              </span>
            ) : salesToday.trend < 0 ? (
              <span className="flex items-center text-[11px] font-bold text-[var(--color-negative)] bg-[var(--color-negative-bg)] px-1.5 py-0.5 rounded">
                <TrendingDown className="w-3 h-3 mr-1" /> {salesToday.trend.toFixed(1)}%
              </span>
            ) : (
              <span className="text-[11px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 rounded">0.0%</span>
            )}
            <span className="text-[11px] text-[var(--color-text-muted)]">vs yesterday</span>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="kpi-card" style={{ "--kpi-color": "var(--color-positive)" } as any}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Outstanding Receivables</p>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">Rs. {formatNumber(receivables.total)}</h3>
            </div>
            <div className="p-2 bg-[var(--color-surface-sunken)] rounded-md relative">
              <Receipt className="w-5 h-5 text-[var(--color-positive)]" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {receivables.overdueCount > 0 ? (
              <span className="text-[11px] font-bold text-[var(--color-negative)]">
                {receivables.overdueCount} Overdue
              </span>
            ) : (
              <span className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-positive)]" /> requires follow up
              </span>
            )}
          </div>
        </div>

        {/* VAT Liability */}
        <div className="kpi-card" style={{ "--kpi-color": "var(--color-warning)" } as any}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">VAT Liability (Est.)</p>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">Rs. {formatNumber(vatLiability.total)}</h3>
            </div>
            <div className="p-2 bg-[var(--color-surface-sunken)] rounded-md">
              <FileCheck className="w-5 h-5 text-[var(--color-warning)]" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
             <span className="text-[11px] font-bold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock className="w-3 h-3" /> Due: {vatLiability.dueDateBS}
             </span>
          </div>
        </div>

        {/* Cash & Bank Balance */}
        <div className="kpi-card group relative" style={{ "--kpi-color": "#6366F1" } as any}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Cash & Bank Balance</p>
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">Rs. {formatNumber(cashAndBank.total)}</h3>
            </div>
            <div className="p-2 bg-[var(--color-surface-sunken)] rounded-md">
              <Landmark className="w-5 h-5 text-[#6366F1]" />
            </div>
          </div>
          <div className="mt-2 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1 cursor-help">
            Hover to view breakdown
            <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--color-sidebar-bg)] rounded-md shadow-lg p-3 z-10 hidden group-hover:block border border-[var(--color-sidebar-border)]">
              <div className="text-[10px] font-bold text-[var(--color-sidebar-text)] uppercase mb-2 border-b border-[var(--color-sidebar-border)] pb-1">Account Breakdown</div>
              <div className="space-y-1.5">
                {cashAndBank.list.map(a => (
                  <div key={a.id} className="flex justify-between items-center">
                    <span className="text-[11px] text-white truncate pr-2">{a.name}</span>
                    <span className="text-[11px] font-mono font-bold text-white whitespace-nowrap">Rs. {formatNumber(a.balance || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* MIDDLE ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Revenue Area Chart */}
        <div className="lg:col-span-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm p-5">
           <div className="mb-4">
             <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Revenue This Month</h3>
             <p className="text-[11px] text-[var(--color-text-muted)]">Daily sales trend for current BS month</p>
           </div>
           <div className="h-[250px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={revenueThisMonthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--color-accent-subtle)" stopOpacity={1}/>
                     <stop offset="95%" stopColor="var(--color-accent-subtle)" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-table-border)" />
                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} tickFormatter={(val) => `Rs. ${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`} />
                 <RechartsTooltip 
                   contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                   formatter={(value: number) => [`Rs. ${formatNumber(value)}`, 'Revenue']}
                   labelFormatter={(label) => `Day ${label}`}
                 />
                 <Area type="monotone" dataKey="revenue" stroke="var(--color-accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Top 5 Parties */}
        <div className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--color-table-border)] flex justify-between items-center">
             <div>
               <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Top 5 Outstanding Parties</h3>
               <p className="text-[11px] text-[var(--color-text-muted)]">Customers with highest unpaid balances</p>
             </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Party</th>
                  <th className="text-right">Outstanding</th>
                  <th className="text-right">Ageing</th>
                </tr>
              </thead>
              <tbody>
                {topParties.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-[12px] text-[var(--color-text-muted)]">No outstanding parties</td></tr>
                ) : (
                  topParties.map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">{p.name}</div>
                        {p.limit > 0 ? (
                          <div className="w-full bg-[var(--color-surface-raised)] rounded-full h-1.5 mt-1.5 max-w-[120px]">
                            <div className={`h-1.5 rounded-full ${p.outstanding > p.limit * 0.8 ? 'bg-[var(--color-negative)]' : 'bg-[var(--color-accent)]'}`} style={{ width: `${Math.min((p.outstanding/p.limit)*100, 100)}%` }}></div>
                          </div>
                        ) : (
                           <div className="text-[9px] text-[var(--color-text-muted)] mt-1">No limit set</div>
                        )}
                      </td>
                      <td className="amt amt-dr text-right">
                        Rs. {formatNumber(p.outstanding)}
                      </td>
                      <td className="text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.overdueDays > 30 ? 'bg-[var(--color-negative-bg)] text-[var(--color-negative)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'}`}>
                          {p.overdueDays} Days
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Vouchers */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[var(--color-surface-raised)] px-4 py-3 border-b border-[var(--color-table-border)]">
            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Recent Vouchers</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date (BS)</th>
                  <th>Type / No</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentVouchers.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-4 text-[12px] text-[var(--color-text-muted)]">No recent vouchers</td></tr>
                ) : (
                  recentVouchers.map(v => (
                    <tr key={v.id}>
                      <td className="text-[11px] text-[var(--color-text-secondary)] font-mono">{v.dateNepali}</td>
                      <td>
                         <div className="text-[10px] font-bold text-[var(--color-accent)] uppercase">{v.type.replace(/_/g, ' ')}</div>
                         <div className="text-[12px] font-mono text-[var(--color-text-primary)]">{v.voucherNo}</div>
                      </td>
                      <td className="amt text-right">
                        Rs. {formatNumber(v.grandTotal || v.totalDebit || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="kpi-card !p-0 !border-0 flex flex-col h-full bg-transparent overflow-hidden rounded-lg shadow-sm" style={{ "--kpi-color": "var(--color-warning)" } as any}>
           <div className="bg-[var(--color-surface)] px-4 py-3 border border-[var(--color-border)] border-b-0 rounded-t-lg flex justify-between items-center z-10 relative">
            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" /> Stock Alerts
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto bg-[var(--color-surface)] border border-[var(--color-border)] border-t-0 rounded-b-lg">
             <table className="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th className="text-right">Current Qty</th>
                </tr>
              </thead>
              <tbody>
                {stockAlerts.length === 0 ? (
                  <tr><td colSpan={2} className="text-center py-4 text-[12px] text-[var(--color-text-muted)]">Stock levels healthy</td></tr>
                ) : (
                  stockAlerts.map(alert => (
                    <tr key={alert.id}>
                      <td>
                         <div className="text-[12px] font-semibold text-[var(--color-text-primary)]">{alert.name}</div>
                         <div className="text-[10px] text-[var(--color-text-muted)]">Reorder: {alert.reorderLevel} {alert.unit}</div>
                      </td>
                      <td className="text-right">
                         <span className={`text-[11px] font-bold ${alert.qty === 0 ? 'text-[var(--color-negative)]' : 'text-[var(--color-warning)]'}`}>
                           {alert.qty} {alert.unit}
                         </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Compliance Dates */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="bg-[var(--color-surface-raised)] px-4 py-3 border-b border-[var(--color-table-border)] flex justify-between items-center">
            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[var(--color-accent)]" /> Compliance Deadlines
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto p-4">
             <div className="space-y-3">
               {complianceDates.map(cd => (
                 <div key={cd.name} className="border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-surface)] shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                         <FileCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" /> {cd.name}
                      </span>
                      <span className={`text-[13px] font-bold font-mono ${cd.date < todayBS ? 'text-[var(--color-negative)]' : 'text-[var(--color-accent)]'}`}>{cd.date}</span>
                    </div>
                    <div className="text-[10px] font-medium text-[var(--color-text-muted)] ml-5">
                      Deadline in BS Date
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
