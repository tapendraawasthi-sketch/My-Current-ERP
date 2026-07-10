import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import type { AiProposal } from "./proposalTypes";
import { ProposalStatuses } from "./proposalTypes";
import { createProposalRecord } from "./proposalStore";
import { getProposalById } from "./proposalRepository";
import { transitionProposal } from "./proposalLifecycle";
import { validateProposal, isProposalValid } from "./proposalValidator";
import { getDefaultExpiry } from "./proposalPolicies";
import { enqueueApproval } from "./approvalQueue";
import { recordApprovalHistory } from "./approvalHistory";
import { notifyApprovalPending } from "./approvalNotifications";
import { recordProposalAudit } from "./approvalAudit";
import { proposalMetrics } from "./proposalMetrics";
import { recordProposalDiagnostic } from "./proposalDiagnostics";
import { proposalLogger } from "./proposalLogger";

export interface SubmitProposalInput {
  sessionId: string;
  commandType: string;
  aggregateType: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
  agentId?: string;
  capabilityId?: string;
  rationale?: string;
  confidence?: number;
  correlationId?: string;
  causationId?: string;
}

export function submitProposal(input: SubmitProposalInput): AiProposal {
  if (!isMigrationFlagEnabled("MIGRATION_AI_PROPOSALS")) {
    throw new Error("MIGRATION_AI_PROPOSALS is disabled");
  }

  const proposal = createProposalRecord({
    sessionId: input.sessionId,
    agentId: input.agentId,
    capabilityId: input.capabilityId,
    commandType: input.commandType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    rationale: input.rationale,
    confidence: input.confidence,
    correlationId: input.correlationId,
    causationId: input.causationId,
    expiresAt: getDefaultExpiry(),
  });

  const issues = validateProposal(proposal);
  if (!isProposalValid(proposal)) {
    recordProposalDiagnostic({
      proposalId: proposal.id,
      stage: "error",
      message: issues.map((i) => i.message).join("; "),
      timestamp: new Date().toISOString(),
    });
  }

  enqueueApproval(proposal);
  notifyApprovalPending(proposal);
  recordProposalAudit({ proposalId: proposal.id, action: "submitted" });
  recordApprovalHistory({ proposalId: proposal.id, action: "submitted" });
  proposalMetrics.incrementCreated();
  recordProposalDiagnostic({ proposalId: proposal.id, stage: "created", timestamp: new Date().toISOString() });
  proposalLogger.info("proposal-submitted", { proposalId: proposal.id });

  return proposal;
}

export function approveProposal(proposalId: string, actorId?: string): AiProposal | null {
  if (!isMigrationFlagEnabled("MIGRATION_AI_APPROVAL")) {
    throw new Error("MIGRATION_AI_APPROVAL is disabled");
  }

  const proposal = getProposalById(proposalId);
  if (!proposal || proposal.status !== ProposalStatuses.PENDING) return null;
  if (!isProposalValid(proposal)) return null;

  const updated = transitionProposal(proposalId, ProposalStatuses.APPROVED, { actorId });
  if (updated) {
    proposalMetrics.incrementApproved();
    recordApprovalHistory({ proposalId, action: "approved", actorId });
    recordProposalDiagnostic({ proposalId, stage: "approved", timestamp: new Date().toISOString() });
  }
  return updated;
}

export function rejectProposal(proposalId: string, actorId?: string, reason?: string): AiProposal | null {
  if (!isMigrationFlagEnabled("MIGRATION_AI_APPROVAL")) {
    throw new Error("MIGRATION_AI_APPROVAL is disabled");
  }

  const proposal = getProposalById(proposalId);
  if (!proposal || proposal.status !== ProposalStatuses.PENDING) return null;

  const updated = transitionProposal(proposalId, ProposalStatuses.REJECTED, { actorId, errorMessage: reason });
  if (updated) {
    proposalMetrics.incrementRejected();
    recordApprovalHistory({ proposalId, action: "rejected", actorId, details: { reason } });
    recordProposalDiagnostic({ proposalId, stage: "rejected", timestamp: new Date().toISOString() });
  }
  return updated;
}
