import type { AiProposal } from "./proposalTypes";
import { ApprovalPolicies } from "./approvalPolicies";
import { proposalLogger } from "./proposalLogger";

export interface ApprovalNotification {
  proposalId: string;
  type: "pending" | "approved" | "rejected" | "expired";
  message: string;
  timestamp: string;
}

const notifications: ApprovalNotification[] = [];

export function notifyApprovalPending(proposal: AiProposal): void {
  if (!ApprovalPolicies.notifyOnPending) return;
  notifications.push({
    proposalId: proposal.id,
    type: "pending",
    message: `Proposal ${proposal.id} awaiting approval: ${proposal.commandType}`,
    timestamp: new Date().toISOString(),
  });
  proposalLogger.debug("approval-notification-pending", { proposalId: proposal.id });
}

export function notifyApprovalApproved(proposalId: string): void {
  if (!ApprovalPolicies.notifyOnApproved) return;
  notifications.push({
    proposalId,
    type: "approved",
    message: `Proposal ${proposalId} approved`,
    timestamp: new Date().toISOString(),
  });
}

export function notifyApprovalRejected(proposalId: string): void {
  if (!ApprovalPolicies.notifyOnRejected) return;
  notifications.push({
    proposalId,
    type: "rejected",
    message: `Proposal ${proposalId} rejected`,
    timestamp: new Date().toISOString(),
  });
}

export function listApprovalNotifications(): ApprovalNotification[] {
  return [...notifications];
}
