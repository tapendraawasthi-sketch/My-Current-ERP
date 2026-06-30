import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/ui/ReportShell";
import BsDateCell from "../components/reporting/BsDateCell";
import { ADToBSLong } from "../lib/nepaliDate";
import { Download, Printer } from "lucide-react";
import toast from "react-hot-toast";

function fmtAmt(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "91-180" | "180+";

function getAgingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0)   return "current";
  if (daysOverdue <= 30)  return "1-30";
  if (daysOverdue <= 60)  return "31-60";
  if (daysOverdue <= 90)  return "61-90";
  if (daysOverdue <= 180) return "91-180";
  return "180+";
}

const AgingReport: React.FC = () => {
  // Fix BUG-014: uses store directly (no dexie-react-hooks, no named db export)
  const { invoices, parties } = useStore();

  const today = new Date().toISOString().split("T")[0];
  const [asAt,  setAsAt ] = useState(today);
  const [pType, setPType] = useState<"all" | "customer" | "supplier">("customer");

  const partyMap = useMemo(() => {
    const m = new Map<string, string>();
    (parties ?? []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [parties]);

  interface AgingRow {
    partyId: string;
    partyName: string;
    current: number;
    "1-30": number;
    "31-60": number;
    "61-90": number;
    "91-180": number;
    "180+": number;
    total: number;
    invoiceCount: number;
    oldestInvoiceDate: string;
  }

  const agingRows = useMemo<AgingRow[]>(() => {
    const inv = (invoices ?? []).filter((inv) => {
      if (inv.status !== "posted") return false;
      const d = (inv.date ?? "").split("T")[0];
      if (d > asAt) return false;
      const balance = Number(inv.balanceAmount ?? (Number(inv.grandTotal ?? 0) - Number(inv.paidAmount ?? 0)));
      if (balance <= 0) return false;
      if (pType === "customer") return inv.type === "sales-invoice" || inv.type === "sales";
      if (pType === "supplier") return inv.type === "purchase-invoice" || inv.type === "purchase";
      return true;
    });

    const map = new Map<string, AgingRow>();

    for (const invoice of inv) {
      const partyId   = invoice.partyId   ?? "unknown";
      const partyName = invoice.partyName ?? partyMap.get(partyId) ?? "Unknown";
      const dueDate   = invoice.dueDate   ?? invoice.date ?? asAt;
      const daysOver  = daysDiff(dueDate, asAt);
      const bucket    = getAgingBucket(daysOver);
      const balance   = Math.max(0, Number(invoice.balanceAmount ?? (Number(invoice.grandTotal ?? 0) - Number(invoice.paidAmount ?? 0))));

      if (!map.has(partyId)) {
        map.set(partyId, {
          partyId,
          partyName,
          "current": 0,
          "1-30": 0,
          "31-60": 0,
          "61-90": 0,
          "91-180": 0,
          "180+": 0,
          total: 0,
          invoiceCount: 0,
          oldestInvoiceDate: invoice.date ?? "",
        });
      }

      const row = map.get(partyId)!;
      row[bucket] += balance;
      row.total   += balance;
      row.invoiceCount++;
      if ((invoice.date ?? "") < row.oldestInvoiceDate || !row.oldestInvoiceDate) {
        row.oldestInvoiceDate = invoice.date ?? "";
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [invoices, parties, asAt, pType, partyMap]);

  const grandTotals = useMemo(() => {
    return agingRows.reduce(
      (acc, r) => ({
        "current": acc["current"] + r["current"],
        "1-30":    acc["1-30"]    + r["1-30"],
        "31-60":   acc["31-60"]   + r["31-60"],
        "61-90":   acc["61-90"]   + r["61-90"],
        "91-180":  acc["91-180"]  + r["91-180"],
        "180+":    acc["180+"]    + r["180+"],
        total:     acc.total      + r.total,
      }),
      { "current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "91-180": 0, "180+": 0, total: 0 },
    );
  }, [agingRows]);

  const handleExport = () => {
    const headers = ["Party", "Current", "1-30", "31-60", "61-90", "91-180", "180+", "Total"];
    const rows = agingRows.map((r) =>
      [r.partyName, r["current"], r["1-30"], r["31-60"], r["61-90"], r["91-180"], r["180+"], r.total]
        .map((c) => `"${c}"`).join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `aging-report-${asAt}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Aging Report exported");
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
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

  // Fix BUG-032: BS date in subtitle
  return (
    <ReportShell
      title="Aging Report"
      subtitle={`As at: ${ADToBSLong(asAt)} (${asAt})`}
      actions={actions}
    >
      <div className="no-print px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">As at</label>
          <input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} className={inputCls} />
          <span className="text-[11px] text-gray-500">({ADToBSLong(asAt)})</span>
        </div>
        <select value={pType} onChange={(e) => setPType(e.target.value as typeof pType)} className={inputCls}>
          <option value="customer">Customers (Debtors)</option>
          <option value="supplier">Suppliers (Creditors)</option>
          <option value="all">All Parties</option>
        </select>
        <span className="ml-auto text-[11px] text-gray-500">{agingRows.length} parties</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              <th className={th}>Party Name</th>
              <th className={`${th} text-right`}>Current</th>
              <th className={`${th} text-right`}>1-30 Days</th>
              <th className={`${th} text-right`}>31-60 Days</th>
              <th className={`${th} text-right`}>61-90 Days</th>
              <th className={`${th} text-right`}>91-180 Days</th>
              <th className={`${th} text-right`}>180+ Days</th>
              <th className={`${th} text-right`}>Total Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {agingRows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">No outstanding balances found.</td></tr>
            ) : (
              agingRows.map((row) => (
                <tr key={row.partyId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={`${td} font-medium text-gray-800`}>{row.partyName}</td>
                  <td className={`${td} text-right font-mono text-green-700`}>{row["current"] > 0 ? fmtAmt(row["current"]) : "-"}</td>
                  <td className={`${td} text-right font-mono text-amber-600`}>{row["1-30"]   > 0 ? fmtAmt(row["1-30"])   : "-"}</td>
                  <td className={`${td} text-right font-mono text-amber-700`}>{row["31-60"]  > 0 ? fmtAmt(row["31-60"])  : "-"}</td>
                  <td className={`${td} text-right font-mono text-orange-600`}>{row["61-90"] > 0 ? fmtAmt(row["61-90"])  : "-"}</td>
                  <td className={`${td} text-right font-mono text-red-500`}>{row["91-180"]   > 0 ? fmtAmt(row["91-180"]) : "-"}</td>
                  <td className={`${td} text-right font-mono text-red-700 font-bold`}>{row["180+"] > 0 ? fmtAmt(row["180+"]) : "-"}</td>
                  <td className={`${td} text-right font-mono font-bold text-gray-800`}>{fmtAmt(row.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          {agingRows.length > 0 && (
            <tfoot>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold">
                <td className="px-3 py-2.5 text-[12px] text-gray-700">Grand Total</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-green-700">{fmtAmt(grandTotals["current"])}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-amber-600">{fmtAmt(grandTotals["1-30"])}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px]">{fmtAmt(grandTotals["31-60"])}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px]">{fmtAmt(grandTotals["61-90"])}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px]">{fmtAmt(grandTotals["91-180"])}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-red-700">{fmtAmt(grandTotals["180+"])}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">{fmtAmt(grandTotals.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
};

export default AgingReport;
