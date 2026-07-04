// src/lib/falcon/nlpEngine.ts
// Falcon AI — Advanced Natural Language Processing Engine
// Self-contained, no external APIs, pure TypeScript implementation

import { classifyIntent, type FalconIntent } from "./intentTaxonomy";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedQuery {
  original: string;
  normalized: string;
  tokens: string[];
  lemmas: string[];
  nGrams: string[];
  entities: ExtractedEntity[];
  questionType: QuestionType;
  actionVerb: ActionVerb | null;
  targetObject: string | null;
  modifiers: string[];
  isQuestion: boolean;
  isCommand: boolean;
  isGreeting: boolean;
  sentiment: "neutral" | "frustrated" | "curious" | "urgent";
  complexity: "simple" | "moderate" | "complex";
  confidence: number;
}

export type QuestionType =
  | "how-to"
  | "what-is"
  | "where-is"
  | "why"
  | "when"
  | "which"
  | "can-i"
  | "show-me"
  | "list"
  | "explain"
  | "troubleshoot"
  | "compare"
  | "calculate"
  | "navigate"
  | "command"
  | "greeting"
  | "unknown";

export type ActionVerb =
  | "create"
  | "add"
  | "make"
  | "delete"
  | "remove"
  | "edit"
  | "modify"
  | "update"
  | "view"
  | "show"
  | "find"
  | "search"
  | "open"
  | "go"
  | "navigate"
  | "post"
  | "save"
  | "print"
  | "export"
  | "calculate"
  | "check"
  | "verify"
  | "explain"
  | "tell"
  | "help";

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  normalizedValue: string;
  confidence: number;
  position: number;
}

export type EntityType =
  | "module"
  | "voucher"
  | "report"
  | "master"
  | "field"
  | "action"
  | "account"
  | "party"
  | "item"
  | "date"
  | "amount"
  | "percentage"
  | "shortcut"
  | "concept"
  | "error"
  | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// LEXICONS AND PATTERN MAPS
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than",
  "too", "very", "just", "also", "now", "this", "that", "these", "those",
  "and", "but", "or", "if", "because", "until", "while", "please", "me",
  "my", "i", "you", "your", "we", "our", "they", "their", "it", "its",
  "am", "get", "got", "let", "lets", "want", "need", "like", "know",
]);

const LEMMA_MAP: Record<string, string> = {
  creating: "create", created: "create", creates: "create",
  adding: "add", added: "add", adds: "add",
  making: "make", made: "make", makes: "make",
  deleting: "delete", deleted: "delete", deletes: "delete",
  removing: "remove", removed: "remove", removes: "remove",
  editing: "edit", edited: "edit", edits: "edit",
  modifying: "modify", modified: "modify", modifies: "modify",
  updating: "update", updated: "update", updates: "update",
  viewing: "view", viewed: "view", views: "view",
  showing: "show", shown: "show", shows: "show",
  finding: "find", found: "find", finds: "find",
  searching: "search", searched: "search", searches: "search",
  opening: "open", opened: "open", opens: "open",
  going: "go", went: "go", goes: "go", gone: "go",
  navigating: "navigate", navigated: "navigate", navigates: "navigate",
  posting: "post", posted: "post", posts: "post",
  saving: "save", saved: "save", saves: "save",
  printing: "print", printed: "print", prints: "print",
  exporting: "export", exported: "export", exports: "export",
  calculating: "calculate", calculated: "calculate", calculates: "calculate",
  checking: "check", checked: "check", checks: "check",
  verifying: "verify", verified: "verify", verifies: "verify",
  explaining: "explain", explained: "explain", explains: "explain",
  telling: "tell", told: "tell", tells: "tell",
  helping: "help", helped: "help", helps: "help",
  entering: "enter", entered: "enter", enters: "enter",
  recording: "record", recorded: "record", records: "record",
  invoices: "invoice", vouchers: "voucher", entries: "entry",
  payments: "payment", receipts: "receipt", journals: "journal",
  parties: "party", customers: "customer", suppliers: "supplier",
  items: "item", stocks: "stock", accounts: "account",
  ledgers: "ledger", reports: "report", settings: "setting",
  balances: "balance", transactions: "transaction",
};

const SYNONYM_MAP: Record<string, string[]> = {
  invoice: ["bill", "voucher", "receipt", "document"],
  sales: ["selling", "sale", "sell", "sold"],
  purchase: ["buying", "buy", "bought", "procurement"],
  payment: ["pay", "paying", "paid", "disbursement"],
  receipt: ["receive", "receiving", "received", "collection"],
  customer: ["client", "buyer", "debtor", "customer"],
  supplier: ["vendor", "seller", "creditor", "supplier"],
  party: ["customer", "supplier", "vendor", "client"],
  account: ["ledger", "a/c", "ac", "account"],
  journal: ["adjustment", "jv", "manual entry"],
  contra: ["transfer", "fund transfer", "bank transfer"],
  vat: ["tax", "gst", "13%", "value added tax"],
  tds: ["withholding tax", "tax deduction"],
  stock: ["inventory", "goods", "product", "item"],
  warehouse: ["godown", "location", "store", "wh"],
  create: ["make", "add", "new", "generate"],
  view: ["see", "show", "display", "open", "check"],
  delete: ["remove", "erase", "cancel"],
  edit: ["modify", "change", "update", "alter"],
  print: ["export", "pdf", "download"],
  balance: ["outstanding", "due", "remaining"],
  report: ["statement", "summary", "register"],
};

const ACTION_VERB_PATTERNS: Array<{ pattern: RegExp; verb: ActionVerb }> = [
  { pattern: /\b(create|add|make|new|generate|enter|record|pass)\b/i, verb: "create" },
  { pattern: /\b(delete|remove|erase|cancel|void)\b/i, verb: "delete" },
  { pattern: /\b(edit|modify|change|update|alter|correct)\b/i, verb: "edit" },
  { pattern: /\b(view|see|show|display|look|check|open)\b/i, verb: "view" },
  { pattern: /\b(find|search|locate|where)\b/i, verb: "find" },
  { pattern: /\b(go|navigate|open|access|reach)\b/i, verb: "navigate" },
  { pattern: /\b(post|save|submit|finalize)\b/i, verb: "post" },
  { pattern: /\b(print|export|pdf|download)\b/i, verb: "print" },
  { pattern: /\b(calculate|compute|formula|total)\b/i, verb: "calculate" },
  { pattern: /\b(explain|tell|what|describe|define)\b/i, verb: "explain" },
  { pattern: /\b(help|assist|guide)\b/i, verb: "help" },
];

const QUESTION_TYPE_PATTERNS: Array<{ pattern: RegExp; type: QuestionType }> = [
  { pattern: /^how\s+(do|can|to|should|would)\s+/i, type: "how-to" },
  { pattern: /^how\s+/i, type: "how-to" },
  { pattern: /^what\s+(is|are|does|was|were)\s+/i, type: "what-is" },
  { pattern: /^what\s+/i, type: "what-is" },
  { pattern: /^where\s+(is|are|can|do|should)\s+/i, type: "where-is" },
  { pattern: /^where\s+/i, type: "where-is" },
  { pattern: /^why\s+/i, type: "why" },
  { pattern: /^when\s+/i, type: "when" },
  { pattern: /^which\s+/i, type: "which" },
  { pattern: /^can\s+(i|we|you)\s+/i, type: "can-i" },
  { pattern: /^show\s+me\s+/i, type: "show-me" },
  { pattern: /^(list|show|display)\s+(all|the|my)\s+/i, type: "list" },
  { pattern: /^explain\s+/i, type: "explain" },
  { pattern: /\b(error|problem|issue|not\s+working|fail|wrong|bug)\b/i, type: "troubleshoot" },
  { pattern: /\b(compare|difference|vs|versus)\b/i, type: "compare" },
  { pattern: /\b(calculate|compute|formula)\b/i, type: "calculate" },
  { pattern: /^(open|go\s+to|navigate|take\s+me)\s+/i, type: "navigate" },
  { pattern: /^(hi|hello|hey|good\s+(morning|afternoon|evening)|namaste)/i, type: "greeting" },
];

const ERP_ENTITY_PATTERNS: Array<{ pattern: RegExp; type: EntityType; normalizer?: (m: string) => string }> = [
  // Voucher types
  { pattern: /\b(sales?\s*invoice|sales?\s*bill|sales?\s*voucher)\b/i, type: "voucher", normalizer: () => "sales-invoice" },
  { pattern: /\b(purchase\s*invoice|purchase\s*bill|purchase\s*voucher)\b/i, type: "voucher", normalizer: () => "purchase-invoice" },
  { pattern: /\b(payment\s*voucher|payment\s*entry)\b/i, type: "voucher", normalizer: () => "payment-voucher" },
  { pattern: /\b(receipt\s*voucher|receipt\s*entry)\b/i, type: "voucher", normalizer: () => "receipt-voucher" },
  { pattern: /\b(journal\s*voucher|journal\s*entry|jv)\b/i, type: "voucher", normalizer: () => "journal-voucher" },
  { pattern: /\b(contra\s*voucher|contra\s*entry|fund\s*transfer)\b/i, type: "voucher", normalizer: () => "contra-voucher" },
  { pattern: /\b(credit\s*note|cn)\b/i, type: "voucher", normalizer: () => "credit-note" },
  { pattern: /\b(debit\s*note|dn)\b/i, type: "voucher", normalizer: () => "debit-note" },
  { pattern: /\b(sales?\s*return)\b/i, type: "voucher", normalizer: () => "sales-return" },
  { pattern: /\b(purchase\s*return)\b/i, type: "voucher", normalizer: () => "purchase-return" },
  { pattern: /\b(delivery\s*challan)\b/i, type: "voucher", normalizer: () => "delivery-challan" },
  { pattern: /\b(grn|goods\s*receipt\s*note)\b/i, type: "voucher", normalizer: () => "goods-receipt" },
  
  // Reports
  { pattern: /\b(trial\s*balance|tb)\b/i, type: "report", normalizer: () => "trial-balance" },
  { pattern: /\b(balance\s*sheet|bs)\b/i, type: "report", normalizer: () => "balance-sheet" },
  { pattern: /\b(profit\s*(and|&)?\s*loss|p\s*&?\s*l|income\s*statement)\b/i, type: "report", normalizer: () => "profit-loss" },
  { pattern: /\b(day\s*book)\b/i, type: "report", normalizer: () => "day-book" },
  { pattern: /\b(cash\s*book)\b/i, type: "report", normalizer: () => "cash-book" },
  { pattern: /\b(bank\s*book)\b/i, type: "report", normalizer: () => "bank-book" },
  { pattern: /\b(general\s*ledger|gl|ledger\s*report)\b/i, type: "report", normalizer: () => "general-ledger" },
  { pattern: /\b(vat\s*report|gst\s*report|tax\s*report)\b/i, type: "report", normalizer: () => "vat-reports" },
  { pattern: /\b(stock\s*summary|inventory\s*report)\b/i, type: "report", normalizer: () => "stock-summary" },
  { pattern: /\b(aging\s*report|receivable\s*aging|payable\s*aging)\b/i, type: "report", normalizer: () => "aging-report" },
  { pattern: /\b(outstanding\s*receivable)\b/i, type: "report", normalizer: () => "outstanding-receivables" },
  { pattern: /\b(outstanding\s*payable)\b/i, type: "report", normalizer: () => "outstanding-payables" },
  { pattern: /\b(cash\s*flow)\b/i, type: "report", normalizer: () => "cash-flow" },
  { pattern: /\b(tds\s*report)\b/i, type: "report", normalizer: () => "tds-report" },
  
  // Masters
  { pattern: /\b(chart\s*of\s*accounts?|coa)\b/i, type: "master", normalizer: () => "chart-of-accounts" },
  { pattern: /\b(part(y|ies)\s*(directory|master)?)\b/i, type: "master", normalizer: () => "parties" },
  { pattern: /\b(item\s*master|stock\s*master|product\s*master)\b/i, type: "master", normalizer: () => "items" },
  { pattern: /\b(warehouse|godown)\b/i, type: "master", normalizer: () => "warehouses" },
  { pattern: /\b(unit\s*of\s*measure|uom)\b/i, type: "master", normalizer: () => "units" },
  { pattern: /\b(cost\s*cent(er|re))\b/i, type: "master", normalizer: () => "cost-centers" },
  { pattern: /\b(fiscal\s*year)\b/i, type: "master", normalizer: () => "fiscal-year" },
  { pattern: /\b(employee\s*master)\b/i, type: "master", normalizer: () => "employees" },
  { pattern: /\b(payroll)\b/i, type: "master", normalizer: () => "payroll" },
  { pattern: /\b(fixed\s*asset)\b/i, type: "master", normalizer: () => "fixed-assets" },
  
  // Concepts
  { pattern: /\b(vat|value\s*added\s*tax|13\s*%\s*tax)\b/i, type: "concept", normalizer: () => "vat" },
  { pattern: /\b(tds|tax\s*deducted?\s*at\s*source|withholding\s*tax)\b/i, type: "concept", normalizer: () => "tds" },
  { pattern: /\b(debit|dr)\b/i, type: "concept", normalizer: () => "debit" },
  { pattern: /\b(credit|cr)\b/i, type: "concept", normalizer: () => "credit" },
  { pattern: /\b(double\s*entry)\b/i, type: "concept", normalizer: () => "double-entry" },
  { pattern: /\b(depreciation)\b/i, type: "concept", normalizer: () => "depreciation" },
  { pattern: /\b(fifo|first\s*in\s*first\s*out)\b/i, type: "concept", normalizer: () => "fifo" },
  { pattern: /\b(weighted\s*average)\b/i, type: "concept", normalizer: () => "weighted-average" },
  { pattern: /\b(opening\s*balance)\b/i, type: "concept", normalizer: () => "opening-balance" },
  { pattern: /\b(closing\s*balance)\b/i, type: "concept", normalizer: () => "closing-balance" },
  
  // Shortcuts
  { pattern: /\b(f[1-9]|f1[0-2])\b/i, type: "shortcut" },
  { pattern: /\b(ctrl\s*\+\s*[a-z])\b/i, type: "shortcut" },
  { pattern: /\b(alt\s*\+\s*[a-z])\b/i, type: "shortcut" },
  
  // Amounts and percentages
  { pattern: /\b(rs\.?\s*[\d,]+|[\d,]+\s*rupees?)\b/i, type: "amount" },
  { pattern: /\b(\d+\.?\d*\s*%|percent(age)?)\b/i, type: "percentage" },
  
  // Dates
  { pattern: /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/, type: "date" },
  { pattern: /\b(today|yesterday|tomorrow|this\s*(month|week|year))\b/i, type: "date" },
];

const FRUSTRATION_PATTERNS = [
  /\b(not\s+working|doesn't\s+work|can't|cannot|won't|error|problem|issue|bug|wrong|broken|stuck|help)\b/i,
  /\b(why\s+(is|isn't|won't|doesn't|can't))\b/i,
  /[!?]{2,}/,
];

const URGENCY_PATTERNS = [
  /\b(urgent|asap|immediately|now|quick|fast|hurry)\b/i,
  /[!]{2,}/,
];

// ─────────────────────────────────────────────────────────────────────────────
// CORE NLP FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lemmatize(tokens: string[]): string[] {
  return tokens.map((token) => LEMMA_MAP[token] || token);
}

export function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

export function generateNGrams(tokens: string[], maxN: number = 3): string[] {
  const nGrams: string[] = [];
  for (let n = 1; n <= Math.min(maxN, tokens.length); n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      nGrams.push(tokens.slice(i, i + n).join(" "));
    }
  }
  return nGrams;
}

export function expandWithSynonyms(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (token === key || synonyms.includes(token)) {
        expanded.add(key);
        synonyms.forEach((s) => expanded.add(s));
      }
    }
  }
  return Array.from(expanded);
}

export function detectQuestionType(text: string): QuestionType {
  const normalized = text.trim().toLowerCase();
  
  for (const { pattern, type } of QUESTION_TYPE_PATTERNS) {
    if (pattern.test(normalized)) {
      return type;
    }
  }
  
  if (normalized.endsWith("?")) {
    return "what-is";
  }
  
  return "unknown";
}

export function detectActionVerb(text: string): ActionVerb | null {
  const normalized = text.toLowerCase();
  
  for (const { pattern, verb } of ACTION_VERB_PATTERNS) {
    if (pattern.test(normalized)) {
      return verb;
    }
  }
  
  return null;
}

export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const normalized = text.toLowerCase();
  
  for (const { pattern, type, normalizer } of ERP_ENTITY_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      entities.push({
        text: match[0],
        type,
        normalizedValue: normalizer ? normalizer(match[0]) : match[0].toLowerCase().replace(/\s+/g, "-"),
        confidence: 0.9,
        position: match.index || 0,
      });
    }
  }
  
  return entities.sort((a, b) => a.position - b.position);
}

export function detectSentiment(text: string): "neutral" | "frustrated" | "curious" | "urgent" {
  const normalized = text.toLowerCase();
  
  for (const pattern of FRUSTRATION_PATTERNS) {
    if (pattern.test(normalized)) {
      return "frustrated";
    }
  }
  
  for (const pattern of URGENCY_PATTERNS) {
    if (pattern.test(normalized)) {
      return "urgent";
    }
  }
  
  if (text.includes("?") || /^(what|how|why|where|when|which|who)/i.test(normalized)) {
    return "curious";
  }
  
  return "neutral";
}

export function assessComplexity(text: string, entities: ExtractedEntity[]): "simple" | "moderate" | "complex" {
  const wordCount = text.split(/\s+/).length;
  const questionMarks = (text.match(/\?/g) || []).length;
  const entityCount = entities.length;
  
  if (wordCount <= 5 && entityCount <= 1 && questionMarks <= 1) {
    return "simple";
  }
  
  if (wordCount > 20 || entityCount >= 3 || questionMarks > 1) {
    return "complex";
  }
  
  return "moderate";
}

export function extractTargetObject(text: string, entities: ExtractedEntity[]): string | null {
  if (entities.length > 0) {
    const primaryEntity = entities.find(
      (e) => e.type === "voucher" || e.type === "report" || e.type === "master"
    );
    if (primaryEntity) {
      return primaryEntity.normalizedValue;
    }
  }
  
  const objectPatterns = [
    /(?:create|add|make|new)\s+(?:a\s+)?(\w+(?:\s+\w+)?)/i,
    /(?:open|view|show)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
    /(?:how\s+to)\s+(?:\w+\s+)?(?:a\s+)?(\w+(?:\s+\w+)?)/i,
  ];
  
  for (const pattern of objectPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase().replace(/\s+/g, "-");
    }
  }
  
  return null;
}

export function extractModifiers(text: string, tokens: string[]): string[] {
  const modifierPatterns = [
    /\b(today|yesterday|this\s*month|last\s*month|this\s*year)\b/i,
    /\b(all|pending|posted|draft|cancelled|approved)\b/i,
    /\b(customer|supplier|both)\b/i,
    /\b(cash|bank|credit)\b/i,
    /\b(taxable|exempt|zero[- ]?rated)\b/i,
  ];
  
  const modifiers: string[] = [];
  
  for (const pattern of modifierPatterns) {
    const match = text.match(pattern);
    if (match) {
      modifiers.push(match[0].toLowerCase().replace(/\s+/g, "-"));
    }
  }
  
  return modifiers;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PARSING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function parseQuery(query: string): ParsedQuery {
  const original = query.trim();
  const normalized = normalize(original);
  const tokens = tokenize(original);
  const lemmas = lemmatize(tokens);
  const cleanTokens = removeStopWords(lemmas);
  const nGrams = generateNGrams(cleanTokens, 3);
  const entities = extractEntities(original);
  const questionType = detectQuestionType(original);
  const actionVerb = detectActionVerb(original);
  const targetObject = extractTargetObject(original, entities);
  const modifiers = extractModifiers(original, tokens);
  const sentiment = detectSentiment(original);
  const complexity = assessComplexity(original, entities);
  
  const isQuestion = original.includes("?") || 
    /^(how|what|where|why|when|which|can|could|would|should|is|are|do|does)/i.test(normalized);
  
  const isCommand = /^(create|add|make|delete|remove|open|go|show|view|post|save|print)/i.test(normalized);
  
  const isGreeting = questionType === "greeting" ||
    /^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|namaskar)/i.test(normalized);
  
  let confidence = 0.5;
  if (entities.length > 0) confidence += 0.2;
  if (actionVerb) confidence += 0.1;
  if (questionType !== "unknown") confidence += 0.15;
  if (targetObject) confidence += 0.05;
  
  return {
    original,
    normalized,
    tokens,
    lemmas,
    nGrams,
    entities,
    questionType,
    actionVerb,
    targetObject,
    modifiers,
    isQuestion,
    isCommand,
    isGreeting,
    sentiment,
    complexity,
    confidence: Math.min(confidence, 1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY SIMILARITY AND MATCHING
// ─────────────────────────────────────────────────────────────────────────────

export function calculateSimilarity(query1: string, query2: string): number {
  const tokens1 = new Set(removeStopWords(lemmatize(tokenize(query1))));
  const tokens2 = new Set(removeStopWords(lemmatize(tokenize(query2))));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

export function findBestMatch<T extends { keywords: string[] }>(
  query: ParsedQuery,
  candidates: T[],
  scoreThreshold: number = 0.3
): { item: T; score: number } | null {
  let bestMatch: { item: T; score: number } | null = null;
  
  for (const candidate of candidates) {
    const candidateTokens = new Set(
      candidate.keywords.flatMap((k) => removeStopWords(lemmatize(tokenize(k))))
    );
    
    const queryTokens = new Set([
      ...query.lemmas,
      ...query.nGrams,
      ...query.entities.map((e) => e.normalizedValue),
    ]);
    
    let matchCount = 0;
    for (const token of queryTokens) {
      if (candidateTokens.has(token)) {
        matchCount++;
      }
    }
    
    const score = queryTokens.size > 0 ? matchCount / queryTokens.size : 0;
    
    if (score > scoreThreshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { item: candidate, score };
    }
  }
  
  return bestMatch;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP / ELABORATION DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const ELABORATION_PATTERNS = [
  /^(give|tell|show|need|want).{0,24}\b(more\s+)?detail/i,
  /^(more|further|additional)\s+(detail|info|information)/i,
  /^(explain|elaborate|expand)(\s+more|\s+further|\s+that|\s+this)?\b/i,
  /^(in\s+)?detail\s*\??$/i,
  /^(tell\s+me\s+more|more\s+please|be\s+more\s+specific)\b/i,
  /^(what\s+else|anything\s+else)\b/i,
  /^(go\s+on|continue)\s*\??$/i,
];

/** Short follow-ups that ask for more about the previous answer, not a new topic. */
export function isElaborationQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  return ELABORATION_PATTERNS.some((pattern) => pattern.test(q));
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

export interface UserIntent {
  primaryAction: ActionVerb | "query" | "navigate" | "greeting";
  target: string | null;
  targetType: EntityType | null;
  falconIntent: FalconIntent;
  wantsSteps: boolean;
  wantsExplanation: boolean;
  wantsLocation: boolean;
  wantsTroubleshooting: boolean;
  specificFields: string[];
  context: string[];
}

export function extractIntent(parsed: ParsedQuery): UserIntent {
  const falconIntent = classifyIntent(parsed.original);

  const primaryAction: ActionVerb | "query" | "navigate" | "greeting" =
    parsed.isGreeting
      ? "greeting"
      : parsed.actionVerb || (parsed.questionType === "navigate" ? "navigate" : "query");

  const target =
    parsed.targetObject ||
    (parsed.entities.length > 0 ? parsed.entities[0].normalizedValue : null);

  const targetType = parsed.entities.length > 0 ? parsed.entities[0].type : null;

  const wantsSteps = falconIntent === "steps";

  const wantsExplanation =
    falconIntent === "definition" ||
    parsed.questionType === "why";

  const wantsLocation = falconIntent === "nav" || falconIntent === "action_path";

  const wantsTroubleshooting =
    falconIntent === "troubleshoot" || parsed.sentiment === "frustrated";
  
  const specificFields: string[] = [];
  const fieldPatterns = [
    /\b(date|amount|rate|quantity|discount|vat|tds|narration|reference|cheque)\b/gi,
  ];
  for (const pattern of fieldPatterns) {
    const matches = parsed.original.match(pattern);
    if (matches) {
      specificFields.push(...matches.map((m) => m.toLowerCase()));
    }
  }
  
  return {
    primaryAction,
    target,
    targetType,
    falconIntent,
    wantsSteps,
    wantsExplanation,
    wantsLocation,
    wantsTroubleshooting,
    specificFields: [...new Set(specificFields)],
    context: parsed.modifiers,
  };
}
