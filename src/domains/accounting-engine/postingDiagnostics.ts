export interface PostingDiagnosticRecord {
  eventId?: string;
  eventType?: string;
  voucherId?: string;
  accountId?: string;
  stage:
    | "event-received"
    | "applied"
    | "skipped"
    | "parity-pass"
    | "parity-fail"
    | "integrity-fail"
    | "replay-start"
    | "replay-complete"
    | "error";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 3000;
const records: PostingDiagnosticRecord[] = [];

export function recordPostingDiagnostic(entry: PostingDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getPostingDiagnostics(filter?: {
  voucherId?: string;
  stage?: PostingDiagnosticRecord["stage"];
}): PostingDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.voucherId && record.voucherId !== filter.voucherId) return false;
    if (filter?.stage && record.stage !== filter.stage) return false;
    return true;
  });
}

export function clearPostingDiagnostics(): void {
  records.length = 0;
}
