import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { computeOutstandingReceivables } from "../lib/accounting";
import { computeAllStockPositions } from "../lib/stockUtils";
import { formatNumber } from "../lib/utils";
import { formatADToBS } from "../lib/nepaliDate";
import { RefreshCw } from "lucide-react";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";

const Dashboard: React.FC = () => {
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
    return <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}><RefreshCw className="animate-spin" style={{ color: "#4A7A30" }} /></div>;
  }

  return (
    <div style={{ background: "#C5E1A5", paddingBottom: "2.5rem" }} className="min-h-screen">
      <div className="space-y-6 max-w-[1600px] mx-auto pt-6 px-4">
        
        {/* TOP ROW: KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#111111", marginBottom: 6 }}>Today's Sales (BS {todayBS})</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111111", fontFamily: "Courier New, monospace" }}>Rs. {formatNumber(salesToday.total)}</div>
            <div style={{ fontSize: 11, color: "#111111", marginTop: 4 }}>vs yesterday: {salesToday.trend > 0 ? "+" : ""}{salesToday.trend.toFixed(1)}%</div>
          </div>
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#111111", marginBottom: 6 }}>Outstanding Receivables</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111111", fontFamily: "Courier New, monospace" }}>Rs. {formatNumber(receivables.total)}</div>
            <div style={{ fontSize: 11, color: "#111111", marginTop: 4 }}>{receivables.overdueCount} overdue invoice{receivables.overdueCount !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#111111", marginBottom: 6 }}>Cash & Bank Balance</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111111", fontFamily: "Courier New, monospace" }}>Rs. {formatNumber(cashAndBank.total)}</div>
            <div style={{ fontSize: 11, color: "#111111", marginTop: 4 }}>{cashAndBank.list.length} account{cashAndBank.list.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#111111", marginBottom: 6 }}>VAT Liability</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111111", fontFamily: "Courier New, monospace" }}>Rs. {formatNumber(vatLiability.total)}</div>
            <div style={{ fontSize: 11, color: "#111111", marginTop: 4 }}>Due: {vatLiability.dueDateBS}</div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Vouchers */}
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, color: "#111111", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#A8CC88", borderBottom: "1px solid #8FB870", padding: "10px 12px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>Recent Vouchers</h3>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead style={{ borderBottom: "1px solid #8FB870", background: "rgba(0,0,0,0.02)" }}>
                  <tr>
                    <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#111111", textTransform: "uppercase" }}>Date (BS)</th>
                    <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#111111", textTransform: "uppercase" }}>Type / No</th>
                    <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#111111", textTransform: "uppercase", textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: "1px solid #8FB870" }}>
                  {recentVouchers.length === 0 ? (
                    <tr><td colSpan={3} style={{ textAlign: "center", padding: "16px", fontSize: 12, color: "#111111" }}>No recent vouchers</td></tr>
                  ) : (
                    recentVouchers.map(v => (
                      <tr key={v.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                        <td style={{ padding: "8px 12px", fontSize: 11, color: "#111111", fontFamily: "monospace" }}>{v.dateNepali}</td>
                        <td style={{ padding: "8px 12px" }}>
                           <div style={{ fontSize: 10, fontWeight: 700, color: "#111111", textTransform: "uppercase" }}>{v.type.replace(/_/g, ' ')}</div>
                           <div style={{ fontSize: 12, fontFamily: "monospace", color: "#111111" }}>{v.voucherNo}</div>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#111111" }}>
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
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, color: "#111111", overflow: "hidden", display: "flex", flexDirection: "column" }}>
             <div style={{ background: "#A8CC88", borderBottom: "1px solid #8FB870", padding: "10px 12px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>
                Stock Alerts
              </h3>
            </div>
            <div className="flex-1 overflow-x-auto">
               <table className="w-full text-left whitespace-nowrap">
                <thead style={{ borderBottom: "1px solid #8FB870", background: "rgba(0,0,0,0.02)" }}>
                  <tr>
                    <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#111111", textTransform: "uppercase" }}>Item Name</th>
                    <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#111111", textTransform: "uppercase", textAlign: "right" }}>Current Qty</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: "1px solid #8FB870" }}>
                  {stockAlerts.length === 0 ? (
                    <tr><td colSpan={2} style={{ textAlign: "center", padding: "16px", fontSize: 12, color: "#111111" }}>Stock levels healthy</td></tr>
                  ) : (
                    stockAlerts.map(alert => (
                      <tr key={alert.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                        <td style={{ padding: "8px 12px" }}>
                           <div style={{ fontSize: 12, fontWeight: 600, color: "#111111" }}>{alert.name}</div>
                           <div style={{ fontSize: 10, color: "#111111" }}>Reorder: {alert.reorderLevel} {alert.unit}</div>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                           <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: "transparent", color: "#111111" }}>
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
          <div style={{ background: "#D4EBB5", border: "1px solid #8FB870", borderRadius: 4, color: "#111111", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#A8CC88", borderBottom: "1px solid #8FB870", padding: "10px 12px" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>
                Compliance Deadlines
              </h3>
            </div>
            <div style={{ flex: 1, overflowX: "auto", padding: "12px" }}>
               <div className="space-y-3">
                 {complianceDates.map(cd => (
                   <div key={cd.name} style={{ border: "1px solid #8FB870", borderRadius: 4, padding: "12px", background: "rgba(0,0,0,0.02)", boxShadow: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#111111" }}>
                           {cd.name}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#111111" }}>{cd.date}</span>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "#111111", opacity: 0.8 }}>
                        Deadline in BS Date
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
