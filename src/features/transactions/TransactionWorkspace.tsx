import React from "react";
import { PageHeader, Surface } from "@/design-system";
import {
  lifecycleLabel,
  type TransactionDocMode,
  type TransactionLifecycle,
} from "./status";

export interface TransactionPostingResultView {
  documentNumber?: string | null;
  amountLabel?: string | null;
  syncStatus?: string | null;
  lifecycle: TransactionLifecycle;
  message?: string | null;
  idempotentReplay?: boolean;
}

export interface TransactionWorkspaceProps {
  title: string;
  description?: string;
  family: string;
  mode: TransactionDocMode;
  companyName: string;
  fiscalYearName: string;
  lifecycle?: TransactionLifecycle;
  periodLocked?: boolean;
  permissionDenied?: boolean;
  inspector?: React.ReactNode;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode[];
  stickyActions?: React.ReactNode;
  postingResult?: TransactionPostingResultView | null;
  children: React.ReactNode;
}

export function TransactionWorkspace({
  title,
  description,
  family,
  mode,
  companyName,
  fiscalYearName,
  lifecycle = "draft",
  periodLocked,
  permissionDenied,
  inspector,
  inspectorOpen,
  onToggleInspector,
  primaryAction,
  secondaryActions,
  stickyActions,
  postingResult,
  children,
}: TransactionWorkspaceProps) {
  return (
    <div
      className="flex min-h-0 flex-col gap-3"
      data-component="transaction-workspace"
      data-family={family}
      data-mode={mode}
      data-testid={`txn-workspace-${family}`}
    >
      <PageHeader
        title={title}
        description={description}
        status={
          <span
            className="rounded-full bg-[var(--ds-surface-muted)] px-2 py-0.5 text-[12px] font-medium text-[var(--ds-text-muted)]"
            data-testid="txn-lifecycle"
            data-lifecycle={lifecycle}
          >
            {lifecycleLabel(lifecycle)}
          </span>
        }
        meta={
          periodLocked || permissionDenied ? (
            <div className="flex flex-wrap gap-2 text-[12px] text-[var(--ds-text-muted)]">
              <span className="sr-only" data-testid="txn-company">
                {companyName}
              </span>
              <span className="sr-only" data-testid="txn-fy">
                FY {fiscalYearName}
              </span>
              {periodLocked ? (
                <span className="text-[var(--ds-status-danger)]" data-testid="txn-period-locked">
                  Period locked
                </span>
              ) : null}
              {permissionDenied ? (
                <span className="text-[var(--ds-status-danger)]" data-testid="txn-permission-denied">
                  Not permitted to post
                </span>
              ) : null}
            </div>
          ) : (
            <>
              <span className="sr-only" data-testid="txn-company">
                {companyName}
              </span>
              <span className="sr-only" data-testid="txn-fy">
                FY {fiscalYearName}
              </span>
            </>
          )
        }
        primaryAction={primaryAction}
        secondaryActions={
          [
            ...(secondaryActions || []),
            onToggleInspector ? (
              <button
                key="inspector"
                type="button"
                onClick={onToggleInspector}
                className="hidden h-8 items-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-2.5 text-[12px] text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)] xl:inline-flex"
                aria-pressed={inspectorOpen ? "true" : "false"}
                aria-label="Toggle transaction evidence"
              >
                Evidence
              </button>
            ) : null,
          ].filter(Boolean) as React.ReactNode[]
        }
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <Surface
            className="border border-[var(--ds-border-default)] p-3 md:p-4"
            data-testid="txn-document-canvas"
          >
            {children}
          </Surface>

          {postingResult ? (
            <div
              className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-status-success)]/30 bg-[var(--ds-status-success-surface)] p-3"
              data-testid="txn-posting-result"
              role="status"
            >
              <p className="text-[14px] font-semibold text-[var(--ds-status-success)]">
                {postingResult.idempotentReplay
                  ? "Already posted (safe replay)"
                  : lifecycleLabel(postingResult.lifecycle)}
              </p>
              {postingResult.documentNumber ? (
                <p className="mt-1 font-mono text-[13px] text-[var(--ds-text-default)]">
                  {postingResult.documentNumber}
                </p>
              ) : null}
              {postingResult.amountLabel ? (
                <p className="mt-0.5 ds-financial-value text-[13px]">{postingResult.amountLabel}</p>
              ) : null}
              {postingResult.message ? (
                <p className="mt-1 text-[12px] text-[var(--ds-text-muted)]">{postingResult.message}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {inspectorOpen && inspector ? (
          <aside
            className="hidden w-[320px] flex-shrink-0 xl:block"
            aria-label="Transaction evidence"
            data-testid="txn-inspector"
          >
            <Surface className="h-full border border-[var(--ds-border-default)] p-3">{inspector}</Surface>
          </aside>
        ) : null}
      </div>

      {stickyActions ? (
        <div className="ds-no-print sticky bottom-0 z-[var(--ds-z-sticky)] border-t border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4 py-3">
          {stickyActions}
        </div>
      ) : null}
    </div>
  );
}

export function TransactionInspector({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-[var(--ds-text-muted)]">Evidence</p>
      {children}
    </div>
  );
}
