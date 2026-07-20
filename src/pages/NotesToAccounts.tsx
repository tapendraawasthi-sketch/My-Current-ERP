import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { ReportWorkspace } from "@/features/reports";
import { buildNotesToAccounts } from "../lib/nepalFinancialStatements";
import { useBranchFilter } from "../hooks/useBranchFilter";

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function NotesToAccounts() {
  const { accounts, vouchers, companySettings, currentFiscalYear } = useStore();
  const { branchFilter, setBranchFilter, branchOptions, matchBranch } = useBranchFilter();
  const [asAtDate, setAsAtDate] = useState(
    currentFiscalYear?.endDate || new Date().toISOString().split("T")[0],
  );
  const [threshold, setThreshold] = useState(1000);

  const scopedVouchers = useMemo(
    () => (vouchers || []).filter((v: any) => matchBranch(v?.branchId)),
    [vouchers, matchBranch, branchFilter],
  );

  const notes = useMemo(() => {
    return buildNotesToAccounts({
      accounts: accounts as any[],
      vouchers: scopedVouchers as any[],
      asAtDate,
      materialityThreshold: threshold,
    });
  }, [accounts, scopedVouchers, asAtDate, threshold]);

  return (
    <ReportWorkspace
      title="Notes to accounts"
      description="Extra statement notes."
      companyName={companySettings?.name}
      periodLabel={`As at ${asAtDate}`}
      filterSlot={
        <>
          {branchOptions.length > 0 && (
            <div>
              <label className="text-[12px] font-medium text-gray-600 mb-1 block">Branch</label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full max-w-xs"
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
          <div>
            <label className="text-[12px] font-medium text-gray-600 mb-1 block">As at Date</label>
            <input
              type="date"
              value={asAtDate}
              onChange={(e) => setAsAtDate(e.target.value)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full max-w-xs"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-gray-600 mb-1 block">
              Materiality threshold (Rs.)
            </label>
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full max-w-xs"
            />
          </div>
        </>
      }
    >
      <div className="space-y-4">
        {notes.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-[12px] text-gray-500">
            No material balances found for the selected date and threshold.
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-gray-200 bg-[var(--ds-canvas)]">
                <h3 className="text-[12px] font-semibold text-gray-700">
                  Note {note.noteNumber}: {note.title}
                </h3>
                {note.titleNepali && (
                  <p className="text-[12px] text-gray-500 mt-0.5">{note.titleNepali}</p>
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wide">
                      Particulars
                    </th>
                    <th className="px-3 py-2.5 text-right text-[12px] font-semibold text-gray-400 uppercase tracking-wide w-36">
                      Amount (Rs.)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {note.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{line.label}</td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-700">
                        {money(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--ds-surface-selected)] font-bold text-[12px] border-t-2 border-[var(--ds-border-strong)]">
                    <td className="px-3 py-2.5">Total</td>
                    <td className="px-3 py-2.5 font-mono text-right">{money(note.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))
        )}

        <p className="text-[12px] text-gray-400 text-center print-only">
          {companySettings?.name} — Notes to accounts as at {asAtDate}
        </p>
      </div>
    </ReportWorkspace>
  );
}
