import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { Search } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { useBranchFilter } from "../hooks/useBranchFilter";

const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "block text-[11px] font-medium text-gray-600 mb-1";

export default function MissingVoucherReport() {
  const { vouchers, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(currentFiscalYear?.startDate || "");
  const [toDate, setToDate] = useState(currentFiscalYear?.endDate || "");

  const gaps = useMemo(() => {
    const posted = (vouchers || [])
      .filter(
        (v: any) =>
          v.status === "posted" &&
          v.date >= fromDate &&
          v.date <= toDate &&
          matchBranch(v.branchId),
      )
      .sort((a: any, b: any) =>
        String(a.voucherNo).localeCompare(String(b.voucherNo), undefined, { numeric: true }),
      );

    const missing: { expected: string; after: string; type: string }[] = [];
    for (let i = 1; i < posted.length; i++) {
      const prev = posted[i - 1];
      const curr = posted[i];
      if (prev.type !== curr.type) continue;
      const prevNum = parseInt(String(prev.voucherNo).replace(/\D/g, ""), 10);
      const currNum = parseInt(String(curr.voucherNo).replace(/\D/g, ""), 10);
      if (!Number.isFinite(prevNum) || !Number.isFinite(currNum)) continue;
      for (let n = prevNum + 1; n < currNum; n++) {
        const prefix = String(prev.voucherNo).replace(/\d+$/, "");
        missing.push({
          expected: `${prefix}${n}`,
          after: String(prev.voucherNo),
          type: String(curr.type || "voucher"),
        });
      }
    }

    if (!search.trim()) return missing;
    const q = search.toLowerCase();
    return missing.filter(
      (m) =>
        m.expected.toLowerCase().includes(q) ||
        m.after.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q),
    );
  }, [vouchers, fromDate, toDate, search, matchBranch, branchFilter]);

  return (
    <div className="erp-report flex h-full min-h-0 flex-col bg-gray-50 overflow-y-auto p-4 md:p-6">
      <div className="erp-report-toolbar flex items-center justify-between mb-4 no-print">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-900">Missing voucher report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Gaps in posted voucher number sequences by type
          </p>
        </div>
      </div>

      <div className="no-print bg-white border border-gray-200 rounded-lg p-3 mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={labelCls}>From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={`${inputCls} w-full`}
            />
          </div>
          {branchOptions.length > 0 && (
            <div>
              <label className={labelCls}>Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={`${inputCls} w-full`}
                aria-label="Branch"
              >
                <option value="all">All branches</option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.code || b.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label className={labelCls}>Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Voucher no. or type…"
                className={`${inputCls} w-full pl-8`}
              />
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          {gaps.length} missing number{gaps.length === 1 ? "" : "s"} detected
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
        {gaps.length === 0 ? (
          <ReportEmptyState
            message="No missing voucher numbers found"
            hint="Adjust the date range or post more vouchers to detect gaps."
          />
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Voucher type
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Missing number
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      After voucher
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((row, idx) => (
                    <tr
                      key={`${row.type}-${row.expected}-${idx}`}
                      className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)] border-b border-gray-100"
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                        {row.type.replace(/-/g, " ")}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono font-medium text-red-700">
                        {row.expected}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-gray-700">
                        {row.after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500">
              {gaps.length} gap{gaps.length === 1 ? "" : "s"} in sequence
            </div>
          </>
        )}
      </div>
    </div>
  );
}
