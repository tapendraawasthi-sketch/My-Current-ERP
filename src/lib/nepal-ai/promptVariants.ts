/**
 * System-prompt A/B variant goldens — evaluation metadata and routing config.
 */

import {
  PROMPT_VARIANT_ALIASES,
  PROMPT_VARIANTS,
  PROMPT_VARIANTS_BY_BEHAVIOR,
  type PromptVariant,
} from "./generated/runtimeMaps";

const BY_ID = new Map(PROMPT_VARIANTS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPromptVariantById(id: string): PromptVariant | null {
  return BY_ID.get(id) ?? null;
}

export function getPromptVariantsByBehavior(
  behaviorKey: string,
): PromptVariant[] {
  const ids = PROMPT_VARIANTS_BY_BEHAVIOR[behaviorKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as PromptVariant[];
}

export function getPromptVariantSystemPrompt(variantId: string): string | null {
  return getPromptVariantById(variantId)?.systemPrompt ?? null;
}

export type PromptVariantMatch = {
  entry: PromptVariant;
};

/** Exact match on variant_id or target_behavior key (not eval test_inputs). */
export function matchPromptVariant(text: string): PromptVariantMatch | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = PROMPT_VARIANT_ALIASES[cand];
    if (hit) {
      const entry = getPromptVariantById(hit.id);
      if (!entry) return null;
      return { entry };
    }
  }

  return null;
}

export function isPromptVariantQuery(text: string): boolean {
  if (matchPromptVariant(text)) return true;
  const t = normalizeKey(text);
  return (
    /\bprompt[_\s-]?v\d+\b/i.test(text) ||
    /\b(system prompt|prompt variant|ab test|a\/b test)\b/i.test(text) ||
    t in PROMPT_VARIANTS_BY_BEHAVIOR
  );
}

export function formatPromptVariantSummary(
  match: PromptVariantMatch,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  const { entry } = match;
  const title =
    lang === "english"
      ? `Prompt variant: ${entry.variantId} (${entry.targetBehavior})`
      : `Prompt variant: ${entry.variantId} (${entry.targetBehavior})`;

  const lines: string[] = [
    `**${title}**`,
    "",
    lang === "english" ? "Key instructions:" : "Key instructions:",
    ...entry.keyInstructions.map((i) => `• ${i}`),
    "",
    lang === "english" ? "Strengths:" : "Strengths:",
    ...entry.expectedStrengths.map((s) => `• ${s}`),
    "",
    lang === "english" ? "Weaknesses:" : "Weaknesses:",
    ...entry.expectedWeaknesses.map((w) => `• ${w}`),
    "",
    lang === "english" ? "Evaluation criteria:" : "Evaluation criteria:",
    ...entry.evaluationCriteria.map((c) => `• ${c}`),
    "",
    lang === "english" ? "Test inputs:" : "Test inputs:",
    ...entry.testInputs.map((i) => `• ${i}`),
    "",
    lang === "english" ? "System prompt:" : "System prompt:",
    entry.systemPrompt,
  ];

  return lines.join("\n");
}

export function tryPromptVariant(
  input: string,
  lang: "english" | "nepali" | "mixed" = "mixed",
): { answer: string; variantId: string } | null {
  const match = matchPromptVariant(input);
  if (!match) return null;
  return {
    answer: formatPromptVariantSummary(match, lang),
    variantId: match.entry.variantId,
  };
}
