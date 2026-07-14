import * as React from "react";
import { RefreshCw, Printer, Download, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  PageMeta,
  Button,
  IconButton,
  StatusChip,
  Surface,
  FilterBar,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/design-system";

export type ReportWorkspaceProps = {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  status?: { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string };
  periodLabel?: string;
  companyName?: string;
  pan?: string;
  nameNepali?: string;
  onRefresh?: () => void;
  onPrint?: () => void;
  onExportExcel?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onOptions?: () => void;
  filterSlot?: React.ReactNode;
  onShowReport?: () => void;
  showReportLabel?: string;
  kpiSlot?: React.ReactNode;
  tabs?: Array<{ key: string; label: string }>;
  activeTab?: string;
  onTabChange?: (key: string) => void;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/** Canonical report chrome (IMPLEMENT_NOW §3.8). */
export function ReportWorkspace({
  title,
  description,
  meta,
  status,
  periodLabel,
  companyName,
  pan,
  nameNepali,
  onRefresh,
  onPrint,
  onExportExcel,
  onExportCsv,
  onExportPdf,
  onOptions,
  filterSlot,
  onShowReport,
  showReportLabel = "Show report",
  kpiSlot,
  tabs,
  activeTab,
  onTabChange,
  breadcrumb,
  children,
  footer,
  className,
}: ReportWorkspaceProps) {
  const hasExport = Boolean(onExportExcel || onExportCsv || onExportPdf);

  const secondaryActions: React.ReactNode[] = [];
  if (onRefresh) {
    secondaryActions.push(
      <IconButton
        key="refresh"
        aria-label="Refresh report"
        title="Refresh (F5)"
        variant="quiet"
        size="small"
        icon={<RefreshCw className="h-4 w-4" />}
        onClick={onRefresh}
      />,
    );
  }
  if (onPrint) {
    secondaryActions.push(
      <Button
        key="print"
        variant="secondary"
        size="small"
        startIcon={<Printer className="h-3.5 w-3.5" />}
        onClick={onPrint}
      >
        Print
      </Button>,
    );
  }
  if (hasExport) {
    secondaryActions.push(
      <DropdownMenu key="export">
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="small"
            startIcon={<Download className="h-3.5 w-3.5" />}
            endIcon={<ChevronDown className="h-3.5 w-3.5" />}
          >
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onExportExcel ? (
            <DropdownMenuItem onSelect={() => onExportExcel()}>Excel</DropdownMenuItem>
          ) : null}
          {onExportCsv ? (
            <DropdownMenuItem onSelect={() => onExportCsv()}>CSV</DropdownMenuItem>
          ) : null}
          {onExportPdf ? (
            <DropdownMenuItem onSelect={() => onExportPdf()}>PDF</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>,
    );
  }
  if (onOptions) {
    secondaryActions.push(
      <Button
        key="options"
        variant="secondary"
        size="small"
        startIcon={<Settings className="h-3.5 w-3.5" />}
        onClick={onOptions}
      >
        Options
      </Button>,
    );
  }

  const body = (
    <>
      {breadcrumb ? (
        <div className="ds-no-print no-print border-b border-[var(--ds-border-subtle)] px-3 py-2 text-[13px]">
          {breadcrumb}
        </div>
      ) : null}
      <div className="p-3">{children}</div>
      {footer}
    </>
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 bg-[var(--ds-canvas)] p-4", className)}>
      <PageHeader
        title={title}
        description={description}
        status={status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : undefined}
        secondaryActions={secondaryActions}
        meta={
          meta ||
          (companyName || periodLabel ? (
            <PageMeta>{[companyName, periodLabel].filter(Boolean).join(" · ")}</PageMeta>
          ) : undefined)
        }
      />

      {(filterSlot || onShowReport) && (
        <div className="ds-no-print no-print rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] p-3">
          <FilterBar
            className="mb-0"
            filters={
              <div className="flex flex-wrap items-end gap-3">
                {filterSlot}
                {onShowReport ? (
                  <Button variant="primary" size="medium" onClick={onShowReport}>
                    {showReportLabel}
                  </Button>
                ) : null}
              </div>
            }
          />
        </div>
      )}

      {kpiSlot ? (
        <div className="ds-no-print no-print grid grid-cols-2 gap-3 lg:grid-cols-4">{kpiSlot}</div>
      ) : null}

      <Surface tone="surface" className="min-h-0 flex-1 overflow-hidden">
        {tabs && tabs.length > 0 && activeTab && onTabChange ? (
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="ds-no-print no-print w-full justify-start rounded-none border-b border-[var(--ds-border-subtle)] px-2">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.key} value={t.key} className="mt-0 p-0">
                {t.key === activeTab ? body : null}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          body
        )}
      </Surface>

      <div className="ds-print-only print-only hidden">
        <div className="mb-3 text-[12px]">
          <div className="font-semibold">{companyName}</div>
          {nameNepali ? <div lang="ne">{nameNepali}</div> : null}
          {pan ? <div>PAN: {pan}</div> : null}
          <div className="mt-1 font-semibold">{title}</div>
          {periodLabel ? <div>{periodLabel}</div> : null}
          <div>Printed at: {new Date().toLocaleString("en-IN")}</div>
        </div>
      </div>
    </div>
  );
}
