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
  KpiSkeleton,
  TableSkeleton,
} from "@/design-system";
import { PrintDocumentHeader, PrintDocumentSignatures } from "./PrintDocumentChrome";

export type ReportWorkspaceProps = {
  title: string;
  description?: string;
  meta?: React.ReactNode;
  status?: { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string };
  periodLabel?: string;
  companyName?: string;
  pan?: string;
  nameNepali?: string;
  /** Optional print letterhead fields (STEP 6.4). */
  address?: string;
  phone?: string;
  logoUrl?: string | null;
  /** When false, omit print signature block. Default true. */
  printSignatures?: boolean;
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
  /** When true, swaps KPI + body for floorplan skeletons (STEP 3.2). */
  loading?: boolean;
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
  address,
  phone,
  logoUrl,
  printSignatures = true,
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
  loading,
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
      <div className="p-3">
        {loading ? <TableSkeleton rows={8} columns={6} className="border-0" /> : children}
      </div>
      {loading ? null : footer}
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

      {loading ? (
        <KpiSkeleton count={4} className="ds-no-print no-print" />
      ) : kpiSlot ? (
        <div className="ds-no-print no-print grid grid-cols-2 gap-3 lg:grid-cols-4">{kpiSlot}</div>
      ) : null}

      <div className="ds-print-only print-only hidden">
        <PrintDocumentHeader
          companyName={companyName}
          nameNepali={nameNepali}
          address={address}
          pan={pan}
          phone={phone}
          logoUrl={logoUrl}
          title={title}
          periodLabel={periodLabel}
        />
      </div>

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

      {printSignatures ? (
        <div className="ds-print-only print-only hidden">
          <PrintDocumentSignatures />
        </div>
      ) : null}
    </div>
  );
}
