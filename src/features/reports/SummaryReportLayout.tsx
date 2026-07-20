import * as React from "react";
import { cn } from "@/lib/utils";
import { ReportWorkspace, type ReportWorkspaceProps } from "./ReportWorkspace";

/**
 * Summary report chrome — KPI strip + condensed table body (STEP 6.2).
 * Use for Trial Balance, registers, ageing summaries.
 */
export function SummaryReportLayout({ className, children, ...rest }: ReportWorkspaceProps) {
  return (
    <ReportWorkspace {...rest} className={cn("report-layout-summary", className)}>
      <div
        data-report-layout="summary"
        className="report-summary-body text-[12px] [&_table]:text-[12px] [&_th]:py-2 [&_td]:py-1.5 [&_.number-cell]:text-[12px]"
      >
        {children}
      </div>
    </ReportWorkspace>
  );
}
