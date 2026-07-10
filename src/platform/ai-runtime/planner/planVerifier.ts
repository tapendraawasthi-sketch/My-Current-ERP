import type { VerifyPlanInput, VerifyPlanOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { getConfidenceEvaluator } from "../confidence";
import { getApprovalGate } from "../approval/approvalGate";

export async function runVerifyPlanStage(input: VerifyPlanInput): Promise<VerifyPlanOutput> {
  const { plan: planOutput, reason } = input;
  const plan = planOutput.plan;
  const issues: string[] = [];
  const approvalGate = getApprovalGate();

  if (plan.steps.length === 0) {
    issues.push("Plan has no steps");
  }

  const commandSteps = plan.steps.filter((s) => s.kind === "command");
  for (const step of commandSteps) {
    const risk = approvalGate.classifyStep(step);
    if (risk.requiresApproval && !step.requiresApproval) {
      issues.push(`Step ${step.id} requires approval but flag not set`);
    }
  }

  const approval = approvalGate.evaluate(plan);
  if (approval.required) {
    issues.push(`High-risk plan: ${approval.message}`);
  }

  if (getConfidenceEvaluator().shouldRefuse(reason.confidence)) {
    issues.push("Reasoning confidence too low to proceed");
  }

  const valid = issues.length === 0;
  const confidence = getConfidenceEvaluator().evaluate({
    score: valid ? plan.confidence.score : Math.min(plan.confidence.score, 0.4),
    missingEvidence: valid ? [] : issues,
    risk: approval.risk.level === "critical" ? "critical" : approval.risk.level === "high" ? "high" : "low",
  });

  return createImmutable({
    plan,
    valid,
    issues,
    confidence,
    timestamp: new Date().toISOString(),
  });
}

export { runPlanStage } from "./planner";
