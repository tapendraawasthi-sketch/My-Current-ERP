/**
 * e-Khata Smart Work Brain
 *
 * Understands natural-language accounting work in Nepali AND English —
 * not rigid phrase templates. Handles qty × rate, plain "sold/bought/paid",
 * and defaults sensible entry types.
 */

import type { KhataIntent } from "./types";
import { isSemanticTransaction, parseSemanticTransaction } from "./semanticNepaliBrain";

export interface WorkSignals {
  hasNumbers: boolean;
  hasWorkVerb: boolean;
  isQuestion: boolean;
  isConversational: boolean;
  suggestedIntent: KhataIntent | null;
  amount: number | null;
  quantity: number | null;
  unitPrice: number | null;
  item: string | null;
}

const WORK_VERBS =
  /\b(sold|sale|sales|sell|selling|bought|buy|purchase|purchased|paid|pay|payment|received|receive|spent|spend|expense|expenses|income|revenue|earned|earning|invoice|invoiced|billed|billing|udhaar|udhar|credit|tiryo|tireko|kineko|kharid|becheko|bikri|kharcha|salary|vat|tds|depreciation|loan|drawings|capital|stock|discount|provision|accrual|contra|deposit|withdraw|transfer|refund|advance|prepaid|outstanding|write\s*off|recover\w*)\b/i;

const QUESTION =
  /\b(what|how|why|when|where|who|which|k\s*ho|ke\s*ho|kasari|kina|is\s|are\s|do\s+you|does\s|can\s|could\s|would\s|should\s|\?)\b/i;

const CONVERSATIONAL =
  /\b(like|love|hate|favourite|favorite|pasand|feel|think|opinion|hello|hi|hey|namaste|bye|thanks|dhanyabad|joke|funny|movie|momo|khana|weather|how\s+are\s+you|k\s*cha)\b/i;

/** Broader gate: should we attempt accounting entry parse? */
export function shouldTryWorkParse(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (!t || t.length < 3) return false;

  // Semantic understanding — if the brain understands meaning, always try parse
  if (isSemanticTransaction(t)) return true;

  if (QUESTION.test(t) && !WORK_VERBS.test(t)) return false;
  if (CONVERSATIONAL.test(t) && !WORK_VERBS.test(t) && !/\d/.test(t)) return false;

  const hasNumber = /\d/.test(t);
  if (WORK_VERBS.test(t) && hasNumber) return true;
  if (WORK_VERBS.test(t) && /\b(for|worth|total|amount|rs|npr|rupees|each|per)\b/i.test(t))
    return true;

  // Nepali/English amount + weak verb (including all kinne conjugations)
  if (
    hasNumber &&
    /\b(diye|diya|liye|aayo|gayo|diyo|tiryo|kineko|kinyo|kinye|kine|kiniyo|kharid|becheko|kin)\b/i.test(
      t,
    )
  )
    return true;

  // Qty × rate pattern without explicit verb
  if (/\d+\s+\w+\s+(for|at|@)\s*(rs\.?\s*)?\d+/i.test(t)) return true;

  // Nepali genitive price: "50 rupaya ko bag"
  if (/\d+\s+(?:rs|npr|rupees|rupiya|rupya|rupaye|rupaya)\s+ko\s+\w/i.test(t)) return true;

  return false;
}

/** Parse amount including qty × unit price */
export function parseSmartAmount(text: string): {
  amount: number | null;
  quantity: number | null;
  unitPrice: number | null;
} {
  const t = text.replace(/,/g, "").toLowerCase();

  // "200 cups for Rs 50 each" / "200 cups at 50 each" / "200 @ 50"
  const qtyEach =
    t.match(
      /(\d+(?:\.\d+)?)\s+[a-zA-Z]+(?:s|es)?\s+(?:for|at|@)\s*(?:rs\.?\s*|npr\s*)?(\d+(?:\.\d+)?)\s*(?:each|per|a\s+piece)?/i,
    ) ||
    t.match(
      /(\d+(?:\.\d+)?)\s+(?:units?|items?|pcs?|pieces?)\s+(?:at|@|for)\s*(?:rs\.?\s*)?(\d+(?:\.\d+)?)/i,
    );
  if (qtyEach) {
    const qty = parseFloat(qtyEach[1]);
    const unit = parseFloat(qtyEach[2]);
    if (qty > 0 && unit > 0)
      return { amount: Math.round(qty * unit), quantity: qty, unitPrice: unit };
  }

  // "Rs 50 each" with qty word earlier: sold 200 ... 50 each
  const eachMatch = t.match(/(?:rs\.?\s*|npr\s*)?(\d+(?:\.\d+)?)\s*(?:each|per|a\s+piece)/i);
  const qtyMatch = t.match(/\b(\d+(?:\.\d+)?)\s+[a-zA-Z]{2,}/i);
  if (eachMatch && qtyMatch) {
    const qty = parseFloat(qtyMatch[1]);
    const unit = parseFloat(eachMatch[1]);
    if (qty > 0 && unit > 0 && qty !== unit) {
      return { amount: Math.round(qty * unit), quantity: qty, unitPrice: unit };
    }
  }

  // "worth 500" / "worth of 500" / "total 5000" / "amount 3000"
  const worthMatch = t.match(
    /\b(?:worth(?:\s+of)?|total|amount|sum|value)\s*(?:rs\.?\s*|npr\s*)?(\d+(?:\.\d+)?)/i,
  );
  if (worthMatch) {
    const amt = Math.round(parseFloat(worthMatch[1]));
    return { amount: amt, quantity: null, unitPrice: null };
  }

  // "for Rs 500" / "for 500" at end
  const forMatch = t.match(/\bfor\s*(?:rs\.?\s*|npr\s*)?(\d+(?:\.\d+)?)\s*(?:only|total)?\s*$/i);
  if (forMatch) {
    return { amount: Math.round(parseFloat(forMatch[1])), quantity: null, unitPrice: null };
  }

  // Largest number when multiple (prefer total over unit price)
  const numbers = [...t.matchAll(/(?:rs\.?\s*|npr\s*)?(\d+(?:\.\d+)?)/gi)].map((m) =>
    parseFloat(m[1]),
  );
  if (numbers.length >= 2) {
    const sorted = [...numbers].sort((a, b) => b - a);
    // If largest ≈ product of two smaller, use product
    if (
      numbers.length === 2 &&
      sorted[0] === Math.round(sorted[1] * (numbers.find((n) => n !== sorted[1]) ?? 0))
    ) {
      return {
        amount: sorted[0],
        quantity: sorted[1],
        unitPrice: numbers.find((n) => n !== sorted[0] && n !== sorted[1]) ?? null,
      };
    }
    if (numbers.length >= 2) {
      const product = numbers.reduce((a, b) => a * b, 1);
      const max = Math.max(...numbers);
      // Two-number case: likely qty × rate if product >> max
      if (numbers.length === 2 && max < product && product < max * 1000) {
        return { amount: Math.round(product), quantity: numbers[0], unitPrice: numbers[1] };
      }
    }
  }

  // Single / largest number fallback
  if (numbers.length > 0) {
    const max = Math.max(...numbers);
    return { amount: Math.round(max), quantity: null, unitPrice: null };
  }

  return { amount: null, quantity: null, unitPrice: null };
}

/** Classify work intent from natural language (English + Nepali) */
export function classifyWorkIntent(text: string): KhataIntent | null {
  const semantic = parseSemanticTransaction(text);
  if (semantic.intent && semantic.confidence >= 0.65) {
    return semantic.intent;
  }

  const t = text.toLowerCase();

  // Credit sale
  if (
    /\b(udhaar|udhar|udharo|credit\s+sale|on\s+credit)\b/i.test(t) &&
    /\b(sold|sale|becheko|bikri|diye)\b/i.test(t)
  ) {
    return "khata_credit_sale";
  }

  // Payment received
  if (
    /\b(received|receive|got|aayo|aayeko|jama|tiryo|tireko|payment\s+in|collection)\b/i.test(t) &&
    /\b(payment|paisa|money|amount|from|bata)\b/i.test(t) &&
    !/\b(made|out|gave|diye|expense)\b/i.test(t)
  ) {
    return "khata_payment_in";
  }

  // Payment out
  if (
    /\b(paid|payment\s+made|payment\s+out|gave|sent|transfer(?:red)?|bhugtan|tiryo\s+diye)\b/i.test(
      t,
    ) &&
    !/\b(received|in)\b/i.test(t)
  ) {
    return "khata_payment_out";
  }

  // Purchase / bought — all kinne conjugations
  if (
    /\b(bought|buy|purchase|purchased|kineko|kharid|kiniyo|kinyo|kinye|kine|kinna|kinne|procured)\b/i.test(
      t,
    )
  ) {
    if (/\b(udhaar|udhar|credit)\b/i.test(t)) return "khata_credit_purchase";
    return "khata_purchase";
  }

  // Expense / spent
  if (
    /\b(expense|expenses|spent|spend|kharcha|kharcho|paid\s+for)\b/i.test(t) &&
    !/\b(sold|sale|revenue|income)\b/i.test(t)
  ) {
    return "khata_expense";
  }

  // Cash sale — default for "sold" without credit
  if (
    /\b(sold|sale|sales|revenue|income|earned|earning|becheko|bikri|bik)\b/i.test(t) &&
    !/\b(udhaar|udhar|credit|purchase|bought|buy)\b/i.test(t)
  ) {
    if (/\b(cash|nagad|nakad|nakit)\b/i.test(t)) return "khata_cash_sale";
    // Default: sold without credit keyword → cash sale
    return "khata_cash_sale";
  }

  // Salary
  if (/\b(salary|salaries|talab|payroll|wages)\b/i.test(t)) {
    if (/\b(accrual|provision|accrued)\b/i.test(t)) return "khata_salary_accrual";
    return "khata_salary_payment";
  }

  // VAT / TDS / depreciation / bad debt — delegate keywords
  if (/\b(vat\s*paid|vat\s*payment)\b/i.test(t)) return "khata_vat_payment";
  if (/\b(vat\s*sale|vat\s*bikri)\b/i.test(t)) return "khata_vat_sales";
  if (/\b(vat\s*purchase|input\s*vat)\b/i.test(t)) return "khata_vat_purchase";
  if (/\b(tds\s*paid|tds\s*remittance)\b/i.test(t)) return "khata_tds_paid";
  if (/\b(tds\s*deduct|withhold)\b/i.test(t)) return "khata_tds_deducted";
  if (/\b(depreciation|mulya\s*ghata)\b/i.test(t)) return "khata_depreciation";
  if (/\b(bad\s*debt\s*write\s*off|write\s*off|nasakne)\b/i.test(t))
    return "khata_bad_debt_writeoff";
  if (/\b(loan\s*repay|repay\s*loan|rin\s*tiryo)\b/i.test(t)) return "khata_loan_repayment";
  if (/\b(loan\s*received|rin\s*liyo)\b/i.test(t)) return "khata_loan_received";
  if (/\b(drawings|nikasne|withdraw)\b/i.test(t)) return "khata_drawings";
  if (/\b(capital\s*intro|investment|lagaayo)\b/i.test(t)) return "khata_capital_introduced";

  return null;
}

/** Extract item from natural language */
export function extractWorkItem(text: string, intent: KhataIntent | null): string | null {
  const t = text.toLowerCase();

  // "200 cups" / "sold tea" / "bought stationery"
  const qtyItem = t.match(/\b(\d+)\s+([a-zA-Z]{2,20})(?:s|es)?\b/i);
  if (qtyItem && !/^(rs|npr|for|at|each|per|today|yesterday)$/i.test(qtyItem[2])) {
    return qtyItem[2];
  }

  const worthItem = t.match(/\bworth\s+of\s+([a-zA-Z]{2,20})/i);
  if (worthItem) return worthItem[1];

  const soldItem = t.match(
    /\b(?:sold|sale\s+of|selling)\s+(?:(?:\d+\s+\w+\s+)?(?:worth\s+of\s+)?)?([a-zA-Z]{2,20})/i,
  );
  if (soldItem && !/^(worth|for|at|each|today|yesterday|rs|npr)$/i.test(soldItem[1]))
    return soldItem[1];

  if (intent === "khata_expense") {
    const exp = t.match(/\b(?:for|on)\s+([a-zA-Z]{2,20})/i);
    if (exp) return exp[1];
  }

  return null;
}

/** Is this purely conversational (not accounting work)? */
export function isConversationalOnly(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (shouldTryWorkParse(t)) return false;
  if (QUESTION.test(t) && CONVERSATIONAL.test(t)) return true;
  if (/^(do\s+you\s+like|what\s+is\s+your|tell\s+me\s+a\s+joke)/i.test(t)) return true;
  return CONVERSATIONAL.test(t) && !WORK_VERBS.test(t) && !/\d/.test(t);
}

export function analyzeWork(text: string): WorkSignals {
  return {
    hasNumbers: /\d/.test(text),
    hasWorkVerb: WORK_VERBS.test(text),
    isQuestion: QUESTION.test(text),
    isConversational: isConversationalOnly(text),
    suggestedIntent: classifyWorkIntent(text),
    ...parseSmartAmount(text),
    item: extractWorkItem(text, classifyWorkIntent(text)),
  };
}
