/** SUTRA AI — append pipeline resolution steps to reasoning trace */

import type { ChainOfThoughtResult, ReasoningStep } from "../types";

export interface PipelineTraceInput {
  erpQueryResolved: boolean;
  erpHandler?: string;
  paymentMode?: string;
  llmUsed?: boolean;
  llmRouteReason?: string;
  guards?: string[];
  confidence?: number;
}

export function appendPipelineTrace(
  reasoning: ChainOfThoughtResult,
  trace: PipelineTraceInput,
): ChainOfThoughtResult {
  const steps: ReasoningStep[] = [...reasoning.steps];
  let step = steps.length + 1;

  if (trace.paymentMode) {
    steps.push({
      step: step++,
      name: "PAYMENT MODE",
      detail: `Inferred: ${trace.paymentMode}`,
      data: { paymentMode: trace.paymentMode },
    });
  }

  if (trace.erpQueryResolved) {
    steps.push({
      step: step++,
      name: "ERP HANDLER",
      detail: trace.erpHandler ?? "Rule-based ERP query answered",
      data: { resolved: true, handler: trace.erpHandler },
    });
  }

  if (trace.guards?.length) {
    steps.push({
      step: step++,
      name: "TRANSACTION GUARDS",
      detail: trace.guards.join(" · "),
      data: { guards: trace.guards },
    });
  }

  steps.push({
    step: step++,
    name: "LLM ROUTE",
    detail: trace.llmUsed
      ? `Enhanced (${trace.llmRouteReason ?? "online"})`
      : `Skipped (${trace.llmRouteReason ?? "rules sufficient"})`,
    data: { llmUsed: trace.llmUsed, reason: trace.llmRouteReason },
  });

  if (trace.confidence != null) {
    steps.push({
      step: step++,
      name: "FINAL CONFIDENCE",
      detail: `${(trace.confidence * 100).toFixed(0)}%`,
      data: { confidence: trace.confidence },
    });
  }

  return { ...reasoning, steps };
}
