export const ProposalPolicies = {
  humanApprovalRequired: true,
  defaultExpiryMs: 24 * 60 * 60 * 1000,
  approvalTimeoutMs: 60 * 60 * 1000,
  maxPendingPerSession: 50,
  allowAutoApprove: false,
} as const;

export function isHumanApprovalRequired(): boolean {
  return ProposalPolicies.humanApprovalRequired;
}

export function getDefaultExpiry(): string {
  return new Date(Date.now() + ProposalPolicies.defaultExpiryMs).toISOString();
}
