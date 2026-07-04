/**
 * e-Khata module — CA-level Nepali accounting entry maker + emotional conversational brain.
 */

export { normalizeNepaliText, transliterateDevanagari, tokenizeNepali } from "./normalizeNepali";
export { generateConversationalReply, analyzeQuestion } from "./conversationalBrain";
export type { ConversationTurn, QuestionAnalysis, QuestionKind } from "./conversationalBrain";
export {
  composeEmotionalReply,
  detectEmotionalContext,
  isEmotionalMessage,
} from "./emotionalBrain";
export type { EmotionalContext, UserEmotion, ResponseTone } from "./emotionalBrain";
export {
  analyzeNepaliMessage,
  generateNepaliReply,
  shouldTryTransactionParse,
  TRANSACTION_SIGNALS,
  searchKnowledge,
} from "./nepaliBrain";
export { parseKhataMessage } from "./parseKhata";
export {
  processEKhataMessage,
  processEKhataMessageAsync,
  checkEKhataLlmStatus,
} from "./processMessage";
export { generateCAEntry, formatJournalPreview, classifyScenario } from "./caEntryEngine";
export {
  understandAccountingLanguage,
  buildLocalizedEntryReply,
  detectUserLanguage,
  isAccountingLanguageQuery,
  ACCOUNTING_LEXICON,
} from "./accountingLanguageBrain";
export type {
  UserLanguage,
  AccountingLanguageResult,
  AccountingQuestionType,
} from "./accountingLanguageBrain";
export {
  CA_CHART_OF_ACCOUNTS,
  CLASSIFICATION_GUIDE,
  classifyAccount,
  getAccountsByClass,
} from "./caAccountClassification";
export {
  CA_ENTRY_TEMPLATES,
  buildJournalLines,
  validateJournalBalance,
  findTemplateByKeywords,
} from "./caEntryTemplates";
export type {
  KhataConfirmationCard,
  KhataIntent,
  KhataParseResult,
  JournalLineDraft,
  AccountClass,
} from "./types";
export { KHATA_INTENT_LABELS, NEPAL_RATES } from "./types";
export {
  shouldTryWorkParse,
  parseSmartAmount,
  classifyWorkIntent,
  analyzeWork,
  isConversationalOnly,
} from "./smartWorkBrain";
export type { WorkSignals } from "./smartWorkBrain";
export {
  parseSemanticFrame,
  parseSemanticTransaction,
  isSemanticTransaction,
  detectSemanticAction,
  mapFrameToIntent,
} from "./semanticNepaliBrain";
export type { SemanticFrame, SemanticAction, SemanticParseResult, PaymentMode } from "./semanticNepaliBrain";
export { askAutonomousBrain, shouldAutonomousWebSearch } from "./autonomousBrain";
export type { AutonomousBrainOptions, AutonomousBrainResult } from "./autonomousBrain";
export { classifyDomain, isAccountingDomain, shouldBlockWebSearch } from "./domainRouter";
export type { EKhataDomain, DomainRouteResult } from "./domainRouter";
export { detectNegation } from "./negationDetector";
export { analyzeMessageMeaning, resolveBestAmount, cleanPartyName } from "./meaningEngine";
export type { MessageMeaning } from "./meaningEngine";
export {
  searchNepaliGrammar,
  synthesizeGrammarContext,
  answerFromGrammarKnowledge,
} from "./grammarKnowledgeBrain";
export type { GrammarHit } from "./grammarKnowledgeBrain";
export type { NegationResult } from "./negationDetector";
export { computeVat, computeSsf, computeTds, computeDiscount, isVatInclusiveText } from "./calculationEngine";
export type { VatBreakdown, SsfBreakdown, TdsBreakdown } from "./calculationEngine";
export {
  createConversationContext,
  detectContextualCommand,
  updateContextAfterConfirm,
  updateContextAfterEntry,
} from "./conversationState";
export {
  recordTrainingFeedback,
  exportTrainingFeedbackAsJsonl,
  downloadTrainingFeedbackExport,
  getTrainingFeedbackCount,
  syncAllTrainingFeedbackToServer,
} from "./trainingFeedback";
export type { TrainingFeedbackRecord, FeedbackLabel } from "./trainingFeedback";
export type { ConversationState, EKhataConversationContext } from "./conversationState";
export { searchWebReal, expandSearchQueries, formatRealSearchAnswer } from "./ekhataWebSearch";
export type { RealSearchResult } from "./ekhataWebSearch";
