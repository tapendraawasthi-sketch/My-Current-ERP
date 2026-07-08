/**
 * e-Khata Domain Router — classifies user intent domain BEFORE web search or LLM.
 * Prevents accounting terms (sampatti, capital, provision) from hitting Wikipedia.
 */

import { isSemanticTransaction, parseSemanticFrame } from "./semanticNepaliBrain";
import { isNepaliAccountingQuestion } from "../nepal-ai/questionDetect";

export type EKhataDomain =
  | "journal_entry"
  | "accounting_qa"
  | "framework_qa"
  | "compliance_qa"
  | "meta_system"
  | "emotional_chat"
  | "external_fact";

export interface DomainRouteResult {
  domain: EKhataDomain;
  confidence: number;
  /** Never search Wikipedia when true */
  blockWebSearch: boolean;
}

const ACCOUNTING_TERMS =
  /\b(sampati|sampatti|asset|assets|liability|liabilities|equity|puni|dayitwo|rin|aamdani|kharcha|kharcho|debit|credit|dr\b|cr\b|journal|ledger|voucher|hisab|lekha|khata|udhaar|udhar|udharo|receivable|payable|debtor|creditor|provision|accrual|outstanding|prepaid|depreciation|amortization|impairment|goodwill|inventory|stock|cogs|vat|tds|ssf|gratuity|talab|salary|payroll|bikri|becheko|kharid|kineko|tiryo|jama|drawings|capital|loan|contra|reconciliation|trial\s*balance|balance\s*sheet|profit|loss|turnover|working\s*capital|cash\s*flow|ifrs|nas|nfrs|gaap|double\s*entry|write\s*off|bad\s*debt|commission|bhaada|bhada|rent|interest|dividend|opening\s*balance|sales\s*return|purchase\s*return|credit\s*note|debit\s*note|advance|prepaid|fair\s*value|going\s*concern|faithful\s*representation|recognition|measurement|consolidation|audit|revaluation|impairment|deferred|contingent|amortization|ebitda|ebit|gross|net\s*profit|retained\s*earnings|petty\s*cash|imprest|suspense|contra|ledger|narration|fiscal|shrawan|ashadh|ird|ocr|pan\b|esewa|khalti)\b|[\u0900-\u097F]/i;

const FRAMEWORK_TERMS =
  /\b(faithful\s*representation|biswasilo|pratinidhitwo|sambandhitata|relevance|recognition\s*criteria|manyata|mulyankan|nyaya\s*mulya|going\s*concern|chalirakhne|accrual\s*basis|prapti\s*aadhar|conceptual\s*framework|qualitative\s*characteristics|capital\s*maintenance|derecognition|measurement\s*basis|substance\s*over\s*form|materiality|unit\s*of\s*account|present\s*obligation|economic\s*resource|comprehensive\s*income|performance\s*obligation|contract\s*liability|ifrs\s*para|para\s*\d+\.\d+)\b/i;

const COMPLIANCE_TERMS =
  /\b(ird|vat\s*act|income\s*tax|tds\s*rate|ssf\s*rate|gratuity\s*act|labour\s*act|companies\s*act|presumptive\s*tax|advance\s*tax|tax\s*invoice|blacklist|zero\s*rated|exempt\s*supply|reverse\s*charge|excise|customs|withholding|remittance|form\s*13|anna\s*13|pan\s*number|fiscal\s*year|shrawan|ashadh|bs\s*date|nepal\s*tax|statutory|compliance)\b/i;

const ENTRY_SIGNALS =
  /\b(sold|sale|bought|purchase|paid|received|tiryo|tireko|diye|diyo|kineko|kinyo|kinye|kine|kiniyo|kharid|becheko|bikri|kharcha|expense|salary|talab|vat|tds|depreciation|loan|drawings|capital|stock|discount|provision|accrual|contra|deposit|withdraw|refund|return|write\s*off|recover\w*|commission|advance|opening|jama|tirna|bhugtan|firta|firtayo|rupaya|rupiya)\b.*\d|\d.*\b(sold|sale|bought|purchase|paid|received|tiryo|diye|kineko|kinye|kine|kinyo|becheko|kharcha|salary|vat|tds|loan|capital|stock|discount|return|write\s*off|commission|advance|jama|tiryo|diyo|kin)\b/i;

const META_SYSTEM =
  /\b(am\s+i\s+online|online\s*du|online\s*chu|who\s+are\s+you|what\s+are\s+you|what\s+can\s+you|timi\s+ko\s+ho|ke\s+ho\s+timi|your\s+brain|mero\s+brain|ollama|connected|connection)\b/i;

const EMOTIONAL =
  /\b(dukhi|dukh|sad|angry|rish|frustrated|lonely|akela|thak|tired|worried|chinta|hurt|dard|miss|pyar|love|hate|pasand|feel|mood|joke|funny|movie|momo|khana\s*khay|how\s+are\s+you|k\s*cha\s*timro)\b/i;

const EXTERNAL_FACT =
  /\b(weather|mausam|news|population|capital\s*of|prime\s*minister|\bpm\b|president|who\s+is|where\s+is|when\s+did|football|cricket|movie|actor|celebrity)\b/i;

const QUESTION =
  /\b(what|how|why|when|where|who|which|k\s*ho|ke\s*ho|kasari|kina|kun|kati|define|explain|meaning|matlab|arth|farak|difference|compare|classify|entry|journal)\b|\?/i;

export function classifyDomain(text: string): DomainRouteResult {
  const t = text.trim();
  if (!t) {
    return { domain: "emotional_chat", confidence: 1, blockWebSearch: true };
  }

  if (META_SYSTEM.test(t)) {
    return { domain: "meta_system", confidence: 0.95, blockWebSearch: true };
  }

  // Nepal AI question patterns — "noksan k ho" before journal path
  if (isNepaliAccountingQuestion(t)) {
    return { domain: "accounting_qa", confidence: 0.9, blockWebSearch: true };
  }

  // Semantic transaction detection — understands meaning, not just keyword co-occurrence
  if (isSemanticTransaction(t) && !QUESTION.test(t)) {
    return { domain: "journal_entry", confidence: 0.92, blockWebSearch: true };
  }

  const semanticFrame = parseSemanticFrame(t);
  if (
    semanticFrame.action !== "UNKNOWN" &&
    semanticFrame.amount !== null &&
    !semanticFrame.isQuestion &&
    !semanticFrame.isNegated
  ) {
    return { domain: "journal_entry", confidence: 0.88, blockWebSearch: true };
  }

  if (ENTRY_SIGNALS.test(t) && !QUESTION.test(t)) {
    return { domain: "journal_entry", confidence: 0.9, blockWebSearch: true };
  }

  if (FRAMEWORK_TERMS.test(t)) {
    return { domain: "framework_qa", confidence: 0.88, blockWebSearch: true };
  }

  if (COMPLIANCE_TERMS.test(t)) {
    return { domain: "compliance_qa", confidence: 0.85, blockWebSearch: true };
  }

  if (ACCOUNTING_TERMS.test(t)) {
    const isQuestion = QUESTION.test(t);
    if (isQuestion) {
      return { domain: "accounting_qa", confidence: 0.82, blockWebSearch: true };
    }
    if (/\d/.test(t)) {
      return { domain: "journal_entry", confidence: 0.75, blockWebSearch: true };
    }
    return { domain: "accounting_qa", confidence: 0.7, blockWebSearch: true };
  }

  if (EMOTIONAL.test(t) && !ACCOUNTING_TERMS.test(t)) {
    return { domain: "emotional_chat", confidence: 0.7, blockWebSearch: true };
  }

  if (EXTERNAL_FACT.test(t)) {
    return { domain: "external_fact", confidence: 0.75, blockWebSearch: false };
  }

  if (QUESTION.test(t)) {
    return { domain: "external_fact", confidence: 0.5, blockWebSearch: false };
  }

  return { domain: "emotional_chat", confidence: 0.4, blockWebSearch: true };
}

export function isAccountingDomain(text: string): boolean {
  const route = classifyDomain(text);
  return route.blockWebSearch && route.domain !== "meta_system" && route.domain !== "emotional_chat";
}

export function shouldBlockWebSearch(text: string): boolean {
  return classifyDomain(text).blockWebSearch;
}
