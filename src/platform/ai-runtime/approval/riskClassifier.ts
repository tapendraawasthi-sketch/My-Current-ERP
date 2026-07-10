import type { RiskClassification } from "../contracts/approvalContract";
import type { FrozenPlan, FrozenPlanStep } from "../types";

const HIGH_RISK_COMMANDS = new Set([
  "DELETE_VOUCHER",
  "DELETE_INVOICE",
  "REVERSE_VOUCHER",
  "REVERSE_INVOICE",
  "POST_PAYROLL",
  "FILE_TAX_RETURN",
  "BULK_UPDATE",
  "BULK_DELETE",
  "POST_BANK_TRANSACTION",
  "DELETE_ACCOUNT",
  "DELETE_PARTY",
  "DELETE_ITEM",
]);

const HIGH_RISK_PATTERNS = [
  /delete/i,
  /reverse/i,
  /payroll/i,
  /tax filing/i,
  /bulk update/i,
  /bank post/i,
];

export function isHighRiskCommand(commandType: string): boolean {
  return HIGH_RISK_COMMANDS.has(commandType.toUpperCase());
}

export function classifyStepRisk(step: FrozenPlanStep, rawInput?: string): RiskClassification {
  const reasons: string[] = [];
  let level: RiskClassification["level"] = "none";

  if (step.kind === "command") {
    const cmd = (step.commandType ?? "").toUpperCase();
    if (isHighRiskCommand(cmd)) {
      level = "critical";
      reasons.push(`High-risk command type: ${cmd}`);
    } else {
      level = "medium";
      reasons.push("State mutation via command bus");
    }
  }

  if (rawInput) {
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(rawInput)) {
        level = level === "critical" ? "critical" : "high";
        reasons.push(`Input matches high-risk pattern: ${pattern.source}`);
      }
    }
  }

  if (step.requiresApproval) {
    level = level === "none" ? "medium" : level;
    reasons.push("Step flagged for approval");
  }

  return {
    level,
    reasons,
    requiresApproval: level === "high" || level === "critical" || step.requiresApproval,
    commandTypes: step.commandType ? [step.commandType] : [],
  };
}

export function classifyPlanRisk(plan: FrozenPlan): RiskClassification {
  const stepRisks = plan.steps.map((s) => classifyStepRisk(s));
  const order = ["none", "low", "medium", "high", "critical"] as const;
  const maxLevel = stepRisks.reduce<RiskClassification["level"]>(
    (max, r) => (order.indexOf(r.level) > order.indexOf(max) ? r.level : max),
    "none",
  );

  return {
    level: maxLevel,
    reasons: [...new Set(stepRisks.flatMap((r) => [...r.reasons]))],
    requiresApproval: stepRisks.some((r) => r.requiresApproval),
    commandTypes: [...new Set(stepRisks.flatMap((r) => [...r.commandTypes]))],
  };
}
