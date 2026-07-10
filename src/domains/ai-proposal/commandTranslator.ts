import type { AiProposal } from "./proposalTypes";
import type { ExecuteCommandOptions } from "@/platform/command-bus/dispatch";

export function translateProposalToCommand(proposal: AiProposal): ExecuteCommandOptions {
  return {
    commandType: proposal.commandType,
    aggregateType: proposal.aggregateType,
    aggregateId: proposal.aggregateId,
    payload: proposal.payload,
    correlationId: proposal.correlationId,
    causationId: proposal.id,
    commandId: crypto.randomUUID(),
  };
}
