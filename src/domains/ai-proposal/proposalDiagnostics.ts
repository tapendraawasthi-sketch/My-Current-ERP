export interface ProposalDiagnosticRecord {
  proposalId?: string;
  stage:
    | "created"
    | "validated"
    | "approved"
    | "rejected"
    | "revoked"
    | "expired"
    | "executing"
    | "executed"
    | "failed"
    | "replay-complete"
    | "error";
  message?: string;
  timestamp: string;
}

const MAX_RECORDS = 3000;
const records: ProposalDiagnosticRecord[] = [];

export function recordProposalDiagnostic(entry: ProposalDiagnosticRecord): void {
  records.push(entry);
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }
}

export function getProposalDiagnostics(filter?: {
  proposalId?: string;
  stage?: ProposalDiagnosticRecord["stage"];
}): ProposalDiagnosticRecord[] {
  return records.filter((r) => {
    if (filter?.proposalId && r.proposalId !== filter.proposalId) return false;
    if (filter?.stage && r.stage !== filter.stage) return false;
    return true;
  });
}

export function clearProposalDiagnostics(): void {
  records.length = 0;
}
