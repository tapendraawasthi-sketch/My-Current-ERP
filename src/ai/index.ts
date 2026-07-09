/** SUTRA AI — public API exports */

export { IntelligenceCore, intelligenceCore } from "./core/IntelligenceCore";
export { OllamaClient, defaultOllamaClient } from "./core/OllamaClient";
export { ContextManager, defaultContextManager } from "./core/ContextManager";
export { ReasoningEngine } from "./core/ReasoningEngine";

export { LanguageDetector, languageDetector, detectLanguage } from "./language/LanguageDetector";
export { NepaliProcessor, nepaliProcessor } from "./language/NepaliProcessor";
export { RomanNepaliProcessor, romanNepaliProcessor } from "./language/RomanNepaliProcessor";
export { TranslationEngine, translationEngine } from "./language/TranslationEngine";
export { OutputFormatter, outputFormatter } from "./language/OutputFormatter";
export { Transliterator, transliterator } from "./language/Transliterator";

export { SpellingCorrector, spellingCorrector } from "./error-correction/SpellingCorrector";
export { PhoneticMatcher, phoneticMatcher } from "./error-correction/PhoneticMatcher";
export { ErrorDetector, errorDetector } from "./error-correction/ErrorDetector";
export { GrammarAnalyzer, grammarAnalyzer } from "./error-correction/GrammarAnalyzer";
export { IntentClarifier, intentClarifier } from "./error-correction/IntentClarifier";
export { SuggestionEngine, suggestionEngine } from "./error-correction/SuggestionEngine";
export { ConfidenceScorer, confidenceScorer } from "./error-correction/ConfidenceScorer";

export { DomainKnowledge, domainKnowledge } from "./knowledge/DomainKnowledge";
export { ProductCatalog, productCatalog } from "./knowledge/ProductCatalog";
export { NepaliVocabulary, nepaliVocabulary } from "./knowledge/NepaliVocabulary";
export { CommonMisspellings, commonMisspellings } from "./knowledge/CommonMisspellings";
export { ContextualMemory, contextualMemory } from "./knowledge/ContextualMemory";
export { UserProfileManager, userProfileManager } from "./knowledge/UserProfileManager";

export { LearningEngine, learningEngine } from "./learning/LearningEngine";

export { responseValidator, ResponseValidator } from "./validation/ResponseValidator";
export { emotionalFormatter, EmotionalFormatter } from "./conversation/EmotionalFormatter";
export { actionExecutor, ActionExecutor } from "./actions/ActionExecutor";
export { saveAiInvoiceDraft, consumeAiInvoiceDraft, AI_INVOICE_DRAFT_KEY } from "./actions/invoiceDraft";
export {
  saveAiPartyDraft,
  consumeAiPartyDraft,
  peekAiPartyDraft,
  AI_PARTY_DRAFT_KEY,
} from "./actions/partyDraft";

export { erpRagRetriever, ErpRagRetriever, toErpRagContext, computeItemStock } from "./rag/ErpRagRetriever";
export { entityEnricher, EntityEnricher } from "./rag/EntityEnricher";
export { hybridLlmRouter, HybridLlmRouter } from "./routing/HybridLlmRouter";
export { feedbackStore, FeedbackStore } from "./learning/FeedbackStore";
export { feedbackCalibrator, FeedbackCalibrator } from "./learning/FeedbackCalibrator";
export { profileSyncStore, ProfileSyncStore } from "./learning/ProfileSyncStore";
export { ledgerQueryHandler, LedgerQueryHandler } from "./rag/LedgerQueryHandler";
export { stockQueryHandler, StockQueryHandler } from "./rag/StockQueryHandler";
export { khataQueryHandler, KhataQueryHandler } from "./rag/KhataQueryHandler";
export { khataRagProvider, KhataRagProvider } from "./rag/KhataRagProvider";
export { reportQueryHandler, ReportQueryHandler } from "./rag/ReportQueryHandler";
export { batchQueryHandler, BatchQueryHandler } from "./rag/BatchQueryHandler";
export { proactiveAlertEngine, ProactiveAlertEngine } from "./intelligence/ProactiveAlertEngine";
export { selfCorrectionEngine, SelfCorrectionEngine } from "./reasoning/SelfCorrectionEngine";
export { duplicateGuard, DuplicateGuard } from "./guard/DuplicateGuard";
export { shortcutRouter, ShortcutRouter } from "./routing/ShortcutRouter";
export { invoiceQueryHandler, InvoiceQueryHandler } from "./rag/InvoiceQueryHandler";
export { paymentReceiptHandler, PaymentReceiptHandler } from "./rag/PaymentReceiptHandler";
export {
  insightQueryHandler,
  InsightQueryHandler,
  computeBusinessInsights,
  computePartyStats,
} from "./rag/InsightQueryHandler";
export { invoiceHistoryEnricher, InvoiceHistoryEnricher } from "./rag/InvoiceHistoryEnricher";
export { anomalyDetector, AnomalyDetector } from "./intelligence/AnomalyDetector";
export { confirmationGate, ConfirmationGate } from "./guard/ConfirmationGate";
export { multiItemEntityParser, MultiItemEntityParser } from "./context/MultiItemEntityParser";
export {
  buildAiKhataDraft,
  resolveKhataIntent,
  toKhataConfirmationCard,
} from "./actions/KhataCardBuilder";
export { saveAiKhataDraft, consumeAiKhataDraft, peekAiKhataDraft } from "./actions/khataDraft";
export { dateResolver, DateResolver } from "./context/DateResolver";
export { correctionEngine, CorrectionEngine } from "./context/CorrectionEngine";
export { comparisonQueryHandler, ComparisonQueryHandler } from "./rag/ComparisonQueryHandler";
export {
  partyDisambiguationHandler,
  PartyDisambiguationHandler,
} from "./rag/PartyDisambiguationHandler";
export { receivableQueryHandler, ReceivableQueryHandler } from "./rag/ReceivableQueryHandler";
export {
  compoundTransactionHandler,
  CompoundTransactionHandler,
} from "./rag/CompoundTransactionHandler";
export { unitPriceEnricher, UnitPriceEnricher } from "./context/UnitPriceEnricher";
export { compoundPartyParser, CompoundPartyParser } from "./context/CompoundPartyParser";
export { teachBackFormatter, TeachBackFormatter } from "./conversation/TeachBackFormatter";
export { stockGuard, StockGuard } from "./guard/StockGuard";
export { vatEnricher, VatEnricher } from "./context/VatEnricher";
export { expenseEntryHandler, ExpenseEntryHandler } from "./rag/ExpenseEntryHandler";
export { cashBalanceQueryHandler, CashBalanceQueryHandler } from "./rag/CashBalanceQueryHandler";
export { dailyDigestQueryHandler, DailyDigestQueryHandler } from "./rag/DailyDigestQueryHandler";
export { dailyDigestEngine, DailyDigestEngine } from "./intelligence/DailyDigestEngine";
export {
  followUpSuggestionEngine,
  FollowUpSuggestionEngine,
} from "./intelligence/FollowUpSuggestionEngine";
export { offlineReplyEnhancer, OfflineReplyEnhancer } from "./conversation/OfflineReplyEnhancer";
export { buildExamplesResponse } from "./routing/ExamplesRouter";
export { globalSearchHandler, GlobalSearchHandler } from "./rag/GlobalSearchHandler";
export { productRateQueryHandler, ProductRateQueryHandler } from "./rag/ProductRateQueryHandler";
export { unknownPartyHandler, UnknownPartyHandler } from "./rag/UnknownPartyHandler";
export {
  gracefulFallbackHandler,
  GracefulFallbackHandler,
} from "./intelligence/GracefulFallbackHandler";
export {
  downloadChatExport,
  exportChatAsText,
  exportChatAsJson,
} from "./interface/ChatExportUtils";
export { resolveFiscalYear } from "./context/FiscalYearResolver";
export { computePnlFromInvoices } from "./rag/FiscalPnlCalculator";
export { creditLimitGuard, CreditLimitGuard } from "./guard/CreditLimitGuard";
export { paymentModeEnricher, PaymentModeEnricher } from "./context/PaymentModeEnricher";
export { overdueReceivableEngine, OverdueReceivableEngine } from "./intelligence/OverdueReceivableEngine";
export { overdueQueryHandler, OverdueQueryHandler } from "./rag/OverdueQueryHandler";
export { partyOnboardingHandler, PartyOnboardingHandler } from "./rag/PartyOnboardingHandler";
export {
  formatReceivableReminder,
  formatPayableReminder,
  formatForWhatsApp,
  buildWhatsAppUrl,
  copyWhatsAppText,
  openWhatsAppShare,
} from "./conversation/WhatsAppShareFormatter";
export { reminderQueryHandler, ReminderQueryHandler } from "./rag/ReminderQueryHandler";
export { batchPaymentHandler, BatchPaymentHandler } from "./rag/BatchPaymentHandler";
export { appendPipelineTrace } from "./intelligence/PipelineTraceBuilder";
export { formatInvoiceShare, formatInvoiceListShare } from "./conversation/InvoiceShareFormatter";
export { pickTtsText, shouldPreferShareTts } from "./conversation/VoiceReminderSpeaker";
export {
  multilingualReplyPolisher,
  MultilingualReplyPolisher,
} from "./conversation/MultilingualReplyPolisher";
export {
  quickReplyLearningStore,
  QuickReplyLearningStore,
} from "./learning/QuickReplyLearningStore";
export { llmResponseCache, LlmResponseCache } from "./learning/LlmResponseCache";
export { sessionSummaryEngine, SessionSummaryEngine } from "./intelligence/SessionSummaryEngine";
export { returnTransactionHandler, ReturnTransactionHandler } from "./rag/ReturnTransactionHandler";
export { partyPhoneQueryHandler, PartyPhoneQueryHandler } from "./rag/PartyPhoneQueryHandler";
export { partyPhoneEditHandler, PartyPhoneEditHandler } from "./rag/PartyPhoneEditHandler";
export {
  wasDigestShownToday,
  markDigestShownToday,
  dismissDigestForToday,
  snoozeDigestUntilTomorrow,
  snoozeDigestForHours,
  isDigestBlocked,
  getDigestSnoozeRemainingMs,
  restoreDigestVisibility,
  formatDigestHiddenLabel,
  formatDailyDigestHeader,
  formatDigestSnoozeChip,
  formatDigestSnoozeTitle,
  formatDigestShowAgainLabel,
  buildDigestShowQuickReply,
  formatDigestDismissReply,
  formatDigestSnoozeReply,
  formatDigestShowReply,
  isDigestHiddenChipMessage,
  withoutDigestHiddenChips,
  clearDigestShownMarker,
} from "./intelligence/DigestShownTracker";
export {
  saveAiChatQueryDraft,
  consumeAiChatQueryDraft,
  peekAiChatQueryDraft,
  buildSetPhoneHandoffQuery,
  saveAgingSetphoneReturnDraft,
  peekAgingSetphoneReturnDraft,
  consumeAgingSetphoneReturnDraft,
  encodeAgingReturnQuickReplyValue,
  decodeAgingReturnQuickReplyValue,
  formatAgingReturnQuickReplyLabel,
  formatAgingReturnConfirmation,
  AI_CHAT_QUERY_DRAFT_KEY,
  AI_AGING_SETPHONE_RETURN_KEY,
  AGING_RETURN_QR_PREFIX,
} from "./actions/chatQueryDraft";
export {
  saveAiAgingReminderDraft,
  consumeAiAgingReminderDraft,
  peekAiAgingReminderDraft,
  buildReminderQueryFromDraft,
  queueAgingWaAutoOpen,
  consumeAgingWaAutoOpen,
  AI_AGING_REMINDER_DRAFT_KEY,
  AI_AGING_WA_AUTO_OPEN_KEY,
} from "./actions/agingReminderDraft";
export {
  encodeWaOpenValue,
  decodeWaOpenValue,
  formatWaOpenConfirmation,
  encodeCopyValue,
  decodeCopyValue,
  formatCopyConfirmation,
  WA_OPEN_PREFIX,
  COPY_TEXT_PREFIX,
} from "./actions/waQuickReplyBridge";
export { formatCacheHitSparkline, formatCacheStatsLine, formatCacheSparklineTooltip, buildCacheStatsSummary } from "./learning/CacheHitSparkline";
export {
  readDigestPinnedPreference,
  writeDigestPinnedPreference,
  formatCacheClearConfirm,
  agingWaButtonLabel,
  formatDigestPinLabels,
  formatCacheSyncMessage,
  formatCachedBadgeLabel,
  formatCachedHeaderSubtitle,
  formatRuleBasedHeaderSubtitle,
  formatCachedBadgeTooltip,
  formatAgingSearchPlaceholder,
  formatAgingReminderModalTitle,
  formatCacheClearQuickReplyLabel,
  formatCacheClearedReply,
  formatProactiveAlertsHeader,
  formatAgingRemindWaButton,
  formatAgingRemindCopyButton,
  formatChatSyncMessage,
  formatAnalyzingLabel,
  formatAutoCorrectedLabel,
} from "./intelligence/DigestPinPreference";
export { cacheStatsQueryHandler, CacheStatsQueryHandler } from "./rag/CacheStatsQueryHandler";
export {
  parseSearchPartyFilter,
  parseOverduePartyFilter,
  filterPartiesByKind,
} from "./context/PartyTypeFilter";
export {
  queuePartyPhoneSavedNotice,
  consumePartyPhoneSavedNotice,
  formatPartyPhoneSavedMessage,
  buildPhoneSavedQuickReplies,
  getPhoneSavedQuickReplyLabels,
  encodePhoneSavedWaValue,
  decodePhoneSavedWaValue,
  tryHandlePhoneSavedWaQuickReply,
  encodePhoneSavedCopyValue,
  decodePhoneSavedCopyValue,
  tryHandlePhoneSavedCopyQuickReply,
  buildPhoneSavedReminderShare,
  buildPhoneSavedReminderQuery,
  formatWhatsAppSentConfirmation,
  PHONE_SAVED_WA_PREFIX,
  PHONE_SAVED_COPY_PREFIX,
} from "./actions/partyPhoneSavedBridge";
export {
  saveAiAgingReportDraft,
  consumeAiAgingReportDraft,
  peekAiAgingReportDraft,
  AI_AGING_REPORT_DRAFT_KEY,
} from "./actions/agingReportDraft";
export {
  normalizeWhatsAppPhone,
  resolvePartyPhone,
  phoneFromPartyRef,
} from "./context/PartyPhoneResolver";
export {
  exportLearningBundle,
  importLearningBundle,
  downloadLearningBundle,
} from "./learning/ProfileCloudSync";
export type { CloudSyncBundle } from "./learning/ProfileCloudSync";

export { phraseUsageStore, PhraseUsageStore } from "./learning/PhraseUsageStore";
export {
  sessionMemoryStore,
  SessionMemoryStore,
  applySnapshotToContext,
  buildUiMessagesFromSnapshot,
} from "./learning/SessionMemoryStore";

export { getAutocompleteSuggestions } from "./interface/InputAutocompleteEngine";
export type { AutocompleteSuggestion, AutocompleteContext } from "./interface/InputAutocompleteEngine";
export {
  speakText,
  stopSpeaking,
  isSpeechSynthesisSupported,
} from "./interface/VoiceOutput";
export {
  prepareTextForSpeech,
  speechTextForLanguage,
  pickSpeechVoice,
  ensureVoicesLoaded,
} from "./interface/ttsUtils";

export { EntityExtractor, entityExtractor } from "./context/EntityExtractor";
export { IntentClassifier, intentClassifier } from "./context/IntentClassifier";
export { ContextResolver, contextResolver } from "./context/ContextResolver";
export { ChainOfThought, chainOfThought } from "./reasoning/ChainOfThought";
export { MultiAngleAnalyzer, multiAngleAnalyzer } from "./reasoning/MultiAngleAnalyzer";
export { ProbabilityWeighter, probabilityWeighter } from "./reasoning/ProbabilityWeighter";
export { DecisionMaker, decisionMaker } from "./reasoning/DecisionMaker";

export type * from "./types";
