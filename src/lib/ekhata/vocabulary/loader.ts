import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import registry from "../../../../data/ekhata/vocabulary/_registry.json";
import type {
  SectorMatch,
  VocabularyCategory,
  VocabularyRegistry,
  VocabularyTermGroup,
} from "./types";

function loadCategories(): VocabularyCategory[] {
  const globFn = (
    import.meta as ImportMeta & { glob?: (p: string, o: { eager: boolean }) => unknown }
  ).glob;
  if (typeof globFn === "function") {
    const categoryModules = globFn("../../../../data/ekhata/vocabulary/categories/*.json", {
      eager: true,
    }) as Record<string, VocabularyCategory | { default: VocabularyCategory }>;
    return Object.values(categoryModules).map((m) =>
      m && typeof m === "object" && "default" in m
        ? (m as { default: VocabularyCategory }).default
        : (m as VocabularyCategory),
    );
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, "../../../../data/ekhata/vocabulary/categories");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(dir, name), "utf-8")) as VocabularyCategory);
}

const VOCABULARY_REGISTRY = registry as VocabularyRegistry;

const CATEGORIES: VocabularyCategory[] = loadCategories();

let mergedSpellingCache: Record<string, string> | null = null;
let mergedTermsCache: string[] | null = null;

function flattenTerms(group: VocabularyTermGroup | undefined): string[] {
  if (!group) return [];
  return [
    ...(group.en ?? []),
    ...(group.ne_roman ?? []),
    ...(group.ne_devanagari ?? []),
    ...(group.variants ?? []),
  ];
}

/** All spelling variant → canonical maps from every category file. */
export function getMergedSpellingAliases(): Record<string, string> {
  if (mergedSpellingCache) return mergedSpellingCache;
  const out: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    for (const group of Object.values(cat.groups)) {
      if (group.map) Object.assign(out, group.map);
    }
  }
  mergedSpellingCache = out;
  return out;
}

/** Flat list of all business terms for fuzzy item/sector matching. */
export function getAllBusinessTerms(): string[] {
  if (mergedTermsCache) return mergedTermsCache;
  const set = new Set<string>();
  for (const cat of CATEGORIES) {
    for (const group of Object.values(cat.groups)) {
      for (const term of flattenTerms(group)) {
        const t = term.trim().toLowerCase();
        if (t.length >= 2) set.add(t);
      }
    }
  }
  mergedTermsCache = [...set];
  return mergedTermsCache;
}

/** Detect best-matching business sector from message text. */
export function detectBusinessSector(text: string): SectorMatch | null {
  const q = text.toLowerCase();
  let best: SectorMatch | null = null;

  for (const cat of CATEGORIES) {
    if (cat.businessNature === "universal") continue;
    let score = 0;
    const items = cat.groups.items;
    if (items) {
      for (const term of flattenTerms(items)) {
        const t = term.toLowerCase();
        if (t.length < 3) continue;
        if (q.includes(t)) score += t.includes(" ") ? 4 : 2;
      }
    }
    for (const tag of cat.tags) {
      if (q.includes(tag.replace(/-/g, " ")) || q.includes(tag)) score += 1;
    }
    if (score <= 0) continue;
    const match: SectorMatch = {
      slug: cat.slug,
      sectorSlug: cat.sectorSlug ?? null,
      score,
      displayName: cat.displayName,
    };
    if (!best || score > best.score) best = match;
  }
  return best;
}

/** Terms for a specific sector slug (items + transaction verbs). */
export function getSectorVocabulary(sectorSlug: string): VocabularyCategory | undefined {
  return CATEGORIES.find((c) => c.sectorSlug === sectorSlug || c.slug === sectorSlug);
}

/** Intent hint from transaction verb groups matching text. */
export function matchTransactionIntentHint(text: string): string | null {
  const q = text.toLowerCase();
  for (const cat of CATEGORIES) {
    for (const group of Object.values(cat.groups)) {
      if (!group.intentHint) continue;
      for (const term of flattenTerms(group)) {
        const t = term.toLowerCase();
        if (t.length >= 3 && q.includes(t)) return group.intentHint;
      }
    }
  }
  return null;
}

/** Check if text mentions a known business item (any sector). */
export function mentionsBusinessItem(text: string): boolean {
  const q = text.toLowerCase();
  return getAllBusinessTerms().some((term) => term.length >= 3 && q.includes(term));
}

export function getVocabularyRegistry(): VocabularyRegistry {
  return VOCABULARY_REGISTRY;
}

export function getAllCategories(): VocabularyCategory[] {
  return CATEGORIES;
}

export { VOCABULARY_REGISTRY };
