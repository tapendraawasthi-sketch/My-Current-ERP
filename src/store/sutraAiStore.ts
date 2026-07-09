import { create } from "zustand";
import { intelligenceCore } from "@/ai/core/IntelligenceCore";
import { outputFormatter } from "@/ai/language/OutputFormatter";
import { userProfileManager } from "@/ai/knowledge/UserProfileManager";
import { toErpRagContext } from "@/ai/rag/ErpRagRetriever";
import { proactiveAlertEngine } from "@/ai/intelligence/ProactiveAlertEngine";
import { dailyDigestEngine } from "@/ai/intelligence/DailyDigestEngine";
import { isDigestBlocked, markDigestShownToday, dismissDigestForToday, snoozeDigestForHours, restoreDigestVisibility, formatDigestHiddenLabel, buildDigestShowQuickReply, formatDigestDismissReply, formatDigestSnoozeReply, formatDigestShowReply, withoutDigestHiddenChips } from "@/ai/intelligence/DigestShownTracker";
import { saveAiInvoiceDraft } from "@/ai/actions/invoiceDraft";
import { saveAiPartyDraft } from "@/ai/actions/partyDraft";
import { saveAiAgingReportDraft } from "@/ai/actions/agingReportDraft";
import {
  saveAiAgingReminderDraft,
  consumeAiAgingReminderDraft,
  buildReminderQueryFromDraft,
  queueAgingWaAutoOpen,
  consumeAgingWaAutoOpen,
  type AiAgingReminderDraft,
} from "@/ai/actions/agingReminderDraft";
import {
  consumeAiChatQueryDraft,
  saveAiChatQueryDraft,
} from "@/ai/actions/chatQueryDraft";
import { formatWaOpenConfirmation } from "@/ai/actions/waQuickReplyBridge";
import { llmResponseCache } from "@/ai/learning/LlmResponseCache";
import {
  consumePartyPhoneSavedNotice,
  formatPartyPhoneSavedMessage,
  buildPhoneSavedQuickReplies,
  tryHandlePhoneSavedWaQuickReply,
} from "@/ai/actions/partyPhoneSavedBridge";
import { openWhatsAppShare } from "@/ai/conversation/WhatsAppShareFormatter";
import { normalizeWhatsAppPhone } from "@/ai/context/PartyPhoneResolver";
import { toKhataConfirmationCard } from "@/ai/actions/KhataCardBuilder";
import { saveAiKhataDraft } from "@/ai/actions/khataDraft";
import { useEKhataStore } from "@/store/eKhataStore";
import { feedbackStore } from "@/ai/learning/FeedbackStore";
import { feedbackCalibrator } from "@/ai/learning/FeedbackCalibrator";
import { phraseUsageStore } from "@/ai/learning/PhraseUsageStore";
import { quickReplyLearningStore } from "@/ai/learning/QuickReplyLearningStore";
import {
  buildUiMessagesFromSnapshot,
  sessionMemoryStore,
} from "@/ai/learning/SessionMemoryStore";
import { speakText } from "@/ai/interface/VoiceOutput";
import type {
  ErpProactiveAlert,
  LanguageCode,
  LanguageConfig,
  ParallelTranslation,
  QuickReply,
  ReasoningStep,
  Suggestion,
  SutraAiAction,
} from "@/ai/types";
import { useStore } from "@/store/useStore";

function appendDigestActionMessage(
  messages: SutraAiMessage[],
  text: string,
  lang: LanguageCode,
): SutraAiMessage[] {
  return [
    ...messages,
    {
      id: genId(),
      role: "assistant",
      text,
      quickReplies: [buildDigestShowQuickReply(lang)],
      timestamp: new Date(),
    },
  ];
}

function appendDigestHiddenChip(
  messages: SutraAiMessage[],
  postChip: boolean,
  lang: LanguageCode,
): { messages: SutraAiMessage[]; chipPosted: boolean } {
  if (!postChip) return { messages, chipPosted: false };
  return {
    messages: [
      ...messages,
      {
        id: genId(),
        role: "assistant",
        text: formatDigestHiddenLabel(lang),
        quickReplies: [buildDigestShowQuickReply(lang)],
        isDigestChip: true,
        timestamp: new Date(),
      },
    ],
    chipPosted: true,
  };
}

export interface SutraAiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  parallel?: ParallelTranslation;
  correctedFrom?: string;
  autoCorrected?: boolean;
  reasoningSteps?: ReasoningStep[];
  reasoningConfidence?: number;
  processingTimeMs?: number;
  actions?: SutraAiAction[];
  feedbackGiven?: "up" | "down";
  quickReplies?: QuickReply[];
  shareText?: string;
  partyPhone?: string;
  llmCacheHit?: boolean;
  isDigest?: boolean;
  isDigestChip?: boolean;
  timestamp: Date;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const WELCOME =
  "Namaste! Ma **SUTRA AI** — tapaiko intelligent Nepali-English-Roman sahayogi.\n\n" +
  "• **Tri-language** — Nepali, English, Roman Nepali\n" +
  "• **Smart correction** — \"kakor\" → \"काक्रो\" (cucumber)\n" +
  "• **ERP context** — sales, purchase, accounting terms\n\n" +
  "Try: `maele 500 ko kakor bechye`";

let lastLlmCheckAt = 0;
const LLM_CHECK_INTERVAL_MS = 60_000;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSessionPersist(messages: SutraAiMessage[]): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const uiMessages = sessionMemoryStore.trimUiMessages(
      messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          timestamp: m.timestamp.toISOString(),
        })),
    );
    void intelligenceCore.persistSession(uiMessages);
  }, 400);
}

async function afterAssistantReply(
  text: string,
  languageConfig: LanguageConfig,
  userPhrase?: string,
  shareText?: string,
): Promise<void> {
  if (userPhrase) void phraseUsageStore.record(userPhrase);
  if (languageConfig.autoSpeakResponses && (shareText?.trim() || text)) {
    void speakText(shareText?.trim() || text, languageConfig.outputLanguage);
  }
}

async function processAndReply(
  text: string,
  languageConfig: LanguageConfig,
  llmOnline: boolean,
): Promise<{
  assistantMsg: SutraAiMessage | null;
  autoCorrected?: { from: string; to: string };
  pending: {
    suggestions: Suggestion[] | null;
    originalInput: string | null;
    unknownWords?: string[];
  };
  shortcutClear?: boolean;
  shortcutDismissDigest?: boolean;
  shortcutShowDigest?: boolean;
  lastReplyMeta?: { llmCacheHit?: boolean; llmUsed?: boolean; cacheHistoryLen?: number };
}> {
  const { parties, items, stockMovements, invoices, accounts, currentFiscalYear } =
    useStore.getState();
  const result = await intelligenceCore.processInput(text, {
    languageConfig,
    useLlm: llmOnline,
    domainContext: { businessType: "grocery", recentTopics: ["vegetables", "sales"] },
    erpContext: toErpRagContext({
      parties,
      items,
      stockMovements,
      invoices,
      accounts,
      fiscalYear: currentFiscalYear ?? undefined,
    }),
  });

  if (result.shortcutAction === "clear_history") {
    return {
      assistantMsg: {
        id: genId(),
        role: "assistant",
        text: result.assistantText ?? "कुराकानी मेटाइयो।",
        timestamp: new Date(),
      },
      pending: { suggestions: null, originalInput: null },
      shortcutClear: true,
    };
  }

  if (result.shortcutAction === "dismiss_digest") {
    dismissDigestForToday();
    return {
      assistantMsg: {
        id: genId(),
        role: "assistant",
        text: result.assistantText ?? formatDigestDismissReply(languageConfig.outputLanguage),
        quickReplies: result.response.quickReplies,
        timestamp: new Date(),
      },
      pending: { suggestions: null, originalInput: null },
      shortcutDismissDigest: true,
      lastReplyMeta: { cacheHistoryLen: llmResponseCache.getHitHistory().length },
    };
  }

  if (result.shortcutAction === "snooze_digest") {
    snoozeDigestForHours(result.snoozeDigestHours ?? 4);
    return {
      assistantMsg: {
        id: genId(),
        role: "assistant",
        text: result.assistantText ?? formatDigestSnoozeReply(result.snoozeDigestHours ?? 4, languageConfig.outputLanguage),
        quickReplies: result.response.quickReplies,
        timestamp: new Date(),
      },
      pending: { suggestions: null, originalInput: null },
      shortcutDismissDigest: true,
      lastReplyMeta: { cacheHistoryLen: llmResponseCache.getHitHistory().length },
    };
  }

  if (result.shortcutAction === "show_digest") {
    return {
      assistantMsg: {
        id: genId(),
        role: "assistant",
        text: result.assistantText ?? formatDigestShowReply(languageConfig.outputLanguage),
        timestamp: new Date(),
      },
      pending: { suggestions: null, originalInput: null },
      shortcutShowDigest: true,
      lastReplyMeta: { cacheHistoryLen: llmResponseCache.getHitHistory().length },
    };
  }

  if (result.response.needs_clarification && result.suggestions) {
    return {
      assistantMsg: null,
      pending: {
        suggestions: result.suggestions.suggestions,
        originalInput: text,
        unknownWords: result.suggestions.unknownWords,
      },
    };
  }

  const formatted = result.assistantText
    ? {
        primary: result.assistantText,
        parallel: result.assistantParallel ?? {
          english: result.response.response.english,
          nepali: result.response.response.nepali,
          roman: result.response.response.roman,
          sourceLanguage: result.detection.detected,
          targetLanguage: languageConfig.outputLanguage,
        },
        showParallel: languageConfig.showTranslation,
      }
    : outputFormatter.format(
        result.response,
        languageConfig.outputLanguage,
        languageConfig.showTranslation,
        result.entities,
        result.resolvedInput?.explanation,
      );

  return {
    assistantMsg: {
      id: genId(),
      role: "assistant",
      text: formatted.primary,
      parallel: languageConfig.showTranslation ? formatted.parallel : undefined,
      reasoningSteps: result.reasoning.steps,
      reasoningConfidence: result.reasoning.confidence,
      processingTimeMs: result.processingTimeMs,
      actions: result.response.actions,
      quickReplies: result.response.quickReplies,
      shareText: result.response.shareText,
      partyPhone: result.response.partyPhone,
      llmCacheHit: result.llmCacheHit,
      timestamp: new Date(),
    },
    autoCorrected: result.autoCorrected,
    pending: { suggestions: null, originalInput: null },
    lastReplyMeta: {
      llmCacheHit: result.llmCacheHit,
      llmUsed: result.llmUsed,
      cacheHistoryLen: llmResponseCache.getHitHistory().length,
    },
  };
}

export interface SutraAiState {
  isOpen: boolean;
  isLoading: boolean;
  llmOnline: boolean;
  llmModel?: string;
  messages: SutraAiMessage[];
  pendingSuggestions: Suggestion[] | null;
  pendingOriginalInput: string | null;
  pendingUnknownWords?: string[];
  languageConfig: LanguageConfig;
  pendingInvoiceOpen: boolean;
  pendingPartyEdit: boolean;
  proactiveAlerts: ErpProactiveAlert[];
  dailyDigest: string | null;
  digestUndoText: string | null;
  digestChipPosted: boolean;
  lastReplyMeta: { llmCacheHit?: boolean; llmUsed?: boolean; cacheHistoryLen?: number } | null;
  phraseWeights: Record<string, number>;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setLanguageConfig: (config: Partial<LanguageConfig>) => void;
  refreshLlmStatus: (force?: boolean) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  acceptSuggestion: (suggestion: Suggestion) => Promise<void>;
  rejectSuggestion: () => void;
  clearHistory: () => void;
  executeAction: (action: SutraAiAction) => void;
  clearPendingInvoiceOpen: () => void;
  refreshProactiveAlerts: () => void;
  refreshDailyDigest: () => void;
  dismissDailyDigest: () => void;
  snoozeDailyDigest: (hours: number) => void;
  restoreDailyDigest: () => void;
  handoffAgingReminder: (draft: AiAgingReminderDraft) => void;
  handoffChatQuery: (query: string) => void;
  clearPendingPartyEdit: () => void;
  refreshPhraseWeights: () => Promise<void>;
  recordFeedback: (messageId: string, positive: boolean) => Promise<void>;
  pushAssistantBubble: (text: string, opts?: { quickReplies?: QuickReply[] }) => void;
}

function appendPhoneSavedNotice(
  messages: SutraAiMessage[],
  lang: LanguageConfig["outputLanguage"],
): SutraAiMessage[] {
  const notice = consumePartyPhoneSavedNotice();
  if (!notice) return messages;
  return [
    ...messages,
    {
      id: genId(),
      role: "assistant",
      text: formatPartyPhoneSavedMessage(notice, lang),
      partyPhone: normalizeWhatsAppPhone(notice.phone),
      shareText: `${notice.partyName} — ${notice.phone}`,
      quickReplies: buildPhoneSavedQuickReplies(notice, lang),
      timestamp: new Date(),
    },
  ];
}

function dispatchPendingChatHandoffs(get: () => SutraAiState): void {
  const reminderDraft = consumeAiAgingReminderDraft();
  if (reminderDraft) {
    setTimeout(() => void get().sendMessage(buildReminderQueryFromDraft(reminderDraft)), 80);
    return;
  }
  const query = consumeAiChatQueryDraft();
  if (query) {
    setTimeout(() => void get().sendMessage(query), 80);
  }
}

export { tryHandlePhoneSavedWaQuickReply };

export const useSutraAiStore = create<SutraAiState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  llmOnline: false,
  llmModel: undefined,
  messages: [{ id: "welcome", role: "assistant", text: WELCOME, timestamp: new Date() }],
  pendingSuggestions: null,
  pendingOriginalInput: null,
  pendingUnknownWords: undefined,
  pendingInvoiceOpen: false,
  pendingPartyEdit: false,
  proactiveAlerts: [],
  dailyDigest: null,
  digestUndoText: null,
  digestChipPosted: false,
  lastReplyMeta: null,
  phraseWeights: {},
  languageConfig: {
    inputLanguage: "auto",
    outputLanguage: "nepali",
    showTranslation: true,
    autoDetect: true,
    autoSpeakResponses: false,
  },

  openPanel: () => {
    void (async () => {
      await feedbackCalibrator.refresh();
      get().refreshProactiveAlerts();
      get().refreshDailyDigest();
      const weights = await phraseUsageStore.getWeights();
      const snapshot = await sessionMemoryStore.load();
      if (snapshot && snapshot.turns.length > 0) {
        intelligenceCore.restoreSession(snapshot);
        const restored = buildUiMessagesFromSnapshot(snapshot, WELCOME);
        set({
          isOpen: true,
          phraseWeights: weights,
          messages: restored as SutraAiMessage[],
        });
        dispatchPendingChatHandoffs(get);
        return;
      }

      const { dailyDigest, messages, languageConfig } = get();
      const updates: Partial<SutraAiState> = { isOpen: true, phraseWeights: weights };
      let nextMessages = messages;
      if (dailyDigest && !isDigestBlocked()) {
        const hasUserTurns = messages.some((m) => m.role === "user");
        if (!hasUserTurns) {
          nextMessages = [
            ...messages,
            {
              id: genId(),
              role: "assistant",
              text: dailyDigest,
              isDigest: true,
              timestamp: new Date(),
            },
          ];
        }
        markDigestShownToday();
      }
      nextMessages = appendPhoneSavedNotice(nextMessages, languageConfig.outputLanguage);
      updates.messages = nextMessages;
      set(updates);

      dispatchPendingChatHandoffs(get);
    })();
  },
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => {
    const { isOpen } = get();
    if (isOpen) get().closePanel();
    else get().openPanel();
  },

  setLanguageConfig: (config) => {
    const merged = { ...get().languageConfig, ...config };
    set({ languageConfig: merged });
    intelligenceCore.setLanguageConfig(merged);
    userProfileManager.setLanguagePrefs(merged.inputLanguage, merged.outputLanguage);
  },

  refreshLlmStatus: async (force = false) => {
    if (!force && Date.now() - lastLlmCheckAt < LLM_CHECK_INTERVAL_MS) return;
    lastLlmCheckAt = Date.now();
    const health = await intelligenceCore.checkHealth();
    set({ llmOnline: health.online, llmModel: health.model });
  },

  sendMessage: async (text: string) => {
    const { languageConfig, llmOnline } = get();
    const userMsgId = genId();

    set((s) => ({
      messages: [
        ...s.messages,
        { id: userMsgId, role: "user", text, timestamp: new Date() },
      ],
      isLoading: true,
      pendingSuggestions: null,
      pendingOriginalInput: null,
    }));

    try {
      const { assistantMsg, pending, autoCorrected, shortcutClear, shortcutDismissDigest, shortcutShowDigest, lastReplyMeta } =
        await processAndReply(
        text,
        languageConfig,
        llmOnline,
      );

      if (shortcutClear) {
        intelligenceCore.clearConversation();
        void sessionMemoryStore.clear();
        set({
          messages: [
            ...(assistantMsg ? [assistantMsg] : []),
            { id: "welcome", role: "assistant", text: WELCOME, timestamp: new Date() },
          ],
          isLoading: false,
          pendingSuggestions: null,
          pendingOriginalInput: null,
        });
        return;
      }

      if (shortcutDismissDigest) {
        const { dailyDigest, digestUndoText } = get();
        set({
          dailyDigest: null,
          digestUndoText: dailyDigest ?? digestUndoText,
          messages: assistantMsg ? [...get().messages, assistantMsg] : get().messages,
          isLoading: false,
          lastReplyMeta: lastReplyMeta ?? null,
        });
        return;
      }

      if (shortcutShowDigest) {
        get().restoreDailyDigest();
        set({
          messages: assistantMsg ? [...get().messages, assistantMsg] : get().messages,
          isLoading: false,
          lastReplyMeta: lastReplyMeta ?? null,
        });
        return;
      }

      if (autoCorrected) {
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === userMsgId
              ? {
                  ...m,
                  text: autoCorrected.to,
                  correctedFrom: autoCorrected.from,
                  autoCorrected: true,
                }
              : m,
          ),
        }));
      }

      if (pending.suggestions) {
        set((s) => ({
          messages: s.messages,
          isLoading: false,
          pendingSuggestions: pending.suggestions,
          pendingOriginalInput: pending.originalInput,
          pendingUnknownWords: pending.unknownWords,
        }));
        scheduleSessionPersist(get().messages);
        return;
      }

      set((s) => {
        let nextMessages = assistantMsg ? [...s.messages, assistantMsg] : s.messages;
        nextMessages = appendPhoneSavedNotice(nextMessages, languageConfig.outputLanguage);
        scheduleSessionPersist(nextMessages);
        void afterAssistantReply(
          assistantMsg?.text ?? "",
          languageConfig,
          autoCorrected?.to ?? text,
          assistantMsg?.shareText,
        );
        return {
          messages: nextMessages,
          isLoading: false,
          lastReplyMeta: lastReplyMeta ?? null,
        };
      });

      const waParty = consumeAgingWaAutoOpen();
      if (waParty && assistantMsg?.shareText && assistantMsg?.partyPhone) {
        openWhatsAppShare(assistantMsg.shareText, assistantMsg.partyPhone);
        get().pushAssistantBubble(
          formatWaOpenConfirmation(waParty, languageConfig.outputLanguage),
        );
      }
    } catch (e: unknown) {
      const errText = e instanceof Error ? e.message : "Processing failed";
      set((s) => ({
        messages: [
          ...s.messages,
          { id: genId(), role: "assistant", text: `Sorry: ${errText}`, timestamp: new Date() },
        ],
        isLoading: false,
      }));
    }
  },

  acceptSuggestion: async (suggestion: Suggestion) => {
    const { pendingOriginalInput, pendingUnknownWords, languageConfig, llmOnline, messages } = get();

    if (pendingOriginalInput) {
      const wrongWord = pendingUnknownWords?.[0] ?? suggestion.explanation.match(/"([^"]+)"/)?.[1];
      if (wrongWord) {
        intelligenceCore.recordSuggestionFeedback(
          wrongWord,
          suggestion.correctedText,
          true,
          suggestion.metadata?.transactionType ?? "sales",
        );
      }
    }

    const updatedMessages = [...messages];
    for (let i = updatedMessages.length - 1; i >= 0; i--) {
      if (updatedMessages[i].role === "user" && updatedMessages[i].text === pendingOriginalInput) {
        updatedMessages[i] = {
          ...updatedMessages[i],
          text: suggestion.correctedText,
          correctedFrom: pendingOriginalInput ?? undefined,
        };
        break;
      }
    }

    set({
      messages: updatedMessages,
      isLoading: true,
      pendingSuggestions: null,
      pendingOriginalInput: null,
      pendingUnknownWords: undefined,
    });

    try {
      const { assistantMsg, pending, lastReplyMeta } = await processAndReply(
        suggestion.correctedText,
        languageConfig,
        llmOnline,
      );

      if (pending.suggestions) {
        set({
          isLoading: false,
          pendingSuggestions: pending.suggestions,
          pendingOriginalInput: suggestion.correctedText,
          pendingUnknownWords: pending.unknownWords,
        });
        return;
      }

      set((s) => {
        const nextMessages = assistantMsg ? [...s.messages, assistantMsg] : s.messages;
        scheduleSessionPersist(nextMessages);
        void afterAssistantReply(assistantMsg?.text ?? "", languageConfig, suggestion.correctedText);
        return {
          messages: nextMessages,
          isLoading: false,
          lastReplyMeta: lastReplyMeta ?? null,
        };
      });
    } catch {
      set({ isLoading: false });
    }
  },

  rejectSuggestion: () => {
    const { pendingOriginalInput, pendingUnknownWords } = get();
    if (pendingOriginalInput && pendingUnknownWords?.[0]) {
      intelligenceCore.recordSuggestionFeedback(pendingUnknownWords[0], "", false);
    }
    set({
      pendingSuggestions: null,
      pendingOriginalInput: null,
      pendingUnknownWords: undefined,
    });
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: genId(),
          role: "assistant",
          text: "ठीक छ। कृपया फेरि टाइप गर्नुहोस् वा सही शब्द लेख्नुहोस्।",
          timestamp: new Date(),
        },
      ],
    }));
  },

  clearHistory: () => {
    intelligenceCore.clearConversation();
    void sessionMemoryStore.clear();
    set({
      messages: [{ id: "welcome", role: "assistant", text: WELCOME, timestamp: new Date() }],
      pendingSuggestions: null,
      pendingOriginalInput: null,
    });
  },

  executeAction: (action: SutraAiAction) => {
    if (action.type === "prefill_khata" && action.khataDraft) {
      saveAiKhataDraft(action.khataDraft);
      useEKhataStore.getState().openWithPendingCard(toKhataConfirmationCard(action.khataDraft));
      set({ isOpen: false });
      return;
    }

    if (action.type === "prefill_party" && action.partyDraft) {
      saveAiPartyDraft(action.partyDraft);
      useStore.getState().setCurrentPage(action.page);
      set({ isOpen: false, pendingPartyEdit: true });
      return;
    }

    if (action.page === "aging-report" && action.agingDirection) {
      saveAiAgingReportDraft({
        direction: action.agingDirection,
        searchTerm: action.agingSearchTerm,
      });
    }

    if (action.draft) {
      saveAiInvoiceDraft(action.draft);
    }
    useStore.getState().setCurrentPage(action.page);
    set({ isOpen: false, pendingInvoiceOpen: true });
  },

  clearPendingInvoiceOpen: () => set({ pendingInvoiceOpen: false }),
  clearPendingPartyEdit: () => set({ pendingPartyEdit: false }),

  refreshProactiveAlerts: () => {
    const { parties, items, stockMovements, invoices, accounts, currentFiscalYear } =
      useStore.getState();
    const ctx = toErpRagContext({
      parties,
      items,
      stockMovements,
      invoices,
      accounts,
      fiscalYear: currentFiscalYear ?? undefined,
    });
    set({ proactiveAlerts: proactiveAlertEngine.scan(ctx) });
  },

  refreshDailyDigest: () => {
    const { parties, items, stockMovements, invoices, accounts, currentFiscalYear } =
      useStore.getState();
    const { languageConfig } = get();
    const ctx = toErpRagContext({
      parties,
      items,
      stockMovements,
      invoices,
      accounts,
      fiscalYear: currentFiscalYear ?? undefined,
    });
    const digest = dailyDigestEngine.build(ctx, languageConfig.outputLanguage);
    const formatted = digest ? dailyDigestEngine.format(digest, languageConfig.outputLanguage) : null;
    set({
      dailyDigest: formatted && !isDigestBlocked() ? formatted : null,
    });
  },

  dismissDailyDigest: () => {
    const { dailyDigest, isOpen, messages, languageConfig } = get();
    dismissDigestForToday();
    const nextMessages = isOpen
      ? appendDigestActionMessage(
          messages,
          formatDigestDismissReply(languageConfig.outputLanguage),
          languageConfig.outputLanguage,
        )
      : messages;
    set({
      dailyDigest: null,
      digestUndoText: dailyDigest ?? get().digestUndoText,
      messages: nextMessages,
    });
  },

  snoozeDailyDigest: (hours: number) => {
    const { dailyDigest, isOpen, messages, languageConfig } = get();
    snoozeDigestForHours(hours);
    const nextMessages = isOpen
      ? appendDigestActionMessage(
          messages,
          formatDigestSnoozeReply(hours, languageConfig.outputLanguage),
          languageConfig.outputLanguage,
        )
      : messages;
    set({
      dailyDigest: null,
      digestUndoText: dailyDigest ?? get().digestUndoText,
      messages: nextMessages,
    });
  },

  restoreDailyDigest: () => {
    restoreDigestVisibility();
    const { digestUndoText, messages } = get();
    const cleared = withoutDigestHiddenChips(messages);
    if (digestUndoText) {
      set({
        dailyDigest: digestUndoText,
        digestUndoText: null,
        digestChipPosted: false,
        messages: cleared,
      });
      return;
    }
    get().refreshDailyDigest();
    set({ digestUndoText: null, digestChipPosted: false, messages: cleared });
  },

  handoffAgingReminder: (draft) => {
    saveAiAgingReminderDraft(draft);
    if (draft.autoOpenWhatsApp) queueAgingWaAutoOpen(draft.partyName);
    get().openPanel();
  },

  handoffChatQuery: (query) => {
    saveAiChatQueryDraft(query);
    get().openPanel();
  },

  refreshPhraseWeights: async () => {
    const weights = await phraseUsageStore.getWeights();
    set({ phraseWeights: weights });
  },

  recordFeedback: async (messageId: string, positive: boolean) => {
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    const msg = messages[idx];
    const prevUser = [...messages].slice(0, idx).reverse().find((m) => m.role === "user");

    await feedbackStore.record({
      messageId,
      positive,
      userInput: prevUser?.text,
      assistantText: msg?.text,
    });
    await feedbackCalibrator.onFeedback();

    set({
      messages: messages.map((m) =>
        m.id === messageId ? { ...m, feedbackGiven: positive ? "up" : "down" } : m,
      ),
    });
  },

  pushAssistantBubble: (text, opts) => {
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: genId(),
          role: "assistant",
          text,
          quickReplies: opts?.quickReplies,
          timestamp: new Date(),
        },
      ],
    }));
  },
}));
