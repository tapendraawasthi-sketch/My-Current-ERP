import {
  DEVANAGARI_CONSONANTS,
  DEVANAGARI_DIGITS,
  DEVANAGARI_MATRA,
  DEVANAGARI_VOWELS,
  NEPALI_DIGIT_MAP,
  PHRASE_ALIASES,
  SPELLING_ALIASES,
} from "./nepaliLanguage";
import { getMergedSpellingAliases } from "./vocabulary";
import { expandVerbAliases } from "../nepal-ai/verbNormalize";
import { TYPO_ALIASES } from "../nepal-ai/generated/runtimeMaps";
import { replaceDevanagariLexicon } from "../nepal-ai/orthography";

const SORTED_PHRASES = [...PHRASE_ALIASES].sort((a, b) => b[0].length - a[0].length);
const SORTED_WORDS = Object.entries({ ...SPELLING_ALIASES, ...getMergedSpellingAliases() }).sort(
  (a, b) => b[0].length - a[0].length,
);

/** Extra khata Devanagari → roman not always in the orthography lexicon */
const DEVANAGARI_WORDS: Record<string, string> = {
  उधार: "udhaar",
  उधारो: "udhaar",
  दिए: "diye",
  नगद: "nagad",
  बेचेको: "becheko",
  खर्चा: "kharcha",
  किनेको: "kineko",
  तिर्यो: "tiryo",
  आज: "aja",
  हिजो: "hijo",
  पर्सि: "parsi",
  रु: "rs",
  रूपैयाँ: "rs",
  लाई: "lai",
  ले: "le",
  राम: "ram",
  श्याम: "shyam",
  ह्रास: "depreciation",
  आम्दानी: "aamdani",
  सम्पत्ति: "sampatti",
  सम्पति: "sampati",
  भुक्तान: "bhugtan",
  फिर्ता: "firta",
  कमिसन: "commission",
  भाडा: "bhaada",
};

function replaceDevanagariWords(text: string): string {
  // Orthography lexicon first (phrases like "मूल्य अभिवृद्धि कर")
  let out = replaceDevanagariLexicon(text);
  const sorted = Object.keys(DEVANAGARI_WORDS).sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (!out.includes(word)) continue;
    out = out.split(word).join(` ${DEVANAGARI_WORDS[word]} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Rough Devanagari → roman for inline Nepali script in chat messages */
export function transliterateDevanagari(text: string): string {
  text = replaceDevanagariWords(text);
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const two = text.slice(i, i + 2);

    if (NEPALI_DIGIT_MAP[ch]) {
      out += NEPALI_DIGIT_MAP[ch];
      i += 1;
      continue;
    }

    if (DEVANAGARI_CONSONANTS[two]) {
      out += DEVANAGARI_CONSONANTS[two];
      i += 2;
      continue;
    }

    if (DEVANAGARI_CONSONANTS[ch]) {
      let roman = DEVANAGARI_CONSONANTS[ch];
      const next = text[i + 1];
      if (next && DEVANAGARI_MATRA[next]) {
        roman = roman.replace(/a$/, "") + DEVANAGARI_MATRA[next];
        i += 2;
      } else if (next === "्") {
        roman = roman.replace(/a$/, "");
        i += 2;
      } else {
        i += 1;
      }
      out += `${roman} `;
      continue;
    }

    if (DEVANAGARI_VOWELS[ch]) {
      out += `${DEVANAGARI_VOWELS[ch]} `;
      i += 1;
      continue;
    }

    if (ch === "्" || ch === "ं" || ch === "ः") {
      i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.replace(/\s+/g, " ").trim();
}

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

function foldDigits(text: string): string {
  return text.replace(/[०-९]/g, (ch) => NEPALI_DIGIT_MAP[ch] ?? ch);
}

/** English-dominant messages keep work verbs (sold/bought/received) for semantic NLU. */
const ENGLISH_PRESERVE =
  /\b(sold|bought|purchase|purchased|received|paid|payment|expense|salary|each|worth|from|for|today|yesterday|the|a|an)\b/i;

const ENGLISH_VERB_ALIASES = new Set([
  "sold",
  "sale",
  "sales",
  "bought",
  "buy",
  "purchase",
  "purchased",
  "received",
  "receive",
  "paid",
  "pay",
  "payment",
  "expense",
  "expenses",
  "spent",
  "spend",
  "earning",
  "earned",
  "revenue",
  "procured",
  "procure",
]);

const SORTED_TYPO = Object.entries(TYPO_ALIASES).sort((a, b) => b[0].length - a[0].length);

/** Multi-word typo keys (e.g. "ki ho" → "ke ho") — applied before token fold. */
const SORTED_TYPO_PHRASES = SORTED_TYPO.filter(([from]) => from.includes(" "));

function foldSpelling(text: string): string {
  let value = text.toLowerCase();
  const preserveEnglish = ENGLISH_PRESERVE.test(text);

  for (const [from, to] of SORTED_PHRASES) {
    value = value.split(from).join(to);
  }

  // Phrase-level spelling corrections from Nepal AI typo lexicon
  for (const [from, to] of SORTED_TYPO_PHRASES) {
    if (!from) continue;
    if (value === from) {
      value = to;
      continue;
    }
    value = value.split(` ${from} `).join(` ${to} `);
    if (value.startsWith(`${from} `)) value = `${to} ${value.slice(from.length + 1)}`;
    if (value.endsWith(` ${from}`)) value = `${value.slice(0, -(from.length + 1))} ${to}`;
  }

  const tokens = value.split(/\s+/);
  const folded = tokens.map((token) => {
    if (preserveEnglish && ENGLISH_VERB_ALIASES.has(token)) return token;
    for (const [from, to] of SORTED_TYPO) {
      if (from.includes(" ")) continue; // already handled as phrases
      if (token === from) return to;
    }
    for (const [from, to] of SORTED_WORDS) {
      if (token === from) return to;
    }
    return token;
  });

  return folded.join(" ");
}

/**
 * Full normalization pipeline: Devanagari → roman, digits, spelling variants.
 * Output is what the khata NLU parser should read.
 */
export function normalizeNepaliText(raw: string): string {
  let text = raw.normalize("NFKC").trim();
  if (!text) return "";

  if (hasDevanagari(text)) {
    text = transliterateDevanagari(text);
  }

  text = foldDigits(text);
  text = text.replace(/[^\w\s.\u0900-\u097F₨]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  // Spelling corrections BEFORE verb lemma expand (typos like kineyo→kineko, xaina→chaina)
  text = foldSpelling(text);
  text = expandVerbAliases(text);

  return text.replace(/\s+/g, " ").trim();
}

/** Tokens useful for debugging / future training */
export function tokenizeNepali(text: string): string[] {
  return normalizeNepaliText(text).split(/\s+/).filter(Boolean);
}
