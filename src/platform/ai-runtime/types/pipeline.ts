import type { DeepReadonly } from "./immutable";
import type { FrozenIntent } from "./intent";
import type { FrozenPlan } from "./plan";
import type { FrozenEvidence } from "./evidence";
import type { FrozenConfidenceAssessment } from "./confidence";
import type { CommandProposal } from "./output";

export interface AiRuntimeRequest {
  readonly requestId: string;
  readonly sessionId: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly input: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export interface ObserveOutput {
  readonly requestId: string;
  readonly sessionId: string;
  readonly rawInput: string;
  readonly channel: "chat" | "voice" | "api" | "batch";
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: string;
}

export interface UnderstandOutput {
  readonly intent: FrozenIntent;
  readonly ambiguities: readonly string[];
  readonly timestamp: string;
}

export interface RetrieveOutput {
  readonly evidence: FrozenEvidence;
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export interface ReasonOutput {
  readonly reasoning: string;
  readonly conclusions: readonly string[];
  readonly evidence: FrozenEvidence;
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export interface PlanOutput {
  readonly plan: FrozenPlan;
  readonly timestamp: string;
}

export interface VerifyPlanOutput {
  readonly plan: FrozenPlan;
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export interface ExecuteOutput {
  readonly planId: string;
  readonly stepResults: readonly StepExecutionResult[];
  readonly commands: readonly CommandProposal[];
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export interface StepExecutionResult {
  readonly stepId: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly latencyMs: number;
}

export interface VerifyResultOutput {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export interface ExplainOutput {
  readonly explanation: string;
  readonly warnings: readonly string[];
  readonly suggestions: readonly string[];
  readonly confidence: FrozenConfidenceAssessment;
  readonly timestamp: string;
}

export interface LearnOutput {
  readonly sessionId: string;
  readonly insights: readonly string[];
  readonly memoryUpdates: readonly MemoryUpdateRecord[];
  readonly timestamp: string;
}

export interface MemoryUpdateRecord {
  readonly memoryType: "working" | "conversation" | "business" | "long_term";
  readonly key: string;
  readonly action: "store" | "update" | "forget";
}

export interface PipelineContext {
  readonly request: AiRuntimeRequest;
  readonly observe?: DeepReadonly<ObserveOutput>;
  readonly understand?: DeepReadonly<UnderstandOutput>;
  readonly retrieve?: DeepReadonly<RetrieveOutput>;
  readonly reason?: DeepReadonly<ReasonOutput>;
  readonly plan?: DeepReadonly<PlanOutput>;
  readonly verifyPlan?: DeepReadonly<VerifyPlanOutput>;
  readonly execute?: DeepReadonly<ExecuteOutput>;
  readonly verifyResult?: DeepReadonly<VerifyResultOutput>;
  readonly explain?: DeepReadonly<ExplainOutput>;
  readonly learn?: DeepReadonly<LearnOutput>;
}

export type FrozenPipelineContext = DeepReadonly<PipelineContext>;
