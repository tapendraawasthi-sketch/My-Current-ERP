import type { IApprovalGate, ApprovalDecision, RiskClassification } from "../contracts/approvalContract";
import type { FrozenPlan, FrozenPlanStep } from "../types";
import { classifyPlanRisk, classifyStepRisk, isHighRiskCommand } from "./riskClassifier";

export class ApprovalGate implements IApprovalGate {
  classifyPlan(plan: FrozenPlan): RiskClassification {
    return classifyPlanRisk(plan);
  }

  classifyStep(step: FrozenPlanStep): RiskClassification {
    return classifyStepRisk(step);
  }

  evaluate(plan: FrozenPlan): ApprovalDecision {
    const risk = this.classifyPlan(plan);
    const commandSteps = plan.steps.filter((s) => s.kind === "command");

    return {
      required: risk.requiresApproval,
      risk,
      proposalIds: [],
      message: risk.requiresApproval
        ? `Approval required: ${risk.reasons.join("; ")}`
        : "No approval required",
    };
  }

  isHighRiskCommand(commandType: string): boolean {
    return isHighRiskCommand(commandType);
  }
}

let gateInstance: ApprovalGate | null = null;

export function getApprovalGate(): ApprovalGate {
  if (!gateInstance) gateInstance = new ApprovalGate();
  return gateInstance;
}

export function resetApprovalGate(): void {
  gateInstance = null;
}
