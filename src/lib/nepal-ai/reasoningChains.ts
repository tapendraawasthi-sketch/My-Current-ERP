/**
 * Step-by-step parse goldens: tokenize → entity extract → classify → final_output.
 * Exact matches used for ambiguous / error_detection clarify in parseKhata;
 * other intents remain lexicon-only for training / eval.
 */

import {
  REASONING_CHAIN_ALIASES,
  REASONING_CHAIN_BY_INTENT,
  REASONING_CHAIN_PATTERNS,
  type ReasoningChainPattern,
} from "./generated/runtimeMaps";

const BY_ID = new Map(REASONING_CHAIN_PATTERNS.map((e) => [e.id, e]));

/** Intents that should stop parse and ask the user (exact goldens only). */
const EARLY_CLARIFY_INTENTS = new Set(["ambiguous", "error_detection"]);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getReasoningChainById(id: string): ReasoningChainPattern | null {
  return BY_ID.get(id) ?? null;
}

export function getReasoningChainsByIntent(intent: string): ReasoningChainPattern[] {
  const ids = REASONING_CHAIN_BY_INTENT[intent] ?? [];
  return ids.map((id) => BY_ID.get(id)).filter(Boolean) as ReasoningChainPattern[];
}

/** Exact normalized/input golden match. */
export function matchReasoningChain(text: string): ReasoningChainPattern | null {
  if (!text?.trim()) return null;
  const key = normalizeKey(text);

  const hit =
    REASONING_CHAIN_ALIASES[key] ?? REASONING_CHAIN_ALIASES[text.trim()];
  if (hit) return getReasoningChainById(hit.id);

  return null;
}

export function reasoningChainClarifyQuestion(
  entry: ReasoningChainPattern,
): string | null {
  if (entry.needsClarification || entry.intent === "ambiguous") {
    const party =
      (entry.finalOutput?.entities as { party?: string } | undefined)?.party ??
      "party";
    return `Yo transaction clear chhaina — ${party} lai paisa pathako ho ki saman? Amount pani thapnu hola.`;
  }

  if (entry.intent === "error_detection") {
    const err = String(entry.finalOutput?.error ?? "accounting_error");
    const amount = entry.finalOutput?.amount ?? entry.finalOutput?.difference;
    if (err === "unbalanced_journal_entry") {
      return `Journal unbalanced dekhiyo (${err}${amount != null ? `, difference ${amount}` : ""}). Debit/credit milayera confirm garnuhos.`;
    }
    if (err === "fiscal_year_date_mismatch") {
      return `Fiscal year ra date milena (${entry.finalOutput?.fiscal_year} vs ${entry.finalOutput?.date}). Kun sahi ho confirm garnuhos.`;
    }
    if (err === "duplicate_entry") {
      return `Duplicate entry suspicion (${amount ?? ""}). Same invoice already recorded chha ki confirm garnuhos.`;
    }
    if (err === "bank_reconciliation_mismatch") {
      return `Bank statement mismatch (${amount ?? ""}). Reconciliation check garnuhos.`;
    }
    return `Accounting error detected: ${err}. Confirm garnuhos.`;
  }

  return null;
}

/** Early parseKhata path: only ambiguous / error / needsClarification goldens. */
export function matchEarlyReasoningChainClarify(
  text: string,
): ReasoningChainPattern | null {
  const hit = matchReasoningChain(text);
  if (!hit) return null;
  if (hit.needsClarification || EARLY_CLARIFY_INTENTS.has(hit.intent)) {
    return hit;
  }
  return null;
}

export type { ReasoningChainPattern };
