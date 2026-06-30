import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import type { DBVoucher } from "../lib/db";
import { ADToBSLong, ADToBSString } from "../lib/nepaliDate";
import { formatDualDate } from "../lib/nepaliDate";
import ReportShell from "../components/ui/ReportShell";
import BsDateCell from "../components/reporting/BsDateCell";
import { Download, Printer, RefreshCw, Filter } from "lucide-react";
import toast from "react-hot-toast";

function fmtAmt(n: number | undefined | null): string {
  const num = Number(n ?? 0);
  return num.toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DayBook: React.FC = () => {
  const { vouchers, currentFiscalYear } = useStore();

  const today = new Date().toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate ?? today);
  const [toDate, setToDate]     = useState(today);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQ, setSearchQ] = useState("");

  // Fix BUG-016: explicit type annotation on useMemo to avoid `unknown`
  const filtered = useMemo<DBVoucher[]>(() => {
    return (vouchers ?? []).filter((v: DBVoucher) => {
      const vDate = (v.date ?? "").split("T")[0];
      if (fromDate && vDate < fromDate) return false;
      if (toDate   && vDate > toDate  ) return false;
      if (typeFilter !== "All" && v.type !== typeFilter) return false;
      if (statusFilter !== "All" && v.status !== statusFilter) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const match = [v.voucherNo, v.narration, v.type]
          .join(" ")
          .toLowerCase()
          .includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [vouchers, fromDate, toDate, typeFilter, statusFilter, searchQ]);

  // Fix BUG-016: explicit types so React children are never `unknown`
  const totalDebit  = useMemo<number>(() => filtered.reduce((s, v: DBVoucher) => s + Number(v.totalDebit  ?? 0), 0), [filtered]);
  const totalCredit = useMemo<number>(() => filtered.reduce((s, v: DBVoucher) => s + Number(v.totalCredit ?? 0), 0), [filtered]);

  const voucherTypes = useMemo<string[]>(() => {
    const types = Array.from(new Set((vouchers ?? []).map((v: DBVoucher) => v.type).filter(Boolean)));
    return ["All", ...types.sort()];
  }, [vouchers]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const rows = [
      ["Date (B.S.)", "Date (A.D.)", "Voucher No", "Type", "Narration", "Debit", "Credit", "Status"],
      ...filtered.map((v: DBVoucher) => [
        ADToBSString(v.date),
        v.date,
        v.voucherNo,
        v.type,
        v.narration ?? "",
        v.totalDebit ?? 0,
        v.totalCredit ?? 0,
        v.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `day-book-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Day Book exported");
  };

  const inputCls = "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
  const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
  const td = "px-3 py-2.5 text-[12px] text-gray-700";

  const actions = (
    <>
      <button onClick={handleExport} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
        <Download className="h-4 w-4" /> Export
      </button>
      <button onClick={handlePrint} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
        <Printer className="h-4 w-4" /> Print
      </button>
    </>
  );

  return (
    <ReportShell
      title="Day Book"
      subtitle="All voucher transactions for the selected period"
      actions={actions}
    >
      {/* Filters — no-print */}
      <div className="no-print px-4 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-gray-600">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputCls}>
          {voucherTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          {["All", "draft", "posted", "pending", "approved", "cancelled"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search voucher no, narration…"
          className={`${inputCls} w-52`}
        />
        <span className="ml-auto text-[11px] text-gray-500">{filtered.length} vouchers</span>
      </div>

      {/* Print header — print only */}
      <div className="print-only hidden px-4 py-3">
        <h2 className="text-[14px] font-bold">Day Book</h2>
        {/* Fix BUG-027: show BS dates in print header */}
        <p className="text-[11px] text-gray-600">
          From: {ADToBSLong(fromDate)} To: {ADToBSLong(toDate)}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[#f5f6fa] border-b border-gray-200">
              {/* Fix BUG-027: BS date column */}
              <th className={th}>Date (B.S.)</th>
              <th className={th}>Date (A.D.)</th>
              <th className={th}>Voucher No</th>
              <th className={th}>Type</th>
              <th className={th}>Narration</th>
              <th className={`${th} text-right`}>Debit</th>
              <th className={`${th} text-right`}>Credit</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                  No vouchers found for the selected period.
                </td>
              </tr>
            ) : (
              // Fix BUG-016, BUG-089: typed as DBVoucher[], React children are proper types
              filtered.map((v: DBVoucher) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {/* Fix BUG-027: Nepali BS date displayed */}
                  <td className={td}>
                    <BsDateCell adDate={v.date} short bsOnly />
                  </td>
                  <td className={td}>{(v.date ?? "").split("T")[0]}</td>
                  <td className={`${td} font-medium text-gray-800`}>{v.voucherNo ?? ""}</td>
                  <td className={td}>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase">
                      {v.type ?? ""}
                    </span>
                  </td>
                  <td className={`${td} max-w-[220px] truncate`}>{v.narration ?? ""}</td>
                  <td className={`${td} text-right font-mono`}>{fmtAmt(v.totalDebit)}</td>
                  <td className={`${td} text-right font-mono`}>{fmtAmt(v.totalCredit)}</td>
                  <td className={td}>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      v.status === "posted" ? "bg-green-100 text-green-700" :
                      v.status === "cancelled" ? "bg-red-100 text-red-700" :
                      v.status === "approved" ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {v.status ?? "draft"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-[#eef2ff] font-bold border-t-2 border-[#c7d2fe]">
                <td colSpan={5} className="px-3 py-2.5 text-[12px] text-gray-700">
                  Total ({filtered.length} vouchers)
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">{fmtAmt(totalDebit)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-800">{fmtAmt(totalCredit)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
};

export default DayBook;
