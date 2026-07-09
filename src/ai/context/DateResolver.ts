/** SUTRA AI — resolve Nepali/English date references to ISO dates */

export type DateRefKey = "today" | "yesterday" | "day_before" | "tomorrow";

export interface ResolvedDate {
  key: DateRefKey;
  iso: string;
  labelNepali: string;
  labelEnglish: string;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DATE_PATTERNS: Array<{ key: DateRefKey; re: RegExp; iso: () => string; nepali: string; english: string }> = [
  { key: "today", re: /\b(aaja|aja|today)\b/i, iso: () => isoDaysAgo(0), nepali: "आज", english: "Today" },
  { key: "yesterday", re: /\b(hijo|yesterday)\b/i, iso: () => isoDaysAgo(1), nepali: "हिजो", english: "Yesterday" },
  { key: "day_before", re: /\b(ati\s*hijo|day\s+before)\b/i, iso: () => isoDaysAgo(2), nepali: "अति हिजो", english: "Day before yesterday" },
  { key: "tomorrow", re: /\b(parsi|bholi|tomorrow)\b/i, iso: () => isoDaysAhead(1), nepali: "पर्सि", english: "Tomorrow" },
];

export class DateResolver {
  detect(text: string, dateRef?: string): ResolvedDate | null {
    if (dateRef === "today") return this.byKey("today");
    if (dateRef === "yesterday") return this.byKey("yesterday");
    if (dateRef === "day_before") return this.byKey("day_before");

    for (const p of DATE_PATTERNS) {
      if (p.re.test(text)) {
        return { key: p.key, iso: p.iso(), labelNepali: p.nepali, labelEnglish: p.english };
      }
    }
    return null;
  }

  byKey(key: DateRefKey): ResolvedDate {
    const p = DATE_PATTERNS.find((x) => x.key === key)!;
    return { key, iso: p.iso(), labelNepali: p.nepali, labelEnglish: p.english };
  }

  isComparisonQuery(text: string): boolean {
    return (
      /\b(vs|versus|compare|tulana|bhanda)\b/i.test(text) &&
      (/\b(aaja|hijo|today|yesterday|week|mahina)\b/i.test(text) ||
        /\b\d{4}-\d{2}-\d{2}\b/.test(text))
    );
  }
}

export const dateResolver = new DateResolver();
