import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import type { UnifiedContext } from "./contextEngine";
import type { ExecutionPlan } from "./planner";

export interface ReasoningResult {
  summary: string;
  chain: string[];
  confidence: number;
  requiresProposal: boolean;
}

export function runReasoning(
  context: UnifiedContext,
  plan: ExecutionPlan,
): ReasoningResult {
  if (!isMigrationFlagEnabled("MIGRATION_NIOS_REASONING")) {
    return {
      summary: context.message,
      chain: ["reasoning-disabled"],
      confidence: 0.5,
      requiresProposal: false,
    };
  }

  return {
    summary: `Analyzed: ${context.message.slice(0, 120)}`,
    chain: plan.steps.map((s) => `${s.action} via ${s.capabilityId}`),
    confidence: plan.confidence,
    requiresProposal: plan.steps.some((s) => s.action === "propose"),
  };
}
