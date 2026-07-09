/**
 * Verb normalization from Nepal Universal AI BATCH 02–03 + conjugations + verb_normalize_map.json.
 * Maps spoken/typed variants → lemma + semantic tag for NLU.
 */

import {
  VERB_ALIASES,
  VERB_CONJUGATIONS,
  type VerbNormalizeEntry,
} from "./generated/runtimeMaps";

export type { VerbNormalizeEntry };

/** Legacy subset kept for tests — full map is in VERB_ALIASES */
const CORE_VERB_ALIASES = VERB_ALIASES;

const SEMANTIC_TO_FRAME: Record<string, string> = {
  PURCHASE: "PURCHASE",
  SALE: "SALE",
  PAYMENT_OUT: "PAY_OUT",
  RECEIVE: "PAY_IN",
  INBOUND_RECEIPT: "PAY_IN",
  SEND_DISPATCH: "PAY_OUT",
  DEPOSIT_COLLECT: "PAY_IN",
  WITHDRAWAL: "PAY_OUT",
  EXPENSE: "EXPENSE",
  CREDIT_OUTSTANDING: "CREDIT_SALE",
  RETURN_REFUND: "RETURN_SALE",
};

function sortedKeys(): string[] {
  return Object.keys(VERB_ALIASES).sort((a, b) => b.length - a.length);
}

const CONJ_SURFACES = (() => {
  const out = VERB_CONJUGATIONS.map((c) => ({
    form: c.surface.toLowerCase(),
    entry: c,
  }));
  out.sort((a, b) => b.form.length - a.form.length);
  return out;
})();

export type VerbHit = VerbNormalizeEntry & {
  surface: string;
  frameAction?: string;
};

/** Detect if text contains a known verb variant; returns best (longest) match. */
export function detectVerbInText(text: string): VerbHit | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  // Prefer explicit conjugation surfaces first (accurate morphology + DR/CR hints)
  for (const { form, entry } of CONJ_SURFACES) {
    if (t === form) {
      return toHit(form, VERB_ALIASES[form] ?? {
        lemma: entry.lemma,
        intent_hint: entry.intentHint,
        semantic_action: entry.semanticAction,
        signals_completion: entry.signalsCompletion,
        tense: entry.tense,
        transaction_type: entry.transactionType,
        debit_hint: entry.debitHint,
        credit_hint: entry.creditHint,
        meaning: entry.meaning,
      });
    }
    const idx = t.indexOf(form);
    if (idx < 0) continue;
    const beforeOk = idx === 0 || /[\s]/.test(t[idx - 1]!);
    const afterOk = idx + form.length === t.length || /[\s]/.test(t[idx + form.length]!);
    if (beforeOk && afterOk) {
      const alias = VERB_ALIASES[form];
      return toHit(
        form,
        alias ?? {
          lemma: entry.lemma,
          intent_hint: entry.intentHint,
          semantic_action: entry.semanticAction,
          signals_completion: entry.signalsCompletion,
          tense: entry.tense,
          transaction_type: entry.transactionType,
          debit_hint: entry.debitHint,
          credit_hint: entry.creditHint,
          meaning: entry.meaning,
        },
      );
    }
  }

  for (const key of sortedKeys()) {
    const idx = t.indexOf(key);
    if (idx < 0) continue;
    const beforeOk = idx === 0 || /[\s]/.test(t[idx - 1]!);
    const afterOk = idx + key.length === t.length || /[\s]/.test(t[idx + key.length]!);
    if (beforeOk && afterOk) return toHit(key, VERB_ALIASES[key]!);
  }
  return null;
}

function toHit(surface: string, entry: VerbNormalizeEntry): VerbHit {
  const action = entry.semantic_action || "";
  return {
    ...entry,
    surface,
    frameAction: SEMANTIC_TO_FRAME[action] || undefined,
  };
}

/** Double-entry posting hints from morphology lexicon. */
export function getVerbAccountingHints(text: string): {
  debit: string;
  credit: string;
  transactionType: string;
  lemma: string;
} | null {
  const hit = detectVerbInText(text);
  if (!hit?.debit_hint || !hit.credit_hint) return null;
  return {
    debit: hit.debit_hint,
    credit: hit.credit_hint,
    transactionType: hit.transaction_type || "",
    lemma: hit.lemma,
  };
}

/** Expand typos in text using verb aliases (whole-word).
 *  Skips: hunu/chanu copulas; preserves perfect participles (*eko/*ayeko) so
 *  typo corrections like gareyo→gareko / kineyo→kineko remain usable by NLU.
 */
export function expandVerbAliases(text: string): string {
  let out = ` ${text.toLowerCase()} `;
  const sorted = sortedKeys().filter((key) => {
    const entry = VERB_ALIASES[key];
    if (entry.lemma === "hunu" || entry.lemma === "chanu") return false;
    if (entry.semantic_role === "EXISTENCE_COPULA") return false;
    // Already-canonical past/perfect forms — leave surface text alone
    if (
      entry.signals_completion ||
      /(?:eko|ayeko|iyeko|aeko)$/i.test(key) ||
      key === "gareko" ||
      key === "kineko" ||
      key === "becheko" ||
      key === "bhaneko" ||
      key === "pathaeko" ||
      key === "pathaayeko"
    ) {
      return false;
    }
    return true;
  });
  for (const key of sorted) {
    const canon = VERB_ALIASES[key].lemma.split(" ")[0];
    // Never collapse real participles into a wrong lemma like gareko→bhayeko
    if (/(?:eko|ayeko|iyeko|aeko)$/i.test(key) && canon !== key) continue;
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, ` ${canon} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

export { CORE_VERB_ALIASES, VERB_ALIASES };
