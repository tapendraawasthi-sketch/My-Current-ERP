export interface ApprovalHistoryEntry {
  proposalId: string;
  action: string;
  actorId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

const history: ApprovalHistoryEntry[] = [];

export function recordApprovalHistory(entry: Omit<ApprovalHistoryEntry, "timestamp">): void {
  history.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getApprovalHistory(proposalId: string): ApprovalHistoryEntry[] {
  return history.filter((h) => h.proposalId === proposalId);
}

export function listApprovalHistory(): ApprovalHistoryEntry[] {
  return [...history];
}
