/**
 * Complex Nepal business reasoning scenarios — multi-step contradictions,
 * temporal/priority conflicts, and resolution goldens.
 */

import {
  COMPLEX_REASONING_SCENARIOS,
  COMPLEX_REASONING_SCENARIOS_BY_TYPE,
  COMPLEX_REASONING_SCENARIO_ALIASES,
  type ComplexReasoningScenario,
} from "./generated/runtimeMaps";

const BY_ID = new Map(COMPLEX_REASONING_SCENARIOS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getComplexReasoningScenarioById(
  id: string,
): ComplexReasoningScenario | null {
  return BY_ID.get(id) ?? null;
}

export function getComplexReasoningScenariosByType(
  scenarioTypeKey: string,
): ComplexReasoningScenario[] {
  const ids = COMPLEX_REASONING_SCENARIOS_BY_TYPE[scenarioTypeKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as ComplexReasoningScenario[];
}

/** Exact golden match on raw input, normalized, or scenario_id. */
export function matchComplexReasoningScenario(
  text: string,
): ComplexReasoningScenario | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = COMPLEX_REASONING_SCENARIO_ALIASES[cand];
    if (hit) return getComplexReasoningScenarioById(hit.id);
  }

  return null;
}

export function formatComplexReasoningClarify(
  entry: ComplexReasoningScenario,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  if (entry.clarifyQuestion?.trim()) {
    return entry.clarifyQuestion.trim();
  }
  return lang === "english"
    ? "Need a bit more detail to resolve this scenario — can you clarify?"
    : "Yo scenario resolve garna thora detail chahiyo — clear garna saknu huncha?";
}

export function formatComplexReasoningAnswer(
  entry: ComplexReasoningScenario,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  if (entry.clarificationNeeded && entry.clarifyQuestion) {
    return formatComplexReasoningClarify(entry, lang);
  }

  const lead =
    lang === "english"
      ? entry.surfaceContradiction
      : entry.surfaceContradiction;

  const keyThought =
    entry.reasoningRequired[entry.reasoningRequired.length - 1]?.thought ??
    entry.reasoningRequired[0]?.thought ??
    "";

  const top = entry.possibleResolutions[0];
  const resolutionLabel = top?.scenario ?? "";
  const sampleEntry = top?.entries?.[0] ?? "";

  const parts = [lead, keyThought, resolutionLabel, sampleEntry].filter(Boolean);
  return parts.join("\n\n");
}

export function isComplexReasoningClarify(
  entry: ComplexReasoningScenario,
): boolean {
  return entry.clarificationNeeded && Boolean(entry.clarifyQuestion?.trim());
}
