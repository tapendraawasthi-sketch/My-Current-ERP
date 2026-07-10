import type { NiosProposal } from "./niosKernel";
import { ProposalStatus } from "./niosKernel";
import { getProposal, updateProposalStatus } from "./proposalEngine";

export interface ApprovalResult {
  approved: boolean;
  proposalId: string;
  message: string;
}

export function requestApproval(proposalId: string): ApprovalResult {
  const proposal = getProposal(proposalId);
  if (!proposal) {
    return { approved: false, proposalId, message: "Proposal not found" };
  }
  if (proposal.status !== ProposalStatus.PENDING) {
    return { approved: false, proposalId, message: `Proposal status is ${proposal.status}` };
  }
  return {
    approved: false,
    proposalId,
    message: "Approval required — execution deferred to F13",
  };
}

export function approveProposal(proposalId: string): ApprovalResult {
  const updated = updateProposalStatus(proposalId, ProposalStatus.APPROVED);
  if (!updated) {
    return { approved: false, proposalId, message: "Proposal not found" };
  }
  return {
    approved: true,
    proposalId,
    message: "Approved — execution deferred to F13 command gateway",
  };
}

export function rejectProposal(proposalId: string): ApprovalResult {
  const updated = updateProposalStatus(proposalId, ProposalStatus.REJECTED);
  if (!updated) {
    return { approved: false, proposalId, message: "Proposal not found" };
  }
  return { approved: false, proposalId, message: "Proposal rejected" };
}
