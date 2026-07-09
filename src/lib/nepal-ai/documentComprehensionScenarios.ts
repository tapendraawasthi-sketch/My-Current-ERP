/**
 * Multi-page document comprehension goldens — structure, Q&A, extraction tasks.
 */

import {
  DOCUMENT_COMPREHENSION_SCENARIO_ALIASES,
  DOCUMENT_COMPREHENSION_SCENARIOS,
  DOCUMENT_COMPREHENSION_SCENARIOS_BY_TYPE,
  type DocumentComprehensionScenario,
} from "./generated/runtimeMaps";

const BY_ID = new Map(DOCUMENT_COMPREHENSION_SCENARIOS.map((e) => [e.id, e]));

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?؟!.]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDocumentComprehensionScenarioById(
  id: string,
): DocumentComprehensionScenario | null {
  return BY_ID.get(id) ?? null;
}

export function getDocumentComprehensionScenariosByType(
  documentTypeKey: string,
): DocumentComprehensionScenario[] {
  const ids = DOCUMENT_COMPREHENSION_SCENARIOS_BY_TYPE[documentTypeKey] ?? [];
  return ids
    .map((id) => BY_ID.get(id))
    .filter(Boolean) as DocumentComprehensionScenario[];
}

export type DocumentComprehensionMatch = {
  entry: DocumentComprehensionScenario;
  matchedQuestion?: string;
};

/** Exact golden match on document type, scenario id, or sample Q&A question. */
export function matchDocumentComprehensionScenario(
  text: string,
): DocumentComprehensionMatch | null {
  if (!text?.trim()) return null;

  const raw = text.trim();
  const spaced = normalizeKey(raw);

  for (const cand of [raw, raw.toLowerCase(), spaced]) {
    const hit = DOCUMENT_COMPREHENSION_SCENARIO_ALIASES[cand];
    if (hit) {
      const entry = getDocumentComprehensionScenarioById(hit.id);
      if (!entry) return null;
      const qa = entry.questionsThisDocumentCanAnswer.find(
        (p) => normalizeKey(p.q) === spaced || p.q.trim() === raw,
      );
      return { entry, matchedQuestion: qa?.q };
    }
  }

  return null;
}

export function isDocumentComprehensionQuery(text: string): boolean {
  if (matchDocumentComprehensionScenario(text)) return true;
  const t = normalizeKey(text);
  return (
    /\b(audit report|board resolution|tax return|financial report|bank statement|legal contract|multi-page)\b/i.test(
      text,
    ) ||
    /\b(extract|document structure|contingent liabilit|going concern|shareholders equity)\b/i.test(
      text,
    ) ||
    t.includes("what was total revenue") ||
    t.includes("what is the refund amount")
  );
}

function formatStructure(structure: Record<string, unknown>): string {
  return Object.entries(structure)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(", ")}`;
      return `${k}: ${String(v)}`;
    })
    .join("\n• ");
}

export function formatDocumentComprehensionAnswer(
  match: DocumentComprehensionMatch,
  lang: "english" | "nepali" | "mixed" = "mixed",
): string {
  const { entry, matchedQuestion } = match;

  if (matchedQuestion) {
    const qa = entry.questionsThisDocumentCanAnswer.find((p) => p.q === matchedQuestion);
    if (qa) {
      return lang === "english"
        ? `${qa.q}\n\n${qa.a}`
        : `${qa.q}\n\n${qa.a}`;
    }
  }

  const lines: string[] = [
    `**${entry.documentType}**`,
    "",
    lang === "english" ? "Document structure:" : "Document structure:",
    `• ${formatStructure(entry.documentStructure)}`,
  ];

  if (entry.sampleContentSections.length > 0) {
    lines.push("");
    lines.push(lang === "english" ? "Sample sections:" : "Sample sections:");
    for (const sec of entry.sampleContentSections) {
      lines.push(`• ${sec.section}: ${sec.content}`);
    }
  }

  if (entry.questionsThisDocumentCanAnswer.length > 0) {
    lines.push("");
    lines.push(lang === "english" ? "Can answer:" : "Can answer:");
    for (const qa of entry.questionsThisDocumentCanAnswer) {
      lines.push(`• ${qa.q} → ${qa.a}`);
    }
  }

  if (entry.dataExtractionTasks.length > 0) {
    lines.push("");
    lines.push(lang === "english" ? "Extraction tasks:" : "Extraction tasks:");
    for (const task of entry.dataExtractionTasks) {
      lines.push(`• ${task.task} (${task.expectedOutputFormat})`);
    }
  }

  return lines.join("\n");
}

export function tryDocumentComprehensionScenario(
  input: string,
  lang: "english" | "nepali" | "mixed" = "mixed",
): { answer: string; scenarioId: string } | null {
  const match = matchDocumentComprehensionScenario(input);
  if (!match) return null;
  return {
    answer: formatDocumentComprehensionAnswer(match, lang),
    scenarioId: match.entry.scenarioId,
  };
}
