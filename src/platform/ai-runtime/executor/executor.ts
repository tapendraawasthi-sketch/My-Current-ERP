import type { ExecuteInput, ExecuteOutput } from "../contracts/intelligenceContract";
import { createImmutable } from "../types/immutable";
import type { CommandProposal, StepExecutionResult } from "../types";
import { getToolRouter } from "../tool-router/toolRouter";
import { executeQuerySync } from "@fios/query-bus";
import { getCommandDispatcher } from "./commandDispatcher";
import { getConfidenceEvaluator } from "../confidence";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";

export async function runExecuteStage(input: ExecuteInput): Promise<ExecuteOutput> {
  const { verifyPlan, context } = input;
  const plan = verifyPlan.plan;
  const router = getToolRouter();
  const dispatcher = getCommandDispatcher();
  const stepResults: StepExecutionResult[] = [];
  const commands: CommandProposal[] = [];

  if (!verifyPlan.valid) {
    return createImmutable({
      planId: plan.id,
      stepResults: [],
      commands: [],
      confidence: verifyPlan.confidence,
      timestamp: new Date().toISOString(),
    });
  }

  for (const step of plan.steps) {
    const start = Date.now();
    try {
      if (step.kind === "tool" && step.toolId) {
        const result = await router.invoke({
          toolId: step.toolId as import("../contracts").AiToolId,
          action: String(step.payload.action ?? "default"),
          payload: step.payload as Record<string, unknown>,
        });
        stepResults.push({
          stepId: step.id,
          success: result.success,
          data: result.data,
          error: result.error,
          latencyMs: Date.now() - start,
        });
      } else if (step.kind === "query" && step.queryType) {
        const data = executeQuerySync({
          queryType: step.queryType,
          payload: step.payload as Record<string, unknown>,
        });
        stepResults.push({
          stepId: step.id,
          success: true,
          data,
          latencyMs: Date.now() - start,
        });
      } else if (step.kind === "command") {
        const sessionId = context?.request.sessionId ?? "ai-session";
        const dispatchResult = await dispatcher.dispatchProposal({
          sessionId,
          commandType: step.commandType ?? "UNKNOWN",
          aggregateType: step.aggregateType ?? "unknown",
          aggregateId: step.payload.aggregateId as string | undefined,
          payload: step.payload as Record<string, unknown>,
          rationale: step.description,
          confidence: plan.confidence.score,
          correlationId: context?.request.correlationId,
        });
        commands.push(dispatchResult.proposal);

        if (
          !step.requiresApproval &&
          isMigrationFlagEnabled("MIGRATION_AI_EXECUTION") &&
          dispatchResult.proposal.proposalId
        ) {
          const approved = await dispatcher.dispatchApproved(dispatchResult.proposal.proposalId);
          commands[commands.length - 1] = approved.proposal;
        }

        stepResults.push({
          stepId: step.id,
          success: true,
          data: dispatchResult,
          latencyMs: Date.now() - start,
        });
      } else if (step.kind === "verify") {
        stepResults.push({
          stepId: step.id,
          success: true,
          data: { verified: true },
          latencyMs: Date.now() - start,
        });
      }
    } catch (error) {
      stepResults.push({
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start,
      });
    }
  }

  const successRate =
    stepResults.length > 0 ? stepResults.filter((s) => s.success).length / stepResults.length : 0;

  const confidence = getConfidenceEvaluator().evaluate({
    score: successRate * plan.confidence.score,
    missingEvidence: stepResults.filter((s) => !s.success).map((s) => s.error ?? s.stepId),
    risk: commands.some((c) => c.status === "pending") ? "medium" : "none",
  });

  return createImmutable({
    planId: plan.id,
    stepResults,
    commands,
    confidence,
    timestamp: new Date().toISOString(),
  });
}
