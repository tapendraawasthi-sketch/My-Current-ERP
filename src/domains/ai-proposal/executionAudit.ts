export interface ExecutionAuditEntry {
  id: string;
  proposalId: string;
  commandId: string;
  correlationId: string;
  status: "executed" | "failed";
  error?: string;
  timestamp: string;
}

const auditLog: ExecutionAuditEntry[] = [];

export function recordExecutionAudit(input: {
  proposalId: string;
  commandId: string;
  correlationId: string;
  status: "executed" | "failed";
  error?: string;
}): ExecutionAuditEntry {
  const entry: ExecutionAuditEntry = {
    id: crypto.randomUUID(),
    ...input,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(entry);
  return entry;
}

export function getExecutionAuditTrail(proposalId: string): ExecutionAuditEntry[] {
  return auditLog.filter((e) => e.proposalId === proposalId);
}

export function listExecutionAudit(): ExecutionAuditEntry[] {
  return [...auditLog];
}
