import type { DeepReadonly } from "./immutable";
import type { FrozenConfidenceAssessment } from "./confidence";
import type { FrozenIntent } from "./intent";
import type { FrozenPlan } from "./plan";
import type { FrozenEvidence } from "./evidence";

export interface CommandProposal {
  readonly proposalId?: string;
  readonly commandType: string;
  readonly aggregateType: string;
  readonly aggregateId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly rationale: string;
  readonly status: "pending" | "approved" | "executed" | "rejected" | "skipped";
}

export interface AiRuntimeStructuredOutput {
  readonly requestId: string;
  readonly sessionId: string;
  readonly intent: FrozenIntent;
  readonly plan: FrozenPlan | null;
  readonly evidence: FrozenEvidence;
  readonly commands: readonly CommandProposal[];
  readonly confidence: FrozenConfidenceAssessment;
  readonly explanation: string;
  readonly warnings: readonly string[];
  readonly suggestions: readonly string[];
  readonly stage: AiRuntimeStage;
  readonly completedAt: string;
}

export type AiRuntimeStage =
  | "observe"
  | "understand"
  | "retrieve"
  | "reason"
  | "plan"
  | "verify_plan"
  | "execute"
  | "verify_result"
  | "explain"
  | "learn"
  | "complete"
  | "refused";

export type FrozenAiOutput = DeepReadonly<AiRuntimeStructuredOutput>;
