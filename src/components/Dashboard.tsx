// @ts-nocheck
import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { computeOutstandingReceivables } from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { formatNumber } from "../lib/utils";
import { formatADToBS } from "../lib/nepaliDate";
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Calendar, DollarSign } from "lucide-react";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";

const KPIBox: React.FC<{ label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }> = ({ label, value, sub, color = "#1557b0", icon }) => (
  <div style={{ background: "#fff", border: "1px solid #c8d8e8", borderTop: `3px solid ${color}`, borderRadius: 3, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, minHeight: 78 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#5a7a9a" }}>{label}</span>
      {icon && <span style={{ color, opacity: 0.6 }}>{icon}</span>}
    </div>
    <span style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a", fontFamily: "var(--font-mono)", lineHeight: 1.2 }}>{value}</span>
    {sub && <span style={{ fontSize: 10, color: "#8a9ab0" }}>{sub}</span>}
  </div>
);

const Dashboard: React.FC = () => {
  const isDbReady = useStore(s => s.isDbReady);
  const accounts = useStore(s => s.accounts);
  const vouchers = useStore(s => s.vouchers);
  const invoices = useStore(s => s.invoices);
  const items = useStore(s => s.items);
  const parties = useStore(s => s.parties);
  const warehouses = useStore(s => s.warehouses);
  const stockMovements = useStore(s => s.stockMovements);

  const todayAD = new Date().toISOString().split("T")[0];
  const yesterdayAD = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const todayBS = formatADToBS(todayAD);

  const salesToday = useMemo(() => {
    let today = 0, yesterday = 0;
    invoices.forEach((inv: any) => {
      if (inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED) {
        if (inv.date === todayAD) today += (inv.grandTotal || 0);
        else if (inv.date === yesterdayAD) yesterday += (inv.grandTotal || 0);
      }
    });
    const trend = yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : 0;
    return { total: today, trend };
  }, [invoices, todayAD, yesterdayAD]);

  const receivables = useMemo(() => {
    const data = computeOutstandingReceivables(parties, invoices, vouchers);
    let overdue = 0;
    invoices.forEach((inv: any) => {
      if (inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED &&
          (inv.paymentStatus === PaymentStatus.UNPAID || inv.paymentStatus === PaymentStatus.PARTIAL) &&
          inv.dueDate && inv.dueDate < todayAD) overdue++;
    });
    return { total: (data as any).totalAmount || 0, overdue };
  }, [parties, invoices, vouchers, todayAD]);

  const cashAndBank = useMemo(() => {
    const list = accounts.filter((a: any) => a.group === "Current Assets" &&
      (a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank")));
    return { total: list.reduce((s: number, a: any) => s + (a.balance || 0), 0), count: list.length };
  }, [accounts]);

  const vatLiability = useMemo(() => {
    let output = 0, input = 0;
    invoices.forEach((inv: any) => {
      if (inv.status === VoucherStatus.POSTED) {
        if (inv.type === VoucherType.SALES_INVOICE) output += (inv.vatAmount || 0);
        else if (inv.type === VoucherType.PURCHASE_INVOICE) input += (inv.vatAmount || 0);
        else if (inv.type === VoucherType.SALES_RETURN) output -= (inv.vatAmount || 0);
        else if (inv.type === VoucherType.PURCHASE_RETURN) input -= (inv.vatAmount || 0);
      }
    });
    return { total: Math.max(0, output - input), output, input };
  }, [invoices]);

  const recentVouchers = useMemo(() => {
    return [...vouchers].filter((v: any) => v.status === VoucherStatus.POSTED)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);
  }, [vouchers]);

  const stockAlerts = useMemo(() => {
    const positions = computeAllStockPositions(stockMovements, items, warehouses);
    return positions.filter((pos: any) => {
      const item = items.find((i: any) => i.id === pos.itemId);
      return pos.qty <= (item?.reorderLevel || 0);
    }).map((pos: any) => {
      const item = items.find((i: any) => i.id === pos.itemId);
      return { id: pos.itemId, name: item?.name || "Unknown", qty: pos.qty, reorderLevel: item?.reorderLevel || 0, unit: item?.baseUnit || "pcs" };
    }).slice(0, 10);
  }, [stockMovements, items, warehouses]);

  const topParties = useMemo(() => {
    const partyMap: Record<string, { name: string; amount: number }> = {};
    invoices.filter((inv: any) => inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED)
      .forEach((inv: any) => {
        if (!partyMap[inv.partyId]) partyMap[inv.partyId] = { name: inv.partyName, amount: 0 };
        partyMap[inv.partyId].amount += inv.grandTotal || 0;
      });
    return Object.values(partyMap).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [invoices]);

  const parts = (todayBS || "2081-01-01").split("-");
  const nextMonthStr = `${parts[0]}-${String(parseInt(parts[1] || "1") + 1).padStart(2,"0")}-25`;

  if (!isDbReady) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}><RefreshCw className="animate-spin" style={{ color: "#1557b0" }} /></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Today: {todayBS} BS &nbsp;|&nbsp; {todayAD} AD</p>
        </div>
        <div style={{ fontSize: 11, color: "#5a7a9a", fontWeight: 600 }}>
          Real-time Financial Overview
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <KPIBox label="Today's Sales" value={`Rs. ${formatNumber(salesToday.total)}`} sub={`${salesToday.trend > 0 ? "+" : ""}${salesToday.trend.toFixed(1)}% vs yesterday`} color="#059669" icon={<TrendingUp style={{ width: 16, height: 16 }} />} />
        <KPIBox label="Outstanding Receivables" value={`Rs. ${formatNumber(receivables.total)}`} sub={`${receivables.overdue} overdue invoice${receivables.overdue !== 1 ? "s" : ""}`} color="#d97706" icon={<AlertTriangle style={{ width: 16, height: 16 }} />} />
        <KPIBox label="Cash & Bank Balance" value={`Rs. ${formatNumber(cashAndBank.total)}`} sub={`${cashAndBank.count} account${cashAndBank.count !== 1 ? "s" : ""}`} color="#1557b0" icon={<DollarSign style={{ width: 16, height: 16 }} />} />
        <KPIBox label="VAT Liability (MTD)" value={`Rs. ${formatNumber(vatLiability.total)}`} sub={`Due: ${nextMonthStr} BS`} color="#dc2626" icon={<Calendar style={{ width: 16, height: 16 }} />} />
      </div>

      {/* Main 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, alignItems: "start" }}>
        {/* Recent Vouchers */}
        <div className="busy-card">
          <div className="busy-card-header">
            Recent Posted Vouchers
            <span style={{ fontSize: 10, color: "#c8d8e8", fontWeight: 400 }}>{recentVouchers.length} entries</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date (BS)</th>
                  <th>Voucher No</th>
                  <th>Type</th>
                  <th>Narration</th>
                  <th className="th-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentVouchers.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "16px", color: "#8a9ab0" }}>No vouchers</td></tr>
                ) : recentVouchers.map((v: any) => (
                  <tr key={v.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{v.dateNepali}</td>
                    <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{v.voucherNo}</td>
                    <td><span className="badge badge-posted" style={{ fontSize: 9 }}>{(v.type || "").replace(/_/g," ").slice(0,8)}</span></td>
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.narration}>{v.narration}</td>
                    <td className="amt amt-dr">Rs. {formatNumber(v.grandTotal || v.totalDebit || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="busy-card">
          <div className="busy-card-header" style={{ color: stockAlerts.length > 0 ? "#f59e0b" : "#c8d8e8" }}>
            Stock Alerts {stockAlerts.length > 0 && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 9999, padding: "0 5px", fontSize: 9, fontWeight: 700 }}>{stockAlerts.length}</span>}
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Item Name</th><th className="th-right">Qty</th></tr>
            </thead>
            <tbody>
              {stockAlerts.length === 0 ? (
                <tr><td colSpan={2} style={{ textAlign: "center", padding: "12px", color: "#8a9ab0" }}>
                  <CheckCircle style={{ width: 16, height: 16, color: "#059669", display: "inline", marginRight: 6 }} />All stock levels healthy
                </td></tr>
              ) : stockAlerts.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 11 }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: "#8a9ab0" }}>Reorder: {a.reorderLevel} {a.unit}</div>
                  </td>
                  <td className="amt" style={{ color: "#dc2626", fontWeight: 700 }}>{a.qty} {a.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* VAT Summary & Compliance */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="busy-card">
            <div className="busy-card-header">VAT Summary (MTD)</div>
            <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
              {[
                { label: "Output VAT", val: vatLiability.output, color: "#dc2626" },
                { label: "Input VAT", val: vatLiability.input, color: "#059669" },
                { label: "Net Payable", val: vatLiability.total, color: "#1557b0" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#5a7a9a", fontSize: 11 }}>{label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color, fontSize: 11 }}>Rs. {formatNumber(val)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #e8eef5", paddingTop: 6, marginTop: 2 }}>
                <div style={{ fontSize: 10, color: "#8a9ab0" }}>VAT Return Due: {nextMonthStr} BS</div>
              </div>
            </div>
          </div>
          <div className="busy-card">
            <div className="busy-card-header">Top Customers (Sales)</div>
            <div style={{ overflowX: "auto" }}>
              {topParties.length === 0 ? (
                <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "#8a9ab0" }}>No sales yet</div>
              ) : topParties.map((p: any, idx: number) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 10px", borderBottom: "1px solid #f0f4fa", fontSize: 11 }}>
                  <span style={{ fontWeight: idx === 0 ? 700 : 400, color: "#1a2a3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{p.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#1557b0", fontWeight: 600 }}>Rs. {formatNumber(p.amount)}</span>
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
