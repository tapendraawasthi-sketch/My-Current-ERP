import { createImmutable } from "../types/immutable";
import type { FrozenConfidenceAssessment } from "../types";
import type { ConfidencePolicyConfig, IConfidenceEvaluator } from "../contracts/confidenceContract";
import { DEFAULT_CONFIDENCE_POLICY, scoreToLevel, scoreToNextAction } from "./confidencePolicy";

export class ConfidenceEvaluator implements IConfidenceEvaluator {
  readonly config: ConfidencePolicyConfig;

  constructor(config: ConfidencePolicyConfig = DEFAULT_CONFIDENCE_POLICY) {
    this.config = config;
  }

  evaluate(params: {
    score: number;
    missingEvidence?: readonly string[];
    risk?: FrozenConfidenceAssessment["risk"];
  }): FrozenConfidenceAssessment {
    const missingEvidence = params.missingEvidence ?? [];
    const risk = params.risk ?? "none";
    const score = Math.max(0, Math.min(1, params.score));
    const level = scoreToLevel(score, this.config);
    const nextAction = scoreToNextAction(score, missingEvidence, risk, this.config);

    return createImmutable({
      score,
      level,
      risk,
      missingEvidence,
      nextAction,
      rationale: `score=${score.toFixed(2)} risk=${risk} missing=${missingEvidence.length}`,
    });
  }

  combine(assessments: readonly FrozenConfidenceAssessment[]): FrozenConfidenceAssessment {
    if (assessments.length === 0) {
      return this.evaluate({ score: 0, missingEvidence: ["no assessments"], risk: "high" });
    }
    const avgScore = assessments.reduce((s, a) => s + a.score, 0) / assessments.length;
    const missingEvidence = [...new Set(assessments.flatMap((a) => [...a.missingEvidence]))];
    const maxRisk = assessments.reduce<FrozenConfidenceAssessment["risk"]>((max, a) => {
      const order = ["none", "low", "medium", "high", "critical"] as const;
      return order.indexOf(a.risk) > order.indexOf(max) ? a.risk : max;
    }, "none");

    return this.evaluate({ score: avgScore, missingEvidence, risk: maxRisk });
  }

  shouldProceed(assessment: FrozenConfidenceAssessment): boolean {
    return assessment.nextAction === "proceed" || assessment.nextAction === "require_approval";
  }

  shouldRetrieveMore(assessment: FrozenConfidenceAssessment): boolean {
    return assessment.nextAction === "retrieve_more" || assessment.nextAction === "search_again";
  }

  shouldAskUser(assessment: FrozenConfidenceAssessment): boolean {
    return assessment.nextAction === "ask_user";
  }

  shouldRefuse(assessment: FrozenConfidenceAssessment): boolean {
    return assessment.nextAction === "refuse";
  }
}

let evaluatorInstance: ConfidenceEvaluator | null = null;

export function getConfidenceEvaluator(): ConfidenceEvaluator {
  if (!evaluatorInstance) evaluatorInstance = new ConfidenceEvaluator();
  return evaluatorInstance;
}

export function resetConfidenceEvaluator(): void {
  evaluatorInstance = null;
}
