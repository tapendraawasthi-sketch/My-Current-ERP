import React, { Component, type ErrorInfo, type ReactNode } from "react";
import type { OrbixResponse } from "../../lib/ekhata/orbixResponseTypes";
import ClarificationCard from "./ClarificationCard";
import ModeRestrictionCard from "./ModeRestrictionCard";
import ProviderOfflineCard from "./ProviderOfflineCard";
import OrbixMessageContent from "./OrbixMessageContent";

interface OrbixResponseRendererProps {
  response: OrbixResponse | null | undefined;
  displayText?: string;
  onSwitchMode?: () => void;
}

class ResponseErrorBoundary extends Component<
  { children: ReactNode; fallbackText?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[OrbixResponseRenderer]", error, info);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3.5 py-3">
          <p className="text-[13px] text-[var(--ox-text-muted)]">
            We received a response but couldn’t display its structured details. The original message
            is shown below.
          </p>
          {this.props.fallbackText ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--ox-text)]">
              {this.props.fallbackText}
            </p>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}

function renderByType(
  response: OrbixResponse,
  displayText: string | undefined,
  onSwitchMode?: () => void,
): ReactNode {
  const text = displayText || response.display.text;

  switch (response.response_type) {
    case "mode_restriction":
      return (
        <ModeRestrictionCard
          payload={response.payload}
          text={text}
          onSwitchMode={onSwitchMode || (() => undefined)}
        />
      );
    case "clarification_required":
      return <ClarificationCard clarification={response.payload} text={text} />;
    case "provider_offline":
    case "backend_unavailable":
      return <ProviderOfflineCard text={text} />;
    case "permission_denied":
    case "validation_error":
    case "general_error":
      return (
        <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-danger)]/30 bg-[var(--ox-danger-soft)] px-3.5 py-3">
          <p className="text-[13px] font-medium text-[var(--ox-danger)]">
            {response.payload.safe_message || text}
          </p>
        </div>
      );
    case "posting_completed":
      return (
        <div
          className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-success)]/30 bg-[var(--ox-success-soft)] px-3.5 py-3"
          data-testid="orbix-posting-completed"
        >
          <p className="text-[13px] font-semibold text-[var(--ox-success)]">Posted locally</p>
          {(() => {
            const sync = response.payload.sync_status;
            const syncLabel =
              sync === "synced"
                ? "Synced"
                : sync === "disabled"
                  ? "Local-only company"
                  : sync === "failed"
                    ? "Sync failed — local records are safe"
                    : sync === "conflict"
                      ? "Conflict detected — review required"
                      : typeof navigator !== "undefined" && !navigator.onLine
                        ? "Offline — will sync later"
                        : "Waiting to sync";
            const syncTestId =
              sync === "synced"
                ? "synced"
                : sync === "failed"
                  ? "failed"
                  : sync === "conflict"
                    ? "conflict"
                    : "pending";
            return (
              <p
                className="mt-1 text-[11px] text-[var(--ox-text-muted)]"
                data-testid="orbix-sync-status"
                data-sync-status={syncTestId}
              >
                {syncLabel}
              </p>
            );
          })()}
          {text ? (
            <div className="mt-1">
              <OrbixMessageContent text={text} />
            </div>
          ) : null}
          {response.payload.voucher_number ? (
            <p className="mt-1 font-mono text-[12px] text-[var(--ox-text)]" data-testid="orbix-voucher-ref">
              {response.payload.voucher_number}
            </p>
          ) : null}
          {response.payload.amount ? (
            <p className="mt-0.5 font-mono text-[12px] text-[var(--ox-text)]">
              {response.payload.currency || "NPR"} {response.payload.amount}
            </p>
          ) : null}
        </div>
      );
    case "posting_failed":
      return (
        <div
          className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-danger)]/30 bg-[var(--ox-danger-soft)] px-3.5 py-3"
          data-testid="orbix-posting-failed"
        >
          <p className="text-[13px] font-medium text-[var(--ox-danger)]">
            {response.payload.safe_message || text || "Posting failed."}
          </p>
        </div>
      );
    case "confirmation_required":
    case "transaction_preview":
    case "journal_preview":
    case "posting_progress":
      // Journal / confirm / posting UI remains in OrbixJournalCard (pendingCard).
      return text ? (
        <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3.5 py-3">
          <OrbixMessageContent text={text} />
        </div>
      ) : null;
    case "report_result":
    case "report_updated":
      // Report table is rendered from message.report by the parent.
      return text ? (
        <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3.5 py-3">
          <OrbixMessageContent text={text} />
          {response.response_type === "report_updated" && response.payload.changes?.length ? (
            <p className="mt-2 text-[11px] text-[var(--ox-text-muted)]">
              Updated · {response.payload.changes.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null;
    case "normal_answer":
    case "capability_answer":
    case "accounting_explanation":
    case "erp_data_result":
    case "unknown":
    default:
      return text ? (
        <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3.5 py-3">
          <OrbixMessageContent text={text} />
        </div>
      ) : null;
  }
}

/**
 * Central Orbix response renderer — switch on response_type, not assistant prose.
 */
const OrbixResponseRenderer: React.FC<OrbixResponseRendererProps> = ({
  response,
  displayText,
  onSwitchMode,
}) => {
  if (!response) {
    return displayText ? (
      <div className="rounded-[var(--ox-radius-lg)] border border-[var(--ox-border)] bg-[var(--ox-surface)] px-3.5 py-3">
        <OrbixMessageContent text={displayText} />
      </div>
    ) : null;
  }

  return (
    <ResponseErrorBoundary fallbackText={displayText || response.display.text}>
      {renderByType(response, displayText, onSwitchMode)}
    </ResponseErrorBoundary>
  );
};

export default OrbixResponseRenderer;
