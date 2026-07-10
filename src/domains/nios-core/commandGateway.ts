import type { NiosProposal } from "./niosKernel";
import { getProposal } from "./proposalEngine";
import { recordDiagnostic } from "./diagnostics";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { submitProposal as submitAiProposal } from "@/domains/ai-proposal/approvalService";
import { AggregateTypes, CommandTypes } from "@/platform/command-bus/commandTypes";

export interface CommandGatewayResult {
  executed: false;
  proposalId: string;
  message: string;
  deferredTo: "F13" | "pending";
}

function mapCommandType(raw: string): string {
  const map: Record<string, string> = {
    PostVoucher: CommandTypes.POST_VOUCHER,
    PostInvoice: CommandTypes.POST_INVOICE,
    PostKhataEntry: CommandTypes.POST_KHATA_ENTRY,
  };
  return map[raw] ?? raw;
}

function mapAggregateType(commandType: string): string {
  if (commandType.includes("Voucher")) return AggregateTypes.VOUCHER;
  if (commandType.includes("Invoice")) return AggregateTypes.INVOICE;
  if (commandType.includes("Khata")) return AggregateTypes.KHATA;
  return AggregateTypes.VOUCHER;
}

export function submitProposal(proposalId: string): CommandGatewayResult {
  const proposal = getProposal(proposalId);
  if (!proposal) {
    return {
      executed: false,
      proposalId,
      message: "Proposal not found",
      deferredTo: "F13",
    };
  }

  if (isMigrationFlagEnabled("MIGRATION_AI_PROPOSALS")) {
    const commandType = mapCommandType(proposal.commandType);
    const aiProposal = submitAiProposal({
      sessionId: proposal.sessionId,
      commandType,
      aggregateType: proposal.aggregateType ?? mapAggregateType(commandType),
      aggregateId: typeof proposal.payload?.id === "string" ? proposal.payload.id : undefined,
      payload: proposal.payload,
      agentId: proposal.agentId,
      capabilityId: proposal.capabilityId,
      rationale: proposal.rationale,
      confidence: proposal.confidence,
      causationId: proposalId,
    });
    recordDiagnostic({
      stage: "command-blocked",
      sessionId: proposal.sessionId,
      message: `routed to F13 proposal ${aiProposal.id}`,
      timestamp: new Date().toISOString(),
    });
    return {
      executed: false,
      proposalId: aiProposal.id,
      message: "Proposal submitted to F13 approval pipeline",
      deferredTo: "pending",
    };
  }

  recordDiagnostic({
    stage: "command-blocked",
    sessionId: proposal.sessionId,
    message: `command ${proposal.commandType} blocked — deferred to F13`,
    timestamp: new Date().toISOString(),
  });

  return {
    executed: false,
    proposalId,
    message: "Command execution blocked. Proposal deferred to F13 integration.",
    deferredTo: "F13",
  };
}

export function executeCommand(_proposal: NiosProposal): never {
  throw new Error("Direct command execution forbidden. Use F13 approval pipeline.");
}

export function isCommandExecutionAllowed(): boolean {
  return false;
}
