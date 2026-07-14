import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ClarificationPayload } from "../../lib/ekhata/orbixResponseTypes";

interface ClarificationCardProps {
  /** Structured payload — preferred */
  clarification?: ClarificationPayload | null;
  /** Display text fallback when payload has no field lists */
  text?: string;
}

/**
 * ClarificationCard — renders from structured clarification payload.
 * Text is presentation only; field lists come from payload when present.
 */
const ClarificationCard: React.FC<ClarificationCardProps> = ({ clarification, text }) => {
  const captured = clarification?.captured_fields ?? [];
  const missing = clarification?.missing_fields ?? [];
  const showStructured = captured.length > 0 || missing.length > 0;

  return (
    <div
      className="overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]"
      data-component="clarification-card"
      data-testid="orbix-clarification"
      data-draft-id={clarification?.draft_id || undefined}
    >
      <div className="flex items-center gap-2 border-b border-[var(--ds-border-default)] bg-[var(--ds-status-info-surface)] px-3.5 py-2.5">
        <AlertCircle className="h-4 w-4 text-[var(--ds-status-info)]" />
        <div>
          <p className="text-[13px] font-semibold text-[var(--ds-text-default)]">More information needed</p>
          <p className="text-[12px] text-[var(--ds-text-muted)]">
            Draft retained · nothing has been posted yet
            {clarification?.draft_id ? (
              <span className="ml-1 text-[var(--ds-text-subtle)]">
                · {clarification.transaction_type}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="space-y-3 px-3.5 py-3">
        {showStructured ? (
          <>
            {captured.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                  Captured
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {captured.map((c) => (
                    <span
                      key={`${c.field}-${c.value}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--ds-status-success-surface)] px-2.5 py-1 text-[12px] text-[var(--ds-status-success)]"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span className="font-medium">{c.label}:</span> {c.display_value || c.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {missing.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[var(--ds-text-muted)]">
                  Still needed
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missing.map((m) => (
                    <span
                      key={m.field}
                      className="rounded-full border border-dashed border-[var(--ds-status-warning)]/50 bg-[var(--ds-status-warning-surface)] px-2.5 py-1 text-[12px] text-[var(--ds-status-warning)]"
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
                {missing.some((m) => m.choices && m.choices.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {missing
                      .filter((m) => m.choices?.length)
                      .flatMap((m) =>
                        (m.choices || []).map((ch) => (
                          <span
                            key={`${m.field}-${ch.value}`}
                            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] px-2 py-0.5 text-[12px] text-[var(--ds-text-muted)]"
                          >
                            {ch.label}
                          </span>
                        )),
                      )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ds-text-default)]">
            {text || "Please provide the missing details to continue."}
          </p>
        )}
        <p className="text-[12px] text-[var(--ds-text-muted)]">
          Reply in the composer with the missing details — your draft stays open.
        </p>
      </div>
    </div>
  );
};

export default ClarificationCard;
