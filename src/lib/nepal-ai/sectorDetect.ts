import { SECTOR_KEYWORD_INDEX, type SectorKeywordEntry } from "./generated/runtimeMaps";
import { matchRetailItem } from "./retailItems";
import { voteSectorFromTerms } from "./sectorTerms";

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

  const vocabVote = voteSectorFromTerms(t);
  // Single strong term (~1.3+) is enough; multi-term phrases score higher
  if (vocabVote && vocabVote.score >= 1.2) {
    const bySlug = SECTOR_KEYWORD_INDEX.find((e) => e.sectorSlug === vocabVote.sectorSlug);
    if (bySlug) {
      return {
        sectorId: bySlug.sectorId,
        sectorSlug: bySlug.sectorSlug,
        score: 4 + vocabVote.score + scoreSector(t, bySlug),
        name: bySlug.name,
        macroSector: bySlug.macroSector,
      };
    }
    return {
      sectorId: `vocab:${vocabVote.sector}`,
      sectorSlug: vocabVote.sectorSlug,
      score: 4 + vocabVote.score,
      name: vocabVote.terms[0]?.term ?? vocabVote.sector,
      macroSector: vocabVote.sector,
    };
  }

  const itemHit = matchRetailItem(t);
  if (itemHit) {
    const bySlug = SECTOR_KEYWORD_INDEX.find((e) => e.sectorSlug === itemHit.sectorSlug);
    if (bySlug) {
      return {
        sectorId: bySlug.sectorId,
        sectorSlug: bySlug.sectorSlug,
        score: 3 + scoreSector(t, bySlug),
        name: bySlug.name,
        macroSector: bySlug.macroSector,
      };
    }
    return {
      sectorId: `item:${itemHit.itemId}`,
      sectorSlug: itemHit.sectorSlug,
      score: 3,
      name: itemHit.canonical,
      macroSector: itemHit.sector,
    };
  }

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
