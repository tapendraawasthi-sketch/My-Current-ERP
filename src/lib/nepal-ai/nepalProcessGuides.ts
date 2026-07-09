/**
 * Nepal administrative process guides (company, PAN, VAT, bank, SSF, trade, import/export, loans).
 */

import {
  NEPAL_PROCESS_GUIDE_ALIASES,
  NEPAL_PROCESS_GUIDES,
  type NepalProcessGuideEntry,
} from "./generated/runtimeMaps";

const BY_ID = new Map(NEPAL_PROCESS_GUIDES.map((e) => [e.id, e]));
const ALIAS_KEYS = Object.keys(NEPAL_PROCESS_GUIDE_ALIASES).sort((a, b) => b.length - a.length);

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getNepalProcessGuideById(id: string): NepalProcessGuideEntry | null {
  return BY_ID.get(id) ?? null;
}

export function matchNepalProcessGuide(text: string): NepalProcessGuideEntry | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = NEPAL_PROCESS_GUIDE_ALIASES[cand];
    if (hit) return getNepalProcessGuideById(hit.id);
  }

  let best: NepalProcessGuideEntry | null = null;
  let bestLen = 0;
  for (const alias of ALIAS_KEYS) {
    const a = normalizeKey(alias);
    if (a.length < 5) continue;
    if (!(spaced === a || spaced.includes(a) || a.includes(spaced))) continue;

    const exactish = spaced === a || spaced.startsWith(a) || a.startsWith(spaced);
    const processCue =
      /\b(kasari|kaise|how\s+to|how\s+do|process|steps|tarika|garne|register|renew|kholne|line|banaune|submit)\b/i.test(
        spaced,
      );
    if (!exactish && !processCue) continue;

    if (a.length > bestLen) {
      const entry = getNepalProcessGuideById(NEPAL_PROCESS_GUIDE_ALIASES[alias].id);
      if (entry) {
        best = entry;
        bestLen = a.length;
      }
    }
  }
  return best;
}

export function formatNepalProcessGuideAnswer(
  entry: NepalProcessGuideEntry,
  lang: "nepali" | "english" | "mixed",
): string {
  const steps =
    entry.stepsNe?.length > 0
      ? entry.stepsNe.join("\n")
      : lang === "english"
        ? entry.answerEn
        : entry.answerNe;

  const parts: string[] = [];
  if (lang === "english") {
    parts.push(entry.questionEn || entry.process);
    parts.push(steps);
    if (entry.requiredDocuments?.length) {
      parts.push(`Documents: ${entry.requiredDocuments.join("; ")}`);
    }
    if (entry.timeline) parts.push(`Timeline: ${entry.timeline}`);
    if (entry.fees) parts.push(`Fees: ${entry.fees}`);
    if (entry.commonIssues?.length) {
      parts.push(`Common issues: ${entry.commonIssues.join("; ")}`);
    }
  } else {
    parts.push(entry.questionNe || entry.process);
    parts.push(steps);
    if (entry.requiredDocuments?.length) {
      parts.push(`Kagajpatra: ${entry.requiredDocuments.join("; ")}`);
    }
    if (entry.timeline) parts.push(`Samaya: ${entry.timeline}`);
    if (entry.fees) parts.push(`Shulk: ${entry.fees}`);
    if (entry.commonIssues?.length) {
      parts.push(`Samanya samasya: ${entry.commonIssues.join("; ")}`);
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

export type { NepalProcessGuideEntry };
