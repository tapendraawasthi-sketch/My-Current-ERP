/**
 * Accounting Language Brain — bilingual semantic understanding of accounting language.
 * Understands Nepali, English, and mixed input; responds in the user's language.
 * Works standalone (no Ollama) and augments the Ollama LLM when available.
 */

import { findTemplateByKeywords, getEntryTemplate } from "./caEntryTemplates";
import { CLASSIFICATION_GUIDE } from "./caAccountClassification";
import { formatJournalPreview } from "./caEntryEngine";
import { isAccountingDomain } from "./domainRouter";
import { answerFromGrammarKnowledge } from "./grammarKnowledgeBrain";
import {
  formatGlossaryDefinition,
  getGlossaryByConceptKey,
  matchAccountingGlossary,
} from "@/lib/nepal-ai/accountingGlossary";
import {
  formatRegulatedDefinition,
  matchRegulatedGlossary,
} from "@/lib/nepal-ai/regulatedGlossary";
import {
  formatFaqAnswer,
  matchAccountingFaq,
} from "@/lib/nepal-ai/accountingFaq";
import {
  formatNepalTaxFaqAnswer,
  matchNepalTaxFaq,
} from "@/lib/nepal-ai/nepalTaxFaq";
import {
  formatLegalSectionExplainerAnswer,
  matchLegalSectionExplainer,
} from "@/lib/nepal-ai/legalSectionExplainers";
import {
  formatNepalProcessGuideAnswer,
  matchNepalProcessGuide,
} from "@/lib/nepal-ai/nepalProcessGuides";
import {
  formatDocumentUnderstandingAnswer,
  isDocumentUnderstandingQuery,
  matchDocumentUnderstandingType,
} from "@/lib/nepal-ai/documentUnderstanding";
import {
  formatDocumentComprehensionAnswer,
  isDocumentComprehensionQuery,
  matchDocumentComprehensionScenario,
} from "@/lib/nepal-ai/documentComprehensionScenarios";
import {
  formatPromptVariantSummary,
  isPromptVariantQuery,
  matchPromptVariant,
} from "@/lib/nepal-ai/promptVariants";
import {
  formatDocumentOcrExtractionAnswer,
  isDocumentOcrExtractionQuery,
  matchDocumentOcrExtraction,
} from "@/lib/nepal-ai/documentOcrExtraction";
import {
  formatFinancialStatementInterpretationAnswer,
  isFinancialStatementInterpretationQuery,
  matchFinancialStatementInterpretation,
} from "@/lib/nepal-ai/financialStatementInterpretation";
import {
  formatAccountingComparisonAnswer,
  isAccountingComparisonQuery,
  matchAccountingComparison,
} from "@/lib/nepal-ai/accountingComparisons";
import {
  formatComplexReasoningAnswer,
  matchComplexReasoningScenario,
} from "@/lib/nepal-ai/complexReasoningScenarios";
import {
  formatCrossDomainAnswer,
  matchCrossDomainScenario,
} from "@/lib/nepal-ai/crossDomainScenarios";
import {
  formatClassificationExplanation,
  matchClassificationExplanation,
} from "@/lib/nepal-ai/classificationExplanations";
import {
  formatNovelPatternAnswer,
  formatNovelPatternClarify,
  matchNovelPatternHandler,
} from "@/lib/nepal-ai/novelPatternHandlers";
import {
  formatSectorTermDefinition,
  matchSectorTerm,
} from "@/lib/nepal-ai/sectorTerms";
import {
  confirmationTemplateIntent,
  renderResponseTemplate,
} from "@/lib/nepal-ai/responseTemplates";
import type { KhataIntent, KhataConfirmationCard } from "./types";
import { KHATA_INTENT_LABELS } from "./types";

export type UserLanguage = "nepali" | "english" | "mixed";

export type AccountingQuestionType =
  | "definition"
  | "entry_effect"
  | "classification"
  | "how_to"
  | "comparison"
  | "scenario"
  | "general";

export interface AccountingLanguageResult {
  kind: "answer" | "entry_hint" | "none";
  reply: string;
  language: UserLanguage;
  confidence: number;
  questionType?: AccountingQuestionType;
  relatedIntent?: KhataIntent;
}

/** Bilingual accounting lexicon — maps terms across Nepali ↔ English */
export const ACCOUNTING_LEXICON: Array<{
  concept: string;
  en: string[];
  ne: string[];
  intent?: KhataIntent;
  accountClass?: string;
}> = [
  { concept: "debtors", en: ["debtors", "sundry debtors", "accounts receivable", "receivable"], ne: ["debtor", "lina baki", "receivable"], intent: "khata_credit_sale", accountClass: "asset" },
  { concept: "credit_sale", en: ["credit sale", "sold on credit", "receivable created"], ne: ["udhaar", "udhar", "udhaar bikri", "udhaar diye"], intent: "khata_credit_sale", accountClass: "income" },
  { concept: "cash_sale", en: ["cash sale", "sold for cash"], ne: ["nagad bikri", "nakad bikri", "cash ma becheko"], intent: "khata_cash_sale", accountClass: "income" },
  { concept: "payment_received", en: ["payment received", "collection", "debtor paid"], ne: ["tiryo", "jama", "paisa aayo", "payment aayo"], intent: "khata_payment_in", accountClass: "asset" },
  { concept: "credit_purchase", en: ["credit purchase", "bought on credit", "payable"], ne: ["udhaar kineko", "udhaar ma kineko", "kharid udhaar"], intent: "khata_credit_purchase", accountClass: "liability" },
  { concept: "payment_made", en: ["payment made", "paid supplier"], ne: ["payment gareko", "tirna diye", "bhugtan"], intent: "khata_payment_out", accountClass: "liability" },
  { concept: "expense", en: ["expense", "operating cost"], ne: ["kharcha", "kharcho", "kharch"], intent: "khata_expense", accountClass: "expense" },
  { concept: "bad_debt", en: ["bad debt", "write off", "irrecoverable"], ne: ["bad debt", "nasakne", "ramro chaina"], intent: "khata_bad_debt_writeoff", accountClass: "expense" },
  { concept: "provision", en: ["provision", "doubtful debt", "accrual"], ne: ["andaaja", "provision", "baki"], intent: "khata_provision_bad_debt", accountClass: "expense" },
  { concept: "salary", en: ["salary", "payroll", "wages"], ne: ["talab", "salary", "vetan"], intent: "khata_salary_accrual", accountClass: "expense" },
  { concept: "ssf_employee", en: ["ssf employee", "employee contribution 10%"], ne: ["ssf employee", "karmachari ssf"], intent: "khata_ssf_employee", accountClass: "liability" },
  { concept: "ssf_employer", en: ["ssf employer", "employer contribution 11%"], ne: ["ssf employer", "employer ssf"], intent: "khata_ssf_employer", accountClass: "expense" },
  { concept: "gratuity", en: ["gratuity", "retirement benefit"], ne: ["gratuity", "sewa asthaan"], intent: "khata_gratuity_provision", accountClass: "expense" },
  { concept: "vat", en: ["vat", "value added tax", "output vat", "input vat"], ne: ["vat", "mulya thap kar"], intent: "khata_vat_sales", accountClass: "liability" },
  { concept: "tds", en: ["tds", "withholding tax", "tax deducted"], ne: ["tds", "source ma kar"], intent: "khata_tds_deducted", accountClass: "liability" },
  { concept: "depreciation", en: ["depreciation", "asset write down"], ne: ["depreciation", "mulya ghata"], intent: "khata_depreciation", accountClass: "expense" },
  { concept: "capital", en: ["capital", "owner investment"], ne: ["capital", "puni", "lagaani"], intent: "khata_capital_introduced", accountClass: "equity" },
  { concept: "drawings", en: ["drawings", "owner withdrawal"], ne: ["drawings", "nikasne"], intent: "khata_drawings", accountClass: "equity" },
  { concept: "stock", en: ["stock", "inventory", "cogs", "wip", "merchandise"], ne: ["stock", "saman", "inventory", "mal"], intent: "khata_stock_purchase", accountClass: "stock" },
  { concept: "goodwill", en: ["goodwill", "intangible"], ne: ["goodwill", "sarbhaumik"], accountClass: "asset" },
  { concept: "provision", en: ["provision", "allowance", "doubtful debt"], ne: ["provision", "andaaja", "andaaj"], intent: "khata_provision_bad_debt", accountClass: "liability" },
  { concept: "capital", en: ["capital", "owner investment", "share capital", "equity capital"], ne: ["capital", "puni", "lagaani", "punji"], intent: "khata_capital_introduced", accountClass: "equity" },
  { concept: "trial_balance", en: ["trial balance", "tb"], ne: ["trial balance", "parikshan lekha"], accountClass: "asset" },
  { concept: "balance_sheet", en: ["balance sheet", "statement of financial position"], ne: ["balance sheet", "sampatti dayitwo"], accountClass: "asset" },
  { concept: "bank_overdraft", en: ["bank overdraft", "overdraft"], ne: ["bank overdraft", "atiran"], accountClass: "liability" },
  { concept: "deferred_revenue", en: ["deferred revenue", "unearned revenue", "customer advance"], ne: ["advance", "unearned"], intent: "khata_customer_advance", accountClass: "liability" },
  { concept: "commission", en: ["commission income", "commission"], ne: ["commission", "aamdani commission"], intent: "khata_commission_income", accountClass: "income" },
  { concept: "rent", en: ["rent expense", "rent paid"], ne: ["bhaada", "bhada", "bhada kharcha"], intent: "khata_rent_expense", accountClass: "expense" },
  { concept: "sales_return", en: ["sales return", "credit note"], ne: ["sales return", "firta", "saman firta"], intent: "khata_sales_return", accountClass: "income" },
  { concept: "outstanding", en: ["outstanding", "receivable", "payable", "accrued"], ne: ["baki", "outstanding", "baki kharcha"], intent: "khata_outstanding_expense", accountClass: "liability" },
  { concept: "debit", en: ["debit", "dr", "left side"], ne: ["debit", "jama", "baaya"], accountClass: "asset" },
  { concept: "credit", en: ["credit", "cr", "right side"], ne: ["credit", "kharcha side", "daaya"], accountClass: "liability" },
  { concept: "asset", en: ["asset", "resources owned", "goodwill", "prepaid", "receivable"], ne: ["sampatti", "sampati", "asset", "sampada"], intent: undefined, accountClass: "asset" },
  { concept: "liability", en: ["liability", "obligation", "payable"], ne: ["rin", "dayitwo", "liability"], accountClass: "liability" },
  { concept: "equity", en: ["equity", "capital", "owner stake"], ne: ["puni", "equity", "malik ko hissa"], accountClass: "equity" },
  { concept: "income", en: ["income", "revenue", "sales"], ne: ["aamdani", "income", "bikri"], accountClass: "income" },
  { concept: "gain", en: ["gain", "capital gain"], ne: ["nafa", "gain"], accountClass: "gain" },
  { concept: "loss", en: ["loss", "capital loss"], ne: ["noksan", "loss"], accountClass: "loss" },
];

const QUESTION_PATTERNS: Array<{ type: AccountingQuestionType; pattern: RegExp; weight: number }> = [
  { type: "entry_effect", pattern: /\b(what\s+entry|which\s+entry|entry\s+for|journal\s+entry|debit.*credit|dr.*cr|k\s+entry|entry\s+k\s+hunchha|kata\s+janchha|lekha\s+k\s+hunchha)\b/i, weight: 10 },
  { type: "entry_effect", pattern: /\b(k\s+hunchha|kasari\s+record|how\s+to\s+record|post\s+entry|confirm\s+entry)\b/i, weight: 8 },
  { type: "definition", pattern: /\b(what\s+is|what\s+are|define|explain|meaning|k\s+ho|k\s+hunchha|arth|matlab|bujhaunu|bujhnus|sodhchu)\b/i, weight: 9 },
  { type: "definition", pattern: /(के\s*हो|क\s*हो|भनेको\s*के|अर्थ\s*के|बताउनु|भन्ने\s*के)/i, weight: 9 },
  { type: "classification", pattern: /\b(classify|classification|asset\s+or|income\s+or|liability\s+or|type\s+of|k\s+prakar|kun\s+shreni|khata\s+prakar|is\s+\w+\s+an?\s+(asset|liability|income|expense))\b/i, weight: 9 },
  { type: "how_to", pattern: /\b(how\s+to|how\s+do|kasari|k\s+garne|steps|process|tarika)\b/i, weight: 8 },
  { type: "comparison", pattern: /\b(difference\s+between|vs\.?|versus|farak|bich\s+ko\s+antar|compare)\b/i, weight: 9 },
  { type: "scenario", pattern: /\b(when\s+should|in\s+which\s+case|situation|scenario|k\s+bela|k\s+condition|kun\s+awastha)\b/i, weight: 8 },
];

const ENGLISH_SIGNALS = /\b(the|is|are|was|what|how|when|which|should|would|could|entry|debit|credit|account|journal|asset|liability|expense|income|revenue|provision|depreciation|receivable|payable)\b/i;
const NEPALI_SIGNALS = /\b(k\s*ho|k\s*hunchha|kasari|bhannus|bujhaunu|ko\s+entry|hunchha|udhaar|kharcha|bikri|kharid|tiryo|jama|sampatti|rin|aamdani|nafa|noksan|hisab|lekha|khata|tapai|hajur|chha|garnu|garne|bhannu|sodh)\b|[\u0900-\u097F]/;

export function detectUserLanguage(text: string): UserLanguage {
  const enScore = (text.match(new RegExp(ENGLISH_SIGNALS.source, "gi")) ?? []).length;
  const neScore = (text.match(new RegExp(NEPALI_SIGNALS.source, "gi")) ?? []).length;
  if (enScore > neScore * 1.5) return "english";
  if (neScore > enScore * 1.5) return "nepali";
  return "mixed";
}

function classifyQuestionType(text: string): AccountingQuestionType {
  let best: AccountingQuestionType = "general";
  let bestScore = 0;
  for (const q of QUESTION_PATTERNS) {
    if (q.pattern.test(text) && q.weight > bestScore) {
      bestScore = q.weight;
      best = q.type;
    }
  }
  return best;
}

function scoreConcepts(text: string): Array<{ concept: string; score: number; entry?: (typeof ACCOUNTING_LEXICON)[0] }> {
  const lower = text.toLowerCase();
  const results: Array<{ concept: string; score: number; entry?: (typeof ACCOUNTING_LEXICON)[0] }> = [];

  const aliases: Record<string, string> = {
    sampati: "asset",
    sampatti: "asset",
    sampada: "asset",
    dayitwo: "liability",
    rin: "liability",
    aamdani: "income",
    kharcho: "expense",
    punji: "capital",
    andaaj: "provision",
  };

  for (const term of ACCOUNTING_LEXICON) {
    let score = 0;
    for (const w of term.en) {
      if (lower.includes(w.toLowerCase())) score += w.length;
    }
    for (const w of term.ne) {
      if (lower.includes(w.toLowerCase())) score += w.length;
    }
    if (score > 0) results.push({ concept: term.concept, score, entry: term });
  }

  for (const [alias, concept] of Object.entries(aliases)) {
    if (lower.includes(alias)) {
      const entry = ACCOUNTING_LEXICON.find((t) => t.concept === concept);
      if (entry) results.push({ concept, score: alias.length + 5, entry });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

function isAccountingLanguageQuery(text: string): boolean {
  if (isAccountingDomain(text) && /\b(what|how|when|which|k\s|kasari|explain|define|entry|classify|difference|scenario|bujh|sodh|bhannu|matlab|k\s*ho|ke\s*ho|kun\s*ho|arth)\b/i.test(text)) {
    return true;
  }
  const concepts = scoreConcepts(text);
  const qType = classifyQuestionType(text);
  if (concepts.length >= 1 && qType !== "general") return true;
  if (concepts.length >= 2) return true;
  if (/\b(accounting|hisab|lekha|journal|debit|credit|double\s*entry|balance\s*sheet|trial\s*balance|vat|tds|ssf|gratuity|provision|depreciation|receivable|payable|accrual|prepaid|outstanding|cogs|equity|asset|liability)\b/i.test(text)) {
    return /\b(what|how|when|which|k\s|kasari|explain|define|entry|classify|difference|scenario|situation|bujh|sodh|bhannu|matlab)\b/i.test(text);
  }
  // Glossary / FAQ / regulated lexicon: allow "FIFO k ho", "VAT k ho", "लालपुर्जा के हो", etc.
  if (
    (qType === "definition" ||
      qType === "how_to" ||
      qType === "comparison" ||
      /\b(k\s*ho|ke\s*ho|what\s+is|define|explain|arth|matlab|kasari|kaise|kati)\b/i.test(text) ||
      /(के\s*हो|क\s*हो|भनेको\s*के|अर्थ)/.test(text)) &&
    (matchNepalProcessGuide(text) ||
      matchNepalTaxFaq(text) ||
      matchAccountingFaq(text) ||
      matchAccountingGlossary(text) ||
      matchRegulatedGlossary(text) ||
      matchSectorTerm(text))
  ) {
    return true;
  }
  return false;
}

function localize(label: string, lang: UserLanguage): string {
  if (lang !== "english") return label;
  const map: Record<string, string> = {
    "Credit Sale (Udhaar / Receivable)": "Credit Sale (Receivable)",
    "Payment Received (Receivable Settlement)": "Payment Received",
    "Credit Purchase (Payable / Outstanding)": "Credit Purchase (Payable)",
    "Bad Debt Write-off": "Bad Debt Write-off",
    "Provision for Bad Debts": "Provision for Bad Debts",
    "Salary Accrual (Outstanding Salary)": "Salary Accrual",
    "SSF Employee Contribution (10%)": "SSF Employee Contribution (10%)",
    "SSF Employer Contribution (11%)": "SSF Employer Contribution (11%)",
    "Gratuity Provision": "Gratuity Provision",
    "Sales with VAT (13%)": "Sales with VAT (13%)",
    "Accrued Expense (Outstanding Bill)": "Accrued Expense",
  };
  return map[label] ?? label;
}

function answerEntryEffect(concept: string, intent: KhataIntent | undefined, lang: UserLanguage): string {
  const template = intent ? getEntryTemplate(intent) : findTemplateByKeywords(concept)?.intent ? getEntryTemplate(findTemplateByKeywords(concept)!.intent) : null;
  if (!template) {
    return lang === "english"
      ? "I understand you're asking about a journal entry. Please describe the transaction with amount — e.g. 'bad debt write off 3000' or 'salary accrual 50000'."
      : "Journal entry ko barema sodhnu bhayo. Transaction rakam sahit lekhnu hola — jastai: 'bad debt write off 3000' wa 'salary accrual 50000'.";
  }

  const label = localize(KHATA_INTENT_LABELS[template.intent], lang);
  const sampleLines = template.buildLines({ amount: 10000, narration: "Example" });
  const preview = formatJournalPreview(sampleLines);

  if (lang === "english") {
    return (
      `**${label}**\n\n` +
      `**When to use:** ${template.explanation}\n\n` +
      `**Sample journal (NPR 10,000):**\n${preview}\n\n` +
      `To post an entry, type the transaction with amount — e.g. "${template.keywords[0]} 10000".`
    );
  }
  return (
    `**${label}**\n\n` +
    `**Kahile garni:** ${template.explanation}\n\n` +
    `**Namuna journal (NPR 10,000):**\n${preview}\n\n` +
    `Entry rakhna transaction rakam sahit lekhnu hola — jastai: "${template.keywords[0]} 10000".`
  );
}

/** Extract "X k ho?" / "what is X" term for direct glossary lookup */
function extractDefinitionTerm(text: string): string | null {
  const t = text.trim();
  const ne = t.match(/^(.+?)\s+(k|ke)\s+ho\s*\??$/i);
  if (ne?.[1]) return ne[1].trim();
  const en = t.match(/^(?:what\s+is|what\s+are|define|explain)\s+(.+?)\s*\??$/i);
  if (en?.[1]) return en[1].trim();
  return null;
}

function answerSimpleDefinitionQuestion(
  text: string,
  lang: UserLanguage,
): AccountingLanguageResult | null {
  const term = extractDefinitionTerm(text);
  if (!term || term.length > 48) return null;

  const glossary =
    matchAccountingGlossary(term) ||
    matchAccountingGlossary(text) ||
    getGlossaryByConceptKey(term.replace(/\s+/g, "_"));
  if (glossary) {
    return {
      kind: "answer",
      reply: formatGlossaryDefinition(glossary, lang),
      language: lang,
      confidence: 0.92,
      questionType: "definition",
    };
  }

  const def = answerDefinition(term, lang, text);
  if (def) {
    return {
      kind: "answer",
      reply: def,
      language: lang,
      confidence: 0.9,
      questionType: "definition",
    };
  }

  return null;
}

/** Prefer lexicon glossary; fall back to a few Nepal-specific hard defs not in the user batch. */
function answerDefinition(concept: string, lang: UserLanguage, rawText?: string): string | null {
  const regulated =
    matchRegulatedGlossary(rawText || concept) || matchRegulatedGlossary(concept);
  if (regulated) {
    return formatRegulatedDefinition(regulated, lang);
  }

  const glossary =
    matchAccountingGlossary(rawText || concept) ||
    matchAccountingGlossary(concept) ||
    getGlossaryByConceptKey(concept) ||
    getGlossaryByConceptKey(concept.replace(/\s+/g, "_")) ||
    getGlossaryByConceptKey(concept.replace(/-/g, "_"));

  if (glossary) {
    return formatGlossaryDefinition(glossary, lang);
  }

  // Nepal-specific extras not covered (or more precise) than the plain glossary rows
  const defs: Record<string, { en: string; ne: string }> = {
    lekha: {
      en: "**Accounting (Lekha)** is the systematic recording, classifying, and summarizing of financial transactions. In this ERP it covers khata entries, journals, ledgers, balance sheet, VAT/TDS, and reports.",
      ne: "**लेखा (Lekha)** vaneko arthik len-den, bikri-kharid, kharcha-aamdani ra sampatti-dayitwo lai hisab kitab ma record garne, classify garne ra report banau-ne vyavastha ho. Yo Sutra ERP ma lekha = khata entry, journal, balance sheet, VAT/TDS ra reports.",
    },
    hisab: {
      en: "**Hisab (accounts)** means the books and records of money in and out — parties, balances, udhaar, and daily transactions in your khata.",
      ne: "**हिसाब** vaneko paisa aune-jane, party ko baki, udhaar, ra daily transaction haru ko record ho — tapaiko khata nai hisab ko core ho.",
    },
    khata: {
      en: "**Khata** is your running account book — credit sales (udhaar), payments, purchases, and expenses recorded party-wise.",
      ne: "**खाता** vaneko chalne hisab kitab ho — udhaar bikri, payment, kharid, kharcha party anusar record hunchha. Orbix bata Nepali/English ma entry garna saknuhunchha.",
    },
    accounting: {
      en: "**Accounting** is the language of business finance — assets, liabilities, income, expenses, double-entry journals, and financial statements.",
      ne: "**Accounting** vaneko business finance ko bhasa ho — sampatti, dayitwo, aamdani, kharcha, double-entry journal, ra financial statement.",
    },
    bank_overdraft: {
      en: "Bank overdraft is a **liability** — you owe the bank, not an asset.",
      ne: "Bank overdraft **liability** ho — tapai bank lai tirna baki, asset hoina.",
    },
    ssf_employee: {
      en: "SSF Employee contribution = 10% of basic salary, deducted from employee and remitted to Social Security Fund.",
      ne: "SSF Employee = basic salary ko 10%, employee bata katauchha ra Social Security Fund ma janchha.",
    },
    ssf_employer: {
      en: "SSF Employer contribution = 11% of basic salary, borne by employer as expense.",
      ne: "SSF Employer = basic salary ko 11%, employer le tirne expense ho.",
    },
    gratuity: {
      en: "Gratuity is retirement benefit per Nepal labour law. Provision: Dr Gratuity Expense, Cr Gratuity Provision. Payment: Dr Provision, Cr Bank.",
      ne: "Gratuity retirement benefit ho. Provision: Dr Gratuity Expense, Cr Gratuity Provision. Payment: Dr Provision, Cr Bank.",
    },
  };

  const key = concept in defs ? concept : Object.keys(defs).find((k) => concept.includes(k));
  if (!key) return null;
  const d = defs[key];
  return lang === "english" ? d.en : d.ne;
}

const GENERIC_CLASSES = new Set(["asset", "liability", "equity", "income", "expense", "gain", "loss", "debit", "credit"]);

function pickClassificationConcept(concepts: ReturnType<typeof scoreConcepts>) {
  const specific = concepts.filter((c) => !GENERIC_CLASSES.has(c.concept));
  if (specific.length > 0) return specific[0];
  return concepts[0];
}

function answerClassification(concepts: ReturnType<typeof scoreConcepts>, lang: UserLanguage): string {
  const top = pickClassificationConcept(concepts)?.entry;
  if (!top?.accountClass) {
    return lang === "english"
      ? "Account classes: Asset, Liability, Equity, Income, Expense, Gain, Loss, Stock. Ask about a specific term — e.g. 'is debtors an asset?'"
      : "Khata prakar: Asset, Liability, Equity, Income, Expense, Gain, Loss, Stock. Specific sodhnus — jastai 'debtors asset ho?'";
  }

  const guide = CLASSIFICATION_GUIDE[top.accountClass as keyof typeof CLASSIFICATION_GUIDE];
  if (!guide) return "";

  if (lang === "english") {
    return (
      `**${top.concept}** is classified as **${top.accountClass.toUpperCase()}**.\n\n` +
      `${guide.definition}\n\n` +
      `Debit when: ${guide.debitWhen}\n` +
      `Credit when: ${guide.creditWhen}\n\n` +
      `Examples: ${guide.examples.join(", ")}`
    );
  }
  return (
    `**${top.concept}** lai **${top.accountClass.toUpperCase()}** shreni ma rakhinchha.\n\n` +
    `${guide.definition}\n\n` +
    `Debit kahile: ${guide.debitWhen}\n` +
    `Credit kahile: ${guide.creditWhen}\n\n` +
    `Udaharan: ${guide.examples.join(", ")}`
  );
}

function answerComparison(text: string, lang: UserLanguage): string {
  if (/\b(accrual|cash)\b/i.test(text)) {
    return lang === "english"
      ? "**Accrual vs Cash Basis:**\n• Accrual — record when bill/invoice arises (Nepal IRD default for VAT businesses)\n• Cash — record only when money moves\n\nExample: Electricity bill received but unpaid → Accrual records expense now; Cash waits until payment."
      : "**Accrual vs Cash Basis:**\n• Accrual — bill/invoice aayeko bela record (Nepal IRD default)\n• Cash — paisa move bhayeko bela matra record\n\nUdaharan: Electricity bill aayo tara tirna baki → Accrual le aile expense record garchha.";
  }
  if (/\b(receivable|payable|debtor|creditor)\b/i.test(text)) {
    return lang === "english"
      ? "**Receivable vs Payable:**\n• Receivable (Debtor) = they owe YOU (asset) — credit sales\n• Payable (Creditor) = YOU owe them (liability) — credit purchases"
      : "**Receivable vs Payable:**\n• Receivable (Debtor) = arule tapailai dina baki (asset) — udhaar bikri\n• Payable (Creditor) = tapai le tirna baki (liability) — udhaar kharid";
  }
  if (/\b(income|expense|gain|loss)\b/i.test(text)) {
    return lang === "english"
      ? "**Income vs Expense vs Gain vs Loss:**\n• Income — ordinary revenue (sales, services)\n• Expense — ordinary costs (salary, rent)\n• Gain — non-operating profit (asset sold above book value)\n• Loss — non-operating loss (asset sold below book value)"
      : "**Income vs Expense vs Gain vs Loss:**\n• Income — sadharan revenue (bikri, service)\n• Expense — sadharan kharcha (talab, bhada)\n• Gain — non-operating nafa (asset bechda book value bhanda badhi)\n• Loss — non-operating noksan";
  }
  if (/\b(accrual|provision)\b/i.test(text)) {
    return lang === "english"
      ? "**Accrual vs Provision:**\n• Accrual — record expense/income when obligation/right arises (e.g. unpaid bill)\n• Provision — liability for uncertain amount (e.g. doubtful debts) per IAS 37"
      : "**Accrual vs Provision:**\n• Accrual — bill/rights aayeko bela record\n• Provision — uncertain amount ko liability (jastai bad debt provision)";
  }
  return lang === "english"
    ? "Please specify what to compare — e.g. 'accrual vs cash', 'receivable vs payable', 'income vs expense'."
    : "K compare garne bhannus — jastai 'accrual vs cash', 'receivable vs payable'.";
}

/** Main accounting language understanding — call before generic chat brain */
export function understandAccountingLanguage(text: string): AccountingLanguageResult {
  const lang = detectUserLanguage(text);
  if (!isAccountingLanguageQuery(text)) {
    return { kind: "none", reply: "", language: lang, confidence: 0 };
  }

  const qType = classifyQuestionType(text);
  const concepts = scoreConcepts(text);
  const topConcept = concepts[0];
  const relatedIntent = topConcept?.entry?.intent;

  const wantsDefinition =
    qType === "definition" ||
    qType === "how_to" ||
    /\b(k\s*ho|ke\s*ho|what\s+is|what\s+are|define|explain|meaning|arth|matlab|kasari|kaise|kati)\b/i.test(text) ||
    /(के\s*हो|क\s*हो|भनेको\s*के|अर्थ)/.test(text);

  // Process how-tos (company/PAN/VAT/bank/SSF/loan) before rate/policy tax FAQ
  const processHit = matchNepalProcessGuide(text);
  if (
    processHit &&
    (qType === "how_to" || wantsDefinition || qType === "general" || qType === "comparison")
  ) {
    return {
      kind: "answer",
      reply: formatNepalProcessGuideAnswer(processHit, lang),
      language: lang,
      confidence: 0.93,
      questionType: "how_to",
      relatedIntent,
    };
  }

  // Scanned document schemas (VAT invoice, cheque, bank statement, etc.)
  if (
    isDocumentUnderstandingQuery(text) ||
    isDocumentOcrExtractionQuery(text) ||
    isDocumentComprehensionQuery(text)
  ) {
    const docCmp = matchDocumentComprehensionScenario(text);
    if (docCmp) {
      return {
        kind: "answer",
        reply: formatDocumentComprehensionAnswer(docCmp, lang),
        language: lang,
        confidence: 0.93,
        questionType: "definition",
        relatedIntent,
      };
    }
    const ocrHit = matchDocumentOcrExtraction(text);
    if (ocrHit) {
      return {
        kind: "answer",
        reply: formatDocumentOcrExtractionAnswer(ocrHit, lang),
        language: lang,
        confidence: 0.92,
        questionType: "definition",
        relatedIntent,
      };
    }
    const docHit = matchDocumentUnderstandingType(text);
    if (docHit) {
      return {
        kind: "answer",
        reply: formatDocumentUnderstandingAnswer(docHit, lang),
        language: lang,
        confidence: 0.9,
        questionType: "definition",
        relatedIntent,
      };
    }
  }

  // Novel unseen phrasing — generalize to nearest pattern + suggested intent
  const novelPattern = matchNovelPatternHandler(text);
  if (novelPattern) {
    return {
      kind: "answer",
      reply: formatNovelPatternAnswer(novelPattern, lang),
      language: lang,
      confidence: 0.88,
      questionType: "scenario",
      relatedIntent,
    };
  }

  // System-prompt A/B variant metadata (variant_id / target_behavior lookups only)
  if (isPromptVariantQuery(text)) {
    const promptVariant = matchPromptVariant(text);
    if (promptVariant) {
      return {
        kind: "answer",
        reply: formatPromptVariantSummary(promptVariant, lang),
        language: lang,
        confidence: 0.94,
        questionType: "definition",
        relatedIntent,
      };
    }
  }

  // Classification transparency teaching (why AI classified / asked / corrected)
  const classExplain = matchClassificationExplanation(text);
  if (classExplain) {
    return {
      kind: "answer",
      reply: formatClassificationExplanation(classExplain, lang),
      language: lang,
      confidence: 0.93,
      questionType: "how_to",
      relatedIntent,
    };
  }

  // Complex Nepal business reasoning (exact golden scenario inputs)
  const complexScenario = matchComplexReasoningScenario(text);
  if (complexScenario) {
    return {
      kind: "answer",
      reply: formatComplexReasoningAnswer(complexScenario, lang),
      language: lang,
      confidence: 0.91,
      questionType: "scenario",
      relatedIntent,
    };
  }

  // Cross-domain reasoning (labor/tax/import/property/banking goldens)
  const crossDomain = matchCrossDomainScenario(text);
  if (crossDomain) {
    return {
      kind: "answer",
      reply: formatCrossDomainAnswer(crossDomain, lang),
      language: lang,
      confidence: 0.92,
      questionType: "scenario",
      relatedIntent,
    };
  }

  // Financial statement ratio / interpretation Q&A (sample BS, P&L, CF, TB, bank recon)
  if (isFinancialStatementInterpretationQuery(text)) {
    const finHit = matchFinancialStatementInterpretation(text);
    if (finHit) {
      return {
        kind: "answer",
        reply: formatFinancialStatementInterpretationAnswer(finHit, lang),
        language: lang,
        confidence: finHit.matchedQa ? 0.94 : 0.9,
        questionType: finHit.matchedQa ? "scenario" : "definition",
        relatedIntent,
      };
    }
  }

  // Concept comparisons (Asset vs Liability, VAT vs Income Tax, etc.)
  if (isAccountingComparisonQuery(text) || qType === "comparison") {
    const cmpHit = matchAccountingComparison(text);
    if (cmpHit) {
      return {
        kind: "answer",
        reply: formatAccountingComparisonAnswer(cmpHit, lang),
        language: lang,
        confidence: 0.93,
        questionType: "comparison",
        relatedIntent,
      };
    }
  }

  // Nepal tax FAQ (VAT/TDS/customs — dated legal answers) before generic accounting FAQ
  const taxFaqHit = matchNepalTaxFaq(text);
  if (taxFaqHit && (wantsDefinition || qType === "comparison" || qType === "general")) {
    return {
      kind: "answer",
      reply: formatNepalTaxFaqAnswer(taxFaqHit, lang),
      language: lang,
      confidence: 0.94,
      questionType: "definition",
      relatedIntent,
    };
  }

  // Statutory section / circular / contract clause plain-language explainers
  const legalHit = matchLegalSectionExplainer(text);
  if (
    legalHit &&
    (wantsDefinition || qType === "comparison" || qType === "general" || qType === "how_to")
  ) {
    return {
      kind: "answer",
      reply: formatLegalSectionExplainerAnswer(legalHit, lang),
      language: lang,
      confidence: 0.93,
      questionType: "definition",
      relatedIntent,
    };
  }

  // FAQ (full Q&A) wins over short glossary definitions
  const faqHit = matchAccountingFaq(text);
  if (faqHit && (wantsDefinition || qType === "comparison" || qType === "general")) {
    const faqQType: AccountingQuestionType =
      faqHit.questionType === "process"
        ? "how_to"
        : faqHit.questionType === "comparison"
          ? "comparison"
          : faqHit.questionType === "calculation"
            ? "definition"
            : "definition";
    return {
      kind: "answer",
      reply: formatFaqAnswer(faqHit, lang),
      language: lang,
      confidence: 0.92,
      questionType: faqQType,
      relatedIntent,
    };
  }

  // Nepal regulated terms (VAT, SSF, Lalpurja, company/labor/legal) before plain accounting glossary
  const regulatedHit = matchRegulatedGlossary(text);
  if (regulatedHit && wantsDefinition) {
    return {
      kind: "answer",
      reply: formatRegulatedDefinition(regulatedHit, lang),
      language: lang,
      confidence: 0.9,
      questionType: "definition",
      relatedIntent,
    };
  }

  // Multi-sector business terms (khaja, rod, OTC, bhada, bali…)
  const sectorTermHit = matchSectorTerm(text);
  if (sectorTermHit && wantsDefinition) {
    return {
      kind: "answer",
      reply: formatSectorTermDefinition(sectorTermHit, lang),
      language: lang,
      confidence: 0.89,
      questionType: "definition",
      relatedIntent,
    };
  }

  // Glossary definitions win over entry-effect when user asks "X k ho" / "what is X"
  // (e.g. "journal entry k ho" would otherwise match the entry_effect pattern).
  const glossaryHit = matchAccountingGlossary(text);
  if (glossaryHit && wantsDefinition) {
    return {
      kind: "answer",
      reply: formatGlossaryDefinition(glossaryHit, lang),
      language: lang,
      confidence: 0.88,
      questionType: "definition",
      relatedIntent,
    };
  }

  if (qType === "entry_effect" || (qType === "scenario" && relatedIntent)) {
    const reply = answerEntryEffect(topConcept?.concept ?? text, relatedIntent, lang);
    return { kind: "answer", reply, language: lang, confidence: 0.9, questionType: qType, relatedIntent };
  }

  if (qType === "classification") {
    return { kind: "answer", reply: answerClassification(concepts, lang), language: lang, confidence: 0.85, questionType: qType, relatedIntent };
  }

  if (qType === "comparison") {
    return { kind: "answer", reply: answerComparison(text, lang), language: lang, confidence: 0.85, questionType: qType };
  }

  const defKey = topConcept?.concept ?? (/\bdouble\s*entry\b/i.test(text) ? "double entry" : null);
  const defAnswer = defKey ? answerDefinition(defKey, lang, text) : null;
  if (defAnswer) {
    return { kind: "answer", reply: defAnswer, language: lang, confidence: 0.8, questionType: "definition", relatedIntent };
  }

  if (relatedIntent) {
    const reply = answerEntryEffect(topConcept!.concept, relatedIntent, lang);
    return { kind: "answer", reply, language: lang, confidence: 0.75, questionType: "general", relatedIntent };
  }

  const simpleDef = answerSimpleDefinitionQuestion(text, lang);
  if (simpleDef) return simpleDef;

  const grammarAnswer = answerFromGrammarKnowledge(text, lang);
  if (grammarAnswer && grammarAnswer.confidence >= 0.72) {
    return {
      kind: "answer",
      reply: grammarAnswer.reply,
      language: lang,
      confidence: grammarAnswer.confidence,
      questionType: qType,
    };
  }

  const fallback =
    lang === "english"
      ? "I'm your accounting language assistant. Ask me:\n• 'What entry for bad debt write off?'\n• 'Is debtors an asset or liability?'\n• 'Difference between accrual and cash basis'\n• Or post entries: 'salary accrual 50000'"
      : "Ma tapaiko accounting language sahayogi hun. Sodhnus:\n• 'Bad debt write off ko entry k hunchha?'\n• 'Debtors asset ho ki liability?'\n• 'Accrual ra cash basis ko farak'\n• Wa entry: 'salary accrual 50000'";

  return { kind: "answer", reply: fallback, language: lang, confidence: 0.6, questionType: "general" };
}

/** Build language-aware entry confirmation reply */
export function buildLocalizedEntryReply(card: KhataConfirmationCard, lang?: UserLanguage): string {
  const language = lang ?? detectUserLanguage(card.raw_text);

  const bucket = confirmationTemplateIntent(card.intent);
  if (bucket) {
    const prefer = [
      ...(card.party ? ["party"] : []),
      "amount",
      ...(card.item ? ["item"] : []),
    ];
    const rendered = renderResponseTemplate(
      bucket,
      language === "english" ? "english" : "nepali",
      {
        party: card.party || (language === "english" ? "party" : "party"),
        amount: card.amount,
        item: card.item || (language === "english" ? "goods" : "saamaan"),
        date: card.date,
      },
      { preferEntities: prefer },
    );
    if (rendered) {
      const lines = card.journalLines ?? [];
      if (lines.length > 0) {
        return `${rendered}\n\n📋 **Journal:**\n${formatJournalPreview(lines)}`;
      }
      return rendered;
    }
  }

  const label = localize(KHATA_INTENT_LABELS[card.intent], language);
  const party = card.party || (language === "english" ? "(no party)" : "(party chaina)");
  const lines = card.journalLines ?? [];

  if (language === "english") {
    let reply =
      `📒 **Journal Entry:**\n` +
      `• Type: ${label}\n` +
      `• Party: ${party}\n` +
      `• Amount: NPR ${card.amount.toLocaleString()}\n` +
      (card.item ? `• Description: ${card.item}\n` : "") +
      (card.primaryClass ? `• Class: ${card.primaryClass}\n` : "");
    if (lines.length > 0) reply += `\n📋 **Lines:**\n${formatJournalPreview(lines)}\n`;
    if (card.caExplanation) reply += `\n💡 ${card.caExplanation}\n`;
    reply += `\nClick **Confirm** if correct.`;
    return reply;
  }

  let reply =
    `📒 **CA-Level Entry:**\n` +
    `• Prakar: ${label}\n` +
    `• Party: ${party}\n` +
    `• Rakam: NPR ${card.amount.toLocaleString()}\n` +
    (card.item ? `• Vivaran: ${card.item}\n` : "") +
    (card.primaryClass ? `• Class: ${card.primaryClass}\n` : "");
  if (lines.length > 0) reply += `\n📋 **Journal:**\n${formatJournalPreview(lines)}\n`;
  if (card.caExplanation) reply += `\n💡 ${card.caExplanation}\n`;
  reply += `\nSahi chha bhane **Confirm** thichnus.`;
  return reply;
}

export { detectUserLanguage as detectLanguage, isAccountingLanguageQuery, scoreConcepts };
