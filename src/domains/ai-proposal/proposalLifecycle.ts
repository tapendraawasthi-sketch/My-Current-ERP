import { ProposalStatuses } from "./proposalTypes";
import type { AiProposal } from "./proposalTypes";
import { getProposalById, listProposalsByStatus } from "./proposalRepository";
import { updateProposalRecord } from "./proposalStore";
import { recordProposalAudit } from "./approvalAudit";

const VALID_TRANSITIONS: Record<string, string[]> = {
  [ProposalStatuses.PENDING]: [ProposalStatuses.APPROVED, ProposalStatuses.REJECTED, ProposalStatuses.REVOKED, ProposalStatuses.EXPIRED],
  [ProposalStatuses.APPROVED]: [ProposalStatuses.EXECUTING, ProposalStatuses.REVOKED, ProposalStatuses.EXPIRED],
  [ProposalStatuses.EXECUTING]: [ProposalStatuses.EXECUTED, ProposalStatuses.FAILED],
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionProposal(
  id: string,
  toStatus: AiProposal["status"],
  meta?: { actorId?: string; errorMessage?: string; commandId?: string },
): AiProposal | null {
  const proposal = getProposalById(id);
  if (!proposal) return null;
  if (!canTransition(proposal.status, toStatus)) return null;

  const patch: Partial<AiProposal> = { status: toStatus };
  if (toStatus === ProposalStatuses.APPROVED) {
    patch.approvedAt = new Date().toISOString();
    patch.approvedBy = meta?.actorId;
  }
  if (toStatus === ProposalStatuses.REJECTED) {
    patch.rejectedAt = new Date().toISOString();
  }
  if (toStatus === ProposalStatuses.EXECUTED) {
    patch.executedAt = new Date().toISOString();
    patch.commandId = meta?.commandId;
  }
  if (toStatus === ProposalStatuses.FAILED) {
    patch.errorMessage = meta?.errorMessage;
  }

  const updated = updateProposalRecord(id, patch);
  if (updated) {
    recordProposalAudit({
      proposalId: id,
      action: `transition:${proposal.status}->${toStatus}`,
      actorId: meta?.actorId,
      details: meta,
    });
  }
  return updated;
}

export function revokeProposal(id: string, actorId?: string): AiProposal | null {
  const proposal = getProposalById(id);
  if (!proposal) return null;
  if (proposal.status !== ProposalStatuses.PENDING && proposal.status !== ProposalStatuses.APPROVED) {
    return null;
  }
  return transitionProposal(id, ProposalStatuses.REVOKED, { actorId });
}

export function expireStaleProposals(now = Date.now()): number {
  let expired = 0;
  for (const status of [ProposalStatuses.PENDING, ProposalStatuses.APPROVED]) {
    const proposals = listProposalsByStatus(status);
    for (const p of proposals) {
      if (new Date(p.expiresAt).getTime() <= now) {
        if (transitionProposal(p.id, ProposalStatuses.EXPIRED)) expired += 1;
      }
    }
  }
  return expired;
}
