export interface SyncDiagnosticRecord {
  stage:
    | "cycle-start"
    | "cycle-complete"
    | "cycle-error"
    | "push-success"
    | "push-failed"
    | "pull-success"
    | "pull-failed"
    | "auth-rejected"
    | "conflict"
    | "bootstrap";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 2000;
const records: SyncDiagnosticRecord[] = [];

export function recordSyncDiagnostic(entry: SyncDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getSyncDiagnostics(filter?: {
  stage?: SyncDiagnosticRecord["stage"];
}): SyncDiagnosticRecord[] {
  return records.filter((r) => !filter?.stage || r.stage === filter.stage);
}

export function clearSyncDiagnostics(): void {
  records.length = 0;
}
