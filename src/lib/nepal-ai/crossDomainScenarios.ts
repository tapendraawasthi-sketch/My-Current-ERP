/**
 * Cross-domain Nepal business scenarios — labor/tax/import/property/banking
 * reasoning goldens with journal entry illustrations.
 */

import {
  CROSS_DOMAIN_SCENARIO_ALIASES,
  CROSS_DOMAIN_SCENARIOS,
  CROSS_DOMAIN_SCENARIOS_BY_DOMAIN,
  type CrossDomainScenario,
} from "./generated/runtimeMaps";

const BY_ID = new Map(CROSS_DOMAIN_SCENARIOS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCrossDomainScenarioById(id: string): CrossDomainScenario | null {
  return BY_ID.get(id) ?? null;
}

export function getCrossDomainScenariosByDomain(domainKey: string): CrossDomainScenario[] {
  const ids = CROSS_DOMAIN_SCENARIOS_BY_DOMAIN[domainKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as CrossDomainScenario[];
}

/** Exact golden match on raw input, normalized, or scenario_id. */
export function matchCrossDomainScenario(text: string): CrossDomainScenario | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = CROSS_DOMAIN_SCENARIO_ALIASES[cand];
    if (hit) return getCrossDomainScenarioById(hit.id);
  }

  return null;
}

export function formatCrossDomainAnswer(
  entry: CrossDomainScenario,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  const lines: string[] = [entry.answerNe];

  if (entry.journalEntries.length > 0) {
    lines.push("");
    lines.push(
      lang === "english"
        ? "Journal entries:"
        : lang === "nepali"
          ? "Journal entries:"
          : "Journal entries:",
    );
    for (const je of entry.journalEntries) {
      lines.push(`• ${je}`);
    }
  }

  return lines.join("\n");
}

export function tryCrossDomainScenario(
  input: string,
  lang: "english" | "nepali" | "mixed" = "mixed",
): { answer: string; scenarioId: string } | null {
  const match = matchCrossDomainScenario(input);
  if (!match) return null;
  return {
    answer: formatCrossDomainAnswer(match, lang),
    scenarioId: match.scenarioId,
  };
}
