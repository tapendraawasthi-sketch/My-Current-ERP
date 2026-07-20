import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/design-system";

export type DetailReportKpi = {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
};

export type DetailReportLayoutProps = {
  title: string;
  subtitle?: string;
  /** Primary entity identity (ledger name, party, etc.) */
  entityName: string;
  entityMeta?: React.ReactNode;
  kpis?: DetailReportKpi[];
  actions?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Detail report chrome — entity header card + transaction table (STEP 6.2).
 * Use for General Ledger statement, party statements, voucher drills.
 */
export function DetailReportLayout({
  title,
  subtitle,
  entityName,
  entityMeta,
  kpis,
  actions,
  onBack,
  children,
  footer,
  className,
}: DetailReportLayoutProps) {
  return (
    <div
      data-report-layout="detail"
      className={cn(
        "flex h-full min-h-0 flex-col gap-3 bg-[var(--ds-surface-muted)] p-4",
        className,
      )}
    >
      <div className="no-print shrink-0 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-3 shadow-[var(--ds-shadow-1)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            {onBack ? (
              <Button
                type="button"
                variant="secondary"
                size="small"
                className="shrink-0"
                startIcon={<ArrowLeft className="h-3.5 w-3.5" />}
                onClick={onBack}
                aria-label="Back"
              >
                Back
              </Button>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-gray-800">{title}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] text-gray-500">{subtitle}</p>
              ) : null}
              <p className="mt-1 truncate text-[13px] font-medium text-[var(--ds-text-strong)]">
                {entityName}
              </p>
              {entityMeta ? (
                <div className="mt-1 text-[11px] text-gray-500">{entityMeta}</div>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {kpis && kpis.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--ds-border-subtle)] pt-3 sm:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="min-w-0">
                <div className="text-[10px] font-medium text-gray-500">{k.label}</div>
                <div
                  className={cn(
                    "mt-0.5 font-mono text-[13px] font-semibold",
                    k.tone === "success" && "text-[var(--ox-success)]",
                    k.tone === "danger" && "text-[var(--ox-danger)]",
                    (!k.tone || k.tone === "default") && "text-gray-800",
                  )}
                >
                  {k.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)]">
        {children}
      </div>

      {footer ? (
        <div className="no-print shrink-0 text-[11px] text-gray-500">{footer}</div>
      ) : null}
    </div>
  );
}
