import { ReportPolicies } from "./reportPolicies";
import { getDB } from "@/lib/db";
import type { JsonObject } from "@fios/kernel";

export interface ReportParityResult {
  reportType: string;
  metric: string;
  legacyValue: number;
  projectionValue: number;
  diff: number;
  withinTolerance: boolean;
  passed: boolean;
}

export interface ReportParityReport {
  checks: ReportParityResult[];
  passed: boolean;
  passRate: number;
  recordedAt: string;
}

const parityResults: ReportParityResult[] = [];
let lastParityReport: ReportParityReport | null = null;

export function getLastParityReport(): ReportParityReport | null {
  return lastParityReport;
}

export function getStoredParityResults(): ReportParityResult[] {
  return [...parityResults];
}

function checkMetric(
  reportType: string,
  metric: string,
  legacyValue: number,
  projectionValue: number,
): ReportParityResult {
  const diff = Math.abs(legacyValue - projectionValue);
  const withinTolerance = diff <= ReportPolicies.parityTolerance;
  return {
    reportType,
    metric,
    legacyValue,
    projectionValue,
    diff,
    withinTolerance,
    passed: withinTolerance,
  };
}

async function persistParityResult(result: ReportParityResult): Promise<void> {
  parityResults.push(result);
  try {
    const db = getDB() as Record<string, { put: (r: unknown) => Promise<unknown> }>;
    await db.projectionParityResults?.put({
      id: `report:${result.reportType}:${result.metric}:${Date.now()}`,
      projectionName: result.reportType,
      metric: result.metric,
      legacyValue: result.legacyValue,
      projectionValue: result.projectionValue,
      diff: result.diff,
      withinTolerance: result.withinTolerance,
      recordedAt: new Date().toISOString(),
      details: { source: "report-engine" } as JsonObject,
    });
  } catch {
    /* diagnostics only */
  }
}

export function recordParityChecks(checks: ReportParityResult[]): ReportParityReport {
  const passed = checks.filter((c) => c.passed).length;
  const passRate = checks.length > 0 ? passed / checks.length : 1;
  const report: ReportParityReport = {
    checks,
    passed: passRate >= ReportPolicies.parityProductionThreshold,
    passRate,
    recordedAt: new Date().toISOString(),
  };
  lastParityReport = report;
  for (const check of checks) {
    void persistParityResult(check);
  }
  return report;
}

export { checkMetric };
