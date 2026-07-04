// src/lib/falcon/smartIntentEngine.ts
// Falcon AI — Smart Intent Understanding Engine
// Determines exactly what the user is asking and how to respond

import type { ParsedQuery, UserIntent, EntityType } from "./nlpEngine";
import { parseQuery, extractIntent } from "./nlpEngine";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ResponseStrategy =
  | "navigation-only"      // Just show the path/menu to reach something
  | "steps-only"           // Just show numbered steps to perform action
  | "explanation"          // Explain what something is/does
  | "troubleshooting"      // Diagnose and solve a problem
  | "field-specific"       // Answer about a specific field/setting
  | "comparison"           // Compare two or more things
  | "calculation"          // Calculate or show formula
  | "list"                 // List items/options
  | "shortcut"             // Show keyboard shortcut
  | "accounting-entry"     // Show journal entry/accounting effect
  | "validation-rules"     // Show rules/requirements
  | "greeting"             // Respond to greeting
  | "comprehensive";       // Full answer with multiple sections

export interface SmartIntent {
  parsed: ParsedQuery;
  userIntent: UserIntent;
  responseStrategy: ResponseStrategy;
  primaryFocus: string | null;
  secondaryTopics: string[];
  excludeFromResponse: ExclusionRule[];
  requiredSections: SectionType[];
  optionalSections: SectionType[];
  confidenceScore: number;
  routeContext?: string;
}

export type SectionType =
  | "title"
  | "navigation"
  | "steps"
  | "fields"
  | "accounting-effect"
  | "validation"
  | "common-errors"
  | "shortcuts"
  | "tips"
  | "related"
  | "follow-ups";

export interface ExclusionRule {
  sectionType: SectionType;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE STRATEGY DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────

function determineResponseStrategy(
  parsed: ParsedQuery,
  intent: UserIntent,
  routeContext?: string
): ResponseStrategy {
  // Greetings get greeting response
  if (parsed.isGreeting) {
    return "greeting";
  }

  // Navigation questions ("where is...", "how to open...", "go to...")
  if (intent.wantsLocation && !intent.wantsSteps && !intent.wantsExplanation) {
    return "navigation-only";
  }

  // How-to questions without wanting explanation
  if (intent.wantsSteps && !intent.wantsExplanation && !intent.wantsTroubleshooting) {
    return "steps-only";
  }

  // Troubleshooting (errors, problems)
  if (intent.wantsTroubleshooting) {
    return "troubleshooting";
  }

  // What-is questions
  if (intent.wantsExplanation && !intent.wantsSteps && !intent.wantsLocation) {
    return "explanation";
  }

  // Field-specific questions
  if (intent.specificFields.length > 0 && !intent.wantsSteps) {
    return "field-specific";
  }

  // Comparison questions
  if (parsed.questionType === "compare") {
    return "comparison";
  }

  // Calculation questions
  if (parsed.questionType === "calculate" || intent.primaryAction === "calculate") {
    return "calculation";
  }

  // List requests
  if (parsed.questionType === "list") {
    return "list";
  }

  // Shortcut questions
  if (parsed.entities.some((e) => e.type === "shortcut") ||
      /keyboard|shortcut|hotkey/i.test(parsed.original)) {
    return "shortcut";
  }

  // Accounting entry questions
  if (/journal\s*entry|accounting\s*entry|debit|credit|ledger\s*entry/i.test(parsed.original)) {
    return "accounting-entry";
  }

  // Validation rules questions
  if (/validation|rules?|required|mandatory|limit|restriction/i.test(parsed.original)) {
    return "validation-rules";
  }

  // Default to comprehensive if complex or ambiguous
  if (parsed.complexity === "complex" || (intent.wantsSteps && intent.wantsExplanation)) {
    return "comprehensive";
  }

  // Default based on entity type
  if (intent.targetType === "voucher") {
    return intent.wantsLocation ? "navigation-only" : "steps-only";
  }

  if (intent.targetType === "concept") {
    return "explanation";
  }

  return "comprehensive";
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUSION RULES — What NOT to include in response
// ─────────────────────────────────────────────────────────────────────────────

function determineExclusions(
  parsed: ParsedQuery,
  intent: UserIntent,
  strategy: ResponseStrategy
): ExclusionRule[] {
  const exclusions: ExclusionRule[] = [];

  // Navigation-only: exclude everything except path
  if (strategy === "navigation-only") {
    exclusions.push(
      { sectionType: "steps", reason: "User only asked where something is" },
      { sectionType: "fields", reason: "User only asked where something is" },
      { sectionType: "accounting-effect", reason: "User only asked where something is" },
      { sectionType: "validation", reason: "User only asked where something is" },
      { sectionType: "common-errors", reason: "User only asked where something is" }
    );
  }

  // Steps-only: exclude explanations
  if (strategy === "steps-only") {
    exclusions.push(
      { sectionType: "accounting-effect", reason: "User wants steps, not accounting theory" }
    );
  }

  // Explanation: exclude steps
  if (strategy === "explanation") {
    exclusions.push(
      { sectionType: "steps", reason: "User wants explanation, not how-to" },
      { sectionType: "validation", reason: "User wants explanation, not rules" }
    );
  }

  // If user asked about a specific field, don't explain all fields
  if (intent.specificFields.length > 0) {
    exclusions.push(
      { sectionType: "fields", reason: "User asked about specific field, not all fields" }
    );
  }

  // If query is simple, don't add too much
  if (parsed.complexity === "simple") {
    exclusions.push(
      { sectionType: "related", reason: "Simple query doesn't need related topics" },
      { sectionType: "tips", reason: "Simple query doesn't need tips" }
    );
  }

  return exclusions;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED AND OPTIONAL SECTIONS
// ─────────────────────────────────────────────────────────────────────────────

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
      return ["title"];
    
    case "calculation":
      return ["title"];
    
    case "list":
      return ["title"];
    
    case "shortcut":
      return ["shortcuts"];
    
    case "accounting-entry":
      return ["accounting-effect"];
    
    case "validation-rules":
      return ["validation"];
    
    case "greeting":
      return [];
    
    case "comprehensive":
    default:
      return ["title", "navigation", "steps"];
  }
}

function determineOptionalSections(
  strategy: ResponseStrategy,
  intent: UserIntent,
  parsed: ParsedQuery
): SectionType[] {
  const optional: SectionType[] = [];

  // Only add follow-ups for non-simple queries
  if (parsed.complexity !== "simple") {
    optional.push("follow-ups");
  }

  switch (strategy) {
    case "steps-only":
      optional.push("shortcuts", "tips");
      break;
    
    case "troubleshooting":
      optional.push("steps", "tips");
      break;
    
    case "comprehensive":
      optional.push("fields", "accounting-effect", "validation", "shortcuts", "tips", "related");
      break;
  }

  return optional;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractPrimaryFocus(
  parsed: ParsedQuery,
  intent: UserIntent
): string | null {
  // Use target object if available
  if (intent.target) {
    return intent.target;
  }

  // Use first entity
  if (parsed.entities.length > 0) {
    return parsed.entities[0].normalizedValue;
  }

  // Try to extract from query patterns
  const focusPatterns = [
    /(?:about|for|on|in|with)\s+(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
    /(?:create|add|make|open|view)\s+(?:a\s+)?([a-z]+(?:\s+[a-z]+)?)/i,
  ];

  for (const pattern of focusPatterns) {
    const match = parsed.original.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase().replace(/\s+/g, "-");
    }
  }

  return null;
}

function extractSecondaryTopics(
  parsed: ParsedQuery,
  primaryFocus: string | null
): string[] {
  const secondary: string[] = [];

  // Add entity values that are not the primary focus
  for (const entity of parsed.entities) {
    if (entity.normalizedValue !== primaryFocus) {
      secondary.push(entity.normalizedValue);
    }
  }

  // Add modifiers
  secondary.push(...parsed.modifiers);

  return [...new Set(secondary)];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE SCORING
// ─────────────────────────────────────────────────────────────────────────────

function calculateConfidence(
  parsed: ParsedQuery,
  intent: UserIntent,
  strategy: ResponseStrategy
): number {
  let confidence = 0.5;

  // Boost for recognized entities
  confidence += parsed.entities.length * 0.1;

  // Boost for clear action verb
  if (intent.primaryAction !== "query") {
    confidence += 0.1;
  }

  // Boost for clear question type
  if (parsed.questionType !== "unknown") {
    confidence += 0.1;
  }

  // Boost for target identification
  if (intent.target) {
    confidence += 0.1;
  }

  // Slight penalty for complex queries (harder to understand perfectly)
  if (parsed.complexity === "complex") {
    confidence -= 0.1;
  }

  // Penalty for ambiguous strategies
  if (strategy === "comprehensive") {
    confidence -= 0.05;
  }

  return Math.max(0.2, Math.min(1, confidence));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeIntent(query: string, routeContext?: string): SmartIntent {
  const parsed = parseQuery(query);
  const userIntent = extractIntent(parsed);
  const responseStrategy = determineResponseStrategy(parsed, userIntent, routeContext);
  const primaryFocus = extractPrimaryFocus(parsed, userIntent);
  const secondaryTopics = extractSecondaryTopics(parsed, primaryFocus);
  const excludeFromResponse = determineExclusions(parsed, userIntent, responseStrategy);
  const requiredSections = determineRequiredSections(responseStrategy);
  const optionalSections = determineOptionalSections(responseStrategy, userIntent, parsed);
  const confidenceScore = calculateConfidence(parsed, userIntent, responseStrategy);

  return {
    parsed,
    userIntent,
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function shouldIncludeSection(
  intent: SmartIntent,
  section: SectionType
): boolean {
  // Check if excluded
  if (intent.excludeFromResponse.some((e) => e.sectionType === section)) {
    return false;
  }

  // Check if required
  if (intent.requiredSections.includes(section)) {
    return true;
  }

  // Check if optional
  return intent.optionalSections.includes(section);
}

export function getResponseDirective(intent: SmartIntent): string {
  const directives: Record<ResponseStrategy, string> = {
    "navigation-only": "Provide ONLY the menu path/navigation to reach this screen. Do NOT explain what it does or how to use it.",
    "steps-only": "Provide ONLY the numbered steps to perform this action. Do NOT explain what things mean or provide background.",
    "explanation": "Explain what this concept/feature means and its purpose. Do NOT provide step-by-step instructions.",
    "troubleshooting": "Focus on diagnosing the issue and providing a solution. Start with the likely cause and how to fix it.",
    "field-specific": "Answer ONLY about the specific field(s) asked. Do NOT explain the entire form or all fields.",
    "comparison": "Compare the items directly, highlighting key differences. Use a structured format.",
    "calculation": "Show the formula and calculation. Include a worked example with numbers.",
    "list": "Provide a clean, organized list of the requested items.",
    "shortcut": "Provide ONLY the keyboard shortcut(s) requested. Be brief and direct.",
    "accounting-entry": "Show the journal entry with Debit and Credit accounts and amounts. Include the accounting principle.",
    "validation-rules": "List the specific rules, requirements, or restrictions. Be precise and complete.",
    "greeting": "Respond warmly but briefly. Mention you can help with ERP questions.",
    "comprehensive": "Provide a complete answer with context, steps, and tips as needed.",
  };

  return directives[intent.responseStrategy];
}

export function formatIntentSummary(intent: SmartIntent): string {
  const lines: string[] = [];
  
  lines.push(`Strategy: ${intent.responseStrategy}`);
  lines.push(`Focus: ${intent.primaryFocus || "general"}`);
  
  if (intent.secondaryTopics.length > 0) {
    lines.push(`Context: ${intent.secondaryTopics.join(", ")}`);
  }
  
  lines.push(`Confidence: ${Math.round(intent.confidenceScore * 100)}%`);
  
  if (intent.excludeFromResponse.length > 0) {
    lines.push(`Excluded: ${intent.excludeFromResponse.map((e) => e.sectionType).join(", ")}`);
  }
  
  return lines.join("\n");
}
