import type {
  IIntelligenceCapability,
  IAiRuntime,
  ObserveInput,
  UnderstandInput,
  RetrieveInput,
  ReasonInput,
  PlanInput,
  VerifyPlanInput,
  ExecuteInput,
  VerifyInput,
  ExplainInput,
  LearnInput,
} from "./contracts/intelligenceContract";
import type { AiRuntimeRequest, FrozenAiOutput, PipelineContext } from "./types";
import { createImmutable } from "./types/immutable";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { getConfidenceEvaluator } from "./confidence";
import { getExtensionRegistry } from "./extensionRegistry";
import { recordAiDiagnostic } from "./aiDiagnostics";
import { aiMetrics } from "./aiMetrics";
import { aiLogger } from "./aiLogger";
import { recordAssistantTurn } from "./conversation";
import {
  runObserveStage,
  runUnderstandStage,
  runRetrieveStage,
  runReasonStage,
  runExplainStage,
  runLearnStage,
} from "./reasoning";
import { runPlanStage, runVerifyPlanStage } from "./planner";
import { runExecuteStage } from "./executor";
import { runVerifyResultStage } from "./verification";

async function runStage<T>(
  stage: string,
  requestId: string,
  sessionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  recordAiDiagnostic({ requestId, sessionId, stage: `${stage}-start`, timestamp: new Date().toISOString() });
  const result = await fn();
  const ms = Date.now() - start;
  aiMetrics.recordStageLatency(stage, ms);
  recordAiDiagnostic({
    requestId,
    sessionId,
    stage: `${stage}-complete`,
    timestamp: new Date().toISOString(),
    metadata: { latencyMs: ms },
  });
  return result;
}

export class AiRuntimeCapability implements IIntelligenceCapability {
  observe(input: ObserveInput) {
    return runObserveStage(input);
  }
  understand(input: UnderstandInput) {
    return runUnderstandStage(input);
  }
  retrieve(input: RetrieveInput) {
    return runRetrieveStage(input);
  }
  reason(input: ReasonInput) {
    return runReasonStage(input);
  }
  plan(input: PlanInput) {
    return runPlanStage(input);
  }
  execute(input: ExecuteInput) {
    return runExecuteStage(input);
  }
  verify(input: VerifyInput) {
    return runVerifyResultStage(input);
  }
  explain(input: ExplainInput) {
    return runExplainStage(input);
  }
  learn(input: LearnInput) {
    return runLearnStage(input);
  }
}

export class AiRuntime implements IAiRuntime {
  private capability = new AiRuntimeCapability();

  isReady(): boolean {
    return isMigrationFlagEnabled("MIGRATION_AI_RUNTIME");
  }

  async process(request: AiRuntimeRequest): Promise<FrozenAiOutput> {
    if (!this.isReady()) {
      throw new Error("MIGRATION_AI_RUNTIME is disabled");
    }

    aiMetrics.incrementRequests();
    aiLogger.info("request-start", { requestId: request.requestId, sessionId: request.sessionId });

    const extensions = getExtensionRegistry();
    let ctx: PipelineContext = createImmutable({ request });

    const hookCtx = await extensions.runHooks("before_observe", { request, pipeline: ctx });
    ctx = createImmutable({ ...ctx, ...hookCtx.pipeline });

    const observe = await runStage("observe", request.requestId, request.sessionId, () =>
      this.capability.observe({ request, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, observe });

    const understand = await runStage("understand", request.requestId, request.sessionId, () =>
      this.capability.understand({ observe, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, understand });

    if (getConfidenceEvaluator().shouldRefuse(understand.intent.confidence)) {
      aiMetrics.incrementRefused();
      return this.buildRefusedOutput(request, understand.intent, ctx);
    }

    const retrieve = await runStage("retrieve", request.requestId, request.sessionId, () =>
      this.capability.retrieve({ understand, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, retrieve });

    if (getConfidenceEvaluator().shouldRetrieveMore(retrieve.confidence)) {
      aiLogger.info("retrieve-more-suggested", { requestId: request.requestId });
    }

    const reason = await runStage("reason", request.requestId, request.sessionId, () =>
      this.capability.reason({ retrieve, understand, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, reason });

    const plan = await runStage("plan", request.requestId, request.sessionId, () =>
      this.capability.plan({ reason, understand, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, plan });

    const verifyPlan = await runStage("verify_plan", request.requestId, request.sessionId, () =>
      runVerifyPlanStage({ plan, reason, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, verifyPlan });

    if (verifyPlan.confidence.nextAction === "require_approval") {
      aiMetrics.incrementApprovalsRequired();
    }

    const execute = await runStage("execute", request.requestId, request.sessionId, () =>
      this.capability.execute({ verifyPlan, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, execute });

    if (execute.commands.length > 0) {
      aiMetrics.incrementCommandsProposed();
    }

    const verifyResult = await runStage("verify_result", request.requestId, request.sessionId, () =>
      this.capability.verify({ execute, verifyPlan, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, verifyResult });

    const explain = await runStage("explain", request.requestId, request.sessionId, () =>
      this.capability.explain({ verifyResult, execute, reason, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, explain });

    const learn = await runStage("learn", request.requestId, request.sessionId, () =>
      this.capability.learn({ explain, request, context: ctx }),
    );
    ctx = createImmutable({ ...ctx, learn });

    recordAssistantTurn(request.sessionId, explain.explanation);

    const output = createImmutable({
      requestId: request.requestId,
      sessionId: request.sessionId,
      intent: understand.intent,
      plan: plan.plan,
      evidence: retrieve.evidence,
      commands: execute.commands,
      confidence: explain.confidence,
      explanation: explain.explanation,
      warnings: explain.warnings,
      suggestions: explain.suggestions,
      stage: "complete" as const,
      completedAt: new Date().toISOString(),
    });

    await extensions.runHooks("before_complete", { request, pipeline: ctx, output });
    aiMetrics.incrementCompleted();
    aiLogger.info("request-complete", { requestId: request.requestId });

    return output;
  }

  private buildRefusedOutput(
    request: AiRuntimeRequest,
    intent: import("./types").FrozenIntent,
    ctx: PipelineContext,
  ): FrozenAiOutput {
    const confidence = getConfidenceEvaluator().evaluate({
      score: intent.confidence.score,
      missingEvidence: [...intent.confidence.missingEvidence],
      risk: "high",
    });

    return createImmutable({
      requestId: request.requestId,
      sessionId: request.sessionId,
      intent,
      plan: null,
      evidence: createImmutable({ id: "empty", items: [], queryCount: 0, timestamp: new Date().toISOString() }),
      commands: [],
      confidence,
      explanation: "Request refused due to insufficient confidence.",
      warnings: ["Confidence below refusal threshold"],
      suggestions: ["Provide more context or rephrase your request"],
      stage: "refused",
      completedAt: new Date().toISOString(),
    });
  }
}

let runtimeInstance: AiRuntime | null = null;

export function getAiRuntime(): AiRuntime {
  if (!runtimeInstance) runtimeInstance = new AiRuntime();
  return runtimeInstance;
}

export function resetAiRuntime(): void {
  runtimeInstance = null;
}

export async function processAiRequest(request: AiRuntimeRequest): Promise<FrozenAiOutput> {
  return getAiRuntime().process(request);
}

export function createAiRequest(input: {
  sessionId: string;
  input: string;
  userId?: string;
  tenantId?: string;
  context?: Record<string, unknown>;
  correlationId?: string;
}): AiRuntimeRequest {
  return createImmutable({
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sessionId: input.sessionId,
    userId: input.userId,
    tenantId: input.tenantId,
    input: input.input,
    context: input.context,
    correlationId: input.correlationId,
  });
}
