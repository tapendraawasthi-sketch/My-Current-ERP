import { isProjectionSchemaReady, readGlobalProjectionCursor } from "@/platform/projections/projectionCheckpoint";
import { readTrialBalanceFromProjection } from "./trialBalanceProjectionReader";

export interface ReportIntegrityIssue {
  code: string;
  message: string;
}

export async function checkProjectionSchemaIntegrity(): Promise<ReportIntegrityIssue | null> {
  if (!isProjectionSchemaReady()) {
    return { code: "SCHEMA_NOT_READY", message: "Projection schema not ready" };
  }
  return null;
}

export async function checkTrialBalanceIntegrity(): Promise<ReportIntegrityIssue | null> {
  const tb = await readTrialBalanceFromProjection();
  const diff = Math.abs(tb.totalDebit - tb.totalCredit);
  if (diff >= 0.01) {
    return {
      code: "TRIAL_BALANCE_UNBALANCED",
      message: `Projection trial balance unbalanced: diff=${diff}`,
    };
  }
  return null;
}

export async function checkProjectionCursorIntegrity(): Promise<ReportIntegrityIssue | null> {
  const cursor = await readGlobalProjectionCursor();
  if (!cursor) {
    return { code: "NO_CURSOR", message: "Global projection cursor missing" };
  }
  if (cursor.status === "error") {
    return { code: "CURSOR_ERROR", message: cursor.status };
  }
  return null;
}

export async function runReportIntegrityChecks(): Promise<ReportIntegrityIssue[]> {
  const issues: ReportIntegrityIssue[] = [];
  const checks = [
    await checkProjectionSchemaIntegrity(),
    await checkTrialBalanceIntegrity(),
    await checkProjectionCursorIntegrity(),
  ];
  for (const issue of checks) {
    if (issue) issues.push(issue);
  }
  return issues;
}
