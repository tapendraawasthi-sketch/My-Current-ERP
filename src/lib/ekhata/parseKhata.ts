import type { KhataConfirmationCard, KhataIntent, KhataParseResult } from "./types";
import { WORD_TO_NUMBER } from "./nepaliLanguage";
import { normalizeNepaliText } from "./normalizeNepali";

const CLARIFYING_QUESTION = "Aaple diye ki unle diye?";

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

const PARTY_STOPWORDS = new Set([
  "cash",
  "nagad",
  "nakad",
  "nakit",
  "udhaar",
  "udhar",
  "udharo",
  "credit",
  "payment",
  "purchase",
  "kharcha",
  "expense",
  "aja",
  "aaja",
  "hijo",
  "parsi",
  "sold",
  "for",
  "tea",
  "saya",
  "hajar",
  "lakh",
  "rs",
  "npr",
  "rupees",
  "bikri",
  "vayo",
  "bhayo",
  "ko",
]);

const FILLER_WORDS = new Set([
  "le",
  "lai",
  "ma",
  "ko",
  "ki",
  "ho",
  "cha",
  "gareko",
  "garne",
  "bhayo",
]);

function normalizeUnicodeDigits(text: string): string {
  return text.replace(/[०-९]/g, (ch) => NEPALI_DIGIT_MAP[ch] ?? ch);
}

function normalize(text: string): string {
  let value = normalizeUnicodeDigits(text).toLowerCase().trim();
  value = value.replace(/[^\w\s.\u0900-\u097F]/g, " ");
  value = value.replace(/\s+/g, " ").trim();
  return value
    .split(" ")
    .filter((token) => !FILLER_WORDS.has(token))
    .join(" ");
}

function parseAmountWords(text: string): number | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const kMatch = normalized.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

  const digitMatch = normalized.match(/\b(\d+(?:\.\d+)?)\b/);
  if (digitMatch && !/\b(hajar|saya|lakh)\b/.test(normalized)) {
    return Math.round(parseFloat(digitMatch[1]));
  }

  const tokens = normalized.split(" ");
  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      current = parseInt(token, 10);
      found = true;
      continue;
    }
    if (token in WORD_TO_NUMBER) {
      found = true;
      const multiplier = WORD_TO_NUMBER[token];
      if (multiplier >= 100) {
        current = (current || 1) * multiplier;
        total += current;
        current = 0;
      } else {
        current += multiplier;
      }
    }
  }

  if (current) total += current;
  return found ? total : null;
}

function extractParty(text: string): string | null {
  const soft = normalizeUnicodeDigits(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0900-\u097F.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!soft) return null;

  const laiMatch = soft.match(/\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,30}?)\s+(?:lai|le)\b/i);
  if (laiMatch) {
    const partyTokens = laiMatch[1]
      .trim()
      .split(" ")
      .filter((token) => !PARTY_STOPWORDS.has(token.toLowerCase()));
    if (partyTokens.length) {
      return partyTokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(" ");
    }
  }

  const capitalized = text.match(/\b([A-Z][a-z]{1,30})\b/g) ?? [];
  for (const name of capitalized) {
    if (!PARTY_STOPWORDS.has(name.toLowerCase())) return name;
  }

  return null;
}

function extractItem(text: string, intent: KhataIntent | null): string | null {
  const soft = normalize(text);
  if (!soft) return null;

  if (intent === "khata_purchase") {
    const m1 = soft.match(/\b(\w+)\s+kineko\b/);
    if (m1 && !PARTY_STOPWORDS.has(m1[1])) return m1[1];
    const m2 = soft.match(/\bpurchase\s+(\w+)\b/);
    if (m2) return m2[1];
  }

  if (intent === "khata_cash_sale" || intent === "khata_credit_sale") {
    const m1 = soft.match(/\b(\w+)\s+ko\s+(\w+)\s+becheko\b/);
    if (m1 && !PARTY_STOPWORDS.has(m2Group(m1, 2))) return m1[2];
    const m2 = soft.match(/\b(\w+)\s+becheko\b/);
    if (m2 && !PARTY_STOPWORDS.has(m2[1]) && !["cash", "ma", "nagad"].includes(m2[1])) return m2[1];
    const m3 = soft.match(/\b(\w+)\s+ko\s+(\w+)\s+bikri\b/);
    if (m3 && !PARTY_STOPWORDS.has(m2Group(m3, 2))) return m3[2];
    const m4 = soft.match(/\bsold\s+(\w+)\s+for\b/i);
    if (m4 && !PARTY_STOPWORDS.has(m4[1].toLowerCase())) return m4[1];
  }

  if (intent === "khata_expense") {
    const m1 = soft.match(/\b([a-zA-Z]+)\s+kharcha\b/);
    if (m1) return m1[1];
    const m2 = soft.match(/\bkharcha\s+([a-zA-Z]+)\b/);
    if (m2) return m2[1];
  }

  return null;
}

function m2Group(match: RegExpMatchArray, index: number): string {
  return match[index] ?? "";
}

function extractDate(text: string): string {
  const raw = normalizeUnicodeDigits(text).toLowerCase();
  const today = new Date();
  if (/\bhijo\b/.test(raw)) {
    today.setDate(today.getDate() - 1);
  } else if (/\bparsi\b/.test(raw)) {
    today.setDate(today.getDate() + 1);
  }
  return today.toISOString().slice(0, 10);
}

function hasCashSaleCue(text: string): boolean {
  return (
    /\b(cash|nakit|nagad|nakad)\b/i.test(text) &&
    /\b(bikri|becheko|beche|bik|sale|sold)\b/i.test(text)
  );
}

function hasCreditSaleCue(text: string): boolean {
  return (
    /\b(udhaar|udharo|udhar|credit|उधार)\b/i.test(text) ||
    (/\b(diye|die|diya|diae|दिए)\b/i.test(text) && /\b(lai|le)\b/i.test(text))
  );
}

function hasPaymentInCue(text: string): boolean {
  return /\b(tiryo|tireko|tira|tire|received|aayo|aayeko|aaye|payment\s+received|paisa\s+aayo|jama|jama\s+gareko|payo|paye)\b/i.test(
    text,
  );
}

function hasPurchaseCue(text: string): boolean {
  return /\b(kineko|kine|kiniyo|kinyo|kinna|kharid|kharido|purchase)\b/i.test(text);
}

function hasPaymentOutCue(text: string): boolean {
  return /\b(payment\s+gareko|payment\s+made|paisa\s+diye|tirna\s+diye|bhugtan|tiryo\s+diye)\b|\bpayment\b.*\bgareko\b/i.test(
    text,
  );
}

function hasExpenseCue(text: string): boolean {
  return /\b(kharcha|kharcho|expense|kharch)\b/i.test(text);
}

function needsPartyRoleClarification(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (
    /\b(udhaar|udharo|udhar|credit|tiryo|payment|kharcha|kharcho|kineko|kine|kiniyo|becheko|beche|bikri|cash|nagad|nakad|nakit|sold|purchase|kharid|vayo|bhayo)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/\b(lai|le)\b/.test(normalized)) return false;
  if (/^\s*(\d+|(?:\d+\s+)?(?:saya|hajar|lakh|\w+))\s+(diye|die|diya|diae)\s*$/i.test(normalized)) {
    return true;
  }
  if (/^\d+\s+diye$/i.test(normalized)) return true;
  return false;
}

function classifyIntent(text: string): KhataIntent | null {
  const q = text.trim();
  if (!q) return null;

  if (hasCreditSaleCue(q)) {
    return "khata_credit_sale";
  }
  if (hasPaymentInCue(q)) {
    return "khata_payment_in";
  }
  if (hasCashSaleCue(q)) {
    return "khata_cash_sale";
  }
  if (/\bko\s+nagad\s+bikri\b/i.test(q) || /\bnagad\s+bikri\s+(vayo|bhayo|vayeko|bhayeko)\b/i.test(q)) {
    return "khata_cash_sale";
  }
  if (/\b(bikri|becheko)\s+(vayo|bhayo|vayeko|bhayeko)\b/i.test(q) && /\b(nagad|nakad|cash|nakit)\b/i.test(q)) {
    return "khata_cash_sale";
  }
  if (hasPurchaseCue(q)) {
    return "khata_purchase";
  }
  if (hasPaymentOutCue(q)) {
    return "khata_payment_out";
  }
  if (hasExpenseCue(q)) {
    return "khata_expense";
  }

  if (/\b(diye|die|diya|diae)\b/i.test(q) && /\b(lai|le)\b/i.test(q)) {
    return "khata_credit_sale";
  }

  return null;
}

export function parseKhataMessage(rawText: string, preNormalized?: string): KhataParseResult {
  const text = (preNormalized ?? normalizeNepaliText(rawText)).trim();
  const displayText = rawText.trim();
  if (!text) {
    return { clarifying_question: "Ke transaction ho? Thora clear lekhnus." };
  }

  if (needsPartyRoleClarification(text)) {
    return { clarifying_question: CLARIFYING_QUESTION };
  }

  const intent = classifyIntent(text);
  if (!intent) {
    return { clarifying_question: "Ke transaction ho? Thora clear lekhnus." };
  }

  const amount = parseAmountWords(text);
  if (!amount || amount <= 0) {
    return { clarifying_question: "Rakam kati ho? Number lekhnus." };
  }

  const party = extractParty(displayText);
  const card: KhataConfirmationCard = {
    intent,
    party: party ?? null,
    amount,
    item: extractItem(text, intent),
    date: extractDate(text),
    raw_text: displayText,
  };

  return { card };
}
