// src/lib/falcon/smartIntentEngine.ts
// Falcon AI — Smart Intent Understanding Engine
// Determines exactly what the user is asking and how to respond

import type { ParsedQuery, UserIntent } from "./nlpEngine";
import { parseQuery, extractIntent, isElaborationQuery } from "./nlpEngine";
import {
  classifyIntent,
  getIntentOutputRules,
  type FalconIntent,
  type SectionType,
} from "./intentTaxonomy";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ResponseStrategy =
  | "navigation-only"
  | "steps-only"
  | "explanation"
  | "troubleshooting"
  | "field-specific"
  | "comparison"
  | "calculation"
  | "list"
  | "shortcut"
  | "accounting-entry"
  | "validation-rules"
  | "code-analysis"
  | "greeting"
  | "comprehensive";

export interface SmartIntent {
  parsed: ParsedQuery;
  userIntent: UserIntent;
  falconIntent: FalconIntent;
  responseStrategy: ResponseStrategy;
  primaryFocus: string | null;
  secondaryTopics: string[];
  excludeFromResponse: ExclusionRule[];
  requiredSections: SectionType[];
  optionalSections: SectionType[];
  confidenceScore: number;
  routeContext?: string;
}

export interface ExclusionRule {
  sectionType: SectionType;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE STRATEGY FROM UNIFIED TAXONOMY
// ─────────────────────────────────────────────────────────────────────────────

function strategyFromFalconIntent(falconIntent: FalconIntent, parsed: ParsedQuery): ResponseStrategy {
  if (parsed.isGreeting) return "greeting";

  switch (falconIntent) {
    case "nav":
    case "action_path":
      return "navigation-only";
    case "steps":
      return "steps-only";
    case "definition":
      return "explanation";
    case "troubleshoot":
      return "troubleshooting";
    case "effect":
      return "accounting-entry";
    case "code":
      return "code-analysis";
    case "general":
    default:
      if (parsed.questionType === "compare") return "comparison";
      if (parsed.questionType === "calculate") return "calculation";
      if (parsed.questionType === "list") return "list";
      if (/keyboard|shortcut|hotkey/i.test(parsed.original)) return "shortcut";
      if (/validation|rules?|required|mandatory/i.test(parsed.original)) return "validation-rules";
      return "comprehensive";
  }
}

function determineExclusions(
  falconIntent: FalconIntent,
  strategy: ResponseStrategy,
  userIntent: UserIntent,
  parsed: ParsedQuery,
): ExclusionRule[] {
  const rules = getIntentOutputRules(falconIntent);
  const exclusions: ExclusionRule[] = rules.forbiddenSections.map((sectionType) => ({
    sectionType,
    reason: `Intent ${falconIntent} forbids this section`,
  }));

  if (strategy === "navigation-only") {
    exclusions.push(
      { sectionType: "steps", reason: "User only asked where/how to reach something" },
      { sectionType: "fields", reason: "User only asked where/how to reach something" },
      { sectionType: "accounting-effect", reason: "User only asked where/how to reach something" },
      { sectionType: "validation", reason: "User only asked where/how to reach something" },
      { sectionType: "common-errors", reason: "User only asked where/how to reach something" },
      { sectionType: "tips", reason: "User only asked where/how to reach something" },
    );
  }

  if (strategy === "explanation" && falconIntent === "definition") {
    exclusions.push(
      { sectionType: "steps", reason: "Definition intent — no steps" },
      { sectionType: "navigation", reason: "Definition intent — no path unless asked" },
      { sectionType: "validation", reason: "Definition intent — no rules dump" },
      { sectionType: "common-errors", reason: "Definition intent — no error list" },
      { sectionType: "accounting-effect", reason: "Definition intent — no accounting entry" },
    );
  }

  if (userIntent.specificFields.length > 0) {
    exclusions.push({
      sectionType: "fields",
      reason: "User asked about specific field, not all fields",
    });
  }

  if (parsed.complexity === "simple" && falconIntent !== "general") {
    exclusions.push(
      { sectionType: "related", reason: "Simple query doesn't need related topics" },
      { sectionType: "tips", reason: "Simple query doesn't need tips" },
    );
  }

  return exclusions;
}

function determineRequiredSections(strategy: ResponseStrategy): SectionType[] {
  switch (strategy) {
    case "navigation-only":
      return ["navigation"];
    case "steps-only":
      return ["steps"];
    case "explanation":
      return ["title"];
    case "troubleshooting":
      return ["common-errors"];
    case "field-specific":
      return ["fields"];
    case "comparison":
    case "calculation":
    case "list":
      return ["title"];
    case "shortcut":
      return ["shortcuts"];
    case "accounting-entry":
      return ["accounting-effect"];
    case "validation-rules":
      return ["validation"];
    case "code-analysis":
      return ["title"];
    case "greeting":
      return [];
    case "comprehensive":
    default:
      return ["title"];
  }
}

function determineOptionalSections(
  strategy: ResponseStrategy,
  falconIntent: FalconIntent,
  parsed: ParsedQuery,
): SectionType[] {
  if (falconIntent === "definition" || falconIntent === "action_path" || falconIntent === "nav") {
    return [];
  }

  const optional: SectionType[] = [];
  if (parsed.complexity !== "simple") {
    optional.push("follow-ups");
  }

  switch (strategy) {
    case "steps-only":
      optional.push("shortcuts");
      break;
    case "troubleshooting":
      optional.push("steps", "tips");
      break;
    case "comprehensive":
      optional.push("navigation", "steps", "fields", "shortcuts", "tips");
      break;
  }

  return optional;
}

const META_FOCUS_WORDS = new Set([
  "detail",
  "details",
  "more",
  "info",
  "information",
  "it",
  "this",
  "that",
  "these",
  "those",
  "them",
  "a",
  "an",
  "the",
]);

function extractPrimaryFocus(parsed: ParsedQuery, userIntent: UserIntent): string | null {
  if (isElaborationQuery(parsed.original)) return null;

  if (userIntent.target) return userIntent.target;

  if (parsed.entities.length > 0) {
    const primary = parsed.entities.find(
      (e) => e.type === "voucher" || e.type === "report" || e.type === "master",
    );
    if (primary) return primary.normalizedValue;
    return parsed.entities[0].normalizedValue;
  }

  const focusPatterns = [
    /(?:make|create|post|record|enter|add|pass|generate|cut|raise|prepare|issue|open|view|access)\s+(?:a\s+|an\s+|the\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
    /(?:about|for|on|in|with)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
  ];

  for (const pattern of focusPatterns) {
    const match = parsed.original.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].toLowerCase().replace(/\s+/g, "-");
      const firstWord = candidate.split("-")[0];
      if (!META_FOCUS_WORDS.has(firstWord) && !META_FOCUS_WORDS.has(candidate)) {
        return candidate;
      }
    }
  }

  return parsed.targetObject;
}

function extractSecondaryTopics(parsed: ParsedQuery, primaryFocus: string | null): string[] {
  const secondary: string[] = [];
  for (const entity of parsed.entities) {
    if (entity.normalizedValue !== primaryFocus) {
      secondary.push(entity.normalizedValue);
    }
  }
  secondary.push(...parsed.modifiers);
  return [...new Set(secondary)];
}

function calculateConfidence(
  parsed: ParsedQuery,
  userIntent: UserIntent,
  falconIntent: FalconIntent,
  strategy: ResponseStrategy,
): number {
  let confidence = 0.55;

  confidence += parsed.entities.length * 0.08;
  if (userIntent.target) confidence += 0.1;
  if (falconIntent !== "general") confidence += 0.12;
  if (parsed.complexity === "complex") confidence -= 0.08;
  if (strategy === "comprehensive") confidence -= 0.05;

  return Math.max(0.2, Math.min(1, confidence));
}

export function analyzeIntent(query: string, routeContext?: string): SmartIntent {
  const parsed = parseQuery(query);
  const userIntent = extractIntent(parsed);
  const falconIntent = classifyIntent(query);
  const responseStrategy = strategyFromFalconIntent(falconIntent, parsed);
  const primaryFocus = extractPrimaryFocus(parsed, userIntent);
  const secondaryTopics = extractSecondaryTopics(parsed, primaryFocus);
  const excludeFromResponse = determineExclusions(
    falconIntent,
    responseStrategy,
    userIntent,
    parsed,
  );
  const requiredSections = determineRequiredSections(responseStrategy);
  const optionalSections = determineOptionalSections(responseStrategy, falconIntent, parsed);
  const confidenceScore = calculateConfidence(parsed, userIntent, falconIntent, responseStrategy);

  return {
    parsed,
    userIntent,
    falconIntent,
    responseStrategy,
    primaryFocus,
    secondaryTopics,
    excludeFromResponse,
    requiredSections,
    optionalSections,
    confidenceScore,
    routeContext,
  };
}

export function shouldIncludeSection(intent: SmartIntent, section: SectionType): boolean {
  if (intent.excludeFromResponse.some((e) => e.sectionType === section)) return false;
  if (intent.requiredSections.includes(section)) return true;
  return intent.optionalSections.includes(section);
}

export function getResponseDirective(intent: SmartIntent): string {
  const byFalcon: Record<FalconIntent, string> = {
    action_path:
      "Provide ONLY the navigation path and keyboard shortcut. Do NOT explain what the feature is. Do NOT list steps.",
    nav: "Provide ONLY the menu path/navigation to reach this screen. Do NOT explain what it does.",
    definition:
      "Explain what this is in 2–3 sentences maximum. Do NOT include navigation, steps, or rules.",
    steps: "Provide ONLY numbered steps. No preamble. No definition.",
    troubleshoot: "Diagnose the issue and provide a fix. No feature definitions.",
    effect: "Show the DEBIT/CREDIT accounting entry only.",
    code: "Provide developer format: files, functions, code evidence.",
    general: "Answer concisely. Only what was asked.",
  };

  const directives: Record<ResponseStrategy, string> = {
    "navigation-only": byFalcon.nav,
    "steps-only": byFalcon.steps,
    explanation: byFalcon.definition,
    troubleshooting: byFalcon.troubleshoot,
    "field-specific": "Answer ONLY about the specific field(s) asked.",
    comparison: "Compare items directly with key differences.",
    calculation: "Show formula and worked example.",
    list: "Provide a clean organized list.",
    shortcut: "Provide ONLY keyboard shortcut(s).",
    "accounting-entry": byFalcon.effect,
    "validation-rules": "List validation rules only.",
    "code-analysis": byFalcon.code,
    greeting: "Respond warmly but briefly.",
    comprehensive: byFalcon.general,
  };

  return byFalcon[intent.falconIntent] || directives[intent.responseStrategy];
}

export function formatIntentSummary(intent: SmartIntent): string {
  const lines = [
    `Intent: ${intent.falconIntent}`,
    `Strategy: ${intent.responseStrategy}`,
    `Focus: ${intent.primaryFocus || "general"}`,
  ];
  if (intent.secondaryTopics.length > 0) {
    lines.push(`Context: ${intent.secondaryTopics.join(", ")}`);
  }
  lines.push(`Confidence: ${Math.round(intent.confidenceScore * 100)}%`);
  return lines.join("\n");
}

// Re-export for consumers
export type { FalconIntent, SectionType };
