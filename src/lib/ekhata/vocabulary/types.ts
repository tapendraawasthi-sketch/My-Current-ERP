/** e-Khata business vocabulary — categorized Nepali/English terms by business nature. */

export interface VocabularyLabel {
  en: string;
  ne: string;
}

export interface VocabularyTermGroup {
  label: VocabularyLabel;
  intentHint?: string;
  en?: string[];
  ne_roman?: string[];
  ne_devanagari?: string[];
  variants?: string[];
  map?: Record<string, string>;
}

export interface VocabularyCategory {
  id: string;
  slug: string;
  displayName: { en: string; ne: string; ne_roman: string };
  businessNature: string;
  tags: string[];
  sectorSlug?: string | null;
  groups: Record<string, VocabularyTermGroup>;
}

export interface VocabularyRegistry {
  version: number;
  description: string;
  categories: Array<{
    slug: string;
    displayName: VocabularyCategory["displayName"];
    businessNature: string;
    tags: string[];
    sectorSlug?: string | null;
    file: string;
  }>;
}

export interface SectorMatch {
  slug: string;
  sectorSlug: string | null;
  score: number;
  displayName: VocabularyCategory["displayName"];
}
