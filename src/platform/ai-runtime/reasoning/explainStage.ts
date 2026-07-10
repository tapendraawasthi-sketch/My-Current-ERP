import type { ExplainInput, ExplainOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { getConfidenceEvaluator } from "../confidence";
import { getStoredJournalProposal, buildAccountingExplanation } from "./accountingPipeline";

export async function runExplainStage(input: ExplainInput): Promise<ExplainOutput> {
  const { verifyResult, execute, reason } = input;
  const sessionId = input.context?.request.sessionId ?? "default";
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!verifyResult.valid) {
    warnings.push(...verifyResult.issues);
  }

  const executedCommands = execute.commands.filter((c) => c.status === "executed");
  const pendingCommands = execute.commands.filter((c) => c.status === "pending");

  if (pendingCommands.length > 0) {
    warnings.push(`${pendingCommands.length} command(s) awaiting approval`);
    suggestions.push("Review and approve pending proposals in the approval queue");
  }

  if (executedCommands.length > 0) {
    suggestions.push("Verify creditor balance and bank balance after posting");
  }

  const journalProposal = getStoredJournalProposal(sessionId);
  let explanation: string;

  if (journalProposal) {
    const voucherNo = executedCommands[0]?.proposalId
      ? String((execute.stepResults.find((s) => s.success)?.data as { proposal?: { proposalId?: string } }) ?? "")
      : undefined;
    explanation = buildAccountingExplanation(journalProposal, voucherNo || undefined);
    explanation = [
      explanation,
      "",
      "Why this entry:",
      journalProposal.explanation,
      reason.reasoning,
    ].join("\n");
  } else {
    explanation = [
      reason.reasoning,
      "",
      verifyResult.valid ? "Result verification passed." : "Result verification found issues.",
      executedCommands.length > 0
        ? `Executed ${executedCommands.length} command(s) through Command Bus.`
        : pendingCommands.length > 0
          ? "Journal proposal submitted — awaiting approval before voucher is posted."
          : "No commands dispatched — read-only operation.",
    ].join("\n");
  }

  const confidence = getConfidenceEvaluator().combine([
    verifyResult.confidence,
    execute.confidence,
    reason.confidence,
  ]);

  return createImmutable({
    explanation,
    warnings,
    suggestions,
    confidence,
    timestamp: new Date().toISOString(),
  });
}
