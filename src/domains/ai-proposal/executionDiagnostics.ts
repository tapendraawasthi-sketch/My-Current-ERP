export interface ExecutionDiagnosticRecord {
  proposalId?: string;
  stage: "executing" | "executed" | "failed" | "blocked" | "recovery";
  message?: string;
  timestamp: string;
}

const records: ExecutionDiagnosticRecord[] = [];

export function recordExecutionDiagnostic(entry: ExecutionDiagnosticRecord): void {
  records.push(entry);
  if (records.length > 3000) records.splice(0, records.length - 3000);
}

export function getExecutionDiagnostics(proposalId?: string): ExecutionDiagnosticRecord[] {
  if (!proposalId) return [...records];
  return records.filter((r) => r.proposalId === proposalId);
}
