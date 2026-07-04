import React, { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import ReportShell from "../components/reporting/ReportShell";
import { buildNotesToAccounts } from "../lib/nepalFinancialStatements";

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function NotesToAccounts() {
  const { accounts, vouchers, companySettings, currentFiscalYear } = useStore();
  const [asAtDate, setAsAtDate] = useState(
    currentFiscalYear?.endDate || new Date().toISOString().split("T")[0],
  );
  const [threshold, setThreshold] = useState(1000);

  const notes = useMemo(() => {
    return buildNotesToAccounts({
      accounts: accounts as any[],
      vouchers: vouchers as any[],
      asAtDate,
      materialityThreshold: threshold,
    });
  }, [accounts, vouchers, asAtDate, threshold]);

  return (
    <ReportShell
      title="Notes to Accounts"
      subtitle="Material ledger balances grouped by NAS report section"
      hasData={notes.length > 0}
    >
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 no-print">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">As at Date</label>
              <input
                type="date"
                value={asAtDate}
                onChange={(e) => setAsAtDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full max-w-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Materiality threshold (Rs.)
              </label>
              <input
                type="number"
                min={0}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full max-w-xs"
              />
            </div>
          </div>
        </div>

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
              <div className="px-4 py-2.5 border-b border-gray-200 bg-[#f5f6fa]">
                <h3 className="text-[12px] font-semibold text-gray-800">
                  Note {note.noteNumber}: {note.title}
                </h3>
                {note.titleNepali && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{note.titleNepali}</p>
                )}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Particulars
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-36">
                      Amount (Rs.)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {note.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{line.label}</td>
                      <td className="px-3 py-2.5 text-[12px] font-mono text-right text-gray-800">
                        {money(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#eef2ff] font-bold text-[12px] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5">Total</td>
                    <td className="px-3 py-2.5 font-mono text-right">{money(note.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))
        )}

        <p className="text-[10px] text-gray-400 text-center print-only">
          {companySettings?.name} — Notes to Accounts as at {asAtDate}
        </p>
      </div>
    </ReportShell>
  );
}
