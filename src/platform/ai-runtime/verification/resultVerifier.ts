import type { VerifyInput, VerifyResultOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { getConfidenceEvaluator } from "../confidence";

export async function runVerifyResultStage(input: VerifyInput): Promise<VerifyResultOutput> {
  const { execute, verifyPlan } = input;
  const issues: string[] = [];

  const failedSteps = execute.stepResults.filter((s) => !s.success);
  if (failedSteps.length > 0) {
    issues.push(`${failedSteps.length} step(s) failed during execution`);
    for (const step of failedSteps) {
      if (step.error) issues.push(`Step ${step.stepId}: ${step.error}`);
    }
  }

  const pendingCommands = execute.commands.filter((c) => c.status === "pending");
  if (pendingCommands.length > 0 && verifyPlan.valid) {
    issues.push(`${pendingCommands.length} command(s) pending approval — expected for high-risk actions`);
  }

  const valid = failedSteps.length === 0;
  const confidence = getConfidenceEvaluator().evaluate({
    score: valid ? execute.confidence.score : Math.min(execute.confidence.score, 0.3),
    missingEvidence: issues,
    risk: pendingCommands.length > 0 ? "medium" : "none",
  });

  return createImmutable({
    valid,
    issues,
    confidence,
    timestamp: new Date().toISOString(),
  });
}
