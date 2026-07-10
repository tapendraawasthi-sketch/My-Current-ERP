import type { DeepReadonly } from "./immutable";

export type ConfidenceLevel = "high" | "medium" | "low" | "refused";

export type NextAction =
  | "proceed"
  | "retrieve_more"
  | "ask_user"
  | "search_again"
  | "refuse"
  | "require_approval";

export interface ConfidenceAssessment {
  readonly score: number;
  readonly level: ConfidenceLevel;
  readonly risk: "none" | "low" | "medium" | "high" | "critical";
  readonly missingEvidence: readonly string[];
  readonly nextAction: NextAction;
  readonly rationale: string;
}

export type FrozenConfidenceAssessment = DeepReadonly<ConfidenceAssessment>;
