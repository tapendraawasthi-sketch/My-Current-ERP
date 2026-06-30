import React, { useMemo } from "react";
import { ReportEmptyState } from "../ReportEmptyState";
import { getProfitDecimalPlaces } from "../../lib/utils";

interface LedgerDrillPanelProps {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  accountName: string;
  fromDate: string;
  toDate: string;
  vouchers: any[];
  onOpenVoucher: (voucherId: string) => void;
}

function fmt(n: number): string {
  const dp = getProfitDecimalPlaces();
  return Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

const LedgerDrillPanel: React.FC<LedgerDrillPanelProps> = ({
  open,
  onClose,
  accountId,
  accountName,
  fromDate,
  toDate,
  vouchers,
  onOpenVoucher,
}) => {
  const { lines, openingBalance, closingBalance } = useMemo(() => {
    if (!accountId) return { lines: [], openingBalance: 0, closingBalance: 0 };

    // Collect all lines for this account from all vouchers
    const allLines: {
      date: string;
      voucherNo: string;
      voucherType: string;
      narration: string;
      debit: number;
      credit: number;
      voucherId: string;
    }[] = [];

    for (const v of vouchers) {
      if (!v.lines) continue;
      for (const l of v.lines) {
        if (l.accountId !== accountId) continue;
        allLines.push({
          date: v.date ?? "",
          voucherNo: v.voucherNo ?? v.number ?? "",
          voucherType: v.type ?? "",
          narration: l.narration ?? v.narration ?? "",
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          voucherId: v.id,
        });
      }
    }

    // Sort by date
    allLines.sort((a, b) => a.date.localeCompare(b.date));

    // Compute opening balance (sum of lines BEFORE fromDate)
    let ob = 0;
    for (const l of allLines) {
      if (l.date < fromDate) {
        ob += l.debit - l.credit;
      }
    }

    // Filter to date range
    const inRange = allLines.filter((l) => l.date >= fromDate && l.date <= toDate);

    // Running balance
    let running = ob;
    const rows = inRange.map((l) => {
      running += l.debit - l.credit;
      return { ...l, balance: running };
    });

    return { lines: rows, openingBalance: ob, closingBalance: running };
  }, [accountId, fromDate, toDate, vouchers]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-[480px] h-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1557b0] text-white shrink-0">
          <div>
            <div className="text-[13px] font-semibold">{accountName}</div>
            <div className="text-[10px] text-blue-100 mt-0.5">
              {fromDate} to {toDate}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-lg leading-none"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Opening balance row */}
        <div className="px-4 py-2 bg-[#f5f6fa] border-b border-gray-200 flex justify-between text-[12px]">
          <span className="text-gray-600 font-medium">Opening Balance</span>
          <span className="font-mono font-semibold text-gray-800">
            {openingBalance >= 0 ? fmt(openingBalance) + " Dr" : fmt(openingBalance) + " Cr"}
          </span>
        </div>

        {/* Table body */}
        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <ReportEmptyState message="No transactions in this date range." />
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Voucher
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Narration
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Dr
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Cr
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 cursor-pointer hover:bg-[#e8f0fe]"
                    onClick={() => onOpenVoucher(row.voucherId)}
                  >
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.date}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      <div className="font-medium">{row.voucherNo}</div>
                      <div className="text-[10px] text-gray-400">{row.voucherType}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">
                      {row.narration}
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">
                      {row.debit > 0 ? fmt(row.debit) : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-gray-700">
                      {row.credit > 0 ? fmt(row.credit) : ""}
                    </td>
                    <td className="px-3 py-2 font-mono text-right text-gray-800 font-medium">
                      {fmt(row.balance)} {row.balance >= 0 ? "Dr" : "Cr"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: closing balance */}
        <div className="shrink-0 px-4 py-3 bg-[#eef2ff] border-t-2 border-[#c7d2fe] flex justify-between text-[12px] font-bold">
          <span className="text-gray-800">Closing Balance</span>
          <span className="font-mono text-gray-800">
            {fmt(closingBalance)} {closingBalance >= 0 ? "Dr" : "Cr"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LedgerDrillPanel;
