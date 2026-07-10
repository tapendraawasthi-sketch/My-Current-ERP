import type { PlanInput, PlanOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { buildExecutionPlan } from "./planBuilder";

export async function runPlanStage(input: PlanInput): Promise<PlanOutput> {
  const sessionId = input.context?.request.sessionId;
  const plan = createImmutable(buildExecutionPlan(input.understand.intent, input.reason, sessionId));
  return createImmutable({ plan, timestamp: new Date().toISOString() });
}
