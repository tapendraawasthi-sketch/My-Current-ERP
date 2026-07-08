/**
 * Nepal Universal AI — sector ontology loader for domain routing & sector detection.
 */

export interface SectorOntologyEntry {
  id: string;
  macro_sector: string;
  subsector: string;
  name_en: string;
  name_ne_roman: string;
  name_ne_devanagari?: string;
  typical_roles: string[];
  common_transactions: string[];
  example_user_phrases: string[];
  tags: string[];
  sector_slug?: string;
}

export interface SectorKeywordEntry {
  sector_id: string;
  sector_slug: string;
  name_en: string;
  name_ne_roman: string;
  macro_sector: string;
  keywords: string[];
}

/** Static slug map aligned with ingest_nepal_ai_ontology.py */
const SLUG_MAP: Record<string, string> = {
  "sector-001": "kirana-grocery",
  "sector-002": "hardware-shop",
  "sector-003": "electronics-mobile-shop",
  "sector-006": "pharmacy-medical",
  "sector-008": "restaurant-cafe",
  "sector-010": "bakery",
  "sector-011": "meat-shop",
  "sector-012": "dairy-shop",
  "sector-013": "fruit-vegetable-shop",
  "sector-015": "hardware-construction-materials-shop",
  "sector-024": "clinic-health",
  "sector-049": "software-it-firm",
};

function slugify(nameEn: string, sectorId: string): string {
  if (SLUG_MAP[sectorId]) return SLUG_MAP[sectorId];
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/** Detect best-matching sector from user text using keywords + example phrases. */
export function detectSectorFromOntology(
  text: string,
  entries: SectorOntologyEntry[],
  keywordIndex?: SectorKeywordEntry[],
): { sectorId: string; sectorSlug: string; score: number; name: string } | null {
  const t = text.toLowerCase();
  if (!t.trim()) return null;

  let best: { sectorId: string; sectorSlug: string; score: number; name: string } | null = null;

  for (const entry of entries) {
    let score = 0;
    const slug = slugify(entry.name_en, entry.id);

    if (entry.name_ne_roman && t.includes(entry.name_ne_roman.toLowerCase())) score += 3;
    if (entry.name_en && t.includes(entry.name_en.toLowerCase())) score += 2;
    if (entry.subsector && t.includes(entry.subsector.toLowerCase())) score += 1.5;
    if (entry.macro_sector && t.includes(entry.macro_sector.toLowerCase())) score += 1;

    for (const tag of entry.tags || []) {
      if (tag.length > 3 && t.includes(tag.toLowerCase())) score += 1;
    }
    for (const phrase of entry.example_user_phrases || []) {
      const words = phrase.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const hits = words.filter((w) => t.includes(w)).length;
      if (hits >= 2) score += hits * 0.5;
    }

    const kw = keywordIndex?.find((k) => k.sector_id === entry.id);
    if (kw) {
      for (const word of kw.keywords) {
        if (word.length > 3 && t.includes(word)) score += 0.3;
      }
    }

    if (!best || score > best.score) {
      best = { sectorId: entry.id, sectorSlug: slug, score, name: entry.name_en };
    }
  }

  return best && best.score >= 1.5 ? best : null;
}

/** Returns macro-sector group for consultant routing (tax, legal, accounting, etc.) */
export function macroSectorToConsultantDomain(macro: string): string {
  const m = macro.toLowerCase();
  if (m.includes("professional")) {
    if (m.includes("legal") || m.includes("notary")) return "legal";
    return "accounting_tax";
  }
  if (m.includes("government") || m.includes("public")) return "government";
  if (m.includes("finance")) return "finance";
  if (m.includes("healthcare")) return "healthcare_admin";
  if (m.includes("education")) return "education";
  if (m.includes("construction")) return "construction";
  if (m.includes("agriculture")) return "agriculture";
  if (m.includes("transport")) return "transport";
  if (m.includes("manufacturing")) return "manufacturing";
  if (m.includes("it") || m.includes("technology")) return "technology";
  return "commerce";
}

export { slugify };
