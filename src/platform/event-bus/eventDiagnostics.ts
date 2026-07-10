export interface EventDiagnosticRecord {
  eventId: string;
  eventType: string;
  correlationId: string;
  causationId?: string;
  stage: "published" | "dispatched" | "handler_success" | "handler_failure" | "dlq";
  handlerType?: string;
  durationMs?: number;
  error?: string;
  timestamp: string;
}

const MAX_RECORDS = 2000;
const records: EventDiagnosticRecord[] = [];

export function recordDiagnostic(entry: EventDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getDiagnostics(filter?: {
  eventType?: string;
  correlationId?: string;
  stage?: EventDiagnosticRecord["stage"];
}): EventDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.eventType && record.eventType !== filter.eventType) return false;
    if (filter?.correlationId && record.correlationId !== filter.correlationId) return false;
    if (filter?.stage && record.stage !== filter.stage) return false;
    return true;
  });
}

export function clearDiagnostics(): void {
  records.length = 0;
}

export function getDiagnosticSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const record of records) {
    const key = `${record.stage}:${record.eventType}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}
