/**
 * Nepal Universal AI — Bikram Sambat / relative date / fiscal-year phrase parser.
 * Lexicon-driven (BIKRAM_CALENDAR_PHRASES + TIME_DATE_MAP); converts to AD YYYY-MM-DD.
 */

import {
  BIKRAM_CALENDAR_PHRASES,
  TIME_DATE_MAP,
  type BikramCalendarPhrase,
} from "./generated/runtimeMaps";
import {
  bsToAD,
  getDaysInBSMonthFull,
  getFiscalYearDateRange,
  todayBS,
} from "../nepaliDate";

const NEPALI_DIGIT_MAP: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

function normalizeDigits(text: string): string {
  return text.replace(/[०-९]/g, (ch) => NEPALI_DIGIT_MAP[ch] ?? ch);
}

export function normalizeDateText(text: string): string {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/[^\w\u0900-\u097F/\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, offset: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + offset);
  return d;
}

function resolveBsDay(year: number, month: number, day: number | null | undefined): number {
  const last = getDaysInBSMonthFull(year, month);
  if (day == null || day < 1) return 1;
  return Math.min(day, last);
}

function tryBsToAdISO(year: number, month: number, day: number): string | null {
  try {
    return toLocalISO(bsToAD(year, month, day));
  } catch {
    const clamped = resolveBsDay(year, month, day);
    try {
      return toLocalISO(bsToAD(year, month, clamped));
    } catch {
      return null;
    }
  }
}

/** Infer BS year for a month relative to "today" in BS (prefer current year, else nearby). */
function inferBsYearForMonth(month: number, today = todayBS()): number {
  // If month is far ahead of current month, likely previous year reference; if behind, current.
  // For journal entries users usually mean the current/recent fiscal/calendar proximity.
  if (month === today.month) return today.year;
  // Prefer same year unless more than ~6 months away looking "ahead" from today
  const forward = (month - today.month + 12) % 12;
  const backward = (today.month - month + 12) % 12;
  if (backward <= forward) return today.year;
  // Looking forward into later months → same year if month >= today, else next year
  if (month >= today.month) return today.year;
  return today.year + 1;
}

type PhraseForm = {
  form: string;
  phrase: BikramCalendarPhrase;
};

const PHRASE_FORMS: PhraseForm[] = (() => {
  const out: PhraseForm[] = [];
  for (const p of BIKRAM_CALENDAR_PHRASES) {
    const forms = [p.text, ...p.variants].map((f) => normalizeDateText(String(f)));
    for (const form of forms) {
      if (!form) continue;
      out.push({ form, phrase: p });
    }
  }
  // Longest first so "ashadh masanta" / "shrawan 1" beat bare months
  out.sort((a, b) => b.form.length - a.form.length);
  return out;
})();

function findBestPhrase(haystack: string): PhraseForm | null {
  const t = normalizeDateText(haystack);
  if (!t) return null;
  for (const hit of PHRASE_FORMS) {
    const { form } = hit;
    if (t === form) return hit;
    const idx = t.indexOf(form);
    if (idx < 0) continue;
    const beforeOk = idx === 0 || /[\s\-/]/.test(t[idx - 1]!);
    const afterOk =
      idx + form.length === t.length || /[\s\-/]/.test(t[idx + form.length]!);
    if (beforeOk && afterOk) return hit;
  }
  return null;
}

/** Free-form "month day" e.g. "साउन १ गते", "asar 15" when not in phrase list. */
function matchOpenBsDate(text: string): { month: number; day: number } | null {
  const t = normalizeDateText(text);
  // Prefer multi-word month keys from TIME_DATE_MAP with monthNumber and no day
  const monthAliases = Object.entries(TIME_DATE_MAP)
    .filter(([, e]) => e.monthNumber != null && e.day == null)
    .map(([k, e]) => ({ form: normalizeDateText(k), month: e.monthNumber! }))
    .sort((a, b) => b.form.length - a.form.length);

  for (const { form, month } of monthAliases) {
    if (!form || form.length < 3) continue;
    // month + optional day + optional गते/gate
    const re = new RegExp(
      `(?:^|[\\s])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d{1,2})(?:\\s*(?:gate|gaten|गते))?\\b`,
      "i",
    );
    const m = t.match(re);
    if (m) {
      const day = parseInt(m[1]!, 10);
      if (day >= 1 && day <= 32) return { month, day };
    }
  }
  return null;
}

function extractFyLabel(text: string): string | null {
  const t = normalizeDateText(text);
  // Full FY 2080/81 or 2080-81
  let m = t.match(/\b(?:fy|aarthik\s+bar(?:sha|sa)|आर्थिक\s+बर्ष)?\s*(20\d{2})\s*[\/\-]\s*(\d{2,4})\b/);
  if (m) {
    const start = parseInt(m[1]!, 10);
    let endRaw = parseInt(m[2]!, 10);
    if (endRaw < 100) endRaw = Math.floor(start / 100) * 100 + endRaw;
    return `${start}/${String(endRaw).slice(-2)}`;
  }
  // Short FY 081-82
  m = t.match(/\b(?:fy|एफवाय)\s*0?(\d{2})\s*[\/\-]\s*0?(\d{2,3})\b/);
  if (m) {
    const start = 2000 + parseInt(m[1]!, 10);
    const endShort = parseInt(m[2]!, 10) % 100;
    return `${start}/${String(endShort).padStart(2, "0")}`;
  }
  return null;
}

function shiftCalendarMonth(base: Date, deltaMonths: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMonth(d.getMonth() + deltaMonths);
  return d;
}

function shiftCalendarYear(base: Date, deltaYears: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setFullYear(d.getFullYear() + deltaYears);
  return d;
}

export type ParsedNepaliDate = {
  /** AD calendar date YYYY-MM-DD (for journal/voucher dating) */
  isoDate: string;
  /** Optional end date for periods / FY (inclusive AD) */
  isoEndDate?: string;
  patternType: string;
  matched: string;
  monthNumber?: number | null;
  day?: number | null;
  fiscalLabel?: string;
};

/**
 * Resolve Nepali relative / BS month-day / FY phrase to AD ISO date(s).
 * Returns null when no calendar cue is found (caller may default to today).
 */
export function parseNepaliDate(text: string, now: Date = new Date()): ParsedNepaliDate | null {
  const t = normalizeDateText(text);
  if (!t) return null;

  // 1) Relative / dated phrases (longest match)
  const hit = findBestPhrase(t);
  if (hit) {
    const { phrase, form } = hit;
    const type = phrase.patternType;

    if (type === "relative_day" && phrase.relativeOffsetDays != null) {
      return {
        isoDate: toLocalISO(addDays(now, phrase.relativeOffsetDays)),
        patternType: type,
        matched: form,
      };
    }

    if (type === "relative_period") {
      const key = phrase.text;
      let d = now;
      if (key === "gata hapta") d = addDays(now, -7);
      else if (key === "aaune hapta") d = addDays(now, 7);
      else if (key === "gata mahina") d = shiftCalendarMonth(now, -1);
      else if (key === "aaune mahina") d = shiftCalendarMonth(now, 1);
      else if (key === "gata barsha") d = shiftCalendarYear(now, -1);
      else if (key === "aaune barsha") d = shiftCalendarYear(now, 1);
      else if (phrase.relativeOffsetDays != null) d = addDays(now, phrase.relativeOffsetDays);
      return { isoDate: toLocalISO(d), patternType: type, matched: form };
    }

    if (type === "fiscal_year" || /fiscal year|aarthik/i.test(phrase.fiscalSignificance)) {
      const label = extractFyLabel(form) || extractFyLabel(phrase.text) || extractFyLabel(t);
      if (label) {
        try {
          const range = getFiscalYearDateRange(label);
          return {
            isoDate: range.startDate,
            isoEndDate: range.endDate,
            patternType: "fiscal_year",
            matched: form,
            fiscalLabel: label,
          };
        } catch {
          /* fall through */
        }
      }
    }

    if (
      (type === "bs_date" || type === "bs_month" || type === "month_end" || type === "calendar") &&
      phrase.monthNumber != null
    ) {
      const today = todayBS();
      let year = inferBsYearForMonth(phrase.monthNumber, today);
      // For New Year / Baisakh 1 when we're already past mid-year, stay on calendar year logic
      let day: number;
      if (type === "month_end" || /masanta|end of/i.test(phrase.text + phrase.fiscalSignificance)) {
        day = getDaysInBSMonthFull(year, phrase.monthNumber);
      } else if (phrase.day != null) {
        day = resolveBsDay(year, phrase.monthNumber, phrase.day);
      } else {
        // Bare month → 1st of that month
        day = 1;
      }
      const iso = tryBsToAdISO(year, phrase.monthNumber, day);
      if (iso) {
        return {
          isoDate: iso,
          patternType: type,
          matched: form,
          monthNumber: phrase.monthNumber,
          day,
        };
      }
    }
  }

  // 2) Open BS date pattern
  const open = matchOpenBsDate(t);
  if (open) {
    const year = inferBsYearForMonth(open.month);
    const day = resolveBsDay(year, open.month, open.day);
    const iso = tryBsToAdISO(year, open.month, day);
    if (iso) {
      return {
        isoDate: iso,
        patternType: "bs_date",
        matched: `${open.month}/${open.day}`,
        monthNumber: open.month,
        day,
      };
    }
  }

  // 3) FY label anywhere
  const fy = extractFyLabel(t);
  if (fy) {
    try {
      const range = getFiscalYearDateRange(fy);
      return {
        isoDate: range.startDate,
        isoEndDate: range.endDate,
        patternType: "fiscal_year",
        matched: fy,
        fiscalLabel: fy,
      };
    } catch {
      /* ignore */
    }
  }

  // 4) Map-only relative keys (legacy time_date aliases like yesterday)
  for (const [key, entry] of Object.entries(TIME_DATE_MAP)) {
    const form = normalizeDateText(key);
    if (!form || form.length < 3) continue;
    if (entry.relativeOffsetDays == null) continue;
    const re = new RegExp(`(?:^|[\\s])${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[\\s])`);
    if (re.test(` ${t} `)) {
      return {
        isoDate: toLocalISO(addDays(now, entry.relativeOffsetDays)),
        patternType: entry.patternType || "relative_day",
        matched: form,
      };
    }
  }

  // English fallbacks
  if (/\byesterday\b/.test(t)) {
    return { isoDate: toLocalISO(addDays(now, -1)), patternType: "relative_day", matched: "yesterday" };
  }
  if (/\bday\s+before\s+yesterday\b/.test(t)) {
    return { isoDate: toLocalISO(addDays(now, -2)), patternType: "relative_day", matched: "day before yesterday" };
  }
  if (/\bday\s+after\s+tomorrow\b/.test(t)) {
    return { isoDate: toLocalISO(addDays(now, 2)), patternType: "relative_day", matched: "day after tomorrow" };
  }
  if (/\btomorrow\b/.test(t)) {
    return { isoDate: toLocalISO(addDays(now, 1)), patternType: "relative_day", matched: "tomorrow" };
  }
  if (/\btoday\b/.test(t)) {
    return { isoDate: toLocalISO(now), patternType: "relative_day", matched: "today" };
  }

  return null;
}

/** ISO date for journal extraction; defaults to today when no cue found. */
export function resolveJournalDate(text: string, now: Date = new Date()): string {
  return parseNepaliDate(text, now)?.isoDate ?? toLocalISO(now);
}
