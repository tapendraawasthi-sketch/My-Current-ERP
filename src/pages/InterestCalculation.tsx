import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
// Fix BUG-017: no dexie-react-hooks, no wrong db import, no missing generateSerialNumber
import ReportShell from "../components/ui/ReportShell";
import { ADToBSLong } from "../lib/nepaliDate";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

function fmtAmt(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

const InterestCalculation: React.FC = () => {
  // Fix BUG-017: uses store hooks directly, not dexie-react-hooks
  const { invoices, parties } = useStore();

  const today = new Date().toISOString().split("T")[0];
  const [asAt,       setAsAt      ] = useState(today);
  const [interestRate, setInterestRate] = useState<number>(18); // annual %
  const [partyType,  setPartyType ] = useState<"customer" | "supplier" | "all">("customer");
  const [minDays,    setMinDays   ] = useState<number>(30);

  const partyMap = useMemo(() => {
    const m = new Map<string, string>();
    (parties ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [parties]);

  interface InterestRow {
    partyId:    string;
    partyName:  string;
    invoiceNo:  string;
    date:       string;
    dueDate:    string;
    outstanding: number;
    daysOverdue: number;
    interestAmt: number;
  }

  const rows = useMemo<InterestRow[]>(() => {
    const dailyRate = interestRate / 100 / 365;

    return (invoices ?? [])
      .filter((inv) => {
        if (inv.status !== "posted") return false;
        const isCustomer = inv.type === "sales-invoice" || inv.type === "sales";
        const isSupplier = inv.type === "purchase-invoice" || inv.type === "purchase";
        if (partyType === "customer" && !isCustomer) return false;
        if (partyType === "supplier" && !isSupplier) return false;
        const d = (inv.date ?? "").split("T")[0];
        if (d > asAt) return false;
        const balance = Number(inv.balanceAmount ?? (Number(inv.grandTotal ?? 0) - Number(inv.paidAmount ?? 0)));
        return balance > 0;
      })
      .map((inv) => {
        const outstanding = Number(inv.grandTotal ?? 0) - Number(inv.paidAmount ?? 0);
        const dueDate     = (inv.dueDate ?? inv.date ?? asAt).split("T")[0];
        const daysOverdue = daysBetween(dueDate, asAt);
        const interestAmt = daysOverdue >= minDays
          ? outstanding * dailyRate * daysOverdue
          : 0;
        return {
          partyId:    inv.partyId  ?? "",
          partyName:  inv.partyName ?? partyMap.get(inv.partyId ?? "") ?? "Unknown",
          invoiceNo:  inv.invoiceNo,
          date:       (inv.date ?? "").split("T")[0],
          dueDate,
          outstanding,
          daysOverdue,
          interestAmt,
        };
      })
      .filter((r) => r.daysOverdue >= minDays)
      .sort((a, b) => b.interestAmt - a.interestAmt);
  }, [invoices, asAt, interestRate, partyType, minDays, partyMap]);

  const totalInterest    = useMemo(() => rows.reduce((s, r) => s + r.interestAmt, 0), [rows]);
  const totalOutstanding = useMemo(() => rows.reduce((s, r) => s + r.outstanding, 0), [rows]);

  const handleExport = () => {
    const header = ["Party","Invoice No","Date","Due Date","Outstanding","Days Overdue","Interest"];
    const data   = rows.map((r) => [r.partyName, r.invoiceNo, r.date, r.dueDate, r.outstanding, r.daysOverdue, r.interestAmt.toFixed(2)].map((c) => `"${c}"`).join(","));
    const csv    = [header.join(","), ...data].join("\n");
    const blob   = new Blob([csv], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url; a.download = `interest-calculation-${asAt}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
  const td = "px-3 py-2.5 text-[12px] text-gray-700";

  return (
    <ReportShell
      title="Interest Calculation"
      subtitle={`Overdue interest as at ${ADToBSLong(asAt)}`}
      actions={
        <button onClick={handleExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
          <Download className="h-4 w-4" /> Export
        </button>
      }
    >
      <div className="no-print px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">As at</label>
          <input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">Interest Rate %/yr</label>
          <input type="number" value={interestRate} min={0} max={100} step={0.5}
            onChange={(e) => setInterestRate(Number(e.target.value))} className={`${inputCls} w-20`} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">Min Overdue Days</label>
          <input type="number" value={minDays} min={0}
            onChange={(e) => setMinDays(Number(e.target.value))} className={`${inputCls} w-20`} />
        </div>
        <select value={partyType} onChange={(e) => setPartyType(e.target.value as typeof partyType)} className={inputCls}>
          <option value="customer">Customers</option>
          <option value="supplier">Suppliers</option>
          <option value="all">All</option>
        </select>
        <div className="ml-auto flex gap-4 text-[12px]">
          <span className="text-gray-600">Outstanding: <strong>{fmtAmt(totalOutstanding)}</strong></span>
          <span className="text-red-700 font-semibold">Interest Due: {fmtAmt(totalInterest)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className={th}>Party</th>
              <th className={th}>Invoice No</th>
              <th className={th}>Date</th>
              <th className={th}>Due Date</th>
              <th className={`${th} text-right`}>Outstanding</th>
              <th className={`${th} text-right`}>Days Overdue</th>
              <th className={`${th} text-right`}>Interest (@{interestRate}% p.a.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">No overdue invoices found.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={`${td} font-medium`}>{r.partyName}</td>
                  <td className={td}>{r.invoiceNo}</td>
                  <td className={td}>{r.date}</td>
                  <td className={td}>{r.dueDate}</td>
                  <td className={`${td} text-right font-mono`}>{fmtAmt(r.outstanding)}</td>
                  <td className={`${td} text-right font-mono text-amber-700`}>{r.daysOverdue}d</td>
                  <td className={`${td} text-right font-mono text-red-700 font-bold`}>{fmtAmt(r.interestAmt)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td colSpan={4} className="px-3 py-2.5 text-[12px] text-gray-700">Total</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px]">{fmtAmt(totalOutstanding)}</td>
                <td />
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-red-700">{fmtAmt(totalInterest)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
};

export default InterestCalculation;
