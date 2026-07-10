import type { DeepReadonly } from "./immutable";
import type { FrozenConfidenceAssessment } from "./confidence";

export type PlanStepKind = "tool" | "query" | "command" | "approval" | "verify";

export interface PlanStep {
  readonly id: string;
  readonly kind: PlanStepKind;
  readonly toolId?: string;
  readonly queryType?: string;
  readonly commandType?: string;
  readonly aggregateType?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly description: string;
  readonly requiresApproval: boolean;
  readonly order: number;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly intentId: string;
  readonly steps: readonly PlanStep[];
  readonly estimatedCost: number;
  readonly estimatedLatencyMs: number;
  readonly confidence: FrozenConfidenceAssessment;
  readonly createdAt: string;
}

export type FrozenPlan = DeepReadonly<ExecutionPlan>;
export type FrozenPlanStep = DeepReadonly<PlanStep>;
