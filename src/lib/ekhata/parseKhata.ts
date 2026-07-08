import { detectNegation } from "./negationDetector";
import { CLARIFY_TEMPLATES } from "../nepal-ai/generated/runtimeMaps";
import { inferTransactionDirection } from "../nepal-ai/particleDirection";
import { parseCommaAmount } from "./calculationEngine";
import { generateCAEntry } from "./caEntryEngine";
import { findTemplateByKeywords } from "./caEntryTemplates";
import { WORD_TO_NUMBER } from "./nepaliLanguage";
import { normalizeNepaliText } from "./normalizeNepali";
import {
  classifyWorkIntent,
  extractWorkItem,
  parseSmartAmount,
  shouldTryWorkParse,
} from "./smartWorkBrain";
import { parseSemanticTransaction } from "./semanticNepaliBrain";
import { resolveBestAmount, cleanPartyName } from "./meaningEngine";

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
  "rupee",
  "rupiya",
  "for",
  "each",
  "per",
  "today",
  "yesterday",
  "tomorrow",
  "bikri",
  "vayo",
  "bhayo",
  "ko",
  "salary",
  "ssf",
  "gratuity",
  "vat",
  "tds",
  "depreciation",
  "loan",
  "capital",
  "drawings",
  "stock",
  "bad",
  "debt",
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

/** CA-level intent patterns — priority order matters */
interface IntentPattern {
  intent: KhataIntent;
  test: (text: string) => boolean;
  needsParty?: boolean;
}

const CA_INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "khata_ssf_employer",
    test: (t) => /\b(ssf\s*employer|employer\s*ssf|11\s*%\s*ssf|11\s*percent\s*ssf)\b/i.test(t),
  },
  {
    intent: "khata_ssf_employee",
    test: (t) =>
      /\b(ssf\s*employee|employee\s*ssf|10\s*%\s*ssf|10\s*percent\s*ssf|ssf\s*kata)\b/i.test(t),
  },
  {
    intent: "khata_gratuity_provision",
    test: (t) => /\b(gratuity\s*provision|gratuity\s*accrual|gratuity\s*andaaja)\b/i.test(t),
  },
  {
    intent: "khata_gratuity_payment",
    test: (t) => /\b(gratuity\s*(payment|diyo|tiryo|paid))\b/i.test(t),
  },
  {
    intent: "khata_provision_bad_debt",
    test: (t) =>
      /\b(provision\s*(for\s*)?bad\s*debt|doubtful\s*debt|andaaja\s*bad\s*debt)\b/i.test(t),
  },
  {
    intent: "khata_bad_debt_recovery",
    test: (t) =>
      /\b(bad\s*debt\s*recover\w*|recover\w*\s+bad\s*debt|nasakne\s*feri\s*aayo)\b/i.test(t),
  },
  {
    intent: "khata_bad_debt_writeoff",
    test: (t) =>
      /\b(bad\s*debt\s*(write\s*off|writeoff)|write\s*off|nasakne|irrecoverable)\b/i.test(t) &&
      !/\brecover\w*\b/i.test(t),
  },
  {
    intent: "khata_vat_payment",
    test: (t) => /\b(vat\s*(payment|tiryo|paid|jama)|ird\s*vat)\b/i.test(t),
  },
  {
    intent: "khata_vat_sales",
    test: (t) => /\b(vat\s*(sale|bikri)|vat\s*sanga\s*becheko|13\s*%\s*vat\s*sale)\b/i.test(t),
  },
  {
    intent: "khata_vat_purchase",
    test: (t) => /\b(vat\s*(purchase|kharid|kineko)|input\s*vat)\b/i.test(t),
  },
  { intent: "khata_tds_paid", test: (t) => /\b(tds\s*(paid|tiryo|remittance|jama))\b/i.test(t) },
  {
    intent: "khata_tds_deducted",
    test: (t) => /\b(tds\s*(deduct|kateko|withhold)|withholding\s*tax)\b/i.test(t),
  },
  {
    intent: "khata_sales_return",
    test: (t) =>
      /\b(sales\s*return|credit\s*note|purchase\s*return\s*from\s*customer|saman\s*firta|firtayo|firtaayo|return\s+gare|goods\s*returned)\b/i.test(
        t,
      ) && !/\b(purchase\s*return|supplier)\b/i.test(t),
  },
  {
    intent: "khata_purchase_return",
    test: (t) => /\b(purchase\s*return|debit\s*note|supplier\s*return|kharid\s*firta)\b/i.test(t),
  },
  {
    intent: "khata_customer_advance",
    test: (t) =>
      /\b(customer\s*advance|advance\s*(received|liyo|aayo)|unearned\s*revenue|advance\s*from\s*customer)\b/i.test(
        t,
      ),
  },
  {
    intent: "khata_employee_advance",
    test: (t) =>
      /\b(employee\s*advance|staff\s*advance|talab\s*advance|advance\s*to\s*employee|advance\s*diyo\s*staff)\b/i.test(
        t,
      ),
  },
  {
    intent: "khata_opening_balance",
    test: (t) => /\b(opening\s*balance|opening\s*entry|suruwati\s*khata|purano\s*khata\s*bata)\b/i.test(t),
  },
  {
    intent: "khata_asset_disposal",
    test: (t) =>
      /\b(asset\s*disposal|sold\s*(old\s*)?(vehicle|machine|asset|computer)|fixed\s*asset\s*sold|machine\s*becheko)\b/i.test(
        t,
      ),
  },
  {
    intent: "khata_inventory_write_down",
    test: (t) =>
      /\b(inventory\s*write\s*down|stock\s*adjustment|shrinkage|obsolete\s*stock|stock\s*count\s*difference|saman\s*bigryo)\b/i.test(
        t,
      ),
  },
  {
    intent: "khata_commission_income",
    test: (t) => /\b(commission\s*(income|received|aayo|aamdani)|aamdani\s*commission)\b/i.test(t),
  },
  {
    intent: "khata_rent_expense",
    test: (t) =>
      /\b(rent\s*(expense|paid|tiryo)|bhaada|bhada|premises\s*usage|landlord\s*charged)\b/i.test(t) &&
      !/\b(rent\s*received|byaj|interest)\b/i.test(t),
  },
  {
    intent: "khata_salary_accrual",
    test: (t) =>
      /\b(salary\s*accrual|talab\s*provision|month\s*end\s*salary|salary\s*liability|accrued\s*salary|talab\s*accrue)\b/i.test(
        t,
      ),
  },
  {
    intent: "khata_salary_payment",
    test: (t) => /\b(salary\s*(payment|diyo|tiryo|paid)|talab\s*(diyo|tiryo))\b/i.test(t),
  },
  {
    intent: "khata_outstanding_expense",
    test: (t) =>
      /\b(outstanding\s*(expense|kharcha)|accrued\s*(expense|kharcha)|baki\s*kharcha|bill\s*aayo)\b/i.test(
        t,
      ),
  },
  {
    intent: "khata_prepaid_expense",
    test: (t) => /\b(prepaid|advance\s*(rent|expense)|agadi\s*tiryo)\b/i.test(t),
  },
  {
    intent: "khata_depreciation",
    test: (t) => /\b(depreciation|mulya\s*ghata|annual\s*depreciation)\b/i.test(t),
  },
  { intent: "khata_bank_charges", test: (t) => /\b(bank\s*(charge|fee|kharcha))\b/i.test(t) },
  {
    intent: "khata_discount_allowed",
    test: (t) => /\b(discount\s*allowed|chhut\s*diyo)\b/i.test(t),
  },
  {
    intent: "khata_discount_received",
    test: (t) => /\b(discount\s*received|chhut\s*paayo|chhut\s*milyo)\b/i.test(t),
  },
  {
    intent: "khata_other_income",
    test: (t) =>
      /\b(interest\s*received|rent\s*received|byaj\s*aayo|other\s*income|dividend)\b/i.test(t),
  },
  {
    intent: "khata_capital_introduced",
    test: (t) =>
      /\b(capital\s*introduced|puni\s*lagaayo|owner\s*investment|capital\s*lagaayo)\b/i.test(t),
  },
  {
    intent: "khata_drawings",
    test: (t) => /\b(drawings|nikasne|owner\s*withdrawal|nikasna)\b/i.test(t),
  },
  {
    intent: "khata_loan_received",
    test: (t) =>
      /\b(loan\s*(received|liyo|liye)|rin\s*liyo)\b/i.test(t) &&
      !/\b(repay|repayment|tiryo|payment)\b/i.test(t.replace(/received/gi, "")),
  },
  {
    intent: "khata_loan_repayment",
    test: (t) => /\b(loan\s*(repay\w*|payment|tiryo)|rin\s*tiryo)\b/i.test(t),
  },
  {
    intent: "khata_credit_purchase",
    test: (t) =>
      /\b(udhaar\s*ma\b.*\b(kineko|kharid)\b|udhaar\s*(kineko|kharid)|udhar\s*kineko|credit\s*purchase|kharid\s*udhaar)\b/i.test(
        t,
      ),
    needsParty: true,
  },
  {
    intent: "khata_stock_purchase",
    test: (t) =>
      /\b(stock\s*(purchase|kineko)|inventory|saman\s*kineko|stock\s*kineko)\b/i.test(t) &&
      !/\b(udhaar|udhar|credit)\b/i.test(t),
  },
  {
    intent: "khata_stock_sale_cogs",
    test: (t) => /\b(cogs|cost\s*of\s*goods|stock\s*becheko\s*cost)\b/i.test(t),
  },
  {
    intent: "khata_contra_cash_bank",
    test: (t) => /\b(contra|cash\s*to\s*bank|bank\s*ma\s*jama|cash\s*deposit)\b/i.test(t),
  },
  // Basic khata intents (lower priority for specific CA patterns)
  { intent: "khata_credit_sale", test: hasCreditSaleCue, needsParty: true },
  { intent: "khata_payment_in", test: hasPaymentInCue, needsParty: true },
  { intent: "khata_cash_sale", test: hasCashSaleCue },
  { intent: "khata_purchase", test: hasPurchaseCue },
  { intent: "khata_payment_out", test: hasPaymentOutCue, needsParty: true },
  { intent: "khata_expense", test: hasExpenseCue },
];

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

  const commaAmt = parseCommaAmount(normalized.replace(/\s/g, ""));
  if (commaAmt) return commaAmt;

  const kMatch = normalized.match(/(\d+(?:\.\d+)?)\s*k\b/i);
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

function extractParty(displayText: string, normalizedText?: string): string | null {
  for (const source of [displayText, normalizedText].filter(Boolean) as string[]) {
    const soft = normalizeUnicodeDigits(source)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u0900-\u097F.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!soft) continue;

    const bataMatch = soft.match(
      /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,30}?)\s+bata\b/i,
    );
    if (bataMatch) {
      const partyTokens = bataMatch[1]
        .trim()
        .split(" ")
        .filter((token) => !PARTY_STOPWORDS.has(token.toLowerCase()));
      if (partyTokens.length) {
        return partyTokens
          .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
          .join(" ");
      }
    }

    const laiMatch = soft.match(
      /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{0,30}?)\s+(?:lai|le|लाई|ले)\b/i,
    );
    if (laiMatch) {
      const partyTokens = laiMatch[1]
        .trim()
        .split(" ")
        .filter((token) => !PARTY_STOPWORDS.has(token.toLowerCase()));
      if (partyTokens.length) {
        return partyTokens
          .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
          .join(" ");
      }
    }

    const capitalized = source.match(/\b([A-Z][a-zA-Z]{0,30}(?:\s+[A-Z][a-zA-Z]{0,30})?)\b/g) ?? [];
    for (const name of capitalized) {
      if (!PARTY_STOPWORDS.has(name.toLowerCase()) && !/^(abc|xyz)$/i.test(name)) return name;
    }
  }
  return null;
}

function extractItem(text: string, intent: KhataIntent | null): string | null {
  const soft = normalize(text);
  if (!soft) return null;

  if (
    intent === "khata_purchase" ||
    intent === "khata_credit_purchase" ||
    intent === "khata_stock_purchase"
  ) {
    const m1 = soft.match(/\b(\w+)\s+kineko\b/);
    if (m1 && !PARTY_STOPWORDS.has(m1[1])) return m1[1];
    const m2 = soft.match(/\bpurchase\s+(\w+)\b/);
    if (m2) return m2[1];
  }

  if (
    intent === "khata_cash_sale" ||
    intent === "khata_credit_sale" ||
    intent === "khata_vat_sales"
  ) {
    const m1 = soft.match(/\b(\w+)\s+ko\s+(\w+)\s+becheko\b/);
    if (m1 && !PARTY_STOPWORDS.has(m1[2])) return m1[2];
    const m2 = soft.match(/\b(\w+)\s+becheko\b/);
    if (m2 && !PARTY_STOPWORDS.has(m2[1]) && !["cash", "ma", "nagad"].includes(m2[1])) return m2[1];
    const m3 = soft.match(/\bsold\s+(\w+)\s+for\b/i);
    if (m3 && !PARTY_STOPWORDS.has(m3[1].toLowerCase())) return m3[1];
  }

  if (intent === "khata_expense" || intent === "khata_outstanding_expense") {
    const m1 = soft.match(/\b([a-zA-Z]+)\s+kharcha\b/);
    if (m1) return m1[1];
    const m2 = soft.match(/\bkharcha\s+([a-zA-Z]+)\b/);
    if (m2) return m2[1];
  }

  return null;
}

function extractDate(text: string): string {
  const raw = normalizeUnicodeDigits(text).toLowerCase();
  const today = new Date();
  if (/\b(hijo|yesterday)\b/.test(raw)) today.setDate(today.getDate() - 1);
  else if (/\b(parsi|tomorrow|day\s+after)\b/.test(raw)) today.setDate(today.getDate() + 1);
  return today.toISOString().slice(0, 10);
}

function hasCashSaleCue(text: string): boolean {
  if (
    /\b(sold|sale|sales|revenue|earned|selling)\b/i.test(text) &&
    !/\b(udhaar|udhar|udharo|credit|bought|purchase|kineko|kharid)\b/i.test(text)
  ) {
    return true;
  }
  return (
    /\b(cash|nakit|nagad|nakad)\b/i.test(text) &&
    /\b(bikri|becheko|beche|bik|sale|sold)\b/i.test(text)
  );
}

function hasCreditSaleCue(text: string): boolean {
  if (/\b(kineko|kine|kiniyo|kharid|purchase|saman)\b/i.test(text)) return false;
  if (/\b(tiryo|tireko|tira|clear|jama|payment\s+received|paisa\s+aayo|collected|outstanding\s+dues)\b/i.test(text))
    return false;
  return (
    (/\b(udhaar|udharo|udhar|credit|उधार|on\s+account|on\s+tab|deferred\s*payment)\b/i.test(text) &&
      /\b(becheko|beche|bikri|bik|sale|sold|diye|die|diya|extended|invoiced|dispatched)\b/i.test(text)) ||
    /\b(udhaar|udharo|udhar)\s+becheko\b/i.test(text) ||
    /\bbecheko\b.*\b(udhaar|udharo|udhar)\b/i.test(text) ||
    (/\b(diye|die|diya|diae|दिए)\b/i.test(text) && /\blai\b/i.test(text) && !/\b(tiryo|tireko)\b/i.test(text))
  );
}

function hasPaymentInCue(text: string): boolean {
  if (/\b(interest|discount|rent|dividend|commission)\s*(received|aayo)\b/i.test(text)) return false;
  if (/\blai\b/i.test(text) && /\b(diye|diyo|die|diya)\b/i.test(text) && !/\b(tiryo|tireko|clear)\b/i.test(text))
    return false;
  return (
    /\b(tiryo|tireko|tira|tire|payment\s+received|paisa\s+aayo|jama|jama\s+gareko|payo|paye|collected|settled|outstanding\s+dues)\b/i.test(
      text,
    ) ||
    (/\breceived\b/i.test(text) && /\b(payment|paisa|debtor|debt|cheque|check)\b/i.test(text)) ||
    (/\b(le|bata|from)\b/i.test(text) && /\b(diyo|diye|tiryo|tireko|payo|paye|aayo)\b/i.test(text) &&
      !/\b(lai)\b/i.test(text))
  );
}

function hasPurchaseCue(text: string): boolean {
  return (
    /\b(kineko|kine|kiniyo|kinyo|kinye|kinna|kinne|kharid|kharido|purchase|bought|buy|purchased|procured)\b/i.test(
      text,
    ) && !/\b(udhaar|udhar|credit\s+sale|becheko|sold)\b/i.test(text)
  );
}

function hasPaymentOutCue(text: string): boolean {
  return /\b(payment\s+gareko|payment\s+made|paisa\s+diye|tirna\s+diye|bhugtan|tiryo\s+diye)\b|\bpayment\b.*\bgareko\b/i.test(
    text,
  );
}

function hasExpenseCue(text: string): boolean {
  return /\b(kharcha|kharcho|expense|kharch|noksan|nokshan|loss|ghata|ghateko|ghatyo)\b/i.test(text);
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
  if (/^\s*(\d+|(?:\d+\s+)?(?:saya|hajar|lakh|\w+))\s+(diye|die|diya|diae)\s*$/i.test(normalized))
    return true;
  if (/^\d+\s+diye$/i.test(normalized)) return true;
  return false;
}

function needsPartyName(intent: KhataIntent, party: string | null): boolean {
  if (party) return false;
  const partyRequired: KhataIntent[] = [
    "khata_credit_sale",
    "khata_payment_in",
    "khata_payment_out",
    "khata_credit_purchase",
    "khata_bad_debt_writeoff",
    "khata_discount_allowed",
  ];
  return partyRequired.includes(intent);
}

function partyClarifyingQuestion(intent: KhataIntent): string {
  switch (intent) {
    case "khata_credit_sale":
      return "Kaslaai udharo diye? Party ko naam sahit lekhnu hola. Udaharan: Ram lai 500 udharo becheko";
    case "khata_payment_in":
      return "Kasle paisa tiryo? Party ko naam lekhnu hola. Udaharan: Shyam le 200 tiryo";
    case "khata_payment_out":
      return "Kaslai payment diye? Party ko naam lekhnu hola. Udaharan: Gita lai 2000 payment gareko";
    case "khata_credit_purchase":
      return "Kasbata udhaar ma kineko? Supplier ko naam lekhnu hola.";
    case "khata_bad_debt_writeoff":
      return "Kas ko receivable write-off ho? Debtor ko naam lekhnu hola.";
    default:
      return "Party ko naam chaincha. Feri lekhnu hola.";
  }
}

function classifyIntent(rawText: string, normalizedText: string): KhataIntent | null {
  const sources = [rawText.trim(), normalizedText.trim()].filter(Boolean);

  // 1. Specialized CA regex patterns (VAT, SSF, TDS, etc.) — highest priority
  for (const q of sources) {
    if (!q) continue;
    for (const pattern of CA_INTENT_PATTERNS) {
      if (pattern.test(q)) return pattern.intent;
    }
  }

  // 2. Semantic frame parse — understands meaning for natural Nepali/English
  for (const q of sources) {
    const semantic = parseSemanticTransaction(q);
    if (semantic.intent && semantic.confidence >= 0.65 && !semantic.frame.isQuestion) {
      return semantic.intent;
    }
  }

  for (const q of sources) {
    const template = findTemplateByKeywords(q);
    if (template) return template.intent;

    const particleDir = inferTransactionDirection(q);
    if (particleDir.direction === "inbound" && particleDir.confidence !== "low") {
      if (/\b(tiryo|tireko|aayo|payo|liyo)\b/i.test(q)) return "khata_payment_in";
    }
    if (particleDir.direction === "outbound" && particleDir.confidence !== "low") {
      if (/\b(diye|diyo|tireko|tiryo)\b/i.test(q) && /\blai\b/i.test(q)) return "khata_payment_out";
    }

    if (/\b(diye|die|diya|diae)\b/i.test(q) && /\blai\b/i.test(q)) {
      return "khata_credit_sale";
    }
  }

  // Smart work brain — natural English/Nepali fallback
  for (const q of sources) {
    const workIntent = classifyWorkIntent(q);
    if (workIntent) return workIntent;
  }

  return null;
}

/** Intent classification only — for parser parity tests (no party/amount gates). */
export function classifyKhataIntent(rawText: string, preNormalized?: string): KhataIntent | null {
  const text = (preNormalized ?? normalizeNepaliText(rawText)).trim();
  return classifyIntent(rawText.trim(), text);
}

function resolveAmount(displayText: string, normalizedText?: string): number | null {
  const best = resolveBestAmount(displayText, normalizedText);
  if (best.amount && best.amount > 0) return best.amount;
  const smart = parseSmartAmount(displayText);
  if (smart.amount && smart.amount > 0) return smart.amount;
  return parseAmountWords(displayText) ?? parseAmountWords(normalizedText ?? "");
}

export function parseKhataMessage(rawText: string, preNormalized?: string): KhataParseResult {
  const text = (preNormalized ?? normalizeNepaliText(rawText)).trim();
  const displayText = rawText.trim();
  if (!text) {
    return { clarifying_question: "Ke transaction ho? Thora clear lekhnu hola." };
  }

  const negation = detectNegation(displayText);
  if (negation.blockEntry) {
    return { clarifying_question: negation.clarification ?? "Yo transaction confirm garna sakina." };
  }

  if (needsPartyRoleClarification(text)) {
    return { clarifying_question: CLARIFYING_QUESTION };
  }

  const intent = classifyIntent(displayText, text);

  if (!intent) {
    if (shouldTryWorkParse(displayText)) {
      return {
        clarifying_question:
          "Maile transaction type bujhena. Thora clear lekhnu hola — jastai: 'sold 500 cash', 'bought stationery 1200', 'Ram lai 500 udhaar'",
      };
    }
    return {
      clarifying_question:
        "Ke transaction ho? Thora clear lekhnu hola. Udaharan: 'Ram lai 500 udhaar', 'salary 50000', 'bad debt write off 2000'",
    };
  }

  const semantic = parseSemanticTransaction(displayText);
  const amount = resolveAmount(displayText, text);
  if (!amount || amount <= 0) {
    const tpl =
      intent === "khata_purchase"
        ? CLARIFY_TEMPLATES.missing_amount_purchase?.template_ne
        : intent === "khata_expense"
          ? CLARIFY_TEMPLATES.expense_or_loss?.template_ne
          : intent === "khata_cash_sale"
            ? CLARIFY_TEMPLATES.missing_amount_sale?.template_ne
            : null;
    return { clarifying_question: tpl ?? "Rakam kati ho? Number lekhnus." };
  }

  const party = cleanPartyName(semantic.party ?? extractParty(displayText, text));
  if (needsPartyName(intent, party)) {
    return { clarifying_question: partyClarifyingQuestion(intent) };
  }

  const item =
    semantic.item ?? extractItem(text, intent) ?? extractWorkItem(displayText, intent);
  const date = extractDate(text);

  const { card } = generateCAEntry(intent, {
    amount,
    party,
    item,
    date,
    rawText: displayText,
  });

  return { card };
}
