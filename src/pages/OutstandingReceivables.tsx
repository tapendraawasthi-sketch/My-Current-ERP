import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/ui/ReportShell";
import BsDateCell from "../components/reporting/BsDateCell";
import { ADToBSLong } from "../lib/nepaliDate";
import { Download, Printer } from "lucide-react";
import toast from "react-hot-toast";

// Fix BUG-018: no dexie-react-hooks, no named db import — uses store directly

function fmtAmt(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const OutstandingReceivables: React.FC = () => {
  const { invoices, parties } = useStore(); // ← Fix BUG-018: use store, not dexie hook

  const today = new Date().toISOString().split("T")[0];
  const [asAt, setAsAt] = useState(today);

  const partyMap = useMemo(() => {
    const m = new Map<string, string>();
    (parties ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [parties]);

  interface OsRow {
    partyId: string;
    partyName: string;
    invoiceNo: string;
    date: string;
    dueDate: string;
    grandTotal: number;
    paidAmount: number;
    outstanding: number;
    daysOverdue: number;
  }

  const rows = useMemo<OsRow[]>(() => {
    return (invoices ?? [])
      .filter((inv) => {
        if (inv.status !== "posted") return false;
        if (inv.type !== "sales-invoice" && inv.type !== "sales") return false;
        const d = (inv.date ?? "").split("T")[0];
        if (d > asAt) return false;
        const balance = Number(inv.balanceAmount ?? (Number(inv.grandTotal ?? 0) - Number(inv.paidAmount ?? 0)));
        return balance > 0.01;
      })
      .map((inv) => {
        const paidAmt    = Number(inv.paidAmount ?? 0);
        const grandTotal = Number(inv.grandTotal ?? 0);
        const outstanding = grandTotal - paidAmt;
        const dueDate    = (inv.dueDate ?? inv.date ?? asAt).split("T")[0];
        const dueDateObj = new Date(dueDate);
        const asAtObj    = new Date(asAt);
        const daysOver   = Math.floor((asAtObj.getTime() - dueDateObj.getTime()) / 86400000);
        return {
          partyId:     inv.partyId ?? "",
          partyName:   inv.partyName ?? partyMap.get(inv.partyId ?? "") ?? "Unknown",
          invoiceNo:   inv.invoiceNo,
          date:        (inv.date ?? "").split("T")[0],
          dueDate,
          grandTotal,
          paidAmount:  paidAmt,
          outstanding,
          daysOverdue: Math.max(0, daysOver),
        };
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices, asAt, partyMap]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.outstanding, 0), [rows]);

  const handleExport = () => {
    const header = ["Party", "Invoice No", "Date (BS)", "Date (AD)", "Due Date (BS)", "Due Date (AD)", "Grand Total", "Paid", "Outstanding", "Days Overdue"];
    const data   = rows.map((r) => [
      r.partyName, r.invoiceNo,
      ADToBSLong(r.date), r.date,
      ADToBSLong(r.dueDate), r.dueDate,
      r.grandTotal, r.paidAmount, r.outstanding, r.daysOverdue,
    ].map((c) => `"${c}"`).join(","));
    const csv  = [header.join(","), ...data].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `outstanding-receivables-${asAt}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
  const td = "px-3 py-2.5 text-[12px] text-gray-700";

  const actions = (
    <>
      <button onClick={handleExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
        <Download className="h-4 w-4" /> Export
      </button>
      <button onClick={() => window.print()} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
        <Printer className="h-4 w-4" /> Print
      </button>
    </>
  );

  return (
    <ReportShell
      title="Outstanding Receivables"
      subtitle={`As at: ${ADToBSLong(asAt)} (${asAt}) — ${rows.length} invoices`}
      actions={actions}
    >
      <div className="no-print px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
        <label className="text-[11px] font-medium text-gray-600">As at</label>
        <input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
        <span className="text-[11px] text-gray-500">({ADToBSLong(asAt)})</span>
        <span className="ml-auto text-[12px] font-semibold text-[#1557b0]">
          Total Outstanding: {fmtAmt(total)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className={th}>Party</th>
              <th className={th}>Invoice No</th>
              {/* Fix BUG-033: BS date columns */}
              <th className={th}>Date (B.S.)</th>
              <th className={th}>Date (A.D.)</th>
              <th className={th}>Due Date (B.S.)</th>
              <th className={`${th} text-right`}>Grand Total</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>Outstanding</th>
              <th className={`${th} text-right`}>Days Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">No outstanding receivables.</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={`${td} font-medium text-gray-800`}>{row.partyName}</td>
                  <td className={td}>{row.invoiceNo}</td>
                  {/* Fix BUG-033: BsDateCell for proper BS display */}
                  <td className={td}><BsDateCell adDate={row.date} short bsOnly /></td>
                  <td className={td}>{row.date}</td>
                  <td className={td}><BsDateCell adDate={row.dueDate} short bsOnly /></td>
                  <td className={`${td} text-right font-mono`}>{fmtAmt(row.grandTotal)}</td>
                  <td className={`${td} text-right font-mono text-green-700`}>{fmtAmt(row.paidAmount)}</td>
                  <td className={`${td} text-right font-mono font-bold text-[#1557b0]`}>{fmtAmt(row.outstanding)}</td>
                  <td className={`${td} text-right font-mono ${row.daysOverdue > 90 ? "text-red-600 font-bold" : row.daysOverdue > 30 ? "text-amber-600" : "text-gray-600"}`}>
                    {row.daysOverdue > 0 ? `${row.daysOverdue}d` : "Current"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td colSpan={7} className="px-3 py-2.5 text-[12px] text-gray-700">Total Outstanding</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#1557b0]">{fmtAmt(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
};

export default OutstandingReceivables;
