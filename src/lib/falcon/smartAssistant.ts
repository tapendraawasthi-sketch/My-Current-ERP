/**
 * Falcon smart assistant — answers from your actual ERP structure:
 * 1. Reasoning engine + 836-entry knowledge base (intent + entity matching)
 * 2. Build-time page index (App.tsx routes + page headers)
 * 3. Curated module docs (erpCodeKnowledge)
 */

import { askFalcon } from "./engine";
import { findPagesByQuery, findPageByRoute, formatPageAnswer } from "./pageIndexSearch";
import { getModuleContext } from "./erpCodeKnowledge";
import {
  buildBuiltinErpAnswer,
  resolveBuiltinModuleKey,
  buildModuleSuggestions,
} from "../builtinErpAssistant";
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
  mode: "knowledge-base" | "page-index" | "module-docs" | "hybrid";
  matchedId?: string;
}

const NAV_INTENT =
  /\b(where|how\s+to\s+(open|go|find|reach)|navigate|menu|screen|page|open)\b/i;
const CODE_INTENT = /\b(code|component|file|implement|function|typescript|react)\b/i;

function isNavigationQuestion(query: string): boolean {
  return NAV_INTENT.test(query);
}

function isCodeQuestion(query: string): boolean {
  return CODE_INTENT.test(query);
}

function buildPageIndexAnswer(query: string, route?: string): SmartAssistantResult | null {
  const pages = findPagesByQuery(query, 3);
  const current = findPageByRoute(route);

  if (pages.length === 0 && !current) return null;

  const primary = pages[0] ?? current!;
  const lines = [formatPageAnswer(primary)];

  if (pages.length > 1) {
    lines.push("", "**Related screens:**");
    pages.slice(1).forEach((p) => {
      lines.push(`- **${p.title}** — ${p.menuPath || p.route}`);
    });
  }

  if (isCodeQuestion(query)) {
    lines.push(
      "",
      "_This answer is from your indexed source code (App.tsx routing + page headers)._",
    );
  }

  return {
    answer: lines.join("\n"),
    sources: [primary.file, "App.tsx", `page-index (${GENERATED_PAGE_INDEX_BUILT_AT.slice(0, 10)})`],
    suggestions: pages.slice(0, 3).map((p) => `How do I use ${p.title}?`),
    confidence: 70,
    mode: "page-index",
  };
}

function buildHybridAnswer(
  kbAnswer: string,
  pageEntry: ReturnType<typeof findPageByRoute>,
  moduleKey?: string,
): SmartAssistantResult {
  const parts = [kbAnswer];
  const sources = ["knowledge-base"];

  if (pageEntry) {
    parts.push("", "---", formatPageAnswer(pageEntry));
    sources.push(pageEntry.file);
  }

  return {
    answer: parts.join("\n"),
    sources,
    suggestions: buildModuleSuggestions(moduleKey),
    confidence: 80,
    mode: "hybrid",
  };
}

/**
 * Offline / built-in Falcon brain. Uses query intent + ERP code index + KB.
 */
export function askSmartAssistant(
  query: string,
  context: SmartAssistantContext = {},
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
): SmartAssistantResult {
  const route = context.route;

  // 1. Navigation / "where is X" → page index from actual routes
  if (isNavigationQuestion(query) || isCodeQuestion(query)) {
    const pageResult = buildPageIndexAnswer(query, route);
    if (pageResult && pageResult.confidence >= 50) return pageResult;
  }

  // 2. Knowledge base engine (836 Q&A, intent + entity detection)
  const kb = askFalcon(query, route, conversationHistory);

  // 3. Enrich with current screen from code index when on a known page
  const pageEntry = findPageByRoute(route);
  const moduleKey = resolveBuiltinModuleKey(query, route);

  if (kb.confidence >= 45) {
    if (pageEntry && kb.confidence < 75) {
      return {
        ...buildHybridAnswer(kb.answer, pageEntry, moduleKey),
        matchedId: kb.matchedId,
        suggestions: kb.suggestions.length ? kb.suggestions : buildModuleSuggestions(moduleKey),
      };
    }
    return {
      answer: kb.answer,
      sources: ["knowledge-base", kb.matchedId ? `kb:${kb.matchedId}` : "kb"],
      suggestions: kb.suggestions,
      confidence: kb.confidence,
      mode: "knowledge-base",
      matchedId: kb.matchedId,
    };
  }

  // 4. Page index fallback for module-like questions
  const pageFallback = buildPageIndexAnswer(query, route);
  if (pageFallback) return pageFallback;

  // 5. Curated module documentation
  const moduleAnswer = buildBuiltinErpAnswer(query, route);
  if (!moduleAnswer.includes("Ask about a specific screen")) {
    return {
      answer: moduleAnswer,
      sources: ["module-docs", moduleKey ?? "overview"],
      suggestions: buildModuleSuggestions(moduleKey),
      confidence: 55,
      mode: "module-docs",
    };
  }

  return {
    answer: moduleAnswer,
    sources: ["module-docs"],
    suggestions: buildModuleSuggestions(),
    confidence: 30,
    mode: "module-docs",
  };
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
