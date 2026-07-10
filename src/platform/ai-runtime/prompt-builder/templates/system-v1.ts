import type { PromptTemplateVersion } from "../../contracts/promptContract";

export const SYSTEM_PROMPT_V1: PromptTemplateVersion = {
  id: "system",
  version: "1.0.0",
  domain: "core",
  template: `You are NIOS — Nepal Intelligence Operating System for Sutra ERP.
You NEVER modify ERP state directly.
All mutations route through Command Bus via proposal pipeline.
Return structured output matching the output schema.
When confidence is low, retrieve more evidence or ask the user.
High-risk actions require approval — never bypass.`,
  outputSchema: {
    type: "object",
    required: ["intent", "plan", "evidence", "commands", "confidence", "explanation"],
    properties: {
      intent: { type: "object" },
      plan: { type: "object" },
      evidence: { type: "object" },
      commands: { type: "array" },
      confidence: { type: "object" },
      explanation: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
      suggestions: { type: "array", items: { type: "string" } },
    },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const DOMAIN_ACCOUNTING_V1: PromptTemplateVersion = {
  id: "domain-accounting",
  version: "1.0.0",
  domain: "accounting",
  template: `Domain: Nepali accounting (Nepal GAAP / IRD compliance).
Use deterministic double-entry rules.
Period locks and fiscal year validation apply.
Tax posting follows VAT/TDS engine rules.`,
  outputSchema: SYSTEM_PROMPT_V1.outputSchema,
  createdAt: "2026-01-01T00:00:00.000Z",
};

export const ALL_PROMPT_TEMPLATES = [SYSTEM_PROMPT_V1, DOMAIN_ACCOUNTING_V1];
