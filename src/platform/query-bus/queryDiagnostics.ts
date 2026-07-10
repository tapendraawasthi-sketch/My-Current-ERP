export interface QueryDiagnosticRecord {
  queryId: string;
  queryType: string;
  correlationId: string;
  stage: "dispatched" | "ok" | "not_found" | "rejected" | "validation_failed";
  durationMs?: number;
  error?: string;
  timestamp: string;
}

const MAX_RECORDS = 2000;
const records: QueryDiagnosticRecord[] = [];

export function recordQueryDiagnostic(entry: QueryDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getQueryDiagnostics(filter?: {
  queryType?: string;
  correlationId?: string;
  stage?: QueryDiagnosticRecord["stage"];
}): QueryDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.queryType && record.queryType !== filter.queryType) return false;
    if (filter?.correlationId && record.correlationId !== filter.correlationId) return false;
    if (filter?.stage && record.stage !== filter.stage) return false;
    return true;
  });
}

export function clearQueryDiagnostics(): void {
  records.length = 0;
}
