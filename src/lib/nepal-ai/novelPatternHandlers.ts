/**
 * Novel-pattern generalization goldens — unseen phrasing mapped to nearest
 * known patterns with suggested intent, entities, and clarify prompts.
 */

import {
  NOVEL_PATTERN_HANDLER_ALIASES,
  NOVEL_PATTERN_HANDLERS,
  NOVEL_PATTERN_HANDLERS_BY_INTENT,
  type NovelPatternHandler,
} from "./generated/runtimeMaps";

const BY_ID = new Map(NOVEL_PATTERN_HANDLERS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getNovelPatternHandlerById(id: string): NovelPatternHandler | null {
  return BY_ID.get(id) ?? null;
}

export function getNovelPatternHandlersByIntent(
  intentKey: string,
): NovelPatternHandler[] {
  const ids = NOVEL_PATTERN_HANDLERS_BY_INTENT[intentKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as NovelPatternHandler[];
}

/** Exact golden match on raw input, normalized, or novel_id. */
export function matchNovelPatternHandler(text: string): NovelPatternHandler | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = NOVEL_PATTERN_HANDLER_ALIASES[cand];
    if (hit) return getNovelPatternHandlerById(hit.id);
  }

  return null;
}

function formatEntities(entities: Record<string, unknown>): string {
  const parts = Object.entries(entities)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return parts.length ? parts.join(", ") : "—";
}

export function formatNovelPatternClarify(
  entry: NovelPatternHandler,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  if (entry.clarifyIfNeeded?.trim()) {
    return entry.clarifyIfNeeded.trim();
  }
  return lang === "english"
    ? "Need a bit more detail to record this novel transaction — can you clarify?"
    : "Yo naya pattern record garna thora detail chahiyo — clear garna saknu huncha?";
}

export function formatNovelPatternAnswer(
  entry: NovelPatternHandler,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  const lines: string[] = [];

  lines.push(
    lang === "english"
      ? `Nearest pattern: ${entry.nearestKnownPattern}`
      : `Nearest pattern: ${entry.nearestKnownPattern}`,
  );

  if (entry.reasoningToHandle.length > 0) {
    lines.push("");
    lines.push(lang === "english" ? "Reasoning:" : "Reasoning:");
    for (const step of entry.reasoningToHandle) {
      lines.push(`• ${step}`);
    }
  }

  lines.push("");
  lines.push(`Suggested intent: ${entry.suggestedIntent}`);
  lines.push(`Entities: ${formatEntities(entry.suggestedEntities)}`);

  if (entry.clarifyIfNeeded?.trim()) {
    lines.push("");
    lines.push(entry.clarifyIfNeeded.trim());
  }

  if (entry.generalizationLesson?.trim()) {
    lines.push("");
    lines.push(`Lesson: ${entry.generalizationLesson.trim()}`);
  }

  return lines.join("\n");
}

export function tryNovelPatternHandler(
  input: string,
  lang: "english" | "nepali" | "mixed" = "mixed",
): { answer: string; clarify: string; novelId: string; suggestedIntent: string } | null {
  const match = matchNovelPatternHandler(input);
  if (!match) return null;
  return {
    answer: formatNovelPatternAnswer(match, lang),
    clarify: formatNovelPatternClarify(match, lang),
    novelId: match.novelId,
    suggestedIntent: match.suggestedIntent,
  };
}
