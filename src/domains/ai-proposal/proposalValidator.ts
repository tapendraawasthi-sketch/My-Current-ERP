import type { AiProposal } from "./proposalTypes";
import { CommandTypes } from "@/platform/command-bus/commandTypes";

export interface ValidationIssue {
  code: string;
  message: string;
}

const ALLOWED_COMMANDS = new Set<string>(Object.values(CommandTypes));

export function validateProposal(proposal: AiProposal): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!proposal.commandType) {
    issues.push({ code: "MISSING_COMMAND_TYPE", message: "commandType required" });
  } else if (!ALLOWED_COMMANDS.has(proposal.commandType)) {
    issues.push({ code: "UNKNOWN_COMMAND", message: `Unknown command: ${proposal.commandType}` });
  }

  if (!proposal.aggregateType) {
    issues.push({ code: "MISSING_AGGREGATE_TYPE", message: "aggregateType required" });
  }

  if (!proposal.payload || typeof proposal.payload !== "object") {
    issues.push({ code: "INVALID_PAYLOAD", message: "payload must be an object" });
  }

  if (!proposal.sessionId) {
    issues.push({ code: "MISSING_SESSION", message: "sessionId required" });
  }

  if (new Date(proposal.expiresAt).getTime() <= Date.now()) {
    issues.push({ code: "EXPIRED", message: "Proposal already expired" });
  }

  return issues;
}

export function isProposalValid(proposal: AiProposal): boolean {
  return validateProposal(proposal).length === 0;
}
