/**
 * Falcon smart assistant — ENHANCED with Falcon Brain AI
 * 
 * This is the unified intelligent assistant that:
 * 1. Uses advanced NLP to understand user intent
 * 2. Reads ERP code structure in real-time
 * 3. Answers ONLY what is asked (precision responses)
 * 4. Supports web search when needed
 * 
 * Now powered by the Falcon Brain engine for superior intelligence.
 */

import { askFalconBrainSync, askFalconBrain, type FalconResponse, type FalconContext } from "./falconBrain";
import type { FalconIntent } from "./intentTaxonomy";
import { getModuleContext } from "./erpCodeKnowledge";
import { findPageByRoute } from "./pageIndexSearch";
import { GENERATED_PAGE_INDEX, GENERATED_PAGE_INDEX_BUILT_AT } from "./generatedPageIndex";

export interface SmartAssistantContext {
  route?: string;
  screenTitle?: string;
  companyName?: string;
}

export interface SmartAssistantResult {
  answer: string;
  sources: string[];
  suggestions: string[];
  confidence: number;
  mode: "falcon-brain" | "knowledge-base" | "page-index" | "module-docs" | "hybrid";
  matchedId?: string;
  responseType?: string;
  falconIntent?: FalconIntent;
  processingTimeMs?: number;
}

function toSmartResult(response: FalconResponse): SmartAssistantResult {
  return {
    answer: response.answer,
    sources: response.sources,
    suggestions: response.suggestions,
    confidence: Math.round(response.confidence * 100),
    mode: response.metadata.webSearchUsed ? "hybrid" : "falcon-brain",
    matchedId: response.metadata.matchedModule,
    responseType: response.metadata.responseType,
    falconIntent: response.metadata.falconIntent,
    processingTimeMs: response.reasoning.processingTimeMs,
  };
}

/**
 * Main entry point for the enhanced Falcon AI assistant.
 * Uses the new Falcon Brain engine for intelligent responses.
 */
export function askSmartAssistant(
  query: string,
  context: SmartAssistantContext = {},
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): SmartAssistantResult {
  // Build Falcon context
  const falconContext: FalconContext = {
    currentRoute: context.route,
    screenTitle: context.screenTitle,
    companyName: context.companyName,
    conversationHistory,
  };

  // Use the new Falcon Brain engine (synchronous version for compatibility)
  const response = askFalconBrainSync(query, falconContext);
  return toSmartResult(response);
}

/**
 * Async version that supports web search for current events.
 */
export async function askSmartAssistantAsync(
  query: string,
  context: SmartAssistantContext = {},
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<SmartAssistantResult> {
  // Build Falcon context
  const falconContext: FalconContext = {
    currentRoute: context.route,
    screenTitle: context.screenTitle,
    companyName: context.companyName,
    conversationHistory,
  };

  // Use the async Falcon Brain engine (supports web search)
  const response = await askFalconBrain(query, falconContext);
  return toSmartResult(response);
}

/** Structured context block sent to erp_bot when the Python RAG service is online. */
export function buildErpBotContextBlock(context: SmartAssistantContext): string {
  const parts: string[] = [];

  if (context.route) {
    parts.push(getModuleContext(context.route));
    const page = findPageByRoute(context.route);
    if (page) {
      parts.push(
        "",
        `=== CODE INDEX (from ${page.file}) ===`,
        `Screen title: ${page.title}`,
        page.subtitle ? `Subtitle: ${page.subtitle.replace(/&amp;/g, "&")}` : "",
        page.menuPath ? `Menu path: ${page.menuPath}` : "",
        `React component: ${page.component}`,
      );
    }
  }

  parts.push(
    "",
    `=== ERP STRUCTURE ===`,
    `${GENERATED_PAGE_INDEX_BUILT_AT ? `Page index built: ${GENERATED_PAGE_INDEX_BUILT_AT.slice(0, 10)}` : ""}`,
    `Total indexed screens: ${GENERATED_PAGE_INDEX.length}`,
    `Routing: Zustand currentPage in src/store/index.ts → App.tsx switch/case`,
    `Data: Dexie IndexedDB via src/lib/db.ts`,
  );

  if (context.companyName) {
    parts.push(`Company: ${context.companyName}`);
  }

  return parts.join("\n").trim();
}
