import { clearReportCache, invalidateReportCache } from "./reportCache";
import { clearReportDiagnostics } from "./reportDiagnostics";
import { clearReportSnapshots } from "./reportSnapshot";
import { resetReportCutoverRollback } from "./reportEngine";
import { runFullReportParityValidation } from "./reportParityRunner";
import { runReportIntegrityChecks } from "./reportIntegrityChecker";
import { reportLogger } from "./reportLogger";

export interface ReportRepairResult {
  integrityIssues: number;
  parityPassed: boolean;
  actions: string[];
  recordedAt: string;
}

export async function diagnoseReportEngine(): Promise<ReportRepairResult> {
  const integrity = await runReportIntegrityChecks();
  const parity = await runFullReportParityValidation();
  return {
    integrityIssues: integrity.length,
    parityPassed: parity.passed,
    actions: [
      `integrity issues: ${integrity.length}`,
      `parity pass rate: ${parity.passRate}`,
    ],
    recordedAt: new Date().toISOString(),
  };
}

export async function repairReportEngine(): Promise<ReportRepairResult> {
  invalidateReportCache();
  clearReportSnapshots();
  resetReportCutoverRollback();
  reportLogger.info("report-engine-repair");
  return diagnoseReportEngine();
}

export function resetReportEngineState(): void {
  clearReportCache();
  clearReportDiagnostics();
  clearReportSnapshots();
  resetReportCutoverRollback();
}
