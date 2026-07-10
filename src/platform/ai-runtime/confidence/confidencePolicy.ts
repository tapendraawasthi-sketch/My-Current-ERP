export const DEFAULT_CONFIDENCE_POLICY = {
  highThreshold: 0.85,
  mediumThreshold: 0.6,
  refuseThreshold: 0.25,
  autoExecuteThreshold: 0.95,
} as const;

export function scoreToLevel(
  score: number,
  config: typeof DEFAULT_CONFIDENCE_POLICY,
): "high" | "medium" | "low" | "refused" {
  if (score < config.refuseThreshold) return "refused";
  if (score >= config.highThreshold) return "high";
  if (score >= config.mediumThreshold) return "medium";
  return "low";
}

export function scoreToNextAction(
  score: number,
  missingEvidence: readonly string[],
  risk: import("../types").FrozenConfidenceAssessment["risk"],
  config: typeof DEFAULT_CONFIDENCE_POLICY,
): import("../types").NextAction {
  if (score < config.refuseThreshold) return "refuse";
  if (risk === "critical" || risk === "high") return "require_approval";
  if (missingEvidence.length > 0 && score < config.highThreshold) return "retrieve_more";
  if (score < config.mediumThreshold) return "ask_user";
  if (score < config.highThreshold) return "search_again";
  return "proceed";
}
