import type { EntityId } from "@fios/kernel";

export const ProposalStatuses = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVOKED: "revoked",
  EXPIRED: "expired",
  EXECUTING: "executing",
  EXECUTED: "executed",
  FAILED: "failed",
} as const;

export type ProposalStatus = (typeof ProposalStatuses)[keyof typeof ProposalStatuses];

export interface AiProposal {
  id: EntityId;
  version: number;
  sessionId: string;
  agentId?: string;
  capabilityId?: string;
  commandType: string;
  aggregateType: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  rationale?: string;
  confidence?: number;
  correlationId: string;
  causationId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  executedAt?: string;
  commandId?: string;
  errorMessage?: string;
}

export interface ProposalAuditEntry {
  id: EntityId;
  proposalId: EntityId;
  action: string;
  actorId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
