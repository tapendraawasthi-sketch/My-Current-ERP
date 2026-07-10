import type { ProjectionName } from "./projectionState";

export interface ProjectionDiagnosticRecord {
  projectionName?: ProjectionName;
  eventId?: string;
  eventType?: string;
  globalSequence?: number;
  stage:
    | "event-received"
    | "applied"
    | "skipped"
    | "rebuild-start"
    | "rebuild-complete"
    | "parity-pass"
    | "parity-fail"
    | "error";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 3000;
const records: ProjectionDiagnosticRecord[] = [];

export function recordProjectionDiagnostic(entry: ProjectionDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getProjectionDiagnostics(filter?: {
  projectionName?: ProjectionName;
  stage?: ProjectionDiagnosticRecord["stage"];
}): ProjectionDiagnosticRecord[] {
  return records.filter((record) => {
    if (filter?.projectionName && record.projectionName !== filter.projectionName) return false;
    if (filter?.stage && record.stage !== filter.stage) return false;
    return true;
  });
}

export function clearProjectionDiagnostics(): void {
  records.length = 0;
}
