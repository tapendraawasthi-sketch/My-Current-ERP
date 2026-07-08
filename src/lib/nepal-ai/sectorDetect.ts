/**
 * Sector detection using exported Nepal AI keyword index.
 */

import { SECTOR_KEYWORD_INDEX, type SectorKeywordEntry } from "./generated/runtimeMaps";

export interface SectorMatch {
  sectorId: string;
  sectorSlug: string;
  score: number;
  name: string;
  macroSector: string;
}

function scoreSector(text: string, entry: SectorKeywordEntry): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const kw of entry.keywords) {
    if (kw.length > 3 && t.includes(kw)) score += 1;
    if (kw.length > 5 && new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t)) {
      score += 0.5;
    }
  }
  if (entry.name && t.includes(entry.name.toLowerCase())) score += 2;
  return score;
}

/** Best-matching business sector from user message (for NLU boost / sector phrases). */
export function detectBusinessSector(text: string): SectorMatch | null {
  const t = text.trim();
  if (!t) return null;

  let best: SectorMatch | null = null;
  for (const entry of SECTOR_KEYWORD_INDEX) {
    const score = scoreSector(t, entry);
    if (!best || score > best.score) {
      best = {
        sectorId: entry.sectorId,
        sectorSlug: entry.sectorSlug,
        score,
        name: entry.name,
        macroSector: entry.macroSector,
      };
    }
  }
  return best && best.score >= 1.5 ? best : null;
}
