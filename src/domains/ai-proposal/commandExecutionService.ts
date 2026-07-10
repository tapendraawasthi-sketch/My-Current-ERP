import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { executeCommand } from "@/platform/command-bus/dispatch";
import type { AiProposal } from "./proposalTypes";
import { ProposalStatuses } from "./proposalTypes";
import { getProposalById, listProposalsByStatus } from "./proposalRepository";
import { transitionProposal } from "./proposalLifecycle";
import { translateProposalToCommand } from "./commandTranslator";
import { validateCommandFromProposal } from "./commandValidator";
import { recordExecutionAudit } from "./executionAudit";
import { recordExecutionDiagnostic } from "./executionDiagnostics";
import { executionMetrics } from "./executionMetrics";
import { executionLogger } from "./executionLogger";
import { notifyApprovalApproved } from "./approvalNotifications";

export interface ExecutionResult {
  proposalId: string;
  executed: boolean;
  commandId?: string;
  data?: unknown;
  error?: string;
}

export async function executeApprovedProposal(proposalId: string): Promise<ExecutionResult> {
  if (!isMigrationFlagEnabled("MIGRATION_AI_EXECUTION")) {
    return {
      proposalId,
      executed: false,
      error: "MIGRATION_AI_EXECUTION is disabled",
    };
  }

  const proposal = getProposalById(proposalId);
  if (!proposal) {
    return { proposalId, executed: false, error: "Proposal not found" };
  }

  const validation = validateCommandFromProposal(proposal);
  if (!validation.valid) {
    recordExecutionDiagnostic({
      proposalId,
      stage: "failed",
      message: validation.issues.join("; "),
      timestamp: new Date().toISOString(),
    });
    executionMetrics.incrementFailed();
    return { proposalId, executed: false, error: validation.issues.join("; ") };
  }

  transitionProposal(proposalId, ProposalStatuses.EXECUTING);
  recordExecutionDiagnostic({ proposalId, stage: "executing", timestamp: new Date().toISOString() });

  const commandOptions = translateProposalToCommand(proposal);
  try {
    const data = await executeCommand(commandOptions);
    transitionProposal(proposalId, ProposalStatuses.EXECUTED, { commandId: commandOptions.commandId });
    recordExecutionAudit({
      proposalId,
      commandId: commandOptions.commandId!,
      correlationId: commandOptions.correlationId!,
      status: "executed",
    });
    executionMetrics.incrementExecuted();
    notifyApprovalApproved(proposalId);
    recordExecutionDiagnostic({ proposalId, stage: "executed", timestamp: new Date().toISOString() });
    executionLogger.info("proposal-executed", { proposalId, commandId: commandOptions.commandId });
    return { proposalId, executed: true, commandId: commandOptions.commandId, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    transitionProposal(proposalId, ProposalStatuses.FAILED, { errorMessage: message });
    recordExecutionAudit({
      proposalId,
      commandId: commandOptions.commandId!,
      correlationId: commandOptions.correlationId!,
      status: "failed",
      error: message,
    });
    executionMetrics.incrementFailed();
    recordExecutionDiagnostic({ proposalId, stage: "failed", message, timestamp: new Date().toISOString() });
    executionLogger.error("proposal-execution-failed", { proposalId, error: message });
    return { proposalId, executed: false, error: message };
  }
}

export async function executeAllApproved(): Promise<ExecutionResult[]> {
  const approved = listProposalsByStatus(ProposalStatuses.APPROVED);
  const results: ExecutionResult[] = [];
  for (const proposal of approved) {
    results.push(await executeApprovedProposal(proposal.id));
  }
  return results;
}
