export const ApprovalPolicies = {
  humanApprovalMandatory: true,
  autoExpirePendingMs: 60 * 60 * 1000,
  notifyOnPending: true,
  notifyOnApproved: true,
  notifyOnRejected: true,
  allowSelfApproval: false,
} as const;

export function isApprovalRequired(): boolean {
  return ApprovalPolicies.humanApprovalMandatory;
}
