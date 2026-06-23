import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { VoucherType, VoucherStatus, PaymentStatus } from "../lib/types";
import { formatNumber } from "../lib/utils";
import { ArrowLeft, ChevronDown, ChevronRight, Calendar, Percent, ShieldAlert, Receipt } from "lucide-react";
import toast from "react-hot-toast";

interface OverdueInvoiceDetail {
  id: string;
  invoiceNo: string;
  date: string;
  dueDate: string;
  outstanding: number;
  daysOverdue: number;
  interest: number;
}

interface PartyOverdueSummary {
  partyId: string;
  partyName: string;
  totalOutstanding: number;
  totalInterest: number;
  overdueCount: number;
  invoices: OverdueInvoiceDetail[];
}

const OverdueBillsInterest: React.FC = () => {
  const { billWiseEntries, parties, companySettings, setCurrentPage, interestSlabs, calculateInterestOnBills, addVoucher } = useStore();

  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [interestRate, setInterestRate] = useState<number>(18);
  const [minDays, setMinDays] = useState<number>(0);
  const [selectedSlabId, setSelectedSlabId] = useState<string>("");
  const [expandedParties, setExpandedParties] = useState<Set<string>>(new Set());

  // Toggle expanded card/table per party
  const toggleExpand = (partyId: string) => {
    const next = new Set(expandedParties);
    if (next.has(partyId)) {
      next.delete(partyId);
    } else {
      next.add(partyId);
    }
    setExpandedParties(next);
  };

  // Computation of overdue invoices and interest mapping
  const overdueSummary = useMemo((): PartyOverdueSummary[] => {
    const todayMs = new Date(asOfDate).getTime();
    if (isNaN(todayMs)) return [];

    const partyMap: Record<string, OverdueInvoiceDetail[]> = {};

    // Only process unsettled bills
    const openEntries = billWiseEntries.filter(e => !e.isSettled);

    const calcResults = calculateInterestOnBills(openEntries, asOfDate, selectedSlabId || undefined, selectedSlabId ? undefined : interestRate);

    calcResults.forEach((res) => {
      if (res.daysOverdue >= minDays && res.interestAmount > 0) {
        if (!partyMap[res.entry.partyId]) {
          partyMap[res.entry.partyId] = [];
        }
        partyMap[res.entry.partyId].push({
          id: res.entry.voucherId,
          invoiceNo: res.entry.voucherNo,
          date: res.entry.date,
          dueDate: res.entry.dueDate,
          outstanding: res.entry.balanceAmount,
          daysOverdue: res.daysOverdue,
          interest: Math.round(res.interestAmount * 100) / 100,
        });
      }
    });

    return Object.entries(partyMap)
      .map(([partyId, items]) => {
        const partyName = parties.find((p) => p.id === partyId)?.name || "Unknown Party";
        const totalOutstanding = items.reduce((sum, item) => sum + item.outstanding, 0);
        const totalInterest = items.reduce((sum, item) => sum + item.interest, 0);
        return {
          partyId,
          partyName,
          totalOutstanding,
          totalInterest,
          overdueCount: items.length,
          invoices: items,
        };
      })
      .sort((a, b) => b.totalInterest - a.totalInterest);
  }, [billWiseEntries, parties, asOfDate, interestRate, minDays, selectedSlabId, calculateInterestOnBills]);

  const grandTotals = useMemo(() => {
    return overdueSummary.reduce(
      (totals, party) => {
        totals.outstanding += party.totalOutstanding;
        totals.interest += party.totalInterest;
        totals.count += party.overdueCount;
        return totals;
      },
      { outstanding: 0, interest: 0, count: 0 },
    );
  }, [overdueSummary]);

  const symbol = companySettings?.currencySymbol || "Rs.";

  const handlePostInterest = async (partyData: PartyOverdueSummary) => {
    const party = parties.find(p => p.id === partyData.partyId);
    if (!party || !party.accountId) {
      toast.error("Party account ledger not found.");
      return;
    }
    
    // We assume there's an Interest Income ledger
    const { accounts } = useStore.getState();
    const interestLedger = accounts.find((a) => a.name.toLowerCase().includes("interest income") || a.name.toLowerCase().includes("interest received"));
    if (!interestLedger) {
      toast.error("Interest Income ledger not found. Please create one first.");
      return;
    }

    try {
      const payload: any = {
        type: VoucherType.JOURNAL,
        status: VoucherStatus.DRAFT,
        date: asOfDate,
        dateNepali: "",
        voucherNo: `JV-INT-${Math.random().toString(36).substring(2,8).toUpperCase()}`,
        narration: `Interest calculation as of ${asOfDate}`,
        partyId: party.id,
        partyName: party.name,
        lines: [
          { accountId: party.accountId, debit: partyData.totalInterest, credit: 0 },
          { accountId: interestLedger.id, debit: 0, credit: partyData.totalInterest }
        ],
        totalDebit: partyData.totalInterest,
        totalCredit: partyData.totalInterest,
      };

      await addVoucher(payload);
      toast.success("Draft Journal Voucher created for interest.");
      setCurrentPage("journal");
    } catch (e: any) {
      toast.error("Failed to post interest: " + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 select-none animate-fadeIn text-xs max-w-5xl mx-auto pb-16">
      <ActionToolbar
        title="Overdue Bills Interest"
        subtitle="Interest calculation on overdue receivables and payables"
      />
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-150 pb-5">
        <button
          onClick={() => setCurrentPage("reports")}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">
            Overdue Bills Interest Calculator
          </h2>
          <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5">
            Audit interest accumulated on outstanding customer ledger balances
          </p>
        </div>
      </div>

      {/* Control panel filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> As Of Date
          </span>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            Interest Slab
          </span>
          <select
            value={selectedSlabId}
            onChange={(e) => setSelectedSlabId(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          >
            <option value="">-- Use Fixed Rate --</option>
            {interestSlabs.filter(s => s.isActive).map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.basisType})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <Percent className="h-3 w-3" /> Fixed Rate (% p.a.)
          </span>
          <input
            type="number"
            min="0"
            max="100"
            value={interestRate}
            onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
            disabled={!!selectedSlabId}
            className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Min Days Overdue
          </span>
          <input
            type="number"
            min="0"
            value={minDays}
            onChange={(e) => setMinDays(parseInt(e.target.value) || 0)}
            className="border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Summary KPI stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            Total Overdue Invoices
          </span>
          <span className="text-base font-bold text-slate-800">{grandTotals.count} Bills</span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            Overdue Outstanding
          </span>
          <span className="text-base font-bold text-red-600 font-mono">
            {symbol} {formatNumber(grandTotals.outstanding)}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-1 text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            Total Accumulated Interest
          </span>
          <span className="text-base font-bold text-indigo-700 font-mono">
            {symbol} {formatNumber(grandTotals.interest)}
          </span>
        </div>
      </div>

      {/* Main Aggregated Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        {overdueSummary.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-medium">
            No overdue accounts matching search parameters.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
              Customer Receivables Interest
            </h3>
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-150">
                  <tr>
                    <th className="py-2 px-3 w-10"></th>
                    <th className="py-2 px-2 text-left">Customer / Party Name</th>
                    <th className="py-2 px-2 text-center w-28">Overdue Invoices</th>
                    <th className="py-2 px-2 text-right w-36">Outstanding Amount</th>
                    <th className="py-2 px-2 text-right w-36">Accumulated Interest</th>
                    <th className="py-2 px-2 w-28 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueSummary.map((party) => {
                    const isExpanded = expandedParties.has(party.partyId);
                    return (
                      <React.Fragment key={party.partyId}>
                        {/* Parent Party Row */}
                        <tr
                          onClick={() => toggleExpand(party.partyId)}
                          className="hover:bg-slate-50/50 cursor-pointer font-bold"
                        >
                          <td className="py-3 px-3 text-center">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-800">{party.partyName}</td>
                          <td className="py-3 px-2 text-center text-slate-500 font-medium">
                            {party.overdueCount} bills
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-red-500">
                            {symbol} {formatNumber(party.totalOutstanding)}
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-bold text-indigo-700">
                            {symbol} {formatNumber(party.totalInterest)}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostInterest(party);
                              }}
                              className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold hover:bg-indigo-100 uppercase inline-flex items-center gap-1"
                              title="Post Draft Journal"
                            >
                              <Receipt className="h-3 w-3" /> Post
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Invoices list */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50/50 p-4">
                              <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100/70 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-150">
                                    <tr>
                                      <th className="py-1.5 px-3 text-left">Invoice No</th>
                                      <th className="py-1.5 px-2 text-left">Bill Date</th>
                                      <th className="py-1.5 px-2 text-left">Due Date</th>
                                      <th className="py-1.5 px-2 text-center">Days Overdue</th>
                                      <th className="py-1.5 px-2 text-right">Dues Principal</th>
                                      <th className="py-1.5 px-3 text-right">Computed Interest</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-[11px] font-medium">
                                    {party.invoices.map((inv) => (
                                      <tr key={inv.id} className="hover:bg-slate-50/40">
                                        <td className="py-2 px-3 font-semibold text-slate-700">
                                          {inv.invoiceNo}
                                        </td>
                                        <td className="py-2 px-2 text-slate-500">{inv.date}</td>
                                        <td className="py-2 px-2 text-slate-500">{inv.dueDate}</td>
                                        <td className="py-2 px-2 text-center text-slate-600 font-bold">
                                          {inv.daysOverdue} days
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono text-slate-700">
                                          {symbol} {formatNumber(inv.outstanding)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-[#1557b0] font-bold">
                                          {symbol} {formatNumber(inv.interest)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverdueBillsInterest;
