// Last-resort static KB lookup — only when code index + module docs have no match.

import { FALCON_KB, type FalconKBEntry } from "./knowledgeBase";
import { getCodeStructureInfo, searchModules } from "./codeStructureParser";

/** True when page index or erpCodeKnowledge can answer without static KB. */
export function hasCodeGroundedAnswer(focus: string | null, query: string): boolean {
  if (focus) {
    const info = getCodeStructureInfo(focus);
    if (info?.moduleDoc || info?.menuPath || info?.filePath) return true;
  }
  const results = searchModules(focus || query, 1);
  return results.length > 0 && results[0].score >= 10;
}

/** Static KB — ONLY when code structure has no match. */
export function findKbEntryLastResort(
  query: string,
  focus?: string | null,
): FalconKBEntry | undefined {
  if (hasCodeGroundedAnswer(focus ?? null, query)) {
    return undefined;
  }

  const queryLower = query.toLowerCase();
  const focusLower = focus?.toLowerCase() ?? "";

  return FALCON_KB.find((entry) => {
    const entryText = [entry.title, entry.module, ...entry.keywords].join(" ").toLowerCase();
    if (focusLower && (entryText.includes(focusLower) || focusLower.includes(entry.module))) {
      return true;
    }
    return (
      entry.keywords.some((k) => queryLower.includes(k.toLowerCase())) ||
      queryLower.includes(entry.module)
    );
  });
}
