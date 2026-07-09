/** SUTRA AI — Devanagari ↔ Roman transliteration engine */

import {
  DEVANAGARI_CONSONANTS,
  DEVANAGARI_MATRA,
  DEVANAGARI_VOWELS,
  NEPALI_DIGIT_MAP,
} from "@/lib/ekhata/nepaliLanguage";
import { foldRomanOrthoToken } from "@/lib/nepal-ai/orthography";
import { romanNepaliProcessor } from "./RomanNepaliProcessor";

const TRANSLITERATION_RULES = {
  vowels: {
    a: "अ", aa: "आ", i: "इ", ee: "ई", u: "उ", oo: "ऊ",
    e: "ए", ai: "ऐ", o: "ओ", au: "औ", ri: "ऋ",
  },
  maatra: {
    aa: "ा", i: "ि", ee: "ी", u: "ु", oo: "ू",
    e: "े", ai: "ै", o: "ो", au: "ौ", ri: "ृ",
  },
  conjuncts: {
    ksha: "क्ष", kshya: "क्ष", tra: "त्र", gya: "ज्ञ", shri: "श्री", sri: "श्री",
    chh: "छ", ch: "च",
  },
  numbers: {
    "0": "०", "1": "१", "2": "२", "3": "३", "4": "४",
    "5": "५", "6": "६", "7": "७", "8": "८", "9": "९",
  },
};

/** Known word → Devanagari mappings for common ERP terms */
const WORD_TO_DEVANAGARI: Record<string, string> = {
  kakro: "काक्रो",
  kaakro: "काक्रो",
  kakor: "काक्रो",
  tomatar: "टमाटर",
  aalu: "आलु",
  alu: "आलु",
  pyaj: "प्याज",
  tarkari: "तरकारी",
  maile: "मैले",
  bechye: "बेचें",
  becheko: "बेचेको",
  kinyo: "किनें",
  kineko: "किनेको",
  udhaar: "उधार",
  nagad: "नगद",
  bikri: "बिक्री",
  kharid: "खरिद",
  paisa: "पैसा",
  rupiya: "रुपैयाँ",
  ko: "को",
  le: "ले",
  lai: "लाई",
};

export class Transliterator {
  /** Convert Latin digits to Devanagari digits */
  toDevanagariDigits(text: string): string {
    return text.replace(/\d/g, (d) => TRANSLITERATION_RULES.numbers[d] ?? d);
  }

  /** Convert Devanagari digits to Latin */
  toLatinDigits(text: string): string {
    return text.replace(/[०-९]/g, (d) => NEPALI_DIGIT_MAP[d] ?? d);
  }

  /** Roman word → Devanagari using lexicon + phonetic rules */
  romanToDevanagari(roman: string): string {
    const normalized = romanNepaliProcessor.normalize(roman);
    const tokens = normalized.toLowerCase().split(/\s+/);
    const results: string[] = [];

    for (const token of tokens) {
      const folded = foldRomanOrthoToken(token);
      if (WORD_TO_DEVANAGARI[folded]) {
        results.push(WORD_TO_DEVANAGARI[folded]);
        continue;
      }
      if (/^\d+$/.test(token)) {
        results.push(this.toDevanagariDigits(token));
        continue;
      }
      results.push(this.phoneticRomanToDevanagari(folded));
    }

    return results.join(" ");
  }

  /** Phonetic roman syllable → Devanagari (best-effort) */
  private phoneticRomanToDevanagari(roman: string): string {
    let out = "";
    let i = 0;
    const lower = roman.toLowerCase();

    while (i < lower.length) {
      let matched = false;

      for (const len of [4, 3, 2]) {
        const chunk = lower.slice(i, i + len);
        if (TRANSLITERATION_RULES.conjuncts[chunk as keyof typeof TRANSLITERATION_RULES.conjuncts]) {
          out += TRANSLITERATION_RULES.conjuncts[chunk as keyof typeof TRANSLITERATION_RULES.conjuncts];
          i += len;
          matched = true;
          break;
        }
        if (DEVANAGARI_CONSONANTS[chunk]) {
          out += this.consonantWithImplicitA(chunk);
          i += len;
          matched = true;
          break;
        }
        if (DEVANAGARI_VOWELS[chunk]) {
          out += DEVANAGARI_VOWELS[chunk];
          i += len;
          matched = true;
          break;
        }
      }

      if (!matched) {
        out += lower[i];
        i += 1;
      }
    }

    return out;
  }

  private consonantWithImplicitA(consonantKey: string): string {
    const devaConsonant = Object.entries(DEVANAGARI_CONSONANTS).find(
      ([, v]) => v === consonantKey,
    );
    return devaConsonant ? devaConsonant[0] : consonantKey;
  }

  /** Devanagari → roman using existing e-Khata transliteration */
  devanagariToRoman(text: string): string {
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
        const matra = text[i];
        if (matra && DEVANAGARI_MATRA[matra]) {
          out = out.slice(0, -1) + DEVANAGARI_CONSONANTS[two].slice(0, -1) + DEVANAGARI_MATRA[matra];
          i += 1;
        }
        continue;
      }

      if (DEVANAGARI_VOWELS[ch]) {
        out += DEVANAGARI_VOWELS[ch];
        i += 1;
        continue;
      }

      if (ch === "्") {
        i += 1;
        continue;
      }

      out += ch === " " ? " " : ch;
      i += 1;
    }

    return out.replace(/\s+/g, " ").trim();
  }

  /** Smart transliteration with context awareness */
  smartTransliterate(text: string, targetScript: "devanagari" | "roman"): string {
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    if (targetScript === "devanagari") {
      return hasDevanagari ? text : this.romanToDevanagari(text);
    }
    return hasDevanagari ? this.devanagariToRoman(text) : romanNepaliProcessor.normalize(text);
  }
}

export const transliterator = new Transliterator();
