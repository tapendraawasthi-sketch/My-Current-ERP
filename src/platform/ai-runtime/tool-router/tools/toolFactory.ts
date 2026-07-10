import type { JsonObject } from "@fios/kernel";
import type { AiToolDefinition, AiToolInvocation, AiToolResult, IAiTool } from "../contracts/toolContract";
import { getConfidenceEvaluator } from "../confidence";

function defineTool(
  id: import("../contracts/toolContract").AiToolId,
  name: string,
  description: string,
  domain: string,
  permissions: import("../contracts/toolContract").AiPermission[],
  invokeFn: (invocation: AiToolInvocation) => Promise<unknown>,
): IAiTool {
  const definition: AiToolDefinition = {
    metadata: { id, name, description, version: "1.0.0", domain },
    cost: { computeUnits: 2, tokenEstimate: 100, currency: "internal" },
    latency: { p50Ms: 80, p99Ms: 500, timeoutMs: 5000 },
    permissions,
    minConfidence: 0.5,
  };

  return {
    definition,
    async invoke(invocation: AiToolInvocation): Promise<AiToolResult> {
      const start = Date.now();
      try {
        const data = await invokeFn(invocation);
        return {
          toolId: id,
          action: invocation.action,
          success: true,
          data,
          latencyMs: Date.now() - start,
          confidence: getConfidenceEvaluator().evaluate({ score: 0.85, risk: "none" }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          toolId: id,
          action: invocation.action,
          success: false,
          error: message,
          latencyMs: Date.now() - start,
          confidence: getConfidenceEvaluator().evaluate({ score: 0.1, missingEvidence: [message], risk: "low" }),
        };
      }
    },
  };
}

export { defineTool };
