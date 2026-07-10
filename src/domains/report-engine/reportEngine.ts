import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import type { ReportType } from "./reportRegistry";
import { runReportPipeline, type ReportPipelineOptions, type ReportPipelineResult } from "./reportPipeline";
import { getLastParityReport } from "./reportParityEngine";
import { reportLogger } from "./reportLogger";

let cutoverForcedOff = false;

export function isReportCutoverActive(): boolean {
  if (!isMigrationFlagEnabled("MIGRATION_REPORT_CUTOVER")) return false;
  if (cutoverForcedOff) return false;
  const lastParity = getLastParityReport();
  if (!lastParity?.passed) return false;
  return true;
}

export function forceReportCutoverRollback(reason: string): void {
  cutoverForcedOff = true;
  reportLogger.warn("report-cutover-rollback", { reason });
}

export function resetReportCutoverRollback(): void {
  cutoverForcedOff = false;
}

export async function runReport<T = unknown>(
  reportType: ReportType,
  params: Record<string, unknown> = {},
  options: ReportPipelineOptions = {},
): Promise<ReportPipelineResult<T>> {
  if (!isMigrationFlagEnabled("MIGRATION_REPORT_ENGINE")) {
    throw new Error("MIGRATION_REPORT_ENGINE is disabled");
  }
  return runReportPipeline<T>(reportType, params, options);
}

export function shouldUseProjectionReader(): boolean {
  return (
    isMigrationFlagEnabled("MIGRATION_REPORT_ENGINE") &&
    (isReportCutoverActive() || isMigrationFlagEnabled("MIGRATION_REPORT_PARITY"))
  );
}
