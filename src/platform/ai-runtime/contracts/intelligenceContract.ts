import type {
  ObserveOutput,
  UnderstandOutput,
  RetrieveOutput,
  ReasonOutput,
  PlanOutput,
  ExecuteOutput,
  VerifyPlanOutput,
  VerifyResultOutput,
  ExplainOutput,
  LearnOutput,
  AiRuntimeRequest,
  PipelineContext,
} from "../types";

export interface ObserveInput {
  readonly request: AiRuntimeRequest;
  readonly context?: PipelineContext;
}

export interface UnderstandInput {
  readonly observe: ObserveOutput;
  readonly context?: PipelineContext;
}

export interface RetrieveInput {
  readonly understand: UnderstandOutput;
  readonly context?: PipelineContext;
}

export interface ReasonInput {
  readonly retrieve: RetrieveOutput;
  readonly understand: UnderstandOutput;
  readonly context?: PipelineContext;
}

export interface PlanInput {
  readonly reason: ReasonOutput;
  readonly understand: UnderstandOutput;
  readonly context?: PipelineContext;
}

export interface VerifyPlanInput {
  readonly plan: PlanOutput;
  readonly reason: ReasonOutput;
  readonly context?: PipelineContext;
}

export interface ExecuteInput {
  readonly verifyPlan: VerifyPlanOutput;
  readonly context?: PipelineContext;
}

export interface VerifyInput {
  readonly execute: ExecuteOutput;
  readonly verifyPlan: VerifyPlanOutput;
  readonly context?: PipelineContext;
}

export interface ExplainInput {
  readonly verifyResult: VerifyResultOutput;
  readonly execute: ExecuteOutput;
  readonly reason: ReasonOutput;
  readonly context?: PipelineContext;
}

export interface LearnInput {
  readonly explain: ExplainOutput;
  readonly request: AiRuntimeRequest;
  readonly context?: PipelineContext;
}

/**
 * Intelligence Contract — every AI capability must implement all lifecycle methods.
 * No exceptions.
 */
export interface IIntelligenceCapability {
  observe(input: ObserveInput): Promise<ObserveOutput>;
  understand(input: UnderstandInput): Promise<UnderstandOutput>;
  retrieve(input: RetrieveInput): Promise<RetrieveOutput>;
  reason(input: ReasonInput): Promise<ReasonOutput>;
  plan(input: PlanInput): Promise<PlanOutput>;
  execute(input: ExecuteInput): Promise<ExecuteOutput>;
  verify(input: VerifyInput): Promise<VerifyResultOutput>;
  explain(input: ExplainInput): Promise<ExplainOutput>;
  learn(input: LearnInput): Promise<LearnOutput>;
}

export interface IPipelineStage<TInput, TOutput> {
  readonly stageName: string;
  run(input: TInput): Promise<TOutput>;
}

export interface IAiRuntime {
  process(request: AiRuntimeRequest): Promise<import("../types").FrozenAiOutput>;
  isReady(): boolean;
}
