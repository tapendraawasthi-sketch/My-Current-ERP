export interface DiagnosticRecord {
  sessionId?: string;
  stage:
    | "request-received"
    | "request-complete"
    | "execution-complete"
    | "command-blocked"
    | "health-check"
    | "recovery"
    | "error";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 3000;
const records: DiagnosticRecord[] = [];

export function recordDiagnostic(entry: DiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getDiagnostics(filter?: {
  sessionId?: string;
  stage?: DiagnosticRecord["stage"];
}): DiagnosticRecord[] {
  return records.filter((r) => {
    if (filter?.sessionId && r.sessionId !== filter.sessionId) return false;
    if (filter?.stage && r.stage !== filter.stage) return false;
    return true;
  });
}

export function clearDiagnostics(): void {
  records.length = 0;
}
