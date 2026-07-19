/** SUTRA AI — main orchestrator (Intelligence Core) */

import type {
  AIResponse,
  ErpRagContext,
  LanguageConfig,
  OllamaMessage,
  ProcessInputOptions,
  ProcessInputResult,
  SessionSnapshot,
} from "../types";
import { OllamaClient, defaultOllamaClient } from "./OllamaClient";
import { ContextManager, defaultContextManager } from "./ContextManager";
import { ReasoningEngine } from "./ReasoningEngine";
import { languageDetector } from "../language/LanguageDetector";
import { suggestionEngine } from "../error-correction/SuggestionEngine";
import { decisionMaker } from "../reasoning/DecisionMaker";
import { contextualMemory } from "../knowledge/ContextualMemory";
import { learningEngine } from "../learning/LearningEngine";
import { userProfileManager } from "../knowledge/UserProfileManager";
import { outputFormatter } from "../language/OutputFormatter";
import { responseValidator } from "../validation/ResponseValidator";
import { emotionalFormatter } from "../conversation/EmotionalFormatter";
import { SUTRA_AI_SYSTEM_PROMPT } from "../prompts/systemPrompt";
import { contextResolver } from "../context/ContextResolver";
import { entityExtractor } from "../context/EntityExtractor";
import { intentClassifier } from "../context/IntentClassifier";
import { entityEnricher } from "../rag/EntityEnricher";
import { erpRagRetriever } from "../rag/ErpRagRetriever";
import { hybridLlmRouter } from "../routing/HybridLlmRouter";
import { ledgerQueryHandler } from "../rag/LedgerQueryHandler";
import { stockQueryHandler } from "../rag/StockQueryHandler";
import { khataQueryHandler } from "../rag/KhataQueryHandler";
import { reportQueryHandler } from "../rag/ReportQueryHandler";
import { batchQueryHandler } from "../rag/BatchQueryHandler";
import { invoiceQueryHandler } from "../rag/InvoiceQueryHandler";
import { paymentReceiptHandler } from "../rag/PaymentReceiptHandler";
import { insightQueryHandler } from "../rag/InsightQueryHandler";
import { khataRagProvider } from "../rag/KhataRagProvider";
import { shortcutRouter } from "../routing/ShortcutRouter";
import { selfCorrectionEngine } from "../reasoning/SelfCorrectionEngine";
import { duplicateGuard } from "../guard/DuplicateGuard";
import { anomalyDetector } from "../intelligence/AnomalyDetector";
import { confirmationGate } from "../guard/ConfirmationGate";
import { comparisonQueryHandler } from "../rag/ComparisonQueryHandler";
import { receivableQueryHandler } from "../rag/ReceivableQueryHandler";
import { compoundTransactionHandler } from "../rag/CompoundTransactionHandler";
import { partyDisambiguationHandler } from "../rag/PartyDisambiguationHandler";
import { correctionEngine } from "../context/CorrectionEngine";
import { dateResolver } from "../context/DateResolver";
import { stockGuard } from "../guard/StockGuard";
import { expenseEntryHandler } from "../rag/ExpenseEntryHandler";
import { cashBalanceQueryHandler } from "../rag/CashBalanceQueryHandler";
import { dailyDigestQueryHandler } from "../rag/DailyDigestQueryHandler";
import { followUpSuggestionEngine } from "../intelligence/FollowUpSuggestionEngine";
import { offlineReplyEnhancer } from "../conversation/OfflineReplyEnhancer";
import { teachBackFormatter } from "../conversation/TeachBackFormatter";
import { feedbackCalibrator } from "../learning/FeedbackCalibrator";
import { sessionMemoryStore } from "../learning/SessionMemoryStore";
import { globalSearchHandler } from "../rag/GlobalSearchHandler";
import { productRateQueryHandler } from "../rag/ProductRateQueryHandler";
import { partyOnboardingHandler } from "../rag/PartyOnboardingHandler";
import { overdueQueryHandler } from "../rag/OverdueQueryHandler";
import { reminderQueryHandler } from "../rag/ReminderQueryHandler";
import { batchPaymentHandler } from "../rag/BatchPaymentHandler";
import { appendPipelineTrace } from "../intelligence/PipelineTraceBuilder";
import { multilingualReplyPolisher } from "../conversation/MultilingualReplyPolisher";
import { sessionSummaryEngine } from "../intelligence/SessionSummaryEngine";
import { returnTransactionHandler } from "../rag/ReturnTransactionHandler";
import { partyPhoneQueryHandler } from "../rag/PartyPhoneQueryHandler";
import { partyPhoneEditHandler } from "../rag/PartyPhoneEditHandler";
import { cacheStatsQueryHandler } from "../rag/CacheStatsQueryHandler";
import { llmResponseCache } from "../learning/LlmResponseCache";
import { gracefulFallbackHandler } from "../intelligence/GracefulFallbackHandler";
import { buildDigestShowQuickReply, formatDigestDismissReply, formatDigestSnoozeReply, formatDigestShowReply } from "../intelligence/DigestShownTracker";
import { creditLimitGuard } from "../guard/CreditLimitGuard";

export class IntelligenceCore {
  private ollama: OllamaClient;
  private context: ContextManager;
  private reasoning: ReasoningEngine;

  constructor(ollama?: OllamaClient, context?: ContextManager) {
    this.ollama = ollama ?? defaultOllamaClient;
    this.context = context ?? defaultContextManager;
    this.reasoning = new ReasoningEngine(this.context);
  }

  getContextManager(): ContextManager {
    return this.context;
  }

  setLanguageConfig(config: Partial<LanguageConfig>): void {
    this.context.setLanguageConfig(config);
  }

  async checkHealth() {
    return this.ollama.checkHealth();
  }

  /** Main entry point — process user input through full pipeline */
  async processInput(
    input: string,
    options?: ProcessInputOptions,
  ): Promise<ProcessInputResult> {
    const startMs = Date.now();
    const langConfig = {
      ...this.context.getLanguageConfig(),
      ...options?.languageConfig,
    };

    if (options?.languageConfig) {
      this.context.setLanguageConfig(options.languageConfig);
    }

    // Sprint 14: slash shortcuts
    const shortcut = shortcutRouter.route(input.trim(), langConfig.outputLanguage);
    if (shortcut.handled && shortcut.shortcutAction === "clear_history") {
      return this.buildShortcutClearResult(input, langConfig, startMs);
    }
    if (shortcut.handled && shortcut.shortcutAction === "dismiss_digest") {
      return this.buildShortcutDismissDigestResult(input, langConfig, startMs);
    }
    if (shortcut.handled && shortcut.shortcutAction === "snooze_digest") {
      return this.buildShortcutSnoozeDigestResult(
        input,
        shortcut.snoozeHours ?? 4,
        langConfig,
        startMs,
      );
    }
    if (shortcut.handled && shortcut.shortcutAction === "show_digest") {
      return this.buildShortcutShowDigestResult(input, langConfig, startMs);
    }
    if (shortcut.handled && shortcut.response) {
      return this.buildShortcutHelpResult(input, shortcut.response, langConfig, startMs);
    }

    if (cacheStatsQueryHandler.matches(input.trim())) {
      const cacheResponse = await cacheStatsQueryHandler.tryBuildResponse(
        input.trim(),
        langConfig.outputLanguage,
        input.trim(),
      );
      if (cacheResponse) {
        return this.buildShortcutHelpResult(input, cacheResponse, langConfig, startMs);
      }
    }

    const hints = this.context.getContextHints();
    const session = hints.session;

    const pipelineInput = this.resolveRepeatShortcut(shortcut.rewrittenInput ?? input, session);

    const domainCtx = {
      ...this.context.getDomainContext(),
      ...options?.domainContext,
    };

    // Sprint 3: resolve multi-turn references before processing
    let resolved = contextResolver.resolve(pipelineInput, session);
    let workingInput = resolved.wasResolved ? resolved.resolved : pipelineInput;

    const detection = languageDetector.detect(workingInput);

    const userMisspellings = {
      ...contextualMemory.getUserMisspellings(),
      ...userProfileManager.getProfile().commonMisspellings,
      ...hints.userMisspellings,
    };

    // Sprint 3: entity extraction + context merge
    let entities = entityExtractor.extract(workingInput, hints.commonProducts);
    entities = contextResolver.fillEntitiesFromSession(entities, session);
    entities = entityExtractor.mergeWithContext(entities, session);

    const resolvedDate = dateResolver.detect(workingInput, entities.dateRef);
    if (resolvedDate) entities = { ...entities, resolvedDate: resolvedDate.iso, dateRef: resolvedDate.key };

    // Sprint 17: explicit correction rewrites
    const correction = correctionEngine.apply(workingInput, session, entities);
    if (correction) {
      workingInput = correction.rewrittenInput;
      entities = correction.entities;
      resolved = {
        original: input,
        resolved: correction.rewrittenInput,
        wasResolved: true,
        resolutionType: "correction",
        explanation: correction.explanation,
      };
    }

    let erpContext = await khataRagProvider.enrich(
      options?.erpContext,
      entities,
      workingInput,
    );
    entities = entityEnricher.enrich(entities, workingInput, erpContext);
    entities = entityEnricher.enrichLines(entities, workingInput, erpContext);

    const intent = intentClassifier.classify(
      workingInput,
      entities,
      session,
      this.context.getLastAssistantMessage(),
    );

    if (confirmationGate.isRejectIntent(intent.intent, session)) {
      return this.buildPendingRejectResult(input, langConfig, startMs);
    }
    if (confirmationGate.isConfirmIntent(intent.intent, session)) {
      return this.buildPendingConfirmResult(input, session, langConfig, startMs);
    }

    const suggestions = suggestionEngine.analyze(
      input,
      domainCtx,
      userMisspellings,
      entities,
      session,
    );

    const reasoning = this.reasoning.reason(workingInput, options, entities, intent, suggestions);
    let reasoningOut = reasoning;

    let autoCorrected: ProcessInputResult["autoCorrected"];

    let response = decisionMaker.decide(
      workingInput,
      reasoning,
      suggestions,
      langConfig.outputLanguage,
      intent,
      entities,
      detection.detected,
      reasoning.dimensions,
    );

    // MAI-08 slice 2: never silently rewrite inputs that carry write-path slots
    const writePathRisk = Boolean(
      entities.party ||
        entities.product ||
        entities.productEnglish ||
        entities.amount != null ||
        entities.quantity != null ||
        entities.itemId ||
        entities.partyId,
    );
    if (suggestions.autoCorrect && suggestions.suggestions[0] && !writePathRisk) {
      const auto = suggestions.suggestions[0];
      autoCorrected = { from: input, to: auto.correctedText };
      const autoEntities = entityExtractor.extract(auto.correctedText, hints.commonProducts);
      response = decisionMaker.decide(
        auto.correctedText,
        reasoning,
        { ...suggestions, autoCorrect: true, requiresConfirmation: false },
        langConfig.outputLanguage,
        intent,
        { ...entities, ...autoEntities },
        detection.detected,
        reasoning.dimensions,
      );
      response.understood_input = auto.correctedText;
      response.confidence = auto.confidence;
      response.needs_clarification = false;
      entities = { ...entities, ...autoEntities };
    } else if (suggestions.autoCorrect && writePathRisk) {
      // Keep original text; force clarification instead of silent rewrite
      response.needs_clarification = true;
      response.confidence = Math.min(response.confidence ?? 0.5, 0.55);
    }

    // Sprint 9–11: ERP query handlers (batch, stock, report, balance, khata)
    let erpQueryResolved = false;
    let erpHandlerName: string | undefined;

    const batchResponse = batchQueryHandler.tryBuildResponse(
      workingInput,
      entities,
      erpContext,
      intent,
      langConfig.outputLanguage,
      response.understood_input,
    );
    if (batchResponse) {
      response = batchResponse;
      erpQueryResolved = true;
      erpHandlerName = "batch";
    }

    if (!erpQueryResolved) {
      const searchResponse = globalSearchHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (searchResponse) {
        response = searchResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const insightResponse = insightQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (insightResponse) {
        response = insightResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const digestResponse = dailyDigestQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (digestResponse) {
        response = digestResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const compareResponse = comparisonQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (compareResponse) {
        response = compareResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const recvResponse = receivableQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (recvResponse) {
        response = recvResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const overdueResponse = overdueQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (overdueResponse) {
        response = overdueResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const reminderResponse = reminderQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (reminderResponse) {
        response = reminderResponse;
        erpQueryResolved = true;
        erpHandlerName = "reminder";
      }
    }

    if (!erpQueryResolved) {
      const phoneEditResponse = partyPhoneEditHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (phoneEditResponse) {
        response = phoneEditResponse;
        erpQueryResolved = true;
        erpHandlerName = "party_phone_edit";
      }
    }

    if (!erpQueryResolved) {
      const phoneResponse = partyPhoneQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (phoneResponse) {
        response = phoneResponse;
        erpQueryResolved = true;
        erpHandlerName = "party_phone";
      }
    }

    if (!erpQueryResolved) {
      const compoundResponse = batchPaymentHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (compoundResponse) {
        response = compoundResponse;
        erpQueryResolved = true;
        erpHandlerName = "batch_payment";
      }
    }

    if (!erpQueryResolved) {
      const compoundResponse = compoundTransactionHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (compoundResponse) {
        response = compoundResponse;
        erpQueryResolved = true;
        erpHandlerName = "compound";
      }
    }

    if (!erpQueryResolved) {
      const partyPick = partyDisambiguationHandler.tryBuildResponse(
        entities,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (partyPick) {
        response = partyPick;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const rateResponse = productRateQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (rateResponse) {
        response = rateResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const stockResponse = stockQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (stockResponse) {
        response = stockResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const reportResponse = reportQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (reportResponse) {
        response = reportResponse;
        erpQueryResolved = true;
      }
    }

    let balanceResolved = false;
    if (!erpQueryResolved) {
      const cashResponse = cashBalanceQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (cashResponse) {
        response = cashResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const balanceResponse = ledgerQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (balanceResponse) {
        response = balanceResponse;
        balanceResolved = true;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const expenseResponse = expenseEntryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (expenseResponse) {
        response = expenseResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const returnResponse = returnTransactionHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (returnResponse) {
        response = returnResponse;
        erpQueryResolved = true;
        erpHandlerName = "return";
      }
    }

    if (!erpQueryResolved) {
      const partyOnboard = partyOnboardingHandler.tryBuildResponse(
        entities,
        erpContext,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (partyOnboard) {
        response = partyOnboard;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const paymentResponse = paymentReceiptHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (paymentResponse) {
        response = paymentResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const invoiceResponse = invoiceQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (invoiceResponse) {
        response = invoiceResponse;
        erpQueryResolved = true;
      }
    }

    if (!erpQueryResolved) {
      const khataResponse = khataQueryHandler.tryBuildResponse(
        workingInput,
        entities,
        erpContext,
        intent,
        langConfig.outputLanguage,
        response.understood_input,
      );
      if (khataResponse) {
        response = khataResponse;
        erpQueryResolved = true;
      }
    }

    if (
      !erpQueryResolved &&
      gracefulFallbackHandler.shouldFallback(response, intent, erpQueryResolved)
    ) {
      response = gracefulFallbackHandler.build(
        workingInput,
        langConfig.outputLanguage,
        response.understood_input,
      );
      erpQueryResolved = true;
    }

    const isPaymentDraft =
      entities.transactionType === "payment" ||
      entities.transactionType === "receipt" ||
      response.transaction?.type === "payment" ||
      response.transaction?.type === "receipt";

    const runTxnGuards =
      !response.needs_clarification && (!erpQueryResolved || isPaymentDraft);

    // Sprint 14/22: self-correction + transaction guards
    if (runTxnGuards) {
      if (!erpQueryResolved) {
        const correction = selfCorrectionEngine.review(workingInput, entities, session);
        if (correction.followUp) {
          response = {
            ...response,
            followUp: correction.followUp,
            selfCorrectionNote: correction.note,
            confidence: correction.reduceConfidence
              ? Math.min(response.confidence, 0.78)
              : response.confidence,
          };
        }
      }

      const dup = await duplicateGuard.check(entities, intent);
      if (dup) {
        const warn =
          langConfig.outputLanguage === "english"
            ? dup.english
            : langConfig.outputLanguage === "roman"
              ? dup.roman
              : dup.nepali;
        response = {
          ...response,
          duplicateWarning: warn,
          followUp: response.followUp ? `${response.followUp}\n${warn}` : warn,
        };
      }

      if (!erpQueryResolved) {
        const anomaly = anomalyDetector.detect(entities, erpContext);
        if (anomaly) {
          const warn =
            langConfig.outputLanguage === "english"
              ? anomaly.english
              : langConfig.outputLanguage === "roman"
                ? anomaly.roman
                : anomaly.nepali;
          response = {
            ...response,
            anomalyWarning: warn,
            followUp: response.followUp ? `${response.followUp}\n${warn}` : warn,
            confidence: Math.min(response.confidence, 0.8),
          };
        }

        const stock = stockGuard.check(entities, intent, erpContext);
        if (stock) {
          const warn =
            langConfig.outputLanguage === "english"
              ? stock.english
              : langConfig.outputLanguage === "roman"
                ? stock.roman
                : stock.nepali;
          response = {
            ...response,
            stockWarning: warn,
            followUp: response.followUp ? `${response.followUp}\n${warn}` : warn,
            confidence: Math.min(response.confidence, 0.75),
          };
        }

        const credit = creditLimitGuard.check(entities, intent, erpContext);
        if (credit) {
          const warn =
            langConfig.outputLanguage === "english"
              ? credit.english
              : langConfig.outputLanguage === "roman"
                ? credit.roman
                : credit.nepali;
          response = {
            ...response,
            creditLimitWarning: warn,
            followUp: response.followUp ? `${response.followUp}\n${warn}` : warn,
            confidence: Math.min(response.confidence, 0.78),
          };
        }
      }

      if (confirmationGate.needsGate(response, erpQueryResolved && !isPaymentDraft)) {
        const gated = confirmationGate.gate(
          response,
          entities,
          intent,
          langConfig.outputLanguage,
          response.understood_input,
        );
        response = gated.response;
        this.context.setPendingAction(gated.pending);
      }
    }

    response = multilingualReplyPolisher.polish(response);

    // Sprint 7: validation gate
    const validation = responseValidator.validate(response, entities);
    if (!validation.valid && !response.needs_clarification) {
      response = {
        ...response,
        needs_clarification: true,
        validationIssues: validation.issues,
        followUp: validation.clarificationQuestion ?? response.followUp,
        confidence: Math.min(response.confidence, 0.72),
        actions: undefined,
      };
    }

    let rawLlmResponse: string | undefined;
    let llmUsed = false;
    let llmCacheHit = false;
    let llmRouteReason: string | undefined;

    const llmHealth = options?.useLlm !== false ? await this.ollama.checkHealth() : { online: false };
    const route = hybridLlmRouter.decide({
      confidence: response.confidence,
      intent: intent.intent,
      needsClarification: response.needs_clarification,
      validationFailed: !validation.valid,
      llmOnline: llmHealth.online,
      useLlmRequested: options?.useLlm !== false,
      hasAmbiguousParty: Boolean(entities.partyAmbiguous?.length),
      hasSuggestionPending: Boolean(
        suggestions.requiresConfirmation && suggestions.suggestions.length > 0,
      ),
      hasBalanceAnswer: balanceResolved,
      hasErpQueryAnswer: erpQueryResolved,
    });
    llmRouteReason = route.reason;

    if (route.useLlm) {
      try {
        if (llmHealth.online) {
          llmUsed = true;
          rawLlmResponse = await this.enhanceWithLlm(
            workingInput,
            detection.detected,
            reasoningOut,
            response,
            intent,
            entities,
            erpContext,
          );
          const parsed = this.parseLlmJson(rawLlmResponse);
          if (parsed) {
            const revalidated = responseValidator.validate({ ...response, ...parsed }, entities);
            if (revalidated.valid || parsed.needs_clarification) {
              response = { ...response, ...parsed };
              void llmResponseCache.set(workingInput, intent.intent, parsed);
            }
          }
        } else {
          const cached = await llmResponseCache.get(workingInput, intent.intent);
          if (cached) {
            llmCacheHit = true;
            llmResponseCache.recordHit();
            llmRouteReason = "LLM offline — cache hit";
            response = { ...response, ...cached };
          } else {
            llmResponseCache.recordMiss();
          }
        }
      } catch {
        llmUsed = false;
      }
    }

    if (!response.quickReplies?.length && !response.needs_clarification) {
      const followUps = followUpSuggestionEngine.suggest(intent, entities, session, response);
      if (followUps.length) {
        response = { ...response, quickReplies: followUps };
      }
    }

    if (!response.needs_clarification) {
      this.context.updateSession(entities, intent.intent);
      learningEngine.updateAfterInteraction({
        input,
        entities,
        intent: intent.intent,
        hadSuggestion: false,
        responseTimeMs: Date.now() - startMs,
      });
    } else if (suggestions.suggestions.length > 0) {
      learningEngine.updateAfterInteraction({
        input,
        entities,
        intent: intent.intent,
        hadSuggestion: true,
        acceptedSuggestion: false,
        responseTimeMs: Date.now() - startMs,
      });
    }

    this.context.addTurn("user", input, detection.detected, {
      entities,
      intent: intent.intent,
    });

    let assistantText: string | undefined;
    let assistantParallel: ProcessInputResult["assistantParallel"];

    if (!response.needs_clarification) {
      const history = this.context.getRecentTurns(6).map((t) => ({
        role: t.role,
        content: t.content,
      }));
      const emotional = emotionalFormatter.detect(input, history);
      const formatted = decisionMaker.formatUserMessage(
        response,
        langConfig.outputLanguage,
        resolved.wasResolved ? resolved.explanation : undefined,
        entities,
        langConfig.showTranslation,
        emotionalFormatter.formatReply(
          outputFormatter.format(
            response,
            langConfig.outputLanguage,
            false,
            entities,
            resolved.wasResolved ? resolved.explanation : undefined,
          ).primary,
          input,
          langConfig.outputLanguage,
          {
            intent: intent.intent,
            emotional,
            history,
            isConfused: reasoning.dimensions?.some(
              (d) => d.name === "PROBABILISTIC ANALYSIS" && d.score < 0.6,
            ),
            hasTransaction: Boolean(response.transaction?.type),
          },
        ),
      );
      assistantText = formatted.text;
      if (
        teachBackFormatter.shouldShow(intent.intent, entities) &&
        !erpQueryResolved
      ) {
        const teach = teachBackFormatter.format(entities, intent.intent, langConfig.outputLanguage);
        assistantText = `${assistantText}\n\n${teach}`;
      }
      assistantText = offlineReplyEnhancer.enhance(
        assistantText,
        langConfig.outputLanguage,
        llmHealth.online,
        llmUsed,
      );
      assistantParallel = langConfig.showTranslation ? formatted.parallel?.parallel : undefined;
      this.context.addTurn("assistant", formatted.text, langConfig.outputLanguage);
    }

    const guards: string[] = [];
    if (response.duplicateWarning) guards.push("duplicate");
    if (response.anomalyWarning) guards.push("anomaly");
    if (response.stockWarning) guards.push("stock");
    if (response.creditLimitWarning) guards.push("credit_limit");

    reasoningOut = appendPipelineTrace(reasoningOut, {
      erpQueryResolved,
      erpHandler: erpHandlerName,
      paymentMode: entities.paymentMode,
      llmUsed,
      llmCacheHit,
      llmRouteReason,
      guards: guards.length ? guards : undefined,
      confidence: response.confidence,
    });

    return {
      detection,
      suggestions:
        suggestions.requiresConfirmation && suggestions.suggestions.length > 0
          ? suggestions
          : null,
      reasoning: reasoningOut,
      response,
      intent,
      entities,
      resolvedInput: resolved.wasResolved ? resolved : undefined,
      rawLlmResponse,
      processingTimeMs: Date.now() - startMs,
      autoCorrected,
      assistantText,
      assistantParallel,
      llmUsed,
      llmCacheHit,
      llmRouteReason,
    };
  }

  recordSuggestionFeedback(
    original: string,
    corrected: string,
    accepted: boolean,
    context?: string,
  ): void {
    learningEngine.recordCorrection(original, corrected, accepted, context);
  }

  clearConversation(): void {
    this.context.clearHistory();
  }

  restoreSession(snapshot: SessionSnapshot): void {
    this.context.restoreSnapshot({
      turns: snapshot.turns,
      session: snapshot.session,
      domainContext: snapshot.domainContext,
    });
  }

  getSessionState() {
    return this.context.getSession();
  }

  async persistSession(uiMessages?: SessionSnapshot["uiMessages"]): Promise<void> {
    await sessionMemoryStore.save(this.context, uiMessages);
  }

  getLearningStats() {
    return learningEngine.getStats();
  }

  getUserProfile() {
    return userProfileManager.getProfile();
  }

  private resolveRepeatShortcut(input: string, session: import("../types").SessionState): string {
    if (!/^\/repeat\b/i.test(input.trim())) return input;
    if (!session.lastProduct) return input;
    const amount = session.lastAmount ?? session.lastQuantity ?? 500;
    let phrase = `maile ${amount} ko ${session.lastProduct} bechye`;
    if (session.lastParty) phrase += ` ${session.lastParty} lai`;
    if (session.lastTransactionType === "purchase") {
      phrase = `maile ${amount} ko ${session.lastProduct} kinya`;
    }
    return phrase;
  }

  private buildPendingConfirmResult(
    input: string,
    session: import("../types").SessionState,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    const pending = session.pendingAction!;
    this.context.clearPendingAction();
    const response = confirmationGate.buildConfirmedResponse(pending, session);
    this.context.updateSession(pending.entities, pending.intent);
    this.context.addTurn("user", input, langConfig.outputLanguage);
    this.context.addTurn("assistant", response.response[langConfig.outputLanguage], langConfig.outputLanguage);

    const formatted = decisionMaker.formatUserMessage(
      response,
      langConfig.outputLanguage,
      undefined,
      pending.entities,
      langConfig.showTranslation,
    );

    return {
      response,
      detection: languageDetector.detect(input),
      entities: pending.entities,
      intent: { intent: pending.intent, confidence: 0.95, entities: pending.entities },
      suggestions: null,
      reasoning: { steps: [], finalInterpretation: "confirmed", confidence: 0.95, entities: {} },
      assistantText: formatted.text,
      assistantParallel: langConfig.showTranslation ? formatted.parallel?.parallel : undefined,
      processingTimeMs: Date.now() - startMs,
    };
  }

  private buildPendingRejectResult(
    input: string,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    this.context.clearPendingAction();
    const response = confirmationGate.buildRejectedResponse(langConfig.outputLanguage);
    this.context.addTurn("user", input, langConfig.outputLanguage);
    this.context.addTurn(
      "assistant",
      response.response[langConfig.outputLanguage],
      langConfig.outputLanguage,
    );

    return {
      response,
      detection: languageDetector.detect(input),
      entities: undefined,
      intent: { intent: "REJECTION", confidence: 0.95, entities: {} },
      suggestions: null,
      reasoning: { steps: [], finalInterpretation: "rejected", confidence: 1, entities: {} },
      assistantText: response.response[langConfig.outputLanguage],
      processingTimeMs: Date.now() - startMs,
    };
  }

  private buildShortcutClearResult(
    input: string,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    const detection = languageDetector.detect(input);
    const summary = sessionSummaryEngine.build(
      this.context.getRecentTurns(10),
      this.context.getSession(),
      langConfig.outputLanguage,
    );

    const cleared = {
      nepali: "कुराकानी मेटाइयो।",
      english: "Conversation cleared.",
      roman: "Kurakani metiyo.",
    };

    const primary =
      langConfig.outputLanguage === "english"
        ? cleared.english
        : langConfig.outputLanguage === "roman"
          ? cleared.roman
          : cleared.nepali;

    const assistantText = summary ? `${summary}\n\n${primary}` : primary;

    return {
      detection,
      suggestions: null,
      reasoning: {
        steps: [{ step: 1, name: "SESSION CLEAR", detail: summary ?? "no summary" }],
        finalInterpretation: "clear",
        confidence: 1,
        entities: {},
      },
      response: {
        understood_input: input,
        confidence: 1,
        needs_clarification: false,
        suggestions: [],
        response: {
          nepali: summary ? `${summary}\n\n${cleared.nepali}` : cleared.nepali,
          english: summary ? `${summary}\n\n${cleared.english}` : cleared.english,
          roman: summary ? `${summary}\n\n${cleared.roman}` : cleared.roman,
        },
      },
      processingTimeMs: Date.now() - startMs,
      assistantText,
      shortcutAction: "clear_history",
    };
  }

  private buildShortcutDismissDigestResult(
    input: string,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    const detection = languageDetector.detect(input);
    const cleared = {
      nepali: formatDigestDismissReply("nepali"),
      english: formatDigestDismissReply("english"),
      roman: formatDigestDismissReply("roman"),
    };
    const primary =
      langConfig.outputLanguage === "english"
        ? cleared.english
        : langConfig.outputLanguage === "roman"
          ? cleared.roman
          : cleared.nepali;

    return {
      detection,
      suggestions: null,
      reasoning: {
        steps: [{ step: 1, name: "DIGEST DISMISS", detail: "snoozed until tomorrow" }],
        finalInterpretation: "dismiss_digest",
        confidence: 1,
        entities: {},
      },
      response: {
        understood_input: input,
        confidence: 1,
        needs_clarification: false,
        suggestions: [],
        response: cleared,
        quickReplies: [buildDigestShowQuickReply(langConfig.outputLanguage)],
      },
      processingTimeMs: Date.now() - startMs,
      assistantText: primary,
      shortcutAction: "dismiss_digest",
    };
  }

  private buildShortcutSnoozeDigestResult(
    input: string,
    hours: number,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    const detection = languageDetector.detect(input);
    const cleared = {
      nepali: formatDigestSnoozeReply(hours, "nepali"),
      english: formatDigestSnoozeReply(hours, "english"),
      roman: formatDigestSnoozeReply(hours, "roman"),
    };
    const primary =
      langConfig.outputLanguage === "english"
        ? cleared.english
        : langConfig.outputLanguage === "roman"
          ? cleared.roman
          : cleared.nepali;

    return {
      detection,
      suggestions: null,
      reasoning: {
        steps: [{ step: 1, name: "DIGEST SNOOZE", detail: `${hours}h` }],
        finalInterpretation: "snooze_digest",
        confidence: 1,
        entities: {},
      },
      response: {
        understood_input: input,
        confidence: 1,
        needs_clarification: false,
        suggestions: [],
        response: cleared,
        quickReplies: [buildDigestShowQuickReply(langConfig.outputLanguage)],
      },
      processingTimeMs: Date.now() - startMs,
      assistantText: primary,
      shortcutAction: "snooze_digest",
      snoozeDigestHours: hours,
    };
  }

  private buildShortcutShowDigestResult(
    input: string,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    const detection = languageDetector.detect(input);
    const restored = {
      nepali: formatDigestShowReply("nepali"),
      english: formatDigestShowReply("english"),
      roman: formatDigestShowReply("roman"),
    };
    const primary =
      langConfig.outputLanguage === "english"
        ? restored.english
        : langConfig.outputLanguage === "roman"
          ? restored.roman
          : restored.nepali;

    return {
      detection,
      suggestions: null,
      reasoning: {
        steps: [{ step: 1, name: "DIGEST SHOW", detail: "restore visibility" }],
        finalInterpretation: "show_digest",
        confidence: 1,
        entities: {},
      },
      response: {
        understood_input: input,
        confidence: 1,
        needs_clarification: false,
        suggestions: [],
        response: restored,
      },
      processingTimeMs: Date.now() - startMs,
      assistantText: primary,
      shortcutAction: "show_digest",
    };
  }

  private buildShortcutHelpResult(
    input: string,
    helpResponse: AIResponse,
    langConfig: LanguageConfig,
    startMs: number,
  ): ProcessInputResult {
    const detection = languageDetector.detect(input);
    const primary =
      langConfig.outputLanguage === "english"
        ? helpResponse.response.english
        : langConfig.outputLanguage === "roman"
          ? helpResponse.response.roman
          : helpResponse.response.nepali;

    return {
      detection,
      suggestions: null,
      reasoning: {
        steps: [{ step: 1, name: "SHORTCUT", detail: "/help" }],
        finalInterpretation: "shortcut help",
        confidence: 1,
        entities: {},
      },
      response: helpResponse,
      processingTimeMs: Date.now() - startMs,
      assistantText: primary,
    };
  }

  private async enhanceWithLlm(
    input: string,
    language: string,
    reasoning: { steps: Array<{ name: string; detail: string }> },
    currentResponse: AIResponse,
    intent?: { intent: string; confidence: number },
    entities?: Record<string, unknown>,
    erpContext?: ErpRagContext,
  ): Promise<string> {
    const reasoningSummary = reasoning.steps
      .map((s) => `${s.name}: ${s.detail}`)
      .join("\n");

    const ragSummary = erpContext
      ? erpRagRetriever.buildContextSummary(erpContext, {
          party: (entities as { party?: string })?.party,
          product: (entities as { product?: string })?.product,
        })
      : "";

    const messages: OllamaMessage[] = [
      { role: "system", content: SUTRA_AI_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Input: "${input}"
Language: ${language}
Intent: ${intent?.intent} (${intent?.confidence})
Entities: ${JSON.stringify(entities)}
${ragSummary ? `ERP RAG matches:\n${ragSummary}\n` : ""}
Conversation: ${this.context.getConversationSummary()}
Reasoning:
${reasoningSummary}
Current analysis: ${JSON.stringify(currentResponse)}

Enhance or validate this analysis. Respond with JSON only.`,
      },
    ];

    return this.ollama.chat(messages, { temperature: 0.2, format: "json" });
  }

  private parseLlmJson(raw: string): Partial<AIResponse> | null {
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      return JSON.parse(jsonMatch[0]) as Partial<AIResponse>;
    } catch {
      return null;
    }
  }
}

export const intelligenceCore = new IntelligenceCore();
