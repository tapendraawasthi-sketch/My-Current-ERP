import { diffValues, summarizeDiff } from "@/platform/projections/projectionDiff";
import { ReportPolicies } from "./reportPolicies";

export interface ReportDiffEntry {
  path: string;
  legacy: unknown;
  projection: unknown;
}

export function diffReports(
  legacy: unknown,
  projection: unknown,
  path = "root",
): ReportDiffEntry[] {
  return diffValues(legacy, projection, path, ReportPolicies.parityTolerance);
}

export function summarizeReportDiff(diffs: ReportDiffEntry[]): string {
  return summarizeDiff(diffs);
}

export function hasReportDiff(diffs: ReportDiffEntry[]): boolean {
  return diffs.length > 0;
}
