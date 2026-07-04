import type { KhataEntry } from "../types";

interface BalanceSummaryProps {
  udhaarOut: number;
  udhaarIn: number;
  recentCreditSales: KhataEntry[];
  recentPaymentsIn: KhataEntry[];
  activeChip: "out" | "in" | null;
  onChipClick: (chip: "out" | "in") => void;
  onCloseList: () => void;
}

const fmt = (value: number) =>
  new Intl.NumberFormat("en-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 0 }).format(
    value,
  );

export default function BalanceSummary({
  udhaarOut,
  udhaarIn,
  recentCreditSales,
  recentPaymentsIn,
  activeChip,
  onChipClick,
  onCloseList,
}: BalanceSummaryProps) {
  const list = activeChip === "out" ? recentCreditSales : recentPaymentsIn;

  return (
    <div className="border-b border-gray-200 bg-white px-3 py-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChipClick("out")}
          className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700"
        >
          Udhaar out: {fmt(udhaarOut)}
        </button>
        <button
          type="button"
          onClick={() => onChipClick("in")}
          className="rounded-md bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700"
        >
          Udhaar in: {fmt(udhaarIn)}
        </button>
      </div>
      {activeChip && (
        <div className="mt-2 rounded-md border border-gray-200 bg-[#f5f6fa] p-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Last 10 entries
            </p>
            <button type="button" onClick={onCloseList} className="text-[11px] text-gray-500">
              Close
            </button>
          </div>
          <ul className="space-y-1">
            {list.slice(0, 10).map((entry) => (
              <li key={entry.id} className="flex justify-between text-[12px] text-gray-700">
                <span>{entry.party_name ?? entry.item ?? entry.voucher_type}</span>
                <span className="font-mono">{fmt(entry.amount)}</span>
              </li>
            ))}
            {list.length === 0 && <li className="text-[12px] text-gray-500">No entries yet</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
