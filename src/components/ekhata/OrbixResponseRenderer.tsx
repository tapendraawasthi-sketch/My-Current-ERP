import { syncStatusPresentation, TrustChrome } from "@/features/orbix";
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
        <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3.5 py-3">
          <p className="text-[13px] text-[var(--ds-text-muted)]">
            We received a response but couldn’t display its structured details. The original message
            is shown below.
          </p>
          {this.props.fallbackText ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--ds-text-default)]">
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
    case "unsupported_response":
      return (
        <TrustChrome response={response}>
          <div
            className="rounded-[var(--ds-radius-md)] border border-[var(--ds-status-warning)]/40 bg-[var(--ds-status-warning-surface)] px-3 py-2.5"
            data-testid="orbix-unsupported-response"
            data-received-type={response.payload.received_type}
          >
            <p className="text-[13px] font-medium text-[var(--ds-status-warning)]">
              {response.payload.safe_message || text}
            </p>
            <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">
              Unsupported response type — not shown as an accounting card.
            </p>
          </div>
        </TrustChrome>
      );
    case "mode_restriction":
      return (
        <TrustChrome response={response}>
          <ModeRestrictionCard
            payload={response.payload}
            text={text}
            onSwitchMode={onSwitchMode || (() => undefined)}
          />
        </TrustChrome>
      );
    case "clarification_required":
      return (
        <TrustChrome response={response}>
          <ClarificationCard clarification={response.payload} text={text} />
        </TrustChrome>
      );
    case "provider_offline":
    case "backend_unavailable":
      return (
        <TrustChrome response={response}>
          <ProviderOfflineCard text={text} />
        </TrustChrome>
      );
    case "permission_denied":
    case "validation_error":
    case "general_error": {
      const code =
        "error_code" in response.payload
          ? String((response.payload as { error_code?: string }).error_code || "")
          : "";
      const isStale = code === "stale_preview";
      const isConflict = code.includes("conflict") || code === "integrity_mismatch";
      return (
        <TrustChrome response={response}>
          <div
            className={`rounded-[var(--ds-radius-md)] border px-3 py-2.5 ${
              isConflict
                ? "border-[var(--ds-status-danger)]/40 bg-[var(--ds-status-danger-surface)]"
                : isStale
                  ? "border-[var(--ds-status-warning)]/40 bg-[var(--ds-status-warning-surface)]"
                  : "border-[var(--ds-status-danger)]/30 bg-[var(--ds-status-danger-surface)]"
            }`}
            data-testid={isStale ? "orbix-stale-preview" : isConflict ? "orbix-conflict" : "orbix-error"}
            data-error-code={code || undefined}
          >
            <p
              className={`text-[13px] font-medium ${
                isStale ? "text-[var(--ds-status-warning)]" : "text-[var(--ds-status-danger)]"
              }`}
            >
              {(response.payload as { safe_message?: string }).safe_message || text}
            </p>
            {isStale ? (
              <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">
                Confirmation is disabled for this preview. Request a fresh preview before posting.
              </p>
            ) : null}
            {isConflict ? (
              <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">
                This is a conflict, not a temporary failure. Review required — do not retry blindly.
              </p>
            ) : null}
          </div>
        </TrustChrome>
      );
    }
    case "posting_completed":
      return (
        <TrustChrome response={response}>
          <div data-testid="orbix-posting-completed">
            <p className="text-[14px] font-semibold text-[var(--ds-status-success)]">
              {response.payload.idempotent_replay ? "Already posted (safe replay)" : "Posted locally"}
            </p>
            {(() => {
              const { label, testId } = syncStatusPresentation(response.payload.sync_status);
              return (
                <p
                  className="mt-1 text-[12px] text-[var(--ds-text-muted)]"
                  data-testid="orbix-sync-status"
                  data-sync-status={testId}
                >
                  {label}
                </p>
              );
            })()}
            {text ? (
              <div className="mt-1">
                <OrbixMessageContent text={text} />
              </div>
            ) : null}
            {response.payload.voucher_number ? (
              <p
                className="mt-1 font-mono text-[13px] text-[var(--ds-text-default)]"
                data-testid="orbix-voucher-ref"
              >
                {response.payload.voucher_number}
              </p>
            ) : null}
            {response.payload.amount ? (
              <p className="mt-0.5 ds-financial-value text-[13px] text-[var(--ds-text-default)]">
                {response.payload.currency || "NPR"} {response.payload.amount}
              </p>
            ) : null}
          </div>
        </TrustChrome>
      );
    case "posting_failed": {
      const code = response.payload.error_code || "";
      const isStale = code === "stale_preview";
      return (
        <TrustChrome response={response}>
          <div
            className={`rounded-[var(--ds-radius-md)] border px-3 py-2.5 ${
              isStale
                ? "border-[var(--ds-status-warning)]/40 bg-[var(--ds-status-warning-surface)]"
                : "border-[var(--ds-status-danger)]/30 bg-[var(--ds-status-danger-surface)]"
            }`}
            data-testid={isStale ? "orbix-stale-preview" : "orbix-posting-failed"}
            data-error-code={code || undefined}
          >
            <p
              className={`text-[13px] font-medium ${
                isStale ? "text-[var(--ds-status-warning)]" : "text-[var(--ds-status-danger)]"
              }`}
            >
              {response.payload.safe_message || text || "Posting failed."}
            </p>
            {isStale ? (
              <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">
                Generate a new preview before confirming. The previous confirmation is blocked.
              </p>
            ) : null}
          </div>
        </TrustChrome>
      );
    }
    case "confirmation_required":
    case "transaction_preview":
    case "journal_preview":
    case "transaction_draft":
    case "posting_started":
    case "posting_progress":
    case "cancellation_completed":
      // Journal / confirm / posting UI remains in OrbixJournalCard (pendingCard).
      return text ? (
        <TrustChrome response={response}>
          <OrbixMessageContent text={text} />
        </TrustChrome>
      ) : null;
    case "report_result":
    case "report_updated":
      return text ? (
        <TrustChrome response={response}>
          <OrbixMessageContent text={text} />
          {response.response_type === "report_updated" &&
          "changes" in response.payload &&
          Array.isArray(response.payload.changes) &&
          response.payload.changes.length ? (
            <p className="mt-2 text-[12px] text-[var(--ds-text-muted)]">
              Updated · {response.payload.changes.join(" · ")}
            </p>
          ) : null}
        </TrustChrome>
      ) : null;
    case "normal_answer":
    case "capability_answer":
    case "accounting_explanation":
    case "erp_data_result":
    case "unknown":
      return text ? (
        <TrustChrome response={response}>
          <OrbixMessageContent text={text} />
        </TrustChrome>
      ) : null;
    default: {
      // Exhaustive safeguard — never treat unknown as an accounting card.
      const _exhaustive: never = response;
      void _exhaustive;
      return (
        <div
          className="rounded-[var(--ds-radius-md)] border border-amber-200 bg-amber-50 px-3 py-2.5"
          data-testid="orbix-unsupported-response"
        >
          <p className="text-[13px] text-amber-800">
            {text || "Unsupported response. No accounting action was taken."}
          </p>
        </div>
      );
    }
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
      <div className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3.5 py-3">
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
