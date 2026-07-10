import type { NiosRequest, NiosResponse } from "./niosKernel";
import type { NiosSession } from "./sessionManager";
import type { UnifiedContext } from "./contextEngine";
import { createPlan } from "./planner";
import { runReasoning } from "./reasoningEngine";
import { executePlan } from "./executionEngine";
import { appendConversationTurn } from "./conversationManager";
import { routeModel } from "./modelRouter";
import { storeMemory } from "./memoryEngine";

export async function runOrchestration(input: {
  request: NiosRequest;
  session: NiosSession;
  context: UnifiedContext;
}): Promise<NiosResponse> {
  const model = routeModel(input.request);
  const plan = createPlan(input.context);
  const reasoning = runReasoning(input.context, plan);
  const execution = await executePlan(plan, input.session.id, reasoning);

  storeMemory(input.session.id, "working", "last-plan", plan.id);
  storeMemory(input.session.id, "episodic", `turn-${input.session.turnCount}`, {
    message: input.request.message,
    answer: reasoning.summary,
  });

  appendConversationTurn(input.session.id, "user", input.request.message);
  appendConversationTurn(input.session.id, "assistant", reasoning.summary);

  return {
    sessionId: input.session.id,
    answer: reasoning.summary,
    proposals: execution.proposals,
    engine: `nios-core/${model.id}`,
    trace: {
      planId: plan.id,
      model: model.id,
      readOnlyTools: execution.readOnlyToolsUsed,
    },
  };
}
