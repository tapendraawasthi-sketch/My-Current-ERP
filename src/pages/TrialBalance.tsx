import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import ReportShell, { type ReportDepth } from "../components/reports/ReportShell";

export default function TrialBalance() {
  const { accounts, vouchers, currentFiscalYear } = useStore();
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate ?? "");
  const [toDate, setToDate] = useState(
    currentFiscalYear?.endDate ?? new Date().toISOString().split("T")[0]
  );

  // Build per-account balance from posted vouchers
  const accountBalances = useMemo(() => {
    const map: Record<string, { dr: number; cr: number }> = {};
    for (const v of vouchers) {
      if (v.status !== "posted") continue;
      const d = v.date || "";
      if (fromDate && d < fromDate) continue;
      if (toDate && d > toDate) continue;
      for (const line of v.lines || []) {
        if (!line.accountId) continue;
        if (!map[line.accountId]) map[line.accountId] = { dr: 0, cr: 0 };
        map[line.accountId].dr += Number(line.debit || 0);
        map[line.accountId].cr += Number(line.credit || 0);
      }
    }
    return map;
  }, [vouchers, fromDate, toDate]);

  // Flatten accounts tree
  const rows = useMemo(() => {
    // Only ledger-level accounts
    const ledgers = accounts.filter(a => !a.isGroup && a.isActive !== false);
    return ledgers.map(a => {
      const bal = accountBalances[a.id] ?? { dr: 0, cr: 0 };
      const openDr = Number(a.openingBalanceDr || 0);
      const openCr = Number(a.openingBalanceCr || 0);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        group: a.parentId
          ? accounts.find(g => g.id === a.parentId)?.name ?? ""
          : "",
        openDr,
        openCr,
        txDr: bal.dr,
        txCr: bal.cr,
        closDr: Math.max(0, (openDr + bal.dr) - (openCr + bal.cr)),
        closCr: Math.max(0, (openCr + bal.cr) - (openDr + bal.dr)),
      };
    });
  }, [accounts, accountBalances]);

  const totals = useMemo(() => ({
    openDr: rows.reduce((s, r) => s + r.openDr, 0),
    openCr: rows.reduce((s, r) => s + r.openCr, 0),
    txDr:   rows.reduce((s, r) => s + r.txDr, 0),
    txCr:   rows.reduce((s, r) => s + r.txCr, 0),
    closDr: rows.reduce((s, r) => s + r.closDr, 0),
    closCr: rows.reduce((s, r) => s + r.closCr, 0),
  }), [rows]);

  const th = "px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right border border-gray-200 bg-[#f5f6fa]";
  const thL = "px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-left border border-gray-200 bg-[#f5f6fa]";
  const td = "px-3 py-2 text-[12px] text-gray-700 border border-gray-100 text-right font-mono";
  const tdL = "px-3 py-2 text-[12px] text-gray-700 border border-gray-100 text-left";

  const fmtDrCr = (dr: number, cr: number) => {
    if (dr > 0) return <span className="text-gray-800">Rs. {formatNumber(dr)}</span>;
    if (cr > 0) return <span className="text-gray-600">Rs. {formatNumber(cr)}</span>;
    return <span className="text-gray-300">—</span>;
  };

  return (
    <ReportShell
      title="Trial Balance"
      subtitle={`Period: ${fromDate} to ${toDate}`}
      onPrint={() => window.print()}
    >
      {(_depth: ReportDepth) => (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Filters */}
          <div className="p-3 border-b border-gray-200 bg-[#f5f6fa] flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thL} rowSpan={2} style={{verticalAlign:"middle"}}>Account</th>
                  <th className={thL} rowSpan={2} style={{verticalAlign:"middle"}}>Group</th>
                  <th className={th} colSpan={2} style={{textAlign:"center",background:"#e8f0fe",color:"#1557b0"}}>Opening</th>
                  <th className={th} colSpan={2} style={{textAlign:"center",background:"#e6f4ea",color:"#059669"}}>Transactions</th>
                  <th className={th} colSpan={2} style={{textAlign:"center",background:"#f3e8ff",color:"#7c3aed"}}>Closing</th>
                </tr>
                <tr>
                  <th className={th} style={{background:"#e8f0fe"}}>Dr</th>
                  <th className={th} style={{background:"#e8f0fe"}}>Cr</th>
                  <th className={th} style={{background:"#e6f4ea"}}>Dr</th>
                  <th className={th} style={{background:"#e6f4ea"}}>Cr</th>
                  <th className={th} style={{background:"#f3e8ff"}}>Dr</th>
                  <th className={th} style={{background:"#f3e8ff"}}>Cr</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className={tdL}>
                      <span className="font-mono text-[10px] text-gray-400 mr-1">{row.code}</span>
                      {row.name}
                    </td>
                    <td className={tdL + " text-gray-500"}>{row.group}</td>
                    <td className={td}>{row.openDr > 0 ? `Rs. ${formatNumber(row.openDr)}` : "—"}</td>
                    <td className={td}>{row.openCr > 0 ? `Rs. ${formatNumber(row.openCr)}` : "—"}</td>
                    <td className={td}>{row.txDr > 0 ? `Rs. ${formatNumber(row.txDr)}` : "—"}</td>
                    <td className={td}>{row.txCr > 0 ? `Rs. ${formatNumber(row.txCr)}` : "—"}</td>
                    <td className={td + " font-semibold"}>{row.closDr > 0 ? `Rs. ${formatNumber(row.closDr)}` : "—"}</td>
                    <td className={td + " font-semibold"}>{row.closCr > 0 ? `Rs. ${formatNumber(row.closCr)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                  <td className="px-3 py-2.5 text-[12px] font-bold" colSpan={2}>TOTAL</td>
                  <td className={td + " font-bold"}>Rs. {formatNumber(totals.openDr)}</td>
                  <td className={td + " font-bold"}>Rs. {formatNumber(totals.openCr)}</td>
                  <td className={td + " font-bold"}>Rs. {formatNumber(totals.txDr)}</td>
                  <td className={td + " font-bold"}>Rs. {formatNumber(totals.txCr)}</td>
                  <td className={td + " font-bold text-[#1557b0]"}>Rs. {formatNumber(totals.closDr)}</td>
                  <td className={td + " font-bold text-[#1557b0]"}>Rs. {formatNumber(totals.closCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
