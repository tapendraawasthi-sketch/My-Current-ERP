/** SUTRA AI — main chat component */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  CloudDownload,
  CloudUpload,
  FileDown,
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { downloadChatExport } from "./ChatExportUtils";
import { intelligenceCore } from "../core/IntelligenceCore";
import { sessionSummaryEngine } from "../intelligence/SessionSummaryEngine";
import { useSutraAiStore, tryHandlePhoneSavedWaQuickReply } from "@/store/sutraAiStore";
import { tryHandlePhoneSavedCopyQuickReply } from "@/ai/actions/partyPhoneSavedBridge";
import { decodeWaOpenValue, decodeCopyValue, formatWaOpenConfirmation, formatCopyConfirmation } from "@/ai/actions/waQuickReplyBridge";
import {
  decodeAgingReturnQuickReplyValue,
  formatAgingReturnConfirmation,
} from "@/ai/actions/chatQueryDraft";
import { saveAiAgingReportDraft } from "@/ai/actions/agingReportDraft";
import { formatDigestHiddenLabel, formatDailyDigestHeader, formatDigestSnoozeChip, formatDigestSnoozeTitle, formatDigestShowAgainLabel } from "@/ai/intelligence/DigestShownTracker";
import { llmResponseCache } from "@/ai/learning/LlmResponseCache";
import {
  formatCacheHitSparkline,
  formatCacheSparklineTooltip,
  buildCacheStatsSummary,
} from "@/ai/learning/CacheHitSparkline";
import {
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
  formatProactiveAlertsHeader,
  formatChatSyncMessage,
  formatAnalyzingLabel,
  formatAutoCorrectedLabel,
} from "@/ai/intelligence/DigestPinPreference";
import { useStore } from "@/store/useStore";
import { downloadLearningBundle, importLearningBundle } from "../learning/ProfileCloudSync";
import LanguageSelector from "./LanguageSelector";
import SuggestionCard from "./SuggestionCard";
import ParallelTranslationView from "./ParallelTranslation";
import ReasoningTrace from "./ReasoningTrace";
import VoiceInput from "./VoiceInput";
import VoiceOutput from "./VoiceOutput";
import InputAutocomplete from "./InputAutocomplete";
import MessageShareButton from "./MessageShareButton";
import QuickReplyBar from "./QuickReplyBar";
import { getAutocompleteSuggestions } from "./InputAutocompleteEngine";
import type { AutocompleteSuggestion } from "./InputAutocompleteEngine";
import { copyWhatsAppText, openWhatsAppShare } from "../conversation/WhatsAppShareFormatter";
import { quickReplyLearningStore } from "../learning/QuickReplyLearningStore";
import type { InputLanguage, LanguageCode, Suggestion } from "../types";

const SutraAIChat: React.FC = () => {
  const {
    isOpen,
    closePanel,
    messages,
    pendingSuggestions,
    pendingOriginalInput,
    pendingUnknownWords,
    isLoading,
    llmOnline,
    llmModel,
    languageConfig,
    setLanguageConfig,
    sendMessage,
    pushAssistantBubble,
    acceptSuggestion,
    rejectSuggestion,
    clearHistory,
    executeAction,
    refreshLlmStatus,
    recordFeedback,
    proactiveAlerts,
    dailyDigest,
    digestUndoText,
    dismissDailyDigest,
    snoozeDailyDigest,
    restoreDailyDigest,
    lastReplyMeta,
    phraseWeights,
  } = useSutraAiStore();

  const [input, setInput] = useState("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState<AutocompleteSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [digestPinned, setDigestPinned] = useState(() => readDigestPinnedPreference());
  const [digestTick, setDigestTick] = useState(0);
  const digestBarRef = useRef<HTMLDivElement>(null);
  const prevDailyDigestRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const cacheHeaderClickRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });

  const storeProducts = useStore((s) => s.items?.map((i) => String(i.name ?? "")).slice(0, 20));
  const storeParties = useStore((s) => s.parties?.map((p) => String(p.name ?? "")).slice(0, 20));

  const digestPinUi = useMemo(
    () => formatDigestPinLabels(languageConfig.outputLanguage, digestPinned),
    [languageConfig.outputLanguage, digestPinned],
  );

  const cacheSparkline = useMemo(
    () => formatCacheHitSparkline(llmResponseCache.getHitHistory()),
    [messages.length, lastReplyMeta?.llmCacheHit, lastReplyMeta?.llmUsed, lastReplyMeta?.cacheHistoryLen, isLoading],
  );

  const cacheHitRatePct = useMemo(() => {
    const history = llmResponseCache.getHitHistory();
    if (!history.length) return null;
    return Math.round(llmResponseCache.getHitRate().rate * 100);
  }, [messages.length, lastReplyMeta?.llmCacheHit, lastReplyMeta?.llmUsed, lastReplyMeta?.cacheHistoryLen, isLoading]);

  const cacheSparkTooltip = useMemo(() => {
    const history = llmResponseCache.getHitHistory();
    const rate = cacheHitRatePct ?? Math.round(llmResponseCache.getHitRate().rate * 100);
    return formatCacheSparklineTooltip(history, rate, languageConfig.outputLanguage);
  }, [messages.length, lastReplyMeta?.llmCacheHit, lastReplyMeta?.llmUsed, lastReplyMeta?.cacheHistoryLen, isLoading, cacheHitRatePct, languageConfig.outputLanguage]);

  const digestHiddenLabel = useMemo(
    () => formatDigestHiddenLabel(languageConfig.outputLanguage),
    [digestUndoText, dailyDigest, digestTick, languageConfig.outputLanguage],
  );

  const cachedBadgeLabel = useMemo(
    () => formatCachedBadgeLabel(languageConfig.outputLanguage),
    [languageConfig.outputLanguage],
  );

  const digestShowAgainLabel = useMemo(
    () => formatDigestShowAgainLabel(languageConfig.outputLanguage),
    [languageConfig.outputLanguage],
  );

  const cachedBadgeTooltip = useMemo(
    () => formatCachedBadgeTooltip(languageConfig.outputLanguage),
    [languageConfig.outputLanguage],
  );

  const headerSubtitle = useMemo(() => {
    if (llmOnline) {
      return `${llmModel?.split(":")[0] ?? "Qwen3"} · Nepali-English-Roman`;
    }
    if (lastReplyMeta?.llmCacheHit) {
      return formatCachedHeaderSubtitle(languageConfig.outputLanguage);
    }
    return formatRuleBasedHeaderSubtitle(languageConfig.outputLanguage);
  }, [llmOnline, llmModel, lastReplyMeta?.llmCacheHit, languageConfig.outputLanguage]);

  useEffect(() => {
    if (!digestUndoText || dailyDigest) return;
    const id = window.setInterval(() => setDigestTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [digestUndoText, dailyDigest]);

  useEffect(() => {
    if (dailyDigest && !prevDailyDigestRef.current) {
      digestBarRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevDailyDigestRef.current = dailyDigest;
  }, [dailyDigest]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingSuggestions, isLoading]);

  useEffect(() => {
    if (isOpen) {
      refreshLlmStatus();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, refreshLlmStatus]);

  useEffect(() => {
    if (input.trim().length < 2) {
      setAutocomplete([]);
      return;
    }
    const t = setTimeout(() => {
      setAutocomplete(
        getAutocompleteSuggestions(input, {
          products: storeProducts,
          parties: storeParties,
          session: intelligenceCore.getSessionState(),
          phraseWeights,
        }),
      );
      setActiveSuggestion(0);
    }, 120);
    return () => clearTimeout(t);
  }, [input, storeProducts, storeParties, phraseWeights]);

  const applySuggestion = useCallback((text: string) => {
    setInput(text);
    setAutocomplete([]);
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleCacheHeaderClick = useCallback(() => {
    cacheHeaderClickRef.current.count += 1;
    if (cacheHeaderClickRef.current.timer) {
      clearTimeout(cacheHeaderClickRef.current.timer);
    }
    cacheHeaderClickRef.current.timer = setTimeout(() => {
      const clicks = cacheHeaderClickRef.current.count;
      if (clicks >= 3) {
        if (
          !window.confirm(formatCacheClearConfirm(languageConfig.outputLanguage))
        ) {
          cacheHeaderClickRef.current.count = 0;
          cacheHeaderClickRef.current.timer = null;
          return;
        }
        void sendMessage("/cache clear");
        setSyncMessage(formatCacheSyncMessage("clear_requested", languageConfig.outputLanguage));
      } else if (clicks === 2) {
        void sendMessage("/cache stats");
        setSyncMessage(formatCacheSyncMessage("stats_opened", languageConfig.outputLanguage));
      } else {
        void buildCacheStatsSummary(languageConfig.outputLanguage).then(async (line) => {
          const ok = await copyWhatsAppText(line);
          setSyncMessage(
            formatCacheSyncMessage(
              ok ? "stats_copied" : "copy_failed",
              languageConfig.outputLanguage,
            ),
          );
        });
      }
      cacheHeaderClickRef.current.count = 0;
      cacheHeaderClickRef.current.timer = null;
    }, 280);
  }, [sendMessage, languageConfig.outputLanguage]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      await acceptSuggestion(suggestion);
    },
    [acceptSuggestion],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[9998] w-[440px] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{ maxHeight: "min(85vh, 720px)", minHeight: 480 }}
      data-component="sutra-ai-chat"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1557b0] text-white flex-shrink-0">
        <Brain className="h-4 w-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[13px]">SUTRA AI</span>
          <p className="text-[10px] text-blue-100 truncate">
            {headerSubtitle}
          </p>
        </div>
        {cacheSparkline !== "—" && (
          <button
            type="button"
            onClick={handleCacheHeaderClick}
            className="text-[9px] font-mono text-blue-100 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 flex-shrink-0"
            title={cacheSparkTooltip}
          >
            {cacheHitRatePct != null ? `${cacheHitRatePct}% ` : ""}
            {cacheSparkline}
          </button>
        )}
        {lastReplyMeta?.llmCacheHit && (
          <span
            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-900 flex-shrink-0"
            title={cachedBadgeTooltip}
          >
            {cachedBadgeLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            const summary = sessionSummaryEngine.build(
              intelligenceCore.getContextManager().getRecentTurns(10),
              intelligenceCore.getSessionState(),
              languageConfig.outputLanguage,
            );
            downloadChatExport(
              messages.map((m) => ({
                role: m.role,
                text: m.text,
                timestamp: m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp),
              })),
              "text",
              summary,
            );
            setSyncMessage(formatChatSyncMessage("chat_exported", languageConfig.outputLanguage));
          }}
          title="Export chat"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            void downloadLearningBundle().then(() =>
              setSyncMessage(formatChatSyncMessage("learning_exported", languageConfig.outputLanguage)),
            );
          }}
          title="Export learning"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <CloudDownload className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          title="Import learning"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <CloudUpload className="h-3.5 w-3.5" />
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            const result = await importLearningBundle(text);
            setSyncMessage(result.message);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Clear all messages?")) clearHistory();
          }}
          title="Clear history"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={closePanel}
          title="Close"
          className="p-1 rounded hover:bg-white/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Language selector */}
      <LanguageSelector
        inputLanguage={languageConfig.inputLanguage}
        outputLanguage={languageConfig.outputLanguage}
        showTranslation={languageConfig.showTranslation}
        autoDetect={languageConfig.autoDetect}
        autoSpeakResponses={languageConfig.autoSpeakResponses}
        onInputChange={(lang: InputLanguage) => setLanguageConfig({ inputLanguage: lang })}
        onOutputChange={(lang: LanguageCode) => setLanguageConfig({ outputLanguage: lang })}
        onShowTranslationChange={(show) => setLanguageConfig({ showTranslation: show })}
        onAutoDetectChange={(auto) => setLanguageConfig({ autoDetect: auto })}
        onAutoSpeakChange={(auto) => setLanguageConfig({ autoSpeakResponses: auto })}
      />

      {syncMessage && (
        <p className="px-3 py-1 text-[10px] text-gray-600 bg-blue-50 border-b border-blue-100">
          {syncMessage}
        </p>
      )}

      {!dailyDigest && digestUndoText && (
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex items-center justify-between gap-2">
          <p className="text-[10px] text-gray-500">{digestHiddenLabel}</p>
          <button
            type="button"
            onClick={() => restoreDailyDigest()}
            className="text-[10px] font-semibold text-[#1557b0] hover:text-[#0f4a96]"
          >
            {digestShowAgainLabel}
          </button>
        </div>
      )}

      {proactiveAlerts.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
          <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide mb-1">
            {formatProactiveAlertsHeader(languageConfig.outputLanguage)}
          </p>
          <ul className="space-y-0.5">
            {proactiveAlerts.slice(0, 3).map((alert) => (
              <li
                key={alert.id}
                className={`text-[10px] leading-snug ${
                  alert.severity === "danger"
                    ? "text-red-700"
                    : alert.severity === "warning"
                      ? "text-amber-800"
                      : "text-gray-700"
                }`}
              >
                {languageConfig.outputLanguage === "english"
                  ? alert.english
                  : languageConfig.outputLanguage === "roman"
                    ? alert.roman
                    : alert.nepali}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {dailyDigest && (
          <div
            ref={digestBarRef}
            className={`-mx-3 px-3 py-2 mb-1 bg-[#eef2ff] border-b border-[#c7d2fe] ${
              digestPinned ? "sticky top-0 z-10 shadow-sm" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-semibold text-[#1557b0] uppercase tracking-wide">
                {formatDailyDigestHeader(languageConfig.outputLanguage)}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDigestPinned((p) => {
                    const next = !p;
                    writeDigestPinnedPreference(next);
                    return next;
                  })}
                  className={`text-[10px] font-medium px-1 ${
                    digestPinned ? "text-[#1557b0]" : "text-gray-500 hover:text-gray-700"
                  }`}
                  title={digestPinUi.title}
                >
                  {digestPinUi.label}
                </button>
                <button
                  type="button"
                  onClick={() => snoozeDailyDigest(1)}
                  className="text-[10px] text-gray-500 hover:text-gray-700 font-medium px-1"
                  title={formatDigestSnoozeTitle("1h", languageConfig.outputLanguage)}
                >
                  {formatDigestSnoozeChip("1h", languageConfig.outputLanguage)}
                </button>
                <button
                  type="button"
                  onClick={() => snoozeDailyDigest(4)}
                  className="text-[10px] text-gray-500 hover:text-gray-700 font-medium px-1"
                  title={formatDigestSnoozeTitle("4h", languageConfig.outputLanguage)}
                >
                  {formatDigestSnoozeChip("4h", languageConfig.outputLanguage)}
                </button>
                <button
                  type="button"
                  onClick={() => dismissDailyDigest()}
                  className="text-[10px] text-gray-500 hover:text-gray-700 font-medium px-1"
                  title={formatDigestSnoozeTitle("tomorrow", languageConfig.outputLanguage)}
                >
                  {formatDigestSnoozeChip("tomorrow", languageConfig.outputLanguage)}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-700 whitespace-pre-wrap leading-snug">{dailyDigest}</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-[12px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#1557b0] text-white rounded-br-sm"
                  : "bg-[#f5f6fa] text-gray-800 border border-gray-200 rounded-bl-sm"
              }`}
            >
              {msg.correctedFrom && (
                <p className="text-[9px] opacity-70 line-through mb-0.5">{msg.correctedFrom}</p>
              )}
              {msg.autoCorrected && (
                <span className="inline-block mb-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-green-100 text-green-700 border border-green-200">
                  {formatAutoCorrectedLabel(languageConfig.outputLanguage)}
                </span>
              )}
              {msg.text}
              {msg.role === "assistant" && msg.id !== "welcome" && (
                <MessageShareButton
                  text={msg.text}
                  shareText={msg.shareText}
                  phone={msg.partyPhone}
                />
              )}
              {msg.role === "assistant" && msg.id !== "welcome" && (
                <div className="flex justify-end mt-0.5">
                  <VoiceOutput text={msg.text} outputLanguage={languageConfig.outputLanguage} />
                </div>
              )}
              {msg.parallel && languageConfig.showTranslation && msg.role === "assistant" && (
                <ParallelTranslationView
                  parallel={msg.parallel}
                  primaryLanguage={languageConfig.outputLanguage}
                  compact
                  inverted={false}
                />
              )}
              {msg.reasoningSteps && msg.role === "assistant" && (
                <div className="mt-1.5 -mx-1">
                  <ReasoningTrace
                    steps={msg.reasoningSteps}
                    confidence={msg.reasoningConfidence}
                  />
                </div>
              )}
              {msg.processingTimeMs != null && msg.role === "assistant" && (
                <p className="text-[9px] text-gray-400 mt-1 text-right flex items-center justify-end gap-1.5">
                  {msg.llmCacheHit && (
                    <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold uppercase text-[8px]">
                      {cachedBadgeLabel}
                    </span>
                  )}
                  <span>{msg.processingTimeMs}ms</span>
                </p>
              )}
              {msg.processingTimeMs == null && msg.llmCacheHit && msg.role === "assistant" && (
                <p className="text-[9px] text-gray-400 mt-1 text-right">
                  <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold uppercase text-[8px]">
                    {cachedBadgeLabel}
                  </span>
                </p>
              )}
              {msg.actions && msg.actions.length > 0 && msg.role === "assistant" && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-1.5 border-t border-gray-200">
                  {msg.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => executeAction(action)}
                      className="h-7 px-2.5 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[10px] font-medium rounded-md"
                    >
                      {languageConfig.outputLanguage === "english"
                        ? action.label
                        : action.labelNepali}
                    </button>
                  ))}
                </div>
              )}
              {msg.quickReplies && msg.quickReplies.length > 0 && msg.role === "assistant" && (
                <QuickReplyBar
                  replies={msg.quickReplies}
                  disabled={isLoading}
                  onSelect={(value) => {
                    void quickReplyLearningStore.recordSelection(value);
                    const wa = tryHandlePhoneSavedWaQuickReply(
                      value,
                      languageConfig.outputLanguage,
                    );
                    if (wa) {
                      openWhatsAppShare(wa.shareText, wa.phone);
                      pushAssistantBubble(wa.confirmText);
                      return;
                    }
                    const waOpen = decodeWaOpenValue(value);
                    if (waOpen) {
                      openWhatsAppShare(waOpen.text, waOpen.phone);
                      pushAssistantBubble(
                        formatWaOpenConfirmation(waOpen.partyName, languageConfig.outputLanguage),
                      );
                      return;
                    }
                    const agingReturn = decodeAgingReturnQuickReplyValue(value);
                    if (agingReturn) {
                      saveAiAgingReportDraft({
                        direction: agingReturn.direction,
                        searchTerm: agingReturn.searchTerm,
                      });
                      useStore.getState().setCurrentPage("aging-report");
                      closePanel();
                      pushAssistantBubble(
                        formatAgingReturnConfirmation(languageConfig.outputLanguage),
                      );
                      return;
                    }
                    const phoneCopy = tryHandlePhoneSavedCopyQuickReply(
                      value,
                      languageConfig.outputLanguage,
                    );
                    if (phoneCopy) {
                      void copyWhatsAppText(phoneCopy.text).then((ok) => {
                        pushAssistantBubble(
                          formatCopyConfirmation(
                            phoneCopy.partyName,
                            languageConfig.outputLanguage,
                            ok,
                          ),
                        );
                        if (ok) {
                          setSyncMessage(
                            formatChatSyncMessage("reminder_copied", languageConfig.outputLanguage),
                          );
                        }
                      });
                      return;
                    }
                    const copyPayload = decodeCopyValue(value);
                    if (copyPayload) {
                      void copyWhatsAppText(copyPayload.text).then((ok) => {
                        pushAssistantBubble(
                          formatCopyConfirmation(
                            copyPayload.partyName,
                            languageConfig.outputLanguage,
                            ok,
                          ),
                        );
                        if (ok) {
                          setSyncMessage(
                            formatChatSyncMessage("reminder_copied", languageConfig.outputLanguage),
                          );
                        }
                      });
                      return;
                    }
                    void sendMessage(value);
                  }}
                />
              )}
              {msg.role === "assistant" && msg.id !== "welcome" && (
                <div className="flex items-center gap-1 mt-1.5 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    title="Helpful"
                    disabled={Boolean(msg.feedbackGiven)}
                    onClick={() => recordFeedback(msg.id, true)}
                    className={`p-0.5 rounded ${msg.feedbackGiven === "up" ? "text-green-600" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Not helpful"
                    disabled={Boolean(msg.feedbackGiven)}
                    onClick={() => recordFeedback(msg.id, false)}
                    className={`p-0.5 rounded ${msg.feedbackGiven === "down" ? "text-red-600" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {pendingSuggestions && pendingSuggestions.length > 0 && (
          <SuggestionCard
            originalInput={pendingOriginalInput ?? ""}
            suggestions={pendingSuggestions}
            unknownWords={pendingUnknownWords}
            onSelect={handleSelectSuggestion}
            onReject={rejectSuggestion}
            onCustomInput={(text) => sendMessage(text)}
          />
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500 px-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {formatAnalyzingLabel(languageConfig.outputLanguage)}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 bg-white">
        <div className="flex gap-2 relative">
          <VoiceInput
            disabled={isLoading}
            inputLanguage={languageConfig.inputLanguage}
            onTranscript={(text) => {
              setInput(text);
              setAutocomplete([]);
              void sendMessage(text);
            }}
          />
          <div className="flex-1 relative">
            <InputAutocomplete
              suggestions={autocomplete}
              activeIndex={activeSuggestion}
              onSelect={applySuggestion}
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (autocomplete.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestion((i) => (i + 1) % autocomplete.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestion((i) => (i - 1 + autocomplete.length) % autocomplete.length);
                    return;
                  }
                  if (e.key === "Tab" && autocomplete[activeSuggestion]) {
                    e.preventDefault();
                    applySuggestion(autocomplete[activeSuggestion].text);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  setAutocomplete([]);
                  handleSend();
                }
              }}
              placeholder="Type in Nepali, English, or Roman Nepali..."
              disabled={isLoading}
              className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] disabled:opacity-40 text-white text-[12px] font-medium rounded-md flex items-center gap-1"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[9px] text-gray-400 mt-1 text-center">
          Ctrl+Shift+A · Tab to autocomplete · Esc to close
        </p>
      </div>
    </div>
  );
};

export default SutraAIChat;
