/** SUTRA AI — cross-language translation engine (Sprint 4 enhanced) */

import type { ExtractedEntities, LanguageCode, ParallelTranslation, TransactionEntity } from "../types";
import { languageDetector } from "./LanguageDetector";
import { nepaliProcessor } from "./NepaliProcessor";
import { transliterator } from "./Transliterator";
import { romanNepaliProcessor } from "./RomanNepaliProcessor";
import accountingTerms from "@/data/erp/accounting-terms.json";
import phraseData from "@/data/nepali/phrase-translations.json";

type PhraseEntry = { roman: string; nepali: string; english: string };
type WordEntry = { nepali: string; english: string };

const PHRASES = (phraseData.phrases as PhraseEntry[]).sort(
  (a, b) => b.roman.length - a.roman.length,
);
const WORDS = phraseData.words as Record<string, WordEntry>;
const TEMPLATES = phraseData.templates as Record<
  string,
  { english: string; nepali: string; roman: string }
>;

const NEPALI_DIGIT_MAP: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

export class TranslationEngine {
  detectSource(text: string, override?: LanguageCode | "auto"): LanguageCode {
    if (override && override !== "auto") return override;
    return languageDetector.detect(text).detected;
  }

  translate(text: string, source: LanguageCode, target: LanguageCode): string {
    if (source === target) return text;
    return this.translateAll(text, source)[target];
  }

  translateAll(text: string, source?: LanguageCode): ParallelTranslation {
    const sourceLanguage = source ?? this.detectSource(text);
    const canonical = this.toRomanCanonical(text, sourceLanguage);

    return {
      english: this.buildEnglish(canonical, text, sourceLanguage),
      nepali: this.buildNepali(canonical, text, sourceLanguage),
      roman: canonical,
      sourceLanguage,
    };
  }

  formatTransaction(
    transaction: TransactionEntity,
    outputLanguage?: LanguageCode,
  ): ParallelTranslation & { primary: string } {
    const templateKey =
      transaction.party && transaction.type === "sales"
        ? "credit_sale"
        : transaction.quantity
          ? "sales_qty"
          : transaction.type === "purchase"
            ? "purchase_understood"
            : "sales_understood";

    const template = TEMPLATES[templateKey] ?? TEMPLATES.sales_understood;
    const vars = {
      product: transaction.product ?? "item",
      productNepali:
        transaction.productNepali ??
        transliterator.romanToDevanagari(transaction.product ?? ""),
      amount: String(transaction.amount ?? ""),
      quantity: String(transaction.quantity ?? ""),
      unit: transaction.unit ?? "",
      party: transaction.party ?? "",
    };

    const result: ParallelTranslation = {
      english: this.fillTemplate(template.english, vars),
      nepali: this.fillTemplate(template.nepali, vars),
      roman: this.fillTemplate(template.roman, vars),
      sourceLanguage: "roman",
      targetLanguage: outputLanguage,
    };

    return { ...result, primary: outputLanguage ? result[outputLanguage] : result.nepali };
  }

  formatFromEntities(
    entities: ExtractedEntities,
    outputLanguage: LanguageCode,
  ): ParallelTranslation & { primary: string } {
    return this.formatTransaction(
      {
        type: entities.transactionType,
        product: entities.productEnglish ?? entities.product,
        productNepali: entities.productNepali,
        amount: entities.amount,
        quantity: entities.quantity,
        unit: entities.unit,
        party: entities.party,
      },
      outputLanguage,
    );
  }

  private toRomanCanonical(text: string, source: LanguageCode): string {
    if (source === "roman") return romanNepaliProcessor.normalize(text);
    if (source === "nepali") return transliterator.devanagariToRoman(text);
    return this.englishToRoman(text);
  }

  private buildEnglish(canonical: string, original: string, source: LanguageCode): string {
    if (source === "english") return original.trim();
    let out = this.applyPhrases(canonical, "english");
    out = this.applyWords(out, "english");
    return this.postProcessEnglish(out);
  }

  private buildNepali(canonical: string, original: string, source: LanguageCode): string {
    if (source === "nepali" && /[\u0900-\u097F]/.test(original)) return original.trim();
    let out = this.applyPhrases(canonical, "nepali");
    out = this.applyWords(out, "nepali");
    if (!/[\u0900-\u097F]/.test(out)) {
      out = transliterator.romanToDevanagari(out);
    }
    return this.formatNepaliDigits(out);
  }

  private applyPhrases(text: string, target: "english" | "nepali"): string {
    let out = text.toLowerCase();
    for (const phrase of PHRASES) {
      const re = new RegExp(phrase.roman.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      if (re.test(out)) {
        out = out.replace(re, target === "english" ? phrase.english : phrase.nepali);
      }
    }
    return out;
  }

  private applyWords(text: string, target: "english" | "nepali"): string {
    return text
      .split(/\s+/)
      .map((token) => {
        const clean = token.replace(/[^a-zA-Z\u0900-\u097F0-9]/g, "");
        const punct = token.slice(clean.length);
        const prefix = token.slice(0, token.length - clean.length - punct.length);

        if (/^\d+$/.test(clean)) return token;

        const word = WORDS[clean.toLowerCase()];
        if (word) {
          return prefix + (target === "english" ? word.english : word.nepali) + punct;
        }

        const gloss = nepaliProcessor.toEnglish(clean);
        if (gloss && target === "english") return prefix + gloss + punct;

        const acct = this.matchAccountingTerm(clean);
        if (acct && target === "english") return prefix + acct + punct;

        if (target === "nepali" && /^[a-z]+$/i.test(clean)) {
          return prefix + transliterator.romanToDevanagari(clean) + punct;
        }

        return token;
      })
      .join(" ");
  }

  private englishToRoman(text: string): string {
    const reverseWords: Record<string, string> = {};
    for (const [roman, entry] of Object.entries(WORDS)) {
      reverseWords[entry.english.toLowerCase()] = roman;
    }
    return text
      .toLowerCase()
      .split(/\s+/)
      .map((w) => reverseWords[w.replace(/[^a-z]/g, "")] ?? w)
      .join(" ");
  }

  private postProcessEnglish(text: string): string {
    return text
      .replace(/\b(\d+)\s+ko\b/gi, "worth Rs. $1")
      .replace(/\b(\d+)\s+को\b/g, "worth Rs. $1")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
  }

  private formatNepaliDigits(text: string): string {
    return text.replace(/\d/g, (d) => {
      const deva = Object.entries(NEPALI_DIGIT_MAP).find(([, v]) => v === d);
      return deva ? deva[0] : d;
    });
  }

  private matchAccountingTerm(token: string): string | null {
    const terms = accountingTerms.terms as Record<string, {
      nepali: string[];
      roman: string[];
      english: string;
    }>;
    const lower = token.toLowerCase();
    for (const [, entry] of Object.entries(terms)) {
      if (
        entry.english.toLowerCase() === lower ||
        entry.roman.some((r) => r.toLowerCase() === lower) ||
        entry.nepali.some((n) => n === token)
      ) {
        return entry.english;
      }
    }
    return null;
  }

  private fillTemplate(template: string, vars: Record<string, string>): string {
    let out = template;
    for (const [key, val] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${key}\\}`, "g"), val);
    }
    return out.replace(/\s+/g, " ").trim();
  }
}

export const translationEngine = new TranslationEngine();
