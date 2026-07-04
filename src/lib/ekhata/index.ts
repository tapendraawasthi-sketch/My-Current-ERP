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
export { askAutonomousBrain, shouldAutonomousWebSearch } from "./autonomousBrain";
export type { AutonomousBrainOptions, AutonomousBrainResult } from "./autonomousBrain";
