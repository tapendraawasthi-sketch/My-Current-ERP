import {
  DEVANAGARI_CONSONANTS,
  DEVANAGARI_DIGITS,
  DEVANAGARI_MATRA,
  DEVANAGARI_VOWELS,
  NEPALI_DIGIT_MAP,
  PHRASE_ALIASES,
  SPELLING_ALIASES,
} from "./nepaliLanguage";

const SORTED_PHRASES = [...PHRASE_ALIASES].sort((a, b) => b[0].length - a[0].length);
const SORTED_WORDS = Object.entries(SPELLING_ALIASES).sort((a, b) => b[0].length - a[0].length);

/** Common khata words in Devanagari → roman (whole-word replace before char translit) */
const DEVANAGARI_WORDS: Record<string, string> = {
  उधार: "udhaar",
  उधारो: "udhaar",
  दिए: "diye",
  दियो: "diye",
  नगद: "nagad",
  बिक्री: "bikri",
  बेचेको: "becheko",
  खर्च: "kharcha",
  खर्चा: "kharcha",
  किनेको: "kineko",
  तिर्यो: "tiryo",
  जम्मा: "jama",
  आज: "aja",
  हिजो: "hijo",
  पर्सि: "parsi",
  रु: "rs",
  रूपैयाँ: "rs",
  लाई: "lai",
  ले: "le",
  राम: "ram",
  श्याम: "shyam",
  हजार: "hajar",
  दश: "das",
  तीन: "tin",
  पाँच: "panch",
  पांच: "panch",
  भयो: "vayo",
  ह्रास: "depreciation",
  ब्याज: "byaj",
  आम्दानी: "aamdani",
  सम्पत्ति: "sampatti",
  सम्पति: "sampati",
  ऋण: "rin",
  भुक्तान: "bhugtan",
  फिर्ता: "firta",
  कमिसन: "commission",
  भाडा: "bhaada",
};

function replaceDevanagariWords(text: string): string {
  let out = text;
  const sorted = Object.keys(DEVANAGARI_WORDS).sort((a, b) => b.length - a.length);
  for (const word of sorted) {
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

function foldSpelling(text: string): string {
  let value = text.toLowerCase();

  for (const [from, to] of SORTED_PHRASES) {
    value = value.split(from).join(to);
  }

  const tokens = value.split(/\s+/);
  const folded = tokens.map((token) => {
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
  text = foldSpelling(text);

  return text.replace(/\s+/g, " ").trim();
}

/** Tokens useful for debugging / future training */
export function tokenizeNepali(text: string): string[] {
  return normalizeNepaliText(text).split(/\s+/).filter(Boolean);
}
