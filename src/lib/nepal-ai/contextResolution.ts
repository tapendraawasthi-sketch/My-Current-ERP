/**
 * Multi-turn context resolution (pronouns, amount continuation, corrections, repeats).
 */

import {
  CONTEXT_RESOLUTION_PATTERNS,
  CONTEXT_RESOLUTION_TRIGGERS,
  type ContextResolutionPattern,
} from "./generated/runtimeMaps";
import { parseNepaliAmount } from "./numberWords";

const BY_ID = new Map(CONTEXT_RESOLUTION_PATTERNS.map((p) => [p.id, p]));

export type ContextResolutionFamily =
  | "pronoun"
  | "amount_continuation"
  | "correction"
  | "addition"
  | "time_reference"
  | "implicit_continue"
  | "confirm"
  | "negate"
  | "affirm"
  | "ask"
  | "ordinal"
  | "demonstrative"
  | "location"
  | "self_subject"
  | "error_reference"
  | "other";

export type ContextDiscourseState = {
  lastParty?: string | null;
  lastParties?: string[] | null;
  lastAmount?: number | null;
  lastIntent?: string | null;
  lastUserText?: string | null;
  lastBank?: string | null;
  lastAtm?: string | null;
  lastMethod?: string | null;
  pendingParty?: string | null;
  awaiting?: string | null;
};

export type ContextResolutionResult = {
  pattern: ContextResolutionPattern;
  resolvedText: string;
  intentHint: string;
  baseAction: string;
  family: string;
  amount?: number | null;
  party?: string | null;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[?؟!.]+$/g, "").replace(/\s+/g, " ").trim();
}

export function getContextPatternById(id: string): ContextResolutionPattern | null {
  return BY_ID.get(id) ?? null;
}

/** Exact trigger match from example dialogues. */
export function matchContextTriggerExact(text: string): ContextResolutionPattern | null {
  const key = norm(text);
  const hit = CONTEXT_RESOLUTION_TRIGGERS[key];
  if (!hit) return null;
  return getContextPatternById(hit.id);
}

/**
 * Heuristic match when exact trigger not found but pronouns/corrections present.
 */
export function matchContextResolutionHeuristic(
  text: string,
  state?: ContextDiscourseState | null,
): ContextResolutionPattern | null {
  const t = norm(text);
  if (!t) return null;

  const hasParty = Boolean(state?.lastParty || state?.pendingParty || (state?.lastParties?.length ?? 0) > 0);
  const awaitingAmount = state?.awaiting === "amount" || Boolean(state?.pendingParty);

  if (/^(ho|thik\s*cha|thikcha|huss|hus)$/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "confirm_yes_ho")
      ?? CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "confirm")
      ?? null;
  }
  if (/^hoina,?\s*cancel/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "negate_cancel_hoina") ?? null;
  }

  // Amount continuation: bare number / Rs.xxx while awaiting amount
  if (awaitingAmount) {
    if (/^(rs\.?\s*)?\d+$/i.test(t) || /^\d+\s*rupiya$/i.test(t)) {
      return (
        CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "amount_continuation_number_only") ??
        CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "amount_continuation") ??
        null
      );
    }
  }

  // Corrections
  if (/^(hoina|nai)\b/i.test(t) && (/\d/.test(t) || /\blai\b/i.test(t) || /\b(payment|asti|hijo)\b/i.test(t))) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "correction_replace_amount_hoina")
      ?? CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "correction")
      ?? null;
  }
  if (/^sachhi\b/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "correction_replace_with_sachhi") ?? null;
  }

  if (!hasParty && !state?.lastAmount && !state?.lastBank) {
    // still allow repeats/queries that need less state
  }

  // Pronouns
  if (hasParty) {
    if (/\btyo\s+le\s+(tiryo|diyo|pathayo)\b/i.test(t)) {
      const name = /\bpathayo\b/i.test(t)
        ? "pronoun_tyo_le_pathayo"
        : /\bdiyo\b/i.test(t)
          ? "pronoun_tyo_le_diyo"
          : "pronoun_resolution_tyo_subject_payment_in";
      return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === name) ?? null;
    }
    if (/\btyo\s+lai\b/i.test(t)) {
      return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "pronoun_resolution_tyo_object_payment_out") ?? null;
    }
    if (/\btyo\s+ko\b/i.test(t) && /\b(balance|baki|khata)\b/i.test(t)) {
      return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "pronoun_resolution_tyo_possessive_balance") ?? null;
    }
    if (/\btyo\s+sanga\b/i.test(t)) {
      return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "pronoun_tyo_sanga_hisab") ?? null;
    }
    if (/\b(uni|uhaa)\s+le\b/i.test(t)) {
      return CONTEXT_RESOLUTION_PATTERNS.find((p) =>
        p.patternName === (/\buhaa\b/i.test(t) ? "pronoun_resolution_uhaa_loan_request" : "pronoun_resolution_uni_account_open"),
      ) ?? null;
    }
    if (/\btiniharu\b/i.test(t)) {
      return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "pronoun_resolution_tiniharu_group_transfer") ?? null;
    }
  }

  if (/\byo\s+transaction\s+cancel\b/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "pronoun_resolution_yo_transaction_cancel") ?? null;
  }
  if (/\bferi\s+tyahi\b/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "implicit_continue_feri_same") ?? null;
  }
  if (/\b(ani|feri|arko|tespachi)\b/i.test(t) && (/\d/.test(t) || /\blai\b/i.test(t))) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "addition" || p.family === "implicit_continue") ?? null;
  }
  if (/\b(hijo|asti|pohor|agillo)\s+ko\s+tyo\b/i.test(t) || /\byo\s+hapta\s+ko\s+tyo\b/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "time_reference") ?? null;
  }
  if (/\bpachillo\s+transaction\b/i.test(t) || /\blast\s+transaction\b/i.test(t) || /\bantim\s+ma\b/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "ask") ?? null;
  }
  if (/\b(pahilo|dosro|tesro)\b/i.test(t)) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.family === "ordinal") ?? null;
  }
  if (/\btyo\s+bank\b/i.test(t) && state?.lastBank) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "location_bank_reference") ?? null;
  }
  if (/\btyo\s+atm\b/i.test(t) && state?.lastAtm) {
    return CONTEXT_RESOLUTION_PATTERNS.find((p) => p.patternName === "location_atm_reference") ?? null;
  }

  return null;
}

/** Replace pronouns with last party / fill amount into a parseable phrase. */
export function resolveContextUtterance(
  text: string,
  state: ContextDiscourseState,
  pattern?: ContextResolutionPattern | null,
): ContextResolutionResult | null {
  const pat = pattern ?? matchContextTriggerExact(text) ?? matchContextResolutionHeuristic(text, state);
  if (!pat) return null;

  const party = state.lastParty || state.pendingParty || state.lastParties?.[0] || null;
  const amount = state.lastAmount ?? null;
  let resolved = text.trim();
  const t = norm(text);

  if (pat.family === "pronoun" || pat.patternName.startsWith("pronoun")) {
    if (party) {
      resolved = resolved
        .replace(/\btyo\s+le\b/gi, `${party} le`)
        .replace(/\btyo\s+lai\b/gi, `${party} lai`)
        .replace(/\btyo\s+ko\b/gi, `${party} ko`)
        .replace(/\btyo\s+sanga\b/gi, `${party} sanga`)
        .replace(/\buni\s+le\b/gi, `${party} le`)
        .replace(/\buhaa\s+le\b/gi, `${party} le`)
        .replace(/\btiniharu\b/gi, (state.lastParties || [party]).join(" ra "));
    }
    if (/\btyo\s+le\s+tiryo\b/i.test(t) && party && amount) {
      resolved = `${party} le ${amount} tiryo`;
    }
    if (/\btyo\s+le\s+(diyo|pathayo)\b/i.test(t) && party && amount) {
      resolved = `${party} le ${amount} ${/\bpathayo\b/i.test(t) ? "pathayo" : "diyo"}`;
    }
    if (/\btyo\s+lai\b/i.test(t) && party && !/\b[A-Z][a-z]+\s+lai\b/.test(resolved)) {
      // amount already in text usually
      resolved = resolved.replace(/\btyo\s+lai\b/gi, `${party} lai`);
    }
  }

  if (pat.family === "amount_continuation") {
    const amt = parseNepaliAmount(text) ?? parseNepaliAmount(t.replace(/^rs\.?/i, ""));
    const p = state.pendingParty || state.lastParty;
    if (amt && p) {
      const intent = pat.intentAfterResolution;
      if (/bill|loan/i.test(intent)) {
        resolved = `${p} lai ${amt}`;
      } else if (/transfer|send|payment_out/i.test(intent)) {
        resolved = `${p} lai ${amt} diye`;
      } else {
        resolved = `${p} lai ${amt}`;
      }
    }
  }

  if (pat.family === "correction") {
    const amt = parseNepaliAmount(text);
    const intent = state.lastIntent || "";
    const verb =
      /payment_in|received/i.test(intent)
        ? "tiryo"
        : /purchase|kine/i.test(intent)
          ? "kineko"
          : /expense|kharcha/i.test(intent)
            ? "kharcha"
            : /cash_sale|sale/i.test(intent)
              ? "becheko"
              : "diye";
    if (amt && party) {
      if (/purchase/i.test(intent)) resolved = `${party} bata ${amt} ${verb}`;
      else if (/expense/i.test(intent)) resolved = `${amt} ${verb}`;
      else resolved = `${party} lai ${amt} ${verb}`;
    } else if (amt) {
      resolved = `${amt} ${verb}`;
    } else {
      const m = text.match(/hoina\s+([A-Za-z\u0900-\u097F]+)\s+lai/i);
      if (m) resolved = `${m[1]} lai ${amount ?? ""} ${verb}`.trim();
    }
  }

  if (pat.family === "addition" || pat.family === "implicit_continue") {
    if (/\bferi\s+tyahi\b/i.test(t) && party && amount) {
      resolved = `${party} lai ${amount}`;
    } else if (party) {
      const amt = parseNepaliAmount(text);
      if (amt && /\b(ani|feri|arko)\b/i.test(t) && !/\blai\b/i.test(t)) {
        resolved = `${party} lai ${amt}`;
      }
    }
  }

  if (pat.family === "location") {
    if (state.lastBank && /\btyo\s+bank\b/i.test(t)) {
      resolved = resolved.replace(/\btyo\s+bank\b/gi, `${state.lastBank} bank`);
    }
    if (state.lastAtm && /\btyo\s+atm\b/i.test(t)) {
      resolved = resolved.replace(/\btyo\s+atm\b/gi, state.lastAtm);
    }
  }

  return {
    pattern: pat,
    resolvedText: resolved,
    intentHint: pat.intentAfterResolution,
    baseAction: pat.baseAction,
    family: pat.family,
    amount: parseNepaliAmount(resolved) ?? amount,
    party,
  };
}

export function matchAndResolveContext(
  text: string,
  state?: ContextDiscourseState | null,
): ContextResolutionResult | null {
  if (!state) {
    const exact = matchContextTriggerExact(text);
    if (!exact) return null;
    return resolveContextUtterance(text, {}, exact);
  }
  return resolveContextUtterance(text, state);
}
