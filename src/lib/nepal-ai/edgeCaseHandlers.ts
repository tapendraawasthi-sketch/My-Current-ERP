/**
 * Edge-case handler goldens — minimal input, ambiguity, boundaries, adversarial NLU.
 */

import type { EKhataConversationContext } from "@/lib/ekhata/conversationState";
import {
  EDGE_CASE_HANDLER_ALIASES,
  EDGE_CASE_HANDLERS,
  EDGE_CASE_HANDLERS_BY_CATEGORY,
  type EdgeCaseHandler,
} from "./generated/runtimeMaps";

const BY_ID = new Map(EDGE_CASE_HANDLERS.map((e) => [e.id, e]));

const CLARIFY_CATEGORIES = new Set([
  "minimal_input",
  "maximum_ambiguity",
  "context_dependency",
  "boundary_values",
  "format_edge_cases",
  "novel_combinations",
  "error_combinations",
  "near_miss_patterns",
  "language_edge_cases",
]);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getEdgeCaseHandlerById(id: string): EdgeCaseHandler | null {
  return BY_ID.get(id) ?? null;
}

export function getEdgeCaseHandlersByCategory(categoryKey: string): EdgeCaseHandler[] {
  const ids = EDGE_CASE_HANDLERS_BY_CATEGORY[categoryKey] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as EdgeCaseHandler[];
}

/** Exact golden match on raw input or normalized key. */
export function matchEdgeCaseHandler(text: string): EdgeCaseHandler | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = EDGE_CASE_HANDLER_ALIASES[cand];
    if (hit) return getEdgeCaseHandlerById(hit.id);
  }

  return null;
}

export function hasConversationContext(ctx?: EKhataConversationContext | null): boolean {
  if (!ctx) return false;
  return Boolean(
    ctx.awaiting ||
      ctx.pendingPrefix ||
      ctx.pendingIntent ||
      ctx.pendingParty ||
      ctx.pendingItem ||
      ctx.lastClarifyQuestion ||
      ctx.state === "awaiting_clarification" ||
      ctx.state === "transaction_detected",
  );
}

export function isAdversarialEdgeCase(entry: EdgeCaseHandler): boolean {
  return entry.category === "adversarial" || entry.testPriority === "critical";
}

export function edgeCaseNeedsClarification(
  entry: EdgeCaseHandler,
  hasContext: boolean,
): boolean {
  if (isAdversarialEdgeCase(entry)) return false;
  if (hasContext && entry.category === "minimal_input") return false;
  if (hasContext && entry.category === "context_dependency") return false;
  return CLARIFY_CATEGORIES.has(entry.category);
}

export function formatEdgeCaseReply(
  entry: EdgeCaseHandler,
  hasContext: boolean,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  const strategy = hasContext ? entry.handlingIfContext : entry.handlingIfNoContext;
  if (!strategy) {
    return lang === "english"
      ? entry.withoutContextInterpretation || "Please clarify."
      : entry.withoutContextInterpretation || "Thora clear garnuhos.";
  }

  // Strip surrounding quotes from golden clarify strings when present
  const trimmed = strategy.replace(/^['"]|['"]$/g, "");
  if (lang === "english" && entry.category === "adversarial") {
    return trimmed;
  }
  return trimmed;
}
