import type { FrozenConfidenceAssessment } from "../types";

export interface ConfidencePolicyConfig {
  readonly highThreshold: number;
  readonly mediumThreshold: number;
  readonly refuseThreshold: number;
  readonly autoExecuteThreshold: number;
}

export interface IConfidenceEvaluator {
  readonly config: ConfidencePolicyConfig;
  evaluate(params: {
    score: number;
    missingEvidence?: readonly string[];
    risk?: FrozenConfidenceAssessment["risk"];
  }): FrozenConfidenceAssessment;
  combine(assessments: readonly FrozenConfidenceAssessment[]): FrozenConfidenceAssessment;
  shouldProceed(assessment: FrozenConfidenceAssessment): boolean;
  shouldRetrieveMore(assessment: FrozenConfidenceAssessment): boolean;
  shouldAskUser(assessment: FrozenConfidenceAssessment): boolean;
  shouldRefuse(assessment: FrozenConfidenceAssessment): boolean;
}
