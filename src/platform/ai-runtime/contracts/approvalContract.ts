import type { FrozenPlan, FrozenPlanStep } from "../types";

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface RiskClassification {
  readonly level: RiskLevel;
  readonly reasons: readonly string[];
  readonly requiresApproval: boolean;
  readonly commandTypes: readonly string[];
}

export interface ApprovalDecision {
  readonly required: boolean;
  readonly risk: RiskClassification;
  readonly proposalIds: readonly string[];
  readonly message: string;
}

export interface IApprovalGate {
  classifyPlan(plan: FrozenPlan): RiskClassification;
  classifyStep(step: FrozenPlanStep): RiskClassification;
  evaluate(plan: FrozenPlan): ApprovalDecision;
  isHighRiskCommand(commandType: string): boolean;
}
