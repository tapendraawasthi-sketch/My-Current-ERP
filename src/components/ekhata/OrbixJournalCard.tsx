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
  postingStages?: string[];
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
    <div className="mt-3 overflow-hidden rounded-[var(--ox-radius-md)] border border-[var(--ox-border)]" data-testid="orbix-journal-preview">
      <div className="border-b border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-3 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
          Journal preview
        </p>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--ox-border)]">
            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Account
            </th>
            <th className="w-24 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Debit
            </th>
            <th className="w-24 px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--ox-text-muted)]">
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-[var(--ox-border)]/70 last:border-0">
              <td className="px-3 py-2 text-[var(--ox-text)]">
                {line.accountName}
                <span className="ml-1 text-[10px] text-[var(--ox-text-subtle)]">
                  ({line.accountClass})
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--ox-text)]">
                {line.debit > 0 ? line.debit.toLocaleString() : "—"}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--ox-text)]">
                {line.credit > 0 ? line.credit.toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        {balance && (
          <tfoot>
            <tr className="border-t-2 border-[var(--ox-border-strong)] bg-[var(--ox-primary-soft)] font-semibold">
              <td className="px-3 py-2 text-[var(--ox-text)]">Total</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">
                {balance.totalDebit.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">
                {balance.totalCredit.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      {balance && (
        <div
          className={`mx-2.5 mb-2.5 mt-2 flex items-center gap-1.5 rounded-[var(--ox-radius-md)] border px-2.5 py-1.5 text-[12px] font-medium ${
            balance.balanced
              ? "border-green-200 bg-[var(--ox-success-soft)] text-[var(--ox-success)]"
              : "border-amber-200 bg-[var(--ox-warning-soft)] text-[var(--ox-warning)]"
          }`}
        >
          {balance.balanced ? (
            <>
              <Check className="h-3.5 w-3.5" /> Balanced
            </>
          ) : (
            <>
              <X className="h-3.5 w-3.5" /> Needs correction
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
  postingStages = [],
  onConfirm,
  onCancel,
}) => {
  if (pendingCompoundBatch) {
    return (
      <div
        className="rounded-[var(--ox-radius-xl)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4 shadow-[var(--ox-shadow-sm)]"
        data-component="transaction-draft-card"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] bg-[var(--ox-primary-soft)] text-[var(--ox-primary)]">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--ox-text)]">Batch draft</p>
            <p className="text-[12px] text-[var(--ox-text-muted)]">
              {pendingCompoundBatch.compoundCount} transactions · NPR{" "}
              {pendingCompoundBatch.amount.toLocaleString()}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-[var(--ox-warning-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--ox-warning)]">
            Draft
          </span>
        </div>

        <div className="max-h-32 space-y-1.5 overflow-y-auto">
          {pendingCompoundBatch.parts.map((part) => (
            <div
              key={part.index}
              className="rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface-muted)] px-2.5 py-1.5"
            >
              <p className="truncate text-[12px] font-medium text-[var(--ox-text)]">
                {part.index}. {part.text}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--ox-text-muted)]">
                {KHATA_INTENT_LABELS[part.card.intent]}
                {part.card.party ? ` · ${part.card.party}` : ""}
                {" · "}
                NPR {part.card.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <JournalTable lines={journalLines} balance={balance} />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="h-9 flex-1 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] text-[12px] font-medium text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)] disabled:opacity-40"
          >
            Cancel draft
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || (balance !== null && !balance.balanced)}
            className="h-9 flex-1 rounded-[var(--ox-radius-md)] bg-[var(--ox-primary)] text-[12px] font-medium text-white hover:bg-[var(--ox-primary-hover)] disabled:opacity-40"
          >
            Confirm and post
          </button>
        </div>
      </div>
    );
  }

  if (!pendingCard) return null;

  const highlights = [
    { label: "Type", value: KHATA_INTENT_LABELS[pendingCard.intent] },
    ...(pendingCard.party ? [{ label: "Party", value: pendingCard.party }] : []),
    { label: "Amount", value: `NPR ${pendingCard.amount.toLocaleString()}`, mono: true },
    ...(pendingCard.item ? [{ label: "Item", value: pendingCard.item }] : []),
    { label: "Date", value: pendingCard.date },
  ];

  return (
    <div
      className="rounded-[var(--ox-radius-xl)] border border-[var(--ox-border)] bg-[var(--ox-surface)] p-4 shadow-[var(--ox-shadow-sm)]"
      data-component="transaction-draft-card"
      data-testid="orbix-transaction-preview"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ox-radius-md)] bg-[var(--ox-primary-soft)] text-[var(--ox-primary)]">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--ox-text)]">Transaction draft</p>
          {pendingCard.primaryClass && (
            <span className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--ox-text-muted)]">
              {pendingCard.primaryClass}
            </span>
          )}
        </div>
        <span className="ml-auto rounded-full bg-[var(--ox-warning-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--ox-warning)]">
          Ready for review
        </span>
      </div>

      <div className="overflow-hidden rounded-[var(--ox-radius-md)] border border-[var(--ox-border)]">
        {highlights.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 px-3 py-2 text-[12px] ${
              i > 0 ? "border-t border-[var(--ox-border)]" : ""
            }`}
          >
            <span className="text-[var(--ox-text-muted)]">{row.label}</span>
            <span
              className={`truncate text-right font-medium text-[var(--ox-text)] ${
                "mono" in row && row.mono ? "font-mono tabular-nums" : ""
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <JournalTable lines={journalLines} balance={balance} />

      {pendingCard.caExplanation && (
        <p className="mt-2 border-l-2 border-[var(--ox-intelligence)] pl-2 text-[12px] leading-snug text-[var(--ox-text-muted)]">
          {pendingCard.caExplanation}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="h-9 flex-1 rounded-[var(--ox-radius-md)] border border-[var(--ox-border)] bg-[var(--ox-surface)] text-[12px] font-medium text-[var(--ox-text)] hover:bg-[var(--ox-surface-muted)] disabled:opacity-40"
        >
          Cancel draft
        </button>
        <button
          type="button"
          data-testid="orbix-confirm-post"
          onClick={onConfirm}
          disabled={isLoading || (balance !== null && !balance.balanced)}
          className="h-9 flex-1 rounded-[var(--ox-radius-md)] bg-[var(--ox-primary)] text-[12px] font-medium text-white hover:bg-[var(--ox-primary-hover)] disabled:opacity-40"
        >
          {isLoading ? "Posting…" : "Confirm and post"}
        </button>
      </div>
      {isLoading && postingStages.length > 0 && (
        <p className="mt-2 text-[11px] text-[var(--ox-text-muted)]" data-testid="orbix-posting-stages">
          {postingStages[postingStages.length - 1].replace(/_/g, " ")}
        </p>
      )}
      {pendingCard.draft_id && (
        <p className="mt-1 text-[10px] text-[var(--ox-text-subtle)]" data-testid="orbix-draft-id">
          Draft {pendingCard.draft_id.slice(0, 8)}…
        </p>
      )}
    </div>
  );
};

export default OrbixJournalCard;
