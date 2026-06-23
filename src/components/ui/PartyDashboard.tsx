import React, { useMemo } from "react";
import { useStore } from "../../store/useStore";
import { X, CheckCircle, AlertTriangle, XCircle, ChevronRight, Phone, Mail, MapPin } from "lucide-react";
import { formatNumber } from "../../lib/utils";
import { VoucherType } from "../../lib/types";

interface PartyDashboardProps {
  partyId: string;
  partyName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartyDashboard({ partyId, partyName, isOpen, onClose }: PartyDashboardProps) {
  const { parties, billWiseEntries, vouchers, invoices, setCurrentPage, setReportFilters } = useStore();

  const party = useMemo(() => parties.find(p => p.id === partyId), [parties, partyId]);

  const { balance, limitUtilization, overdues, lastTransactions, stats } = useMemo(() => {
    if (!party) return { balance: 0, limitUtilization: 0, overdues: [], lastTransactions: [], stats: { purchases: 0, sales: 0 } };

    // Outstanding Bills
    const partyBills = billWiseEntries.filter(b => b.partyId === partyId && !b.isSettled);
    
    // Naive sum of pending amount
    const currentBalance = partyBills.reduce((acc, curr) => acc + curr.pendingAmount, 0);

    const partyOverdues = partyBills
      .filter(b => b.dueDate && new Date(b.dueDate) < new Date())
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5);

    const creditLimit = party.creditLimit || 0;
    const utilization = creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0;

    // Last 10 Transactions
    const partyVouchers = vouchers
      .filter(v => v.partyId === partyId)
      .map(v => ({ date: v.date, no: v.voucherNo, type: v.type, amount: v.grandTotal || 0, isDr: v.totalDebit > 0 }));
    
    const partyInvoices = invoices
      .filter(i => i.partyId === partyId)
      .map(i => ({ date: i.date, no: i.invoiceNo, type: i.type, amount: i.grandTotal || 0, isDr: i.type === VoucherType.SALES_INVOICE }));

    const transactions = [...partyVouchers, ...partyInvoices]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);

    // Quick Stats
    const purchases = invoices
      .filter(i => i.partyId === partyId && i.type === VoucherType.PURCHASE_INVOICE)
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    const sales = invoices
      .filter(i => i.partyId === partyId && i.type === VoucherType.SALES_INVOICE)
      .reduce((sum, inv) => sum + inv.grandTotal, 0);

    return {
      balance: currentBalance,
      limitUtilization: utilization,
      overdues: partyOverdues,
      lastTransactions: transactions,
      stats: { purchases, sales }
    };
  }, [partyId, party, billWiseEntries, vouchers, invoices]);

  if (!party) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-[380px] bg-[#f5f6fa] shadow-2xl z-50 transform transition-transform duration-200 ease-in-out border-l border-gray-200 overflow-y-auto ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="sticky top-0 bg-[#1e2433] text-white p-4 flex justify-between items-center shadow-md z-10">
          <div>
            <h2 className="text-[14px] font-bold">{partyName}</h2>
            <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
              <span>{party.code}</span>
              {party.pan && <span>| PAN: {party.pan}</span>}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded flex items-center justify-center hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer outline-none">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Section 1 - Party Info */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              {party.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-gray-400"/> {party.phone}</div>}
              {party.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-gray-400"/> <span className="truncate">{party.email}</span></div>}
              {party.contactPerson && <div className="col-span-2 flex items-center gap-1.5 text-gray-500"><MapPin className="w-3 h-3 text-gray-400"/> {party.contactPerson}</div>}
            </div>
          </div>

          {/* Section 2 - KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 kpi-card">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 kpi-label">Current Balance</div>
              <div className="text-[15px] font-bold text-gray-800 font-mono kpi-value">
                {formatNumber(balance)} <span className="text-[10px] text-gray-500 font-sans font-normal">{balance > 0 ? "Dr" : balance < 0 ? "Cr" : ""}</span>
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 kpi-card">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex justify-between kpi-label">
                Credit Limit
                <span className={limitUtilization > 90 ? "text-red-500" : "text-gray-500"}>{Math.round(limitUtilization)}%</span>
              </div>
              <div className="text-[12px] font-bold text-gray-800 font-mono mb-1.5 kpi-value">
                {party.creditLimit ? formatNumber(party.creditLimit) : "No Limit"}
              </div>
              {party.creditLimit && (
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${limitUtilization > 90 ? "bg-red-500" : limitUtilization > 75 ? "bg-amber-500" : "bg-[#1557b0]"}`} 
                    style={{ width: `${Math.min(limitUtilization, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 kpi-card">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 kpi-label">
              <AlertTriangle className={`w-3.5 h-3.5 ${overdues.length > 0 ? "text-amber-500" : "text-green-500"}`} />
              Credit Days Info
            </div>
            <div className="mt-2 text-[12px] text-gray-700">
              {party.creditDays ? <span className="font-semibold">{party.creditDays} Days</span> : <span className="text-gray-400">Not set</span>}
              {overdues.length > 0 && (
                <div className="mt-1 text-red-600 text-[11px] font-medium flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Has overdue bills
                </div>
              )}
            </div>
          </div>

          {/* Section 3 - Outstanding Bills */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#f5f6fa] px-3 py-2 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Outstanding Bills</h3>
              <button 
                className="text-[10px] font-bold text-[#1557b0] hover:underline cursor-pointer flex items-center"
                onClick={() => {
                  setReportFilters({ partyId });
                  setCurrentPage("bill-pending");
                  onClose();
                }}
              >
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-0">
              <table className="w-full data-table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-gray-500 uppercase">Bill No</th>
                    <th className="px-3 py-1.5 text-left text-[9px] font-semibold text-gray-500 uppercase">Due</th>
                    <th className="px-3 py-1.5 text-right text-[9px] font-semibold text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {overdues.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-[11px] text-gray-400">No overdue bills</td>
                    </tr>
                  ) : (
                    overdues.map(b => {
                      const isOverdue = b.dueDate && new Date(b.dueDate) < new Date();
                      return (
                        <tr key={b.id} className={`border-b border-gray-50 last:border-0 ${isOverdue ? "bg-red-50/50" : ""}`}>
                          <td className="px-3 py-1.5 text-[11px] text-gray-700 font-mono">{b.refNo}</td>
                          <td className="px-3 py-1.5 text-[11px] text-gray-600">{b.dueDate ? new Date(b.dueDate).toLocaleDateString() : "-"}</td>
                          <td className="px-3 py-1.5 text-[11px] text-gray-800 font-mono text-right font-medium">{formatNumber(b.pendingAmount)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4 - Last Transactions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[#f5f6fa] px-3 py-2 border-b border-gray-200">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Last Transactions</h3>
            </div>
            <div className="p-0">
              <table className="w-full data-table">
                <tbody>
                  {lastTransactions.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-[11px] text-gray-400">No transactions</td>
                    </tr>
                  ) : (
                    lastTransactions.map((t, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={onClose}>
                        <td className="px-3 py-1.5 text-[10px] text-gray-500 w-16">{new Date(t.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</td>
                        <td className="px-3 py-1.5 text-[11px]">
                          <div className="font-mono text-gray-700">{t.no}</div>
                          <div className="badge badge-default scale-75 origin-left mt-0.5">{t.type.replace('_', ' ')}</div>
                        </td>
                        <td className={`px-3 py-1.5 text-[11px] font-mono text-right font-medium ${t.isDr ? "text-[#1557b0]" : "text-red-600"}`}>
                          {formatNumber(t.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5 - Quick Stats */}
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 mb-6">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2 border-b border-gray-100 pb-1">Activity Overview</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-gray-400">Total Purchases</div>
                <div className="text-[12px] font-bold text-gray-700 font-mono">{formatNumber(stats.purchases)}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Total Sales</div>
                <div className="text-[12px] font-bold text-gray-700 font-mono">{formatNumber(stats.sales)}</div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}
