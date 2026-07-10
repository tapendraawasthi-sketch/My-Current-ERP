import type { LearnInput, LearnOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { getMemoryStore } from "../memory";

export async function runLearnStage(input: LearnInput): Promise<LearnOutput> {
  const { explain, request } = input;
  const memory = getMemoryStore();
  const insights: string[] = [];
  const memoryUpdates: import("../types/pipeline").MemoryUpdateRecord[] = [];

  memory.working.set(`last-request:${request.sessionId}`, {
    input: request.input,
    confidence: explain.confidence.score,
    warnings: explain.warnings,
  });
  memoryUpdates.push({
    memoryType: "working",
    key: `last-request:${request.sessionId}`,
    action: "store",
  });

  if (request.tenantId && explain.confidence.score >= 0.7) {
    memory.business.setFact(request.tenantId, `last-intent-domain`, request.context?.domain ?? "general");
    memoryUpdates.push({
      memoryType: "business",
      key: "last-intent-domain",
      action: "update",
    });
  }

  if (explain.warnings.length > 0) {
    insights.push(`Session had ${explain.warnings.length} warning(s) — may need follow-up`);
  }

  insights.push(`Completed with confidence ${explain.confidence.score.toFixed(2)}`);

  return createImmutable({
    sessionId: request.sessionId,
    insights,
    memoryUpdates,
    timestamp: new Date().toISOString(),
  });
}

export { runObserveStage } from "./observeStage";
export { runUnderstandStage } from "./understandStage";
export { runRetrieveStage } from "./retrieveStage";
export { runReasonStage } from "./reasonStage";
export { runExplainStage } from "./explainStage";
