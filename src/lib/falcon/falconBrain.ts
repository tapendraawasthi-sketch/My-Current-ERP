// src/lib/falcon/falconBrain.ts
// Falcon AI — Unified Intelligent Brain
// The main engine that combines all AI components for intelligent responses

import { parseQuery, type ParsedQuery, type UserIntent, extractIntent } from "./nlpEngine";
import { analyzeIntent, type SmartIntent, getResponseDirective } from "./smartIntentEngine";
import { composeResponse, type ComposedResponse } from "./precisionComposer";
import {
  getCodeStructureInfo,
  findRelevantKnowledge,
  searchModules,
  getCodebaseStats,
  resolveRoute,
  type CodeStructureInfo,
} from "./codeStructureParser";
import { GENERATED_PAGE_INDEX } from "./generatedPageIndex";
import { FALCON_KB } from "./knowledgeBase";
import { ERP_MODULES, ERP_ACCOUNTING_RULES, ERP_FORMULAS } from "./erpCodeKnowledge";
import { searchWeb, formatSearchResults, isCurrentEventQuery } from "../falconWebSearch";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FalconResponse {
  answer: string;
  confidence: number;
  sources: string[];
  suggestions: string[];
  reasoning: ReasoningTrace;
  metadata: ResponseMetadata;
}

export interface ReasoningTrace {
  query: string;
  parsedQuery: ParsedQuery;
  intent: SmartIntent;
  strategy: string;
  knowledgeSources: string[];
  processingTimeMs: number;
}

export interface ResponseMetadata {
  matchedModule?: string;
  matchedRoute?: string;
  responseType: string;
  sectionsIncluded: string[];
  webSearchUsed: boolean;
  codebaseVersion: string;
}

export interface FalconContext {
  currentRoute?: string;
  screenTitle?: string;
  companyName?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MEMORY
// ─────────────────────────────────────────────────────────────────────────────

interface ConversationTurn {
  query: string;
  response: string;
  intent: SmartIntent;
  timestamp: Date;
}

const conversationMemory: ConversationTurn[] = [];
const MAX_MEMORY_SIZE = 10;

function addToMemory(turn: ConversationTurn): void {
  conversationMemory.push(turn);
  if (conversationMemory.length > MAX_MEMORY_SIZE) {
    conversationMemory.shift();
  }
}

function getRecentContext(): string[] {
  return conversationMemory
    .slice(-3)
    .map((turn) => `Q: ${turn.query}\nA: ${turn.response.substring(0, 100)}...`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT ENHANCEMENT
// ─────────────────────────────────────────────────────────────────────────────

function enhanceWithRouteContext(
  intent: SmartIntent,
  context: FalconContext
): SmartIntent {
  if (!context.currentRoute) {
    return intent;
  }

  // If no primary focus, use current route
  if (!intent.primaryFocus) {
    const routeInfo = getCodeStructureInfo(context.currentRoute);
    if (routeInfo) {
      return {
        ...intent,
        primaryFocus: context.currentRoute,
        routeContext: context.currentRoute,
      };
    }
  }

  return {
    ...intent,
    routeContext: context.currentRoute,
  };
}

function enhanceWithConversationContext(
  intent: SmartIntent,
  history: Array<{ role: "user" | "assistant"; content: string }>
): SmartIntent {
  if (history.length === 0) {
    return intent;
  }

  // Check for follow-up questions
  const lastUserMessage = history
    .slice()
    .reverse()
    .find((m) => m.role === "user");
  
  if (!lastUserMessage) {
    return intent;
  }

  // Resolve pronouns and references
  const queryLower = intent.parsed.original.toLowerCase();
  const pronouns = ["it", "this", "that", "these", "those", "them"];
  
  const hasPronouns = pronouns.some((p) => {
    const pattern = new RegExp(`\\b${p}\\b`, "i");
    return pattern.test(queryLower);
  });

  if (hasPronouns && conversationMemory.length > 0) {
    const lastTurn = conversationMemory[conversationMemory.length - 1];
    if (lastTurn.intent.primaryFocus && !intent.primaryFocus) {
      return {
        ...intent,
        primaryFocus: lastTurn.intent.primaryFocus,
        secondaryTopics: [
          ...intent.secondaryTopics,
          ...lastTurn.intent.secondaryTopics.slice(0, 2),
        ],
      };
    }
  }

  return intent;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB SEARCH INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

async function performWebSearch(query: string): Promise<string | null> {
  try {
    const results = await searchWeb(query, { timeout: 5000 });
    if (results.error) {
      return null;
    }
    return formatSearchResults(results);
  } catch {
    return null;
  }
}

function shouldUseWebSearch(intent: SmartIntent): boolean {
  // Check for web search triggers
  const queryLower = intent.parsed.original.toLowerCase();
  
  // Don't use web search for ERP-specific questions
  if (
    intent.userIntent.targetType === "voucher" ||
    intent.userIntent.targetType === "report" ||
    intent.userIntent.targetType === "master" ||
    intent.userIntent.targetType === "module"
  ) {
    return false;
  }

  // Use web search for current events or explicit search requests
  return isCurrentEventQuery(queryLower) ||
         /\b(search|latest|current|news|today)\b/i.test(queryLower);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PROCESSING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export async function askFalconBrain(
  query: string,
  context: FalconContext = {}
): Promise<FalconResponse> {
  const startTime = performance.now();
  
  // 1. Parse the query
  const parsedQuery = parseQuery(query);
  
  // 2. Analyze intent
  let intent = analyzeIntent(query, context.currentRoute);
  
  // 3. Enhance with context
  intent = enhanceWithRouteContext(intent, context);
  
  if (context.conversationHistory) {
    intent = enhanceWithConversationContext(intent, context.conversationHistory);
  }
  
  // 4. Check if web search is needed
  let webSearchResult: string | null = null;
  const webSearchUsed = shouldUseWebSearch(intent);
  
  if (webSearchUsed) {
    webSearchResult = await performWebSearch(query);
  }
  
  // 5. Compose the response
  let composed: ComposedResponse;
  
  if (webSearchResult && !parsedQuery.isGreeting) {
    // If we have web results, include them
    composed = composeResponse(intent);
    if (composed.confidence < 0.5) {
      composed = {
        ...composed,
        answer: `**Web Search Results:**\n\n${webSearchResult}`,
        confidence: 0.7,
        sources: ["web-search"],
      };
    }
  } else {
    composed = composeResponse(intent);
  }
  
  // 6. Calculate processing time
  const processingTimeMs = performance.now() - startTime;
  
  // 7. Build reasoning trace
  const reasoning: ReasoningTrace = {
    query,
    parsedQuery,
    intent,
    strategy: intent.responseStrategy,
    knowledgeSources: composed.sources,
    processingTimeMs,
  };
  
  // 8. Build metadata
  const stats = getCodebaseStats();
  const metadata: ResponseMetadata = {
    matchedModule: composed.matchedModule,
    matchedRoute: composed.matchedModule ? resolveRoute(composed.matchedModule) || undefined : undefined,
    responseType: composed.responseType,
    sectionsIncluded: composed.sectionsIncluded,
    webSearchUsed,
    codebaseVersion: `${stats.totalScreens} screens, ${stats.totalKBEntries} KB entries`,
  };
  
  // 9. Add to conversation memory
  addToMemory({
    query,
    response: composed.answer,
    intent,
    timestamp: new Date(),
  });
  
  // 10. Return the response
  return {
    answer: composed.answer,
    confidence: composed.confidence,
    sources: composed.sources,
    suggestions: composed.suggestions,
    reasoning,
    metadata,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYNCHRONOUS VERSION (for compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export function askFalconBrainSync(
  query: string,
  context: FalconContext = {}
): FalconResponse {
  const startTime = performance.now();
  
  // 1. Parse the query
  const parsedQuery = parseQuery(query);
  
  // 2. Analyze intent
  let intent = analyzeIntent(query, context.currentRoute);
  
  // 3. Enhance with context
  intent = enhanceWithRouteContext(intent, context);
  
  if (context.conversationHistory) {
    intent = enhanceWithConversationContext(intent, context.conversationHistory);
  }
  
  // 4. Compose the response
  const composed = composeResponse(intent);
  
  // 5. Calculate processing time
  const processingTimeMs = performance.now() - startTime;
  
  // 6. Build reasoning trace
  const reasoning: ReasoningTrace = {
    query,
    parsedQuery,
    intent,
    strategy: intent.responseStrategy,
    knowledgeSources: composed.sources,
    processingTimeMs,
  };
  
  // 7. Build metadata
  const stats = getCodebaseStats();
  const metadata: ResponseMetadata = {
    matchedModule: composed.matchedModule,
    matchedRoute: composed.matchedModule ? resolveRoute(composed.matchedModule) || undefined : undefined,
    responseType: composed.responseType,
    sectionsIncluded: composed.sectionsIncluded,
    webSearchUsed: false,
    codebaseVersion: `${stats.totalScreens} screens, ${stats.totalKBEntries} KB entries`,
  };
  
  // 8. Add to conversation memory
  addToMemory({
    query,
    response: composed.answer,
    intent,
    timestamp: new Date(),
  });
  
  // 9. Return the response
  return {
    answer: composed.answer,
    confidence: composed.confidence,
    sources: composed.sources,
    suggestions: composed.suggestions,
    reasoning,
    metadata,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function getCapabilities(): string[] {
  return [
    "Answer questions about any Sutra ERP module",
    "Provide step-by-step instructions for vouchers and transactions",
    "Explain accounting concepts and Nepal tax rules (VAT, TDS)",
    "Show navigation paths to any screen",
    "Provide keyboard shortcuts",
    "Troubleshoot common errors",
    "Show accounting entries and journal effects",
    "List validation rules and requirements",
    "Search the web for current information",
  ];
}

export function getStats(): {
  screens: number;
  kbEntries: number;
  modules: number;
  accountingRules: number;
  formulas: number;
  conversationMemory: number;
} {
  const codeStats = getCodebaseStats();
  return {
    screens: codeStats.totalScreens,
    kbEntries: codeStats.totalKBEntries,
    modules: codeStats.totalModuleDocs,
    accountingRules: codeStats.totalAccountingRules,
    formulas: codeStats.totalFormulas,
    conversationMemory: conversationMemory.length,
  };
}

export function clearConversationMemory(): void {
  conversationMemory.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ANSWER FUNCTIONS (for specific use cases)
// ─────────────────────────────────────────────────────────────────────────────

export function getQuickNavigation(target: string): string | null {
  const route = resolveRoute(target);
  if (!route) return null;
  
  const info = getCodeStructureInfo(route);
  return info?.menuPath || null;
}

export function getQuickSteps(target: string): string[] {
  const route = resolveRoute(target);
  if (!route) return [];
  
  const info = getCodeStructureInfo(route);
  return info?.moduleDoc?.workflow?.steps || [];
}

export function getQuickShortcuts(target: string): Record<string, string> {
  const route = resolveRoute(target);
  if (!route) {
    return {
      F2: "Save/Post",
      F3: "Add new",
      Esc: "Cancel",
    };
  }
  
  const info = getCodeStructureInfo(route);
  return info?.moduleDoc?.keyboardShortcuts || {
    F2: "Save/Post",
    F3: "Add new",
    Esc: "Cancel",
  };
}

export function getQuickErrors(target: string): Array<{ error: string; solution: string }> {
  const route = resolveRoute(target);
  if (!route) return [];
  
  const info = getCodeStructureInfo(route);
  return info?.moduleDoc?.commonErrors || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function debugQuery(query: string, currentRoute?: string): {
  parsed: ParsedQuery;
  intent: SmartIntent;
  directive: string;
  possibleMatches: Array<{ route: string; score: number }>;
} {
  const parsed = parseQuery(query);
  const intent = analyzeIntent(query, currentRoute);
  const directive = getResponseDirective(intent);
  const matches = searchModules(query, 5);
  
  return {
    parsed,
    intent,
    directive,
    possibleMatches: matches.map((m) => ({
      route: m.entry.route,
      score: m.score,
    })),
  };
}
