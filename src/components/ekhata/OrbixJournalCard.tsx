import { confirmButtonLabel } from "@/features/orbix/presentation";
import React from "react";
import { BookOpen, Check, X } from "lucide-react";
import type { KhataConfirmationCard } from "@/lib/ekhata/types";
import type { KhataCompoundBatchCard } from "@/lib/ekhata/compoundBatch";
import type { JournalLineDraft } from "@/lib/ekhata/types";
import { KHATA_INTENT_LABELS } from "@/lib/ekhata/types";
import {
  ORBIX_CONFIRM_PREVIEW_HEADING,
  ORBIX_CONFIRM_PREVIEW_HINT,
} from "@/platform/calc/calcAuthorityPolicy";

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
  /** When true, confirm is blocked until a fresh preview is generated */
  stalePreview?: boolean;
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
    <div className="mt-3 overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)]" data-testid="orbix-journal-preview">
      <div className="border-b border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-3 py-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
          Journal preview
        </p>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--ds-border-default)]">
            <th className="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
              Account
            </th>
            <th className="w-24 px-2 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
              Debit
            </th>
            <th className="w-24 px-2 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-[var(--ds-border-default)]/70 last:border-0">
              <td className="px-3 py-2 text-[var(--ds-text-default)]">
                {line.accountName}
                <span className="ml-1 text-[12px] text-[var(--ds-text-subtle)]">
                  ({line.accountClass})
                </span>
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--ds-text-default)]">
                {line.debit > 0 ? line.debit.toLocaleString() : "—"}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--ds-text-default)]">
                {line.credit > 0 ? line.credit.toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        {balance && (
          <tfoot>
            <tr className="border-t-2 border-[var(--ds-border-strong)] bg-[var(--ds-surface-selected)] font-semibold">
              <td className="px-3 py-2 text-[var(--ds-text-default)]">Total</td>
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
          className={`mx-2.5 mb-2.5 mt-2 flex items-center gap-1.5 rounded-[var(--ds-radius-md)] border px-2.5 py-1.5 text-[12px] font-medium ${
            balance.balanced
              ? "border-[var(--ds-status-success)]/30 bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
              : "border-amber-200 bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)]"
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
  stalePreview = false,
  onConfirm,
  onCancel,
}) => {
  if (pendingCompoundBatch) {
    return (
      <div
        className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4 shadow-[var(--ds-shadow-1)]"
        data-component="transaction-draft-card"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--ds-surface-selected)] text-[var(--ds-action-primary)]">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--ds-text-default)]">Batch draft</p>
            <p className="text-[12px] text-[var(--ds-text-muted)]">
              {pendingCompoundBatch.compoundCount} transactions · NPR{" "}
              {pendingCompoundBatch.amount.toLocaleString()}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-[var(--ds-status-warning-surface)] px-2 py-0.5 text-[12px] font-semibold uppercase text-[var(--ds-status-warning)]">
            Draft
          </span>
        </div>

        <div className="max-h-32 space-y-1.5 overflow-y-auto">
          {pendingCompoundBatch.parts.map((part) => (
            <div
              key={part.index}
              className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-2.5 py-1.5"
            >
              <p className="truncate text-[12px] font-medium text-[var(--ds-text-default)]">
                {part.index}. {part.text}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ds-text-muted)]">
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
            className="h-9 flex-1 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] text-[12px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)] disabled:opacity-40"
          >
            Cancel draft
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || (balance !== null && !balance.balanced)}
            className="h-9 flex-1 rounded-[var(--ds-radius-md)] bg-[var(--ds-action-primary)] text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-40"
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
      className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-4 shadow-[var(--ds-shadow-1)]"
      data-component="transaction-draft-card"
      data-testid="orbix-transaction-preview"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--ds-surface-selected)] text-[var(--ds-action-primary)]">
          <BookOpen className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[var(--ds-text-default)]">
            {ORBIX_CONFIRM_PREVIEW_HEADING}
          </p>
          <p className="text-[11px] text-[var(--ds-text-muted)] mt-0.5">
            {ORBIX_CONFIRM_PREVIEW_HINT}
          </p>
          {pendingCard.primaryClass && (
            <span className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[12px] font-semibold uppercase text-[var(--ds-text-muted)]">
              {pendingCard.primaryClass}
            </span>
          )}
        </div>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase ${
            stalePreview
              ? "bg-[var(--ds-status-danger-surface)] text-[var(--ds-status-danger)]"
              : "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)]"
          }`}
        >
          {stalePreview ? "Stale — refresh required" : "Ready for review"}
        </span>
      </div>

      {stalePreview ? (
        <div
          className="mb-3 rounded-[var(--ds-radius-md)] border border-[var(--ds-status-warning)]/40 bg-[var(--ds-status-warning-surface)] px-3 py-2"
          data-testid="orbix-stale-preview-banner"
          role="alert"
        >
          <p className="text-[12px] font-medium text-[var(--ds-status-warning)]">
            This preview is out of date. Confirmation is blocked until you generate a new preview.
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)]">
        {highlights.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 px-3 py-2 text-[12px] ${
              i > 0 ? "border-t border-[var(--ds-border-default)]" : ""
            }`}
          >
            <span className="text-[var(--ds-text-muted)]">{row.label}</span>
            <span
              className={`truncate text-right font-medium text-[var(--ds-text-default)] ${
                "mono" in row && row.mono ? "font-mono tabular-nums" : ""
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {(pendingCard.draft_id || pendingCard.preview_hash) && (
        <p className="mt-2 font-mono text-[12px] text-[var(--ds-text-subtle)]" data-testid="orbix-preview-ids">
          {pendingCard.draft_id ? `draft ${String(pendingCard.draft_id).slice(0, 8)}…` : ""}
          {pendingCard.draft_id && pendingCard.preview_hash ? " · " : ""}
          {pendingCard.preview_hash ? `hash ${String(pendingCard.preview_hash).slice(0, 10)}…` : ""}
        </p>
      )}

      <JournalTable lines={journalLines} balance={balance} />

      {pendingCard.caExplanation && (
        <p className="mt-2 border-l-2 border-[var(--ds-action-primary)] pl-2 text-[12px] leading-snug text-[var(--ds-text-muted)]">
          {pendingCard.caExplanation}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="h-9 flex-1 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] text-[12px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)] disabled:opacity-40"
        >
          Cancel draft
        </button>
        <button
          type="button"
          data-testid="orbix-confirm-post"
          onClick={onConfirm}
          disabled={isLoading || stalePreview || (balance !== null && !balance.balanced)}
          aria-disabled={stalePreview || undefined}
          className="h-9 flex-1 rounded-[var(--ds-radius-md)] bg-[var(--ds-action-primary)] text-[12px] font-medium text-white hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-40"
        >
          {isLoading ? "Posting…" : confirmButtonLabel(pendingCard.intent)}
        </button>
      </div>
      {isLoading && postingStages.length > 0 && (
        <p className="mt-2 text-[12px] text-[var(--ds-text-muted)]" data-testid="orbix-posting-stages">
          {postingStages[postingStages.length - 1].replace(/_/g, " ")}
        </p>
      )}
      {pendingCard.draft_id && (
        <p className="mt-1 text-[12px] text-[var(--ds-text-subtle)]" data-testid="orbix-draft-id">
          Draft retained · nothing posted until you confirm
        </p>
      )}
    </div>
  );
};

export default OrbixJournalCard;
