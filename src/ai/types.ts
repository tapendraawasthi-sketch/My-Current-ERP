/** SUTRA AI — shared types for Nepali/English/Roman intelligence system */

export type LanguageCode = "english" | "nepali" | "roman";
export type InputLanguage = LanguageCode | "auto";

export interface LanguageSegment {
  text: string;
  language: LanguageCode;
  startIndex: number;
  endIndex: number;
}

export interface LanguageDetection {
  detected: LanguageCode;
  confidence: number;
  mixedLanguage: boolean;
  segments: LanguageSegment[];
}

export interface LanguageConfig {
  inputLanguage: InputLanguage;
  outputLanguage: LanguageCode;
  showTranslation: boolean;
  autoDetect: boolean;
  autoSpeakResponses?: boolean;
}

export interface Suggestion {
  correctedText: string;
  confidence: number;
  correctionType: string;
  explanation: string;
  displayText: string;
  metadata?: {
    product?: string;
    amount?: number;
    transactionType?: string;
  };
}

export interface SuggestionResult {
  originalInput: string;
  suggestions: Suggestion[];
  autoCorrect: boolean;
  requiresConfirmation: boolean;
  unknownWords?: string[];
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  contextLength: number;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  numPredict: number;
  numCtx: number;
  seed?: number;
}

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
  format?: "json" | undefined;
}

export interface TransactionEntity {
  type?: "sales" | "purchase" | "return" | "payment" | "receipt" | "query" | "other";
  product?: string;
  productNepali?: string;
  amount?: number;
  quantity?: number;
  unit?: string;
  party?: string;
}

export interface AIResponse {
  understood_input: string;
  confidence: number;
  needs_clarification: boolean;
  suggestions: Array<{
    text: string;
    confidence: number;
    explanation: string;
  }>;
  response: {
    english: string;
    nepali: string;
    roman: string;
  };
  transaction?: TransactionEntity;
  sourceLanguage?: LanguageCode;
  followUp?: string;
  actions?: SutraAiAction[];
  validationIssues?: string[];
  duplicateWarning?: string;
  selfCorrectionNote?: string;
  anomalyWarning?: string;
  stockWarning?: string;
  creditLimitWarning?: string;
  shareText?: string;
  partyPhone?: string;
  quickReplies?: QuickReply[];
}

export interface VatBreakdown {
  gross: number;
  net: number;
  vat: number;
  rate: number;
  inclusive: boolean;
}

export interface QuickReply {
  id: string;
  label: string;
  value: string;
  kind?: "confirm" | "reject" | "party" | "query" | "whatsapp" | "copy";
}

/** Sprint 7 — ERP actions from understood intent */
export type InvoiceTabType = "sales" | "purchase" | "sales-return" | "purchase-return";

export interface AiInvoiceDraft {
  type: InvoiceTabType;
  partyName?: string;
  partyId?: string;
  paymentMode?: "cash" | "credit" | "bank";
  lines?: Array<{
    itemName?: string;
    itemId?: string;
    rate?: number;
    qty?: number;
    unit?: string;
  }>;
  narration?: string;
}

export interface AiPartyDraft {
  partyId: string;
  partyName?: string;
  phone?: string;
  focusPhone?: boolean;
}

export interface SutraAiAction {
  id: string;
  type: "prefill_invoice" | "prefill_khata" | "prefill_party" | "navigate";
  page: string;
  invoiceType?: InvoiceTabType;
  draft?: AiInvoiceDraft;
  khataDraft?: AiKhataDraft;
  partyDraft?: AiPartyDraft;
  agingDirection?: "receivable" | "payable";
  agingSearchTerm?: string;
  label: string;
  labelNepali: string;
}

export interface AiKhataDraft {
  intent:
    | "khata_credit_sale"
    | "khata_cash_sale"
    | "khata_payment_in"
    | "khata_payment_out"
    | "khata_purchase"
    | "khata_credit_purchase"
    | "khata_expense";
  party?: string;
  partyId?: string;
  amount: number;
  item?: string;
  date: string;
  rawText: string;
  narration?: string;
}

export interface ExtractedLineItem {
  product?: string;
  productNepali?: string;
  productEnglish?: string;
  itemId?: string;
  amount?: number;
  quantity?: number;
  unit?: string;
  itemRate?: number;
}

export interface ExtractedPartyLine {
  party?: string;
  amount: number;
}

export interface AnalysisDimension {
  name: string;
  findings: string[];
  score: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  clarificationQuestion?: string;
}

export interface ParallelTranslation {
  english: string;
  nepali: string;
  roman: string;
  sourceLanguage: LanguageCode;
  targetLanguage?: LanguageCode;
}

export interface ReasoningStep {
  step: number;
  name: string;
  detail: string;
  data?: Record<string, unknown>;
}

export interface ChainOfThoughtResult {
  steps: ReasoningStep[];
  finalInterpretation: string;
  confidence: number;
  entities: Record<string, unknown>;
  dimensions?: AnalysisDimension[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  language?: LanguageCode;
  entities?: ExtractedEntities;
  intent?: IntentType;
}

/** Sprint 3 — structured entities from user input */
export interface ExtractedEntities {
  product?: string;
  productNepali?: string;
  productEnglish?: string;
  amount?: number;
  quantity?: number;
  unit?: string;
  party?: string;
  partyId?: string;
  partyResolvedName?: string;
  partyAmbiguous?: string[];
  itemId?: string;
  itemAmbiguous?: string[];
  itemRate?: number;
  ragConfidence?: number;
  agent?: string;
  paymentMode?: "cash" | "credit" | "bank" | "unknown";
  dateRef?: string;
  resolvedDate?: string;
  verb?: string;
  transactionType?: "sales" | "purchase" | "return" | "payment" | "receipt" | "expense";
  vatBreakdown?: VatBreakdown;
  lines?: ExtractedLineItem[];
  partyLines?: ExtractedPartyLine[];
}

/** Sprint 3 — multi-turn session state (Levels 5–7 context) */
export interface SessionState {
  lastProduct?: string;
  lastProductNepali?: string;
  lastAmount?: number;
  lastQuantity?: number;
  lastUnit?: string;
  lastParty?: string;
  lastIntent?: IntentType;
  lastTransactionType?: string;
  lastUserText?: string;
  awaiting?: "amount" | "product" | "party" | "confirmation" | null;
  pendingAction?: PendingSutraAction | null;
  topicStack: string[];
  turnCount: number;
}

/** Sprint 16 — held transaction awaiting yes/no confirmation */
export interface PendingSutraAction {
  understoodInput: string;
  entities: ExtractedEntities;
  intent: IntentType;
  warnings: string[];
  outputLanguage: LanguageCode;
}

/** Sprint 13 — persisted session snapshot */
export interface PersistedConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  language?: LanguageCode;
  intent?: IntentType;
}

export interface SessionSnapshot {
  userId: string;
  turns: PersistedConversationTurn[];
  session: SessionState;
  domainContext: DomainContext;
  uiMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    text: string;
    timestamp: string;
  }>;
  updatedAt: number;
}

export interface ResolvedInput {
  original: string;
  resolved: string;
  wasResolved: boolean;
  resolutionType?: "pronoun" | "continuation" | "correction" | "demonstrative" | "repeat";
  explanation?: string;
}

export interface DomainContext {
  businessType?: string;
  commonProducts?: string[];
  commonParties?: string[];
  recentTopics?: string[];
}

/** Sprint 8 — live ERP data for RAG entity resolution */
export interface ErpPartyRef {
  id: string;
  name: string;
  nameNepali?: string;
  code?: string;
  type?: string;
  balance?: number;
  creditLimit?: number;
  creditDays?: number;
  lastInvoiceDate?: string;
  phone?: string;
}

export interface ErpItemRef {
  id: string;
  name: string;
  nameNepali?: string;
  code?: string;
  unit?: string;
  saleRate?: number;
  purchaseRate?: number;
  stockQty?: number;
  reorderLevel?: number;
}

export interface ErpKhataEntry {
  id: string;
  date: string;
  narration?: string;
  amount: number;
  party?: string;
  intent: string;
  voucherNo: string;
}

export interface ErpKhataPartyBalance {
  party: string;
  totalReceivable: number;
  totalPayable: number;
  netBalance: number;
  lastTransactionDate: string;
  transactionCount: number;
}

export interface ErpPnlSnapshot {
  period: "today" | "this_week" | "current_month" | "last_month" | "current_fy";
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  entryCount: number;
}

export interface ErpTrialBalanceSummary {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  rowCount: number;
}

export interface ErpProactiveAlert {
  id: string;
  severity: "info" | "warning" | "danger";
  nepali: string;
  english: string;
  roman: string;
}

export interface ErpInvoiceRef {
  id: string;
  invoiceNo: string;
  date: string;
  partyName?: string;
  grandTotal: number;
  type: string;
  status?: string;
  lines?: Array<{ itemName?: string; itemId?: string; rate?: number; qty?: number }>;
}

export interface ErpPartyStats {
  partyName: string;
  invoiceCount: number;
  avgAmount: number;
  totalAmount: number;
}

export interface ErpBusinessInsights {
  todaySalesTotal: number;
  todayInvoiceCount: number;
  topParties: ErpPartyStats[];
  topProducts: Array<{ name: string; qty: number; amount: number }>;
}

export interface ErpRagContext {
  parties?: ErpPartyRef[];
  items?: ErpItemRef[];
  recentInvoices?: ErpInvoiceRef[];
  partyStats?: ErpPartyStats[];
  businessInsights?: ErpBusinessInsights;
  recentKhata?: ErpKhataEntry[];
  khataPartyBalance?: ErpKhataPartyBalance;
  pnlSnapshot?: ErpPnlSnapshot;
  trialBalance?: ErpTrialBalanceSummary;
  cashBalance?: number;
  bankBalance?: number;
  fiscalYear?: { label: string; startDate: string; endDate: string };
}

export interface RagMatch<T> {
  ref: T;
  score: number;
  matchedField: string;
}

export interface UserProfile {
  userId: string;
  preferredInputLanguage: InputLanguage;
  preferredOutputLanguage: LanguageCode;
  commonMisspellings: Record<string, string>;
  customTerms: string[];
  frequentWords: Record<string, number>;
  businessType?: string;
  commonProducts: string[];
  commonParties: string[];
  preferredTransactionTypes: string[];
  correctionAcceptanceRate: number;
  averageResponseTimeMs: number;
  totalInteractions: number;
  errorRate: number;
  lastActiveAt?: string;
}

export interface UserInteraction {
  input: string;
  intent?: IntentType;
  accepted?: boolean;
  corrected?: boolean;
  responseTimeMs?: number;
  timestamp: Date;
}

export interface LearningStats {
  totalCorrections: number;
  globalAcceptanceRate: number;
  autoCorrectPatterns: number;
  topMisspellings: Array<{ original: string; corrected: string; rate: number }>;
}

export interface ConfidenceFactors {
  editDistance: number;
  phoneticSimilarity: number;
  contextRelevance: number;
  frequencyInCorpus: number;
  userHistoryMatch: number;
  domainRelevance: number;
}

export interface VocabularyEntry {
  nepali: string;
  romanVariants: string[];
  english: string;
  category: string;
  unit: string[];
  commonMisspellings: string[];
  frequency: number;
}

export type IntentType =
  | "SALES_ENTRY"
  | "PURCHASE_ENTRY"
  | "RETURN_ENTRY"
  | "QUERY"
  | "REPORT_REQUEST"
  | "CORRECTION"
  | "CONFIRMATION"
  | "REJECTION"
  | "OTHER";

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  entities: Record<string, unknown>;
}

export interface ProcessInputOptions {
  languageConfig?: Partial<LanguageConfig>;
  userId?: string;
  useLlm?: boolean;
  domainContext?: DomainContext;
  erpContext?: ErpRagContext;
}

export interface ProcessInputResult {
  detection: LanguageDetection;
  suggestions: SuggestionResult | null;
  reasoning: ChainOfThoughtResult;
  response: AIResponse;
  intent?: IntentClassification;
  entities?: ExtractedEntities;
  resolvedInput?: ResolvedInput;
  rawLlmResponse?: string;
  processingTimeMs: number;
  autoCorrected?: { from: string; to: string };
  assistantText?: string;
  assistantParallel?: ParallelTranslation;
  llmUsed?: boolean;
  llmCacheHit?: boolean;
  llmRouteReason?: string;
  shortcutAction?: "clear_history" | "dismiss_digest" | "snooze_digest" | "show_digest";
  snoozeDigestHours?: number;
}
