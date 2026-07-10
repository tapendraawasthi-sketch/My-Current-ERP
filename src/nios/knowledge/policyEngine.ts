/**
 * Policy Engine — Phase 1 stub
 * Executable policies evaluated in verify() stage.
 */

export interface PolicyViolation {
  policyId: string;
  message: string;
  severity: "block" | "warn";
}

export interface PolicyContext {
  capabilityId: string;
  hasEngineEvidence: boolean;
  hasLegalCitation: boolean;
  amountMentioned: boolean;
  numericFromLlm: boolean;
}

const AI_POLICIES = [
  {
    id: "policy.ai.no_money_without_engine",
    check: (ctx: PolicyContext) =>
      ctx.amountMentioned && !ctx.hasEngineEvidence && ctx.capabilityId.includes("tax"),
    message: "Tax amounts must come from deterministic engine, not LLM",
    severity: "block" as const,
  },
  {
    id: "policy.ai.legal_requires_citation",
    check: (ctx: PolicyContext) =>
      ctx.capabilityId.includes("legal") && !ctx.hasLegalCitation,
    message: "Legal answers require graph citation",
    severity: "block" as const,
  },
];

export function evaluatePolicies(ctx: PolicyContext): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  for (const policy of AI_POLICIES) {
    if (policy.check(ctx)) {
      violations.push({
        policyId: policy.id,
        message: policy.message,
        severity: policy.severity,
      });
    }
  }
  return violations;
}

export function policiesPass(ctx: PolicyContext): boolean {
  return evaluatePolicies(ctx).every((v) => v.severity !== "block");
}
