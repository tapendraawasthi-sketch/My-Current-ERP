/**
 * e-Khata Semantic Nepali Brain — meaning-based NLU (not keyword tracking).
 *
 * Parses Nepali/Roman/English mixed text into semantic transaction frames using:
 * - Verb morphology (kinne → kinyo/kinye/kineko all = PURCHASE)
 * - Ergative case (maile/le = agent), dative (lai = recipient)
 * - Genitive price (50 rupaya ko bag = item priced at 50)
 * - Payment mode (udhaar = credit, nagad = cash)
 *
 * Self-contained — no API, no downloads, no external model.
 */

import type { KhataIntent } from "./types";
import { WORD_TO_NUMBER } from "./nepaliLanguage";

/** Semantic action — what happened in the transaction */
export type SemanticAction =
  | "PURCHASE"
  | "SALE"
  | "PAY_IN"
  | "PAY_OUT"
  | "EXPENSE"
  | "CREDIT_SALE"
  | "CREDIT_PURCHASE"
  | "SALARY"
  | "LOAN_IN"
  | "LOAN_OUT"
  | "DRAWINGS"
  | "CAPITAL"
  | "RETURN_SALE"
  | "RETURN_PURCHASE"
  | "UNKNOWN";

export type PaymentMode = "cash" | "credit" | "unknown";

export interface SemanticFrame {
  action: SemanticAction;
  agent: string | null;
  recipient: string | null;
  source: string | null;
  amount: number | null;
  item: string | null;
  paymentMode: PaymentMode;
  confidence: number;
  /** Raw verb lemma detected */
  verbLemma: string | null;
  isQuestion: boolean;
  isNegated: boolean;
}

/** Verb roots → all known surface forms (roman + devanagari translit variants) */
const VERB_MORPHOLOGY: Record<SemanticAction, string[]> = {
  PURCHASE: [
    "kin",
    "kinn",
    "kinne",
    "kinnu",
    "kina",
    "kinyo",
    "kinye",
    "kine",
    "kineko",
    "kiniyo",
    "kinna",
    "kinchhu",
    "kinxu",
    "kharid",
    "kharido",
    "kharidyo",
    "kharideko",
    "kharidne",
    "bought",
    "buy",
    "purchase",
    "purchased",
    "procured",
    "procure",
  ],
  SALE: [
    "bech",
    "bechne",
    "bechnu",
    "bechyo",
    "beche",
    "becheko",
    "bechiyeko",
    "bik",
    "bikri",
    "bikyo",
    "bikyayo",
    "bikne",
    "sold",
    "sell",
    "sale",
    "sales",
    "revenue",
    "income",
    "earned",
    "earning",
  ],
  PAY_IN: [
    "tir",
    "tirnu",
    "tiryo",
    "tireko",
    "tire",
    "tira",
    "tiryoo",
    "tirna",
    "jamayo",
    "jama",
    "aayo",
    "aayeko",
    "aaye",
    "payo",
    "paye",
    "received",
    "receive",
    "collected",
    "collection",
    "milyo",
    "paayo",
    "paaye",
    "paunu",
  ],
  PAY_OUT: [
    "payment gareko",
    "payment made",
    "paisa diye",
    "tirna diye",
    "bhugtan",
    "paid",
    "pay",
    "sent",
    "transferred",
    "transfer",
  ],
  EXPENSE: [
    "kharcha",
    "kharcho",
    "kharch",
    "expense",
    "expenses",
    "spent",
    "spend",
    "kharcha garyo",
    "kharcha gareko",
  ],
  CREDIT_SALE: [], // derived from diye + lai context
  CREDIT_PURCHASE: [], // derived from udhaar + purchase
  SALARY: ["salary", "salaries", "talab", "payroll", "wages", "tallab"],
  LOAN_IN: ["rin liyo", "loan received", "loan liyo", "rin liye"],
  LOAN_OUT: ["rin tiryo", "loan repay", "loan repayment", "rin tirna"],
  DRAWINGS: ["drawings", "nikasne", "nikasna", "withdraw", "withdrawal"],
  CAPITAL: ["capital introduced", "capital lagaayo", "puni lagaayo", "owner investment"],
  RETURN_SALE: [
    "sales return",
    "credit note",
    "saman firta",
    "firtayo",
    "firtaayo",
    "goods returned",
  ],
  RETURN_PURCHASE: ["purchase return", "debit note", "kharid firta", "supplier return"],
  UNKNOWN: [],
};

/** Build reverse lookup: surface form → action */
const SURFACE_TO_ACTION = new Map<string, SemanticAction>();
for (const [action, forms] of Object.entries(VERB_MORPHOLOGY) as [SemanticAction, string[]][]) {
  for (const form of forms) {
    SURFACE_TO_ACTION.set(form.toLowerCase(), action);
  }
}

/** Multi-word phrases checked before single tokens */
const PHRASE_ACTIONS: [RegExp, SemanticAction][] = [
  [/\b(loan\s*received|rin\s*liyo|rin\s*liye)\b/i, "LOAN_IN"],
  [/\b(loan\s*repay\w*|rin\s*tiryo|rin\s*tirna)\b/i, "LOAN_OUT"],
  [/\b(drawings|nikasne|owner\s*withdrawal)\b/i, "DRAWINGS"],
  [/\b(capital\s*intro|puni\s*lagaayo|owner\s*investment)\b/i, "CAPITAL"],
  [/\b(sales\s*return|credit\s*note|saman\s*firta|firtayo)\b/i, "RETURN_SALE"],
  [/\b(purchase\s*return|debit\s*note|kharid\s*firta)\b/i, "RETURN_PURCHASE"],
  [/\b(payment\s+gareko|payment\s+made|paisa\s+diye|tirna\s+diye|bhugtan)\b/i, "PAY_OUT"],
  [/\b(payment\s+received|paisa\s+aayo)\b/i, "PAY_IN"],
  [/\b(salary|talab|payroll|wages)\b/i, "SALARY"],
  [/\b(kharcha\s+gareko|kharcha\s+garyo|paid\s+for)\b/i, "EXPENSE"],
  [/\b(udhaar\s*ma\s*.*\b(kineko|kharid|kin)\b|\b(kineko|kharid)\s*udhaar)\b/i, "CREDIT_PURCHASE"],
  [/\b(udhaar\s*(diye|becheko|beche|bikri)|udharo\s*(diye|becheko))\b/i, "CREDIT_SALE"],
  [/\b(cash|nagad|nakad|nakit)\s*(ma\s*)?(bikri|becheko|beche|bik)\b/i, "SALE"],
  [/\b(bought|purchase|purchased|kharid|kineko|kinyo|kinye|kine)\b/i, "PURCHASE"],
  [/\b(sold|sale|becheko|beche|bikri|bik)\b/i, "SALE"],
  [/\b(tiryo|tireko|aayo|payo|received|jama)\b/i, "PAY_IN"],
  [/\b(kharcha|kharcho|expense|spent)\b/i, "EXPENSE"],
];

const CREDIT_MARKERS = /\b(udhaar|udhar|udharo|udaro|credit|karz|karja)\b/i;
const CASH_MARKERS = /\b(cash|nagad|nakad|nakit|nakat)\b/i;
const QUESTION_MARKERS = /\b(what|how|why|when|where|who|k\s*ho|ke\s*ho|kasari|kina|kati|kitna|\?)\b/i;
const NEGATION_MARKERS =
  /\b(xaina|chaina|chhaina|gardina|gardena|gareko\s*chaina|bhayena|vayena|hudaina|hoina|not|never|no\s+\w+\s+(yet|done))\b/i;

const CURRENCY_WORDS = new Set([
  "rs",
  "npr",
  "rupees",
  "rupee",
  "rupiya",
  "rupya",
  "rupaye",
  "rupiah",
  "rupaya",
  "rupaiya",
  "paisa",
  "₨",
]);

const AGENT_STOPWORDS = new Set([
  "ma",
  "maile",
  "mle",
  "timile",
  "tapai",
  "tapailai",
  "hamile",
  "hajurle",
  "malai",
  "aaja",
  "aja",
  "hijo",
  "parsi",
  "cash",
  "nagad",
  "nakad",
  "udhaar",
  "udhar",
  "ko",
  "le",
  "lai",
  "bata",
  "sanga",
  "ma",
  "the",
  "a",
  "an",
  "for",
  "of",
  "at",
  "to",
  "from",
  "with",
  "by",
]);

const ITEM_STOPWORDS = new Set([
  ...CURRENCY_WORDS,
  "ko",
  "le",
  "lai",
  "ma",
  "ka",
  "ki",
  "ke",
  "ra",
  "bata",
  "sanga",
  "for",
  "at",
  "the",
  "a",
  "an",
  "worth",
  "total",
  "amount",
  "each",
  "per",
  "only",
  "today",
  "yesterday",
  "tomorrow",
  "aja",
  "hijo",
  "parsi",
  "cash",
  "nagad",
  "nakad",
  "udhaar",
  "udhar",
  "credit",
  "payment",
  "rs",
  // Verb surface forms — never treat as item
  "kinyo",
  "kinye",
  "kineko",
  "kine",
  "kiniyo",
  "kharid",
  "becheko",
  "beche",
  "bechyo",
  "bikyo",
  "bikri",
  "tiryo",
  "tireko",
  "diye",
  "diyo",
  "aayo",
  "payo",
  "gareko",
  "garyo",
  "vayo",
  "bhayo",
  "sold",
  "bought",
  "paid",
  "received",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Detect semantic action from text using morphology + phrase patterns */
export function detectSemanticAction(text: string): {
  action: SemanticAction;
  verbLemma: string | null;
  confidence: number;
} {
  const t = text.toLowerCase();

  // Credit sale: diye/diyo + lai (without payment-in context)
  if (/\b(diye|diyo|diya|die|diae)\b/i.test(t) && /\blai\b/i.test(t)) {
    if (!/\b(tiryo|tireko|tira|clear|jama|received)\b/i.test(t)) {
      if (CREDIT_MARKERS.test(t) || /\b(becheko|beche|bikri|bik|sale|sold)\b/i.test(t)) {
        return { action: "CREDIT_SALE", verbLemma: "diye", confidence: 0.92 };
      }
      // "Ram lai 500 diye" without explicit sale verb → credit sale
      if (/\d/.test(t)) {
        return { action: "CREDIT_SALE", verbLemma: "diye", confidence: 0.85 };
      }
    }
  }

  // Phrase-level patterns (longest match first)
  for (const [pattern, action] of PHRASE_ACTIONS) {
    if (pattern.test(t)) {
      return { action, verbLemma: action.toLowerCase(), confidence: 0.88 };
    }
  }

  // Token-level morphology scan (check multi-word first, then single tokens)
  const tokens = tokenize(t);
  for (let i = 0; i < tokens.length; i++) {
    // Two-token phrases
    const bigram = `${tokens[i]} ${tokens[i + 1] ?? ""}`.trim();
    if (SURFACE_TO_ACTION.has(bigram)) {
      return {
        action: SURFACE_TO_ACTION.get(bigram)!,
        verbLemma: bigram,
        confidence: 0.9,
      };
    }
    const token = tokens[i];
    if (SURFACE_TO_ACTION.has(token)) {
      return {
        action: SURFACE_TO_ACTION.get(token)!,
        verbLemma: token,
        confidence: 0.85,
      };
    }
    // Prefix match for conjugated forms: kinye → kin, becheko → beche
    for (const [surface, action] of SURFACE_TO_ACTION) {
      if (surface.length >= 3 && (token.startsWith(surface) || surface.startsWith(token))) {
        if (token.length >= 3 && surface.length >= 3) {
          return { action, verbLemma: token, confidence: 0.78 };
        }
      }
    }
  }

  // Fuzzy verb stem matching for unlisted conjugations
  const verbStemPatterns: [RegExp, SemanticAction, string][] = [
    [/\bkin[a-z]{0,6}\b/i, "PURCHASE", "kin"],
    [/\bkharid[a-z]{0,6}\b/i, "PURCHASE", "kharid"],
    [/\bbeche?[a-z]{0,6}\b/i, "SALE", "beche"],
    [/\bbech[a-z]{0,6}\b/i, "SALE", "bech"],
    [/\bbik[a-z]{0,6}\b/i, "SALE", "bik"],
    [/\btir[a-z]{0,6}\b/i, "PAY_IN", "tir"],
    [/\b(aayo|aayeko|aaye|payo|paye|milyo|paayo)\b/i, "PAY_IN", "aayo"],
    [/\bkharch[a-z]{0,4}\b/i, "EXPENSE", "kharcha"],
    [/\b(diye|diyo|diya)\b/i, "PAY_OUT", "diye"],
  ];

  for (const [pattern, action, lemma] of verbStemPatterns) {
    if (pattern.test(t)) {
      // Disambiguate diye: with lai = credit sale, without = pay out
      if (lemma === "diye" && /\blai\b/i.test(t) && !/\b(tiryo|tireko)\b/i.test(t)) {
        return { action: "CREDIT_SALE", verbLemma: "diye", confidence: 0.8 };
      }
      return { action, verbLemma: lemma, confidence: 0.75 };
    }
  }

  return { action: "UNKNOWN", verbLemma: null, confidence: 0 };
}

/** Extract agent (ergative -le) and recipient (dative -lai) */
export function extractSemanticRoles(text: string): {
  agent: string | null;
  recipient: string | null;
  source: string | null;
} {
  const soft = text
    .replace(/[^\w\s\u0900-\u097F.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // maile/timile/hamile = self/other agent
  if (/\bmaile\b/i.test(soft)) return { agent: "Self", recipient: null, source: null };
  if (/\btimile\b/i.test(soft)) return { agent: "Timi", recipient: null, source: null };
  if (/\bhamile\b/i.test(soft)) return { agent: "Hami", recipient: null, source: null };

  // Name + le (ergative agent): "Ram le 500 tiryo"
  const leMatch = soft.match(
    /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,25}?)\s+(?:le|ले)\b/i,
  );
  if (leMatch) {
    const name = leMatch[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !AGENT_STOPWORDS.has(w.toLowerCase()))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    if (name) return { agent: name, recipient: null, source: null };
  }

  // Name + lai (dative recipient): "Ram lai 500 diye"
  const laiMatch = soft.match(
    /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,25}?)\s+(?:lai|लाई)\b/i,
  );
  if (laiMatch) {
    const name = laiMatch[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !AGENT_STOPWORDS.has(w.toLowerCase()))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    if (name) return { agent: null, recipient: name, source: null };
  }

  // Name + bata (source): "Shyam bata 500 aayo"
  const bataMatch = soft.match(
    /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,25}?)\s+(?:bata|बाट)\b/i,
  );
  if (bataMatch) {
    const name = bataMatch[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !AGENT_STOPWORDS.has(w.toLowerCase()))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    if (name) return { agent: null, recipient: null, source: name };
  }

  // Capitalized English name
  const capMatch = soft.match(/\b([A-Z][a-zA-Z]{1,20})\b/);
  if (capMatch && !AGENT_STOPWORDS.has(capMatch[1].toLowerCase())) {
    return { agent: capMatch[1], recipient: null, source: null };
  }

  return { agent: null, recipient: null, source: null };
}

/** Extract amount using semantic patterns (not just digit regex) */
export function extractSemanticAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");

  // "50 rupaya/rupiya ko bag" — amount before currency + ko
  const priceKoMatch = t.match(
    /\b(\d+(?:\.\d+)?)\s*(?:rs\.?|npr|rupees?|rupiya|rupya|rupaye?|rupaya|rupaiya|₨)?\s+ko\b/i,
  );
  if (priceKoMatch) return Math.round(parseFloat(priceKoMatch[1]));

  // "Rs 500" / "500 rs" / "500 rupaya"
  const rsMatch =
    t.match(/(?:rs\.?\s*|npr\s*)?(\d+(?:\.\d+)?)\s*(?:rs\.?|npr|rupees?|rupiya|rupya|rupaye?|rupaya)?\b/i) ??
    t.match(/\b(\d+(?:\.\d+)?)\s*(?:rs\.?|npr|rupees?|rupiya|rupya|rupaye?|rupaya)\b/i);
  if (rsMatch) return Math.round(parseFloat(rsMatch[1]));

  // "worth 500" / "total 5000"
  const worthMatch = t.match(/\b(?:worth|total|amount|sum|value|mulya)\s*(?:rs\.?|npr\s*)?(\d+(?:\.\d+)?)/i);
  if (worthMatch) return Math.round(parseFloat(worthMatch[1]));

  // "500 ko" (amount genitive without currency word)
  const koMatch = t.match(/\b(\d+(?:\.\d+)?)\s+ko\s+\w/i);
  if (koMatch) return Math.round(parseFloat(koMatch[1]));

  // "for Rs 500" / "for 500"
  const forMatch = t.match(/\bfor\s*(?:rs\.?|npr\s*)?(\d+(?:\.\d+)?)/i);
  if (forMatch) return Math.round(parseFloat(forMatch[1]));

  // "5k" / "5 k"
  const kMatch = t.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

  // Nepali word numbers: saya, hajar, lakh + digits
  const tokens = tokenize(t);
  let total = 0;
  let current = 0;
  let found = false;

  for (const token of tokens) {
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      current = parseFloat(token);
      found = true;
      continue;
    }
    if (token in WORD_TO_NUMBER) {
      found = true;
      const mult = WORD_TO_NUMBER[token];
      if (mult >= 100) {
        current = (current || 1) * mult;
        total += current;
        current = 0;
      } else {
        current += mult;
      }
    }
  }
  if (current) total += current;
  if (found && total > 0) return Math.round(total);

  // Last resort: any standalone number
  const anyNum = t.match(/\b(\d+(?:\.\d+)?)\b/);
  if (anyNum) return Math.round(parseFloat(anyNum[1]));

  return null;
}

/** Extract item/object from semantic patterns */
export function extractSemanticItem(text: string, action: SemanticAction): string | null {
  const t = text.toLowerCase();

  // "50 rupaya ko bag" / "500 ko saman" — genitive price + item
  const priceItemMatch = t.match(
    /\b\d+(?:\.\d+)?\s*(?:rs\.?|npr|rupees?|rupiya|rupya|rupaye?|rupaya|rupaiya|₨)?\s+ko\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F]{1,25})\b/i,
  );
  if (priceItemMatch && !ITEM_STOPWORDS.has(priceItemMatch[1].toLowerCase())) {
    return priceItemMatch[1];
  }

  // "bag kinye/kinyo/kineko" — item before purchase verb
  const beforeVerbMatch = t.match(
    /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F]{1,25})\s+(?:kinyo|kinye|kineko|kine|kiniyo|kharid|becheko|beche|bikyo|bikri)\b/i,
  );
  if (beforeVerbMatch && !ITEM_STOPWORDS.has(beforeVerbMatch[1].toLowerCase())) {
    return beforeVerbMatch[1];
  }

  // "bought bag" / "sold tea" / "purchase stationery"
  const engMatch = t.match(
    /\b(?:bought|buy|purchase|purchased|sold|sell|sale\s+of)\s+(?:\d+\s+\w+\s+)?([a-zA-Z]{2,25})\b/i,
  );
  if (engMatch && !ITEM_STOPWORDS.has(engMatch[1].toLowerCase())) {
    return engMatch[1];
  }

  // "saman/mal/goods/stock" explicit
  const goodsMatch = t.match(/\b(saman|mal|goods|stock|inventory|stationery|item)\b/i);
  if (goodsMatch && (action === "PURCHASE" || action === "SALE")) {
    return goodsMatch[1];
  }

  // qty + item: "200 cups"
  const qtyItem = t.match(/\b\d+\s+([a-zA-Z\u0900-\u097F]{2,25})(?:s|es|haru)?\b/i);
  if (qtyItem && !ITEM_STOPWORDS.has(qtyItem[1].toLowerCase())) {
    return qtyItem[1];
  }

  // "kharcha X" / "X kharcha"
  if (action === "EXPENSE") {
    const exp1 = t.match(/\b([a-zA-Z]{2,20})\s+kharcha\b/i);
    if (exp1) return exp1[1];
    const exp2 = t.match(/\bkharcha\s+([a-zA-Z]{2,20})\b/i);
    if (exp2) return exp2[1];
  }

  return null;
}

export function detectPaymentMode(text: string): PaymentMode {
  if (CREDIT_MARKERS.test(text)) return "credit";
  if (CASH_MARKERS.test(text)) return "cash";
  return "unknown";
}

/** Full semantic frame parse */
export function parseSemanticFrame(text: string): SemanticFrame {
  const { action, verbLemma, confidence: actionConf } = detectSemanticAction(text);
  const roles = extractSemanticRoles(text);
  const amount = extractSemanticAmount(text);
  const item = extractSemanticItem(text, action);
  const paymentMode = detectPaymentMode(text);
  const isQuestion = QUESTION_MARKERS.test(text);
  const isNegated = NEGATION_MARKERS.test(text);

  let confidence = actionConf;
  if (amount !== null) confidence += 0.08;
  if (item) confidence += 0.05;
  if (roles.agent || roles.recipient || roles.source) confidence += 0.05;
  confidence = Math.min(confidence, 0.98);

  return {
    action,
    agent: roles.agent,
    recipient: roles.recipient,
    source: roles.source,
    amount,
    item,
    paymentMode,
    confidence,
    verbLemma,
    isQuestion,
    isNegated,
  };
}

/** Map semantic frame → KhataIntent */
export function mapFrameToIntent(frame: SemanticFrame): KhataIntent | null {
  if (frame.isQuestion || frame.isNegated || frame.action === "UNKNOWN") return null;

  const party = frame.recipient ?? frame.agent ?? frame.source ?? null;
  const mode = frame.paymentMode;

  switch (frame.action) {
    case "PURCHASE":
      if (mode === "credit") return "khata_credit_purchase";
      return "khata_purchase";
    case "SALE":
      if (mode === "credit") return "khata_credit_sale";
      return "khata_cash_sale";
    case "CREDIT_SALE":
      return "khata_credit_sale";
    case "CREDIT_PURCHASE":
      return "khata_credit_purchase";
    case "PAY_IN":
      return "khata_payment_in";
    case "PAY_OUT":
      return "khata_payment_out";
    case "EXPENSE":
      return "khata_expense";
    case "SALARY":
      return "khata_salary_payment";
    case "LOAN_IN":
      return "khata_loan_received";
    case "LOAN_OUT":
      return "khata_loan_repayment";
    case "DRAWINGS":
      return "khata_drawings";
    case "CAPITAL":
      return "khata_capital_introduced";
    case "RETURN_SALE":
      return "khata_sales_return";
    case "RETURN_PURCHASE":
      return "khata_purchase_return";
    default:
      return null;
  }
}

/** Does this text semantically describe a transaction (not just keyword match)? */
export function isSemanticTransaction(text: string): boolean {
  const frame = parseSemanticFrame(text);
  if (frame.isQuestion || frame.isNegated) return false;
  if (frame.action === "UNKNOWN") return false;
  // Need at least action + (amount OR strong confidence)
  if (frame.amount !== null && frame.amount > 0) return true;
  if (frame.confidence >= 0.8 && frame.action !== "UNKNOWN") return true;
  return false;
}

/** High-level semantic parse result for integration */
export interface SemanticParseResult {
  intent: KhataIntent | null;
  amount: number | null;
  party: string | null;
  item: string | null;
  frame: SemanticFrame;
  confidence: number;
}

export function parseSemanticTransaction(text: string): SemanticParseResult {
  const frame = parseSemanticFrame(text);
  const intent = mapFrameToIntent(frame);
  const party = frame.recipient ?? frame.agent ?? frame.source ?? null;

  return {
    intent,
    amount: frame.amount,
    party: party && party !== "Self" ? party : null,
    item: frame.item,
    frame,
    confidence: frame.confidence,
  };
}
