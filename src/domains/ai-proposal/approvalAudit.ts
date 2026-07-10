import type { ProposalAuditEntry } from "./proposalTypes";

const auditLog: ProposalAuditEntry[] = [];

export function recordProposalAudit(input: {
  proposalId: string;
  action: string;
  actorId?: string;
  details?: Record<string, unknown>;
}): ProposalAuditEntry {
  const entry: ProposalAuditEntry = {
    id: crypto.randomUUID(),
    proposalId: input.proposalId,
    action: input.action,
    actorId: input.actorId,
    details: input.details,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(entry);
  return entry;
}

export function getProposalAuditTrail(proposalId: string): ProposalAuditEntry[] {
  return auditLog.filter((e) => e.proposalId === proposalId);
}

export function listAllAuditEntries(): ProposalAuditEntry[] {
  return [...auditLog];
}
