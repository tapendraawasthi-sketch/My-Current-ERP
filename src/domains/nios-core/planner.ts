import type { UnifiedContext } from "./contextEngine";

export interface PlanStep {
  id: string;
  action: string;
  capabilityId: string;
  deps: string[];
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  confidence: number;
}

export function createPlan(context: UnifiedContext): ExecutionPlan {
  const steps: PlanStep[] = [
    { id: "observe", action: "observe", capabilityId: "erp.read.ledger", deps: [] },
    { id: "reason", action: "reason", capabilityId: "erp.read.trial_balance", deps: ["observe"] },
    { id: "propose", action: "propose", capabilityId: "erp.propose.voucher", deps: ["reason"] },
  ];

  return {
    id: crypto.randomUUID(),
    goal: context.message,
    steps,
    confidence: 0.7,
  };
}
