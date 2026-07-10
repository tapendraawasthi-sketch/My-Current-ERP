import type { KhataConfirmationCard } from "@/lib/ekhata/types";
import { executeCommand, CommandTypes, AggregateTypes } from "@fios/command-bus";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { submitProposal, approveProposal } from "@/domains/ai-proposal/approvalService";
import { executeApprovedProposal } from "@/domains/ai-proposal/commandExecutionService";

export const niosDomain = {
  confirmKhata(card: KhataConfirmationCard) {
    return executeCommand<{ voucherNo: string }>({
      commandType: CommandTypes.POST_KHATA_ENTRY,
      aggregateType: AggregateTypes.KHATA,
      payload: { card },
    });
  },
};

export async function confirmKhataViaProposal(
  card: KhataConfirmationCard,
  sessionId: string,
): Promise<{ voucherNo: string }> {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_COMMAND_GATE")) {
    return niosDomain.confirmKhata(card);
  }

  const proposal = submitProposal({
    sessionId,
    commandType: CommandTypes.POST_KHATA_ENTRY,
    aggregateType: AggregateTypes.KHATA,
    payload: { card },
    agentId: "ekhata",
    rationale: "User confirmed e-Khata entry",
  });

  approveProposal(proposal.id, "ekhata-user");

  if (isMigrationFlagEnabled("MIGRATION_AI_EXECUTION")) {
    const result = await executeApprovedProposal(proposal.id);
    if (!result.executed) {
      throw new Error(result.error ?? "Khata proposal execution failed");
    }
    return { voucherNo: String((result.result as { voucherNo?: string })?.voucherNo ?? "") };
  }

  return niosDomain.confirmKhata(card);
}

export type NiosDomain = typeof niosDomain;
