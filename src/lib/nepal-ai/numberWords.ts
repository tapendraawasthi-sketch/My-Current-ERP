/**
 * Nepal Universal AI — Nepali/Hindi/English amount word parser.
 * Longest-phrase match first, then token composition via NUMBER_WORD_VALUES.
 */

import {
  NUMBER_WORD_PHRASES,
  NUMBER_WORD_VALUES,
} from "./generated/runtimeMaps";

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

export function normalizeAmountText(text: string): string {
  return normalizeDigits(text)
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/[₹₨]/g, " rs ")
    .replace(/\brs\.?/g, " rs ")
    .replace(/\bnpr\b/g, " npr ")
    .replace(/\s+/g, " ")
    .trim();
}

type PhraseHit = { value: number; matched: string; start: number; end: number };

/** Build searchable phrase forms sorted longest-first. */
const PHRASE_FORMS: { form: string; value: number }[] = (() => {
  const out: { form: string; value: number }[] = [];
  for (const p of NUMBER_WORD_PHRASES) {
    const forms = [p.text, ...p.variants].map((f) => normalizeAmountText(String(f)));
    for (const form of forms) {
      if (!form) continue;
      // Skip bare 1-digit arabic alone — too noisy as phrase
      if (/^\d$/.test(form)) continue;
      out.push({ form, value: p.numericValue });
    }
  }
  out.sort((a, b) => b.form.length - a.form.length);
  return out;
})();

function findLongestPhrase(haystack: string): PhraseHit | null {
  const t = normalizeAmountText(haystack);
  if (!t) return null;

  for (const { form, value } of PHRASE_FORMS) {
    if (t === form) {
      return { value, matched: form, start: 0, end: t.length };
    }
    // Word-boundary-ish: spaces around, or start/end
    const idx = t.indexOf(form);
    if (idx < 0) continue;
    const before = idx === 0 ? " " : t[idx - 1];
    const after = idx + form.length >= t.length ? " " : t[idx + form.length];
    const boundaryOk =
      /[\s]/.test(before) || idx === 0
        ? /[\s]/.test(after) || idx + form.length === t.length
        : false;
    // Allow currency-ish adjacency: "rs500" already spaced; also "5k"
    const edgeOk =
      (idx === 0 || /[\s]/.test(before) || /[^\w]/.test(before)) &&
      (idx + form.length === t.length || /[\s]/.test(after) || /[^\w]/.test(after));
    if (boundaryOk || edgeOk) {
      // Prefer phrase that covers a large share of the string when embedded in sentence
      const coverage = form.length / t.length;
      if (coverage >= 0.25 || t.length <= form.length + 12) {
        return { value, matched: form, start: idx, end: idx + form.length };
      }
    }
  }
  return null;
}

function parseSuffixShortcuts(text: string): number | null {
  const t = normalizeAmountText(text);

  const cr = t.match(/\b(\d+(?:\.\d+)?)\s*(?:cr|crore)\b/i);
  if (cr) return Math.round(parseFloat(cr[1]) * 10_000_000);

  const lakh = t.match(/\b(\d+(?:\.\d+)?)\s*(?:l|lakh|lac)\b/i);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100_000);

  const k = t.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(parseFloat(k[1]) * 1000);

  const npr = t.match(/\b(?:rs|npr|rupiya|rupees?)\s*(\d+(?:\.\d+)?)\b/i);
  if (npr) return Math.round(parseFloat(npr[1]));

  const nprAfter = t.match(/\b(\d+(?:\.\d+)?)\s*(?:rs|npr|rupiya|rupees?)\b/i);
  if (nprAfter) return Math.round(parseFloat(nprAfter[1]));

  return null;
}

/**
 * Compose amount from number-word tokens (ek hajar paanch saya).
 * Multipliers >= 100 fold the current buffer like Indian numbering.
 */
export function parseAmountFromTokens(text: string): number | null {
  const t = normalizeAmountText(text);
  if (!t) return null;

  const tokens = t.split(/[\s]+/).filter(Boolean);
  let total = 0;
  let current = 0;
  let found = false;

  for (const raw of tokens) {
    // strip currency words
    if (/^(rs|npr|rupiya|rupees?|rupees)$/i.test(raw)) continue;

    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      current = parseFloat(raw);
      found = true;
      continue;
    }

    const val = NUMBER_WORD_VALUES[raw];
    if (val == null) continue;

    found = true;
    if (val >= 100) {
      current = (current || 1) * val;
      total += current;
      current = 0;
    } else if (val > 0 && val < 1) {
      // fractions like aadha rarely alone as amount; treat as current
      current = current ? current * val : val;
    } else if (val > 1 && val < 10 && Number.isInteger(val) === false) {
      // dedh/dhai style applied to following unit handled by phrase matcher preferably
      current = val;
    } else {
      current += val;
    }
  }

  if (current) total += current;
  if (!found || total <= 0) return null;
  return Math.round(total * 100) / 100 === Math.round(total)
    ? Math.round(total)
    : Math.round(total * 100) / 100;
}

/**
 * Extract a Nepali/English spoken or typed amount from free text.
 */
export function parseNepaliAmount(text: string): number | null {
  const t = normalizeAmountText(text);
  if (!t) return null;

  // 1) Exact / longest phrase lexicon (covers fractions & compounds)
  const phrase = findLongestPhrase(t);
  if (phrase && phrase.matched.length >= 2) {
    // If the whole message is basically the phrase (+ currency fluff), trust it
    const stripped = t
      .replace(phrase.matched, " ")
      .replace(/\b(rs|npr|rupiya|rupees?)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!stripped || stripped.length <= 3) {
      const v = phrase.value;
      return Number.isInteger(v) ? Math.round(v) : Math.round(v * 100) / 100;
    }
    // Otherwise still use phrase if it's a strong amount compound
    if (
      /\b(hajar|lakh|crore|saya|k|cr)\b/i.test(phrase.matched) ||
      /\d/.test(phrase.matched) ||
      phrase.matched.includes(" ")
    ) {
      const v = phrase.value;
      return Number.isInteger(v) ? Math.round(v) : Math.round(v * 100) / 100;
    }
  }

  // 2) Modern shortcuts 5k / 2.5L / 1Cr / Rs 500
  const shortcut = parseSuffixShortcuts(t);
  if (shortcut != null) return shortcut;

  // 3) Token composition
  const composed = parseAmountFromTokens(t);
  if (composed != null) return composed;

  // 4) Bare digits
  const digit = t.match(/\b(\d+(?:\.\d+)?)\b/);
  if (digit) return Math.round(parseFloat(digit[1]));

  return null;
}

export function lookupNumberWord(token: string): number | null {
  const v = NUMBER_WORD_VALUES[token.toLowerCase().trim()];
  return v == null ? null : v;
}

/** Merge into legacy WORD_TO_NUMBER tables */
export function getExpandedWordToNumber(): Record<string, number> {
  return { ...NUMBER_WORD_VALUES };
}
