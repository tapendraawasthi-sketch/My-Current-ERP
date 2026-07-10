import type { RetrieveInput, RetrieveOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import { getConfidenceEvaluator } from "../confidence";
import { getToolRouter } from "../tool-router/toolRouter";
import { getMemoryStore } from "../memory";

export async function runRetrieveStage(input: RetrieveInput): Promise<RetrieveOutput> {
  const { understand } = input;
  const router = getToolRouter();
  const memory = getMemoryStore();
  const items: import("../types/evidence").EvidenceItem[] = [];
  const intent = understand.intent;

  const selectedTools = router.selectTools(intent);
  for (const toolId of selectedTools) {
    if (toolId === "memory") {
      const working = memory.working.snapshot();
      items.push({
        id: `ev-working-${Date.now()}`,
        source: "memory",
        label: "Working memory snapshot",
        content: working,
        relevance: 0.5,
        retrievedAt: new Date().toISOString(),
      });
      continue;
    }

    if (toolId === "knowledge" && intent.category === "explanation") {
      const result = await router.invoke({
        toolId: "knowledge",
        action: "lookup",
        payload: { query: intent.rawInput },
      });
      if (result.success) {
        items.push({
          id: `ev-knowledge-${Date.now()}`,
          source: "knowledge",
          label: "Knowledge lookup",
          content: result.data,
          relevance: result.confidence.score,
          retrievedAt: new Date().toISOString(),
        });
      }
    }
  }

  if (intent.category === "query" || intent.category === "report") {
    const result = await router.invoke({
      toolId: "search",
      action: "resolve_query",
      payload: { input: intent.rawInput, domain: intent.domain },
    });
    if (result.success && result.data) {
      items.push({
        id: `ev-search-${Date.now()}`,
        source: "query_bus",
        label: "Query bus retrieval",
        content: result.data,
        relevance: result.confidence.score,
        retrievedAt: new Date().toISOString(),
      });
    }
  }

  const evidence = createImmutable({
    id: `evidence-${understand.intent.id}`,
    items,
    queryCount: items.filter((i) => i.source === "query_bus").length,
    timestamp: new Date().toISOString(),
  });

  const avgRelevance =
    items.length > 0 ? items.reduce((s, i) => s + i.relevance, 0) / items.length : 0;
  const missingEvidence =
    items.length === 0 ? ["No evidence retrieved for intent"] : [];

  const confidence = getConfidenceEvaluator().evaluate({
    score: items.length > 0 ? Math.max(0.4, avgRelevance) : 0.2,
    missingEvidence,
    risk: "none",
  });

  return createImmutable({ evidence, confidence, timestamp: new Date().toISOString() });
}
