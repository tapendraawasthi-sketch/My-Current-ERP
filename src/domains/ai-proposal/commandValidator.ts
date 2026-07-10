import type { AiProposal } from "./proposalTypes";
import { ProposalStatuses } from "./proposalTypes";
import { validateProposal } from "./proposalValidator";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export interface CommandValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateCommandFromProposal(proposal: AiProposal): CommandValidationResult {
  const issues: string[] = [];

  if (!isMigrationFlagEnabled("MIGRATION_AI_APPROVAL")) {
    issues.push("MIGRATION_AI_APPROVAL is disabled");
  }

  if (proposal.status !== ProposalStatuses.APPROVED) {
    issues.push(`Proposal status must be approved, got ${proposal.status}`);
  }

  issues.push(...validateProposal(proposal).map((i) => i.message));

  if (proposal.status === ProposalStatuses.REJECTED) {
    issues.push("Rejected proposals cannot reach Command Bus");
  }

  return { valid: issues.length === 0, issues };
}
