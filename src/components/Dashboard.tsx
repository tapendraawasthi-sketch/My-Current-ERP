// @ts-nocheck
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

    (invoices || []).forEach(inv => {
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
    const data = computeOutstandingReceivables(parties || [], invoices || [], vouchers || []);
    let overdueCount = 0;
    (invoices || []).forEach(inv => {
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
    const list = (accounts || []).filter(a => 
      a.group === "Current Assets" && 
      (a.name.toLowerCase().includes("cash") || a.name.toLowerCase().includes("bank"))
    );
    const total = list.reduce((sum, a) => sum + (a.balance || 0), 0);
    return { total, list };
  }, [accounts]);

  // 4. VAT LIABILITY
  const vatLiability = useMemo(() => {
    const vatLedgers = (accounts || []).filter(a => a.name.toLowerCase().includes("vat payable"));
    const ledgerBalance = vatLedgers.reduce((sum, a) => sum + (a.balance || 0), 0);

    const currentMonthPrefix = todayBS.substring(0, 7);
    let inputVat = 0;
    let outputVat = 0;

    (invoices || []).forEach(inv => {
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
    return [...(vouchers || [])]
      .filter(v => v.status === VoucherStatus.POSTED)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [vouchers]);

  // 8. STOCK ALERTS
  const stockAlerts = useMemo(() => {
    const positions = computeAllStockPositions(stockMovements || [], items || [], warehouses || []);
    return positions
      .filter(pos => {
        const item = (items || []).find(i => i.id === pos.itemId);
        const reorder = item?.reorderLevel || 0;
        return pos.qty <= reorder;
      })
      .map(pos => {
        const item = (items || []).find(i => i.id === pos.itemId);
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
    return <div style={{ padding: "2rem", display: "flex", justifyContent: "center" }}><RefreshCw className="animate-spin text-[#1557b0]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa] pb-10">
      <div className="space-y-6 max-w-[1600px] mx-auto pt-6 px-4">
        
        {/* TOP ROW: KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Today's Sales (BS {todayBS})</div>
            <div className="text-[22px] font-bold text-gray-800 font-mono">Rs. {formatNumber(salesToday.total)}</div>
            <div className="text-[11px] text-gray-500 mt-1">vs yesterday: {salesToday.trend > 0 ? "+" : ""}{salesToday.trend.toFixed(1)}%</div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Outstanding Receivables</div>
            <div className="text-[22px] font-bold text-gray-800 font-mono">Rs. {formatNumber(receivables.total)}</div>
            <div className="text-[11px] text-gray-500 mt-1">{receivables.overdueCount} overdue invoice{receivables.overdueCount !== 1 ? "s" : ""}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Cash & Bank Balance</div>
            <div className="text-[22px] font-bold text-gray-800 font-mono">Rs. {formatNumber(cashAndBank.total)}</div>
            <div className="text-[11px] text-gray-500 mt-1">{cashAndBank.list.length} account{cashAndBank.list.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">VAT Liability</div>
            <div className="text-[22px] font-bold text-gray-800 font-mono">Rs. {formatNumber(vatLiability.total)}</div>
            <div className="text-[11px] text-gray-500 mt-1">Due: {vatLiability.dueDateBS}</div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Vouchers */}
          <div className="bg-white border border-gray-200 rounded flex flex-col overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5">
              <h3 className="text-[13px] font-bold text-gray-800">Recent Vouchers</h3>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Date (BS)</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Type / No</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentVouchers.length === 0 ? (
                    <tr><td colSpan={3} className="text-center p-4 text-xs text-gray-500">No recent vouchers</td></tr>
                  ) : (
                    recentVouchers.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-[11px] text-gray-700 font-mono">{v.dateNepali}</td>
                        <td className="px-3 py-2">
                           <div className="text-[10px] font-bold text-gray-800 uppercase">{v.type.replace(/_/g, ' ')}</div>
                           <div className="text-[12px] font-mono text-gray-600">{v.voucherNo}</div>
                        </td>
                        <td className="px-3 py-2 text-right text-[12px] font-mono font-bold text-gray-800">
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
          <div className="bg-white border border-gray-200 rounded flex flex-col overflow-hidden shadow-sm">
             <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5">
              <h3 className="text-[13px] font-bold text-gray-800">
                Stock Alerts
              </h3>
            </div>
            <div className="flex-1 overflow-x-auto">
               <table className="w-full text-left whitespace-nowrap">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Item Name</th>
                    <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">Current Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stockAlerts.length === 0 ? (
                    <tr><td colSpan={2} className="text-center p-4 text-xs text-gray-500">Stock levels healthy</td></tr>
                  ) : (
                    stockAlerts.map(alert => (
                      <tr key={alert.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                           <div className="text-[12px] font-semibold text-gray-800">{alert.name}</div>
                           <div className="text-[10px] text-gray-500">Reorder: {alert.reorderLevel} {alert.unit}</div>
                        </td>
                        <td className="px-3 py-2 text-right">
                           <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
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
          <div className="bg-white border border-gray-200 rounded flex flex-col overflow-hidden shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5">
              <h3 className="text-[13px] font-bold text-gray-800">
                Compliance Deadlines
              </h3>
            </div>
            <div className="flex-1 overflow-x-auto p-3">
               <div className="space-y-3">
                 {complianceDates.map(cd => (
                   <div key={cd.name} className="border border-gray-200 rounded p-3 bg-gray-50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[12px] font-bold text-gray-800">
                           {cd.name}
                        </span>
                        <span className="text-[13px] font-bold font-mono text-gray-800">{cd.date}</span>
                      </div>
                      <div className="text-[10px] font-medium text-gray-500">
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
