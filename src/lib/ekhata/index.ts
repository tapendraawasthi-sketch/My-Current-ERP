/**
 * e-Khata module — self-contained Nepali conversational AI + accounting assistant.
 * No external APIs, no downloads, no Ollama required.
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
export type { KhataConfirmationCard, KhataIntent, KhataParseResult } from "./types";
export type { EKhataProcessResult, EKhataEngine, ProcessMessageOptions } from "./processMessage";
