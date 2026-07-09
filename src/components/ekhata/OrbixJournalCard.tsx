import React from "react";
import { BookOpen, Check, X } from "lucide-react";
import type { KhataConfirmationCard } from "@/lib/ekhata/types";
import type { KhataCompoundBatchCard } from "@/lib/ekhata/compoundBatch";
import type { JournalLineDraft } from "@/lib/ekhata/types";
import { KHATA_INTENT_LABELS } from "@/lib/ekhata/types";

interface BalanceInfo {
  balanced: boolean;
  totalDebit: number;
  totalCredit: number;
}

interface OrbixJournalCardProps {
  pendingCard: KhataConfirmationCard | null;
  pendingCompoundBatch: KhataCompoundBatchCard | null;
  journalLines: JournalLineDraft[];
  balance: BalanceInfo | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function JournalTable({
  lines,
  balance,
}: {
  lines: JournalLineDraft[];
  balance: BalanceInfo | null;
}) {
  if (!lines.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-white/10 overflow-hidden">
      <div className="px-2.5 py-1.5 bg-white/[0.04] border-b border-white/10">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Journal Lines
        </p>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-white/10">
            <th className="px-2.5 py-1.5 text-left text-[9px] font-semibold text-slate-500 uppercase tracking-wide">
              Account
            </th>
            <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-slate-500 uppercase tracking-wide w-16">
              Dr
            </th>
            <th className="px-2 py-1.5 text-right text-[9px] font-semibold text-slate-500 uppercase tracking-wide w-16">
              Cr
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              <td className="px-2.5 py-1.5 text-slate-300">
                {line.accountName}
                <span className="ml-1 text-[9px] text-slate-600">({line.accountClass})</span>
              </td>
              <td className="px-2 py-1.5 font-mono text-right text-slate-300 tabular-nums">
                {line.debit > 0 ? (
                  <span className="text-[#fb923c]">{line.debit.toLocaleString()}</span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </td>
              <td className="px-2 py-1.5 font-mono text-right text-slate-300 tabular-nums">
                {line.credit > 0 ? (
                  <span className="text-cyan-400">{line.credit.toLocaleString()}</span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        {balance && (
          <tfoot>
            <tr className="bg-cyan-500/10 border-t border-cyan-500/20 font-semibold text-[11px]">
              <td className="px-2.5 py-1.5 text-slate-300">Total</td>
              <td className="px-2 py-1.5 font-mono text-right text-[#fb923c] tabular-nums">
                {balance.totalDebit.toLocaleString()}
              </td>
              <td className="px-2 py-1.5 font-mono text-right text-cyan-400 tabular-nums">
                {balance.totalCredit.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {balance && (
        <div
          className={`mx-2.5 mb-2.5 mt-1 rounded-md px-2 py-1 text-[10px] font-medium border flex items-center gap-1.5 ${
            balance.balanced
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border-red-500/30"
          }`}
        >
          {balance.balanced ? (
            <>
              <Check className="h-3 w-3" /> Journal Balanced
            </>
          ) : (
            <>
              <X className="h-3 w-3" /> Journal Unbalanced
            </>
          )}
        </div>
      )}
    </div>
  );
}

const OrbixJournalCard: React.FC<OrbixJournalCardProps> = ({
  pendingCard,
  pendingCompoundBatch,
  journalLines,
  balance,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  if (pendingCompoundBatch) {
    return (
      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent p-3 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/25">
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-200">
              Confirm Batch Entry
            </p>
            <p className="text-[10px] text-slate-500">
              {pendingCompoundBatch.compoundCount} transactions ·{" "}
              <span className="font-mono text-[#fb923c]">
                NPR {pendingCompoundBatch.amount.toLocaleString()}
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {pendingCompoundBatch.parts.map((part) => (
            <div
              key={part.index}
              className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5"
            >
              <p className="text-[11px] font-medium text-slate-200 truncate">
                {part.index}. {part.text}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {KHATA_INTENT_LABELS[part.card.intent]}
                {part.card.party ? ` · ${part.card.party}` : ""}
                {" · "}
                <span className="font-mono text-[#fb923c]">
                  NPR {part.card.amount.toLocaleString()}
                </span>
              </p>
            </div>
          ))}
        </div>

        <JournalTable lines={journalLines} balance={balance} />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || (balance !== null && !balance.balanced)}
            className="h-8 flex-1 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 text-[12px] font-medium text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" /> Confirm All
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="h-8 flex-1 rounded-md border border-white/15 bg-white/5 text-[12px] font-medium text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!pendingCard) return null;

  const highlights = [
    { label: "Type", value: KHATA_INTENT_LABELS[pendingCard.intent], accent: true },
    ...(pendingCard.party ? [{ label: "Party", value: pendingCard.party, accent: false }] : []),
    {
      label: "Amount",
      value: `NPR ${pendingCard.amount.toLocaleString()}`,
      accent: true,
      mono: true,
    },
    ...(pendingCard.item ? [{ label: "Item", value: pendingCard.item, accent: false }] : []),
    { label: "Date", value: pendingCard.date, accent: false },
  ];

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent p-3 shadow-lg shadow-black/20">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/25">
          <BookOpen className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-200">Confirm Journal Entry</p>
          {pendingCard.primaryClass && (
            <span className="inline-block mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-violet-500/15 text-violet-300 border border-violet-500/25">
              {pendingCard.primaryClass}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden">
        {highlights.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 px-2.5 py-1.5 text-[11px] ${i > 0 ? "border-t border-white/5" : ""}`}
          >
            <span className="text-slate-500">{row.label}</span>
            <span
              className={`text-right truncate ${
                "mono" in row && row.mono
                  ? "font-mono font-medium text-[#fb923c]"
                  : row.accent
                    ? "text-cyan-300 font-medium"
                    : "text-slate-200"
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <JournalTable lines={journalLines} balance={balance} />

      {pendingCard.caExplanation && (
        <p className="mt-2 text-[10px] text-slate-500 italic leading-snug border-l-2 border-cyan-500/30 pl-2">
          {pendingCard.caExplanation}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading || (balance !== null && !balance.balanced)}
          className="h-8 flex-1 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 text-[12px] font-medium text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          <Check className="h-3.5 w-3.5" /> Confirm
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8 flex-1 rounded-md border border-white/15 bg-white/5 text-[12px] font-medium text-slate-300 hover:bg-white/10 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default OrbixJournalCard;
