export interface ReportDiagnosticRecord {
  reportType?: string;
  stage:
    | "report-start"
    | "applied"
    | "skipped"
    | "parity-pass"
    | "parity-fail"
    | "integrity-fail"
    | "replay-start"
    | "replay-complete"
    | "rollback"
    | "error";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 3000;
const records: ReportDiagnosticRecord[] = [];

export function recordReportDiagnostic(entry: ReportDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getReportDiagnostics(filter?: {
  reportType?: string;
  stage?: ReportDiagnosticRecord["stage"];
}): ReportDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.reportType && record.reportType !== filter.reportType) return false;
    if (filter?.stage && record.stage !== filter.stage) return false;
    return true;
  });
}

export function clearReportDiagnostics(): void {
  records.length = 0;
}
