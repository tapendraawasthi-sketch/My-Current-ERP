// src/components/falcon/FalconPanel.tsx
// Falcon AI — Main Chat Panel UI
// Replaces existing FalconPanel.tsx with streaming, markdown, and enhanced UX.

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  X,
  Bot,
  Sparkles,
  Loader2,
  Brain,
  Globe,
  Check,
  Settings,
  Key,
  Search,
  Copy,
  Square,
  ChevronDown,
} from "lucide-react";
import { MarkdownRenderer } from "../../lib/falcon/markdownRenderer";
import { useFalconStore, GROQ_MODELS } from "../../store/falconStore";
import { FalconThinkingPanel } from "./FalconThinkingPanel";
import type { FalconChatMessage } from "../../store/falconStore";

// ─────────────────────────────────────────────────────────────────────────────
// QUICK PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_PROMPTS: Record<string, string[]> = {
  ERP: [
    "Create sales invoice",
    "Record receipt",
    "View VAT report",
    "Add new party",
    "Check outstanding",
    "Day book today",
    "Print invoice",
    "Stock summary",
  ],
  Finance: [
    "Explain double-entry",
    "VAT calculation formula",
    "Trial balance vs P&L",
    "How is depreciation calculated?",
    "What is TDS?",
    "Debit vs Credit",
  ],
  General: [
    "Search latest news",
    "Calculate compound interest",
    "Explain inflation simply",
    "What is machine learning?",
    "Healthy breakfast ideas",
    "How does GPS work?",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Format a Date as "10:32 AM" */
function formatTime(ts: Date | string): string {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Domain badge config */
function getDomainBadge(domain?: string): { label: string; cls: string } | null {
  if (!domain) return null;
  const map: Record<string, { label: string; cls: string }> = {
    erp: { label: "🏢 ERP Expert Mode", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    accounting: { label: "📊 Finance Mode", cls: "bg-green-50 text-green-700 border-green-200" },
    "web-search": {
      label: "🌐 Web Search Mode",
      cls: "bg-orange-50 text-orange-700 border-orange-200",
    },
    math: { label: "🧮 Calculator Mode", cls: "bg-teal-50 text-teal-700 border-teal-200" },
    code: { label: "💻 Code Mode", cls: "bg-violet-50 text-violet-700 border-violet-200" },
    greeting: { label: "👋 Conversation", cls: "bg-gray-50 text-gray-600 border-gray-200" },
    general: {
      label: "💡 General Knowledge",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    },
  };
  return (
    map[domain] ?? {
      label: "💡 General Knowledge",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────────────────────

const MessageBubble = memo(
  ({ msg, onRate }: { msg: FalconChatMessage; onRate: (id: string, v: 1 | -1) => void }) => {
    const [copied, setCopied] = useState(false);
    const isUser = msg.role === "user";
    const isStreaming = !!msg.isStreaming;
    const domainBadge = getDomainBadge(msg.domain);

    const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(msg.content).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }, [msg.content]);

    return (
      <div
        className={`group flex flex-col gap-1 ${isUser ? "items-end" : "items-start"} animate-fadeIn`}
      >
        {/* Bubble */}
        <div
          className={[
            "relative max-w-[92%] rounded-xl px-3 py-2 text-[12px] shadow-sm transition-all",
            isUser
              ? "bg-[#1557b0] text-white rounded-tr-sm"
              : [
                  "bg-white text-gray-800 rounded-tl-sm border",
                  isStreaming ? "border-blue-300 shadow-blue-100" : "border-gray-200",
                ].join(" "),
          ].join(" ")}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          ) : (
            <>
              <MarkdownRenderer content={msg.content} compact animate={isStreaming} />
              {/* Blinking cursor while streaming */}
              {isStreaming && (
                <span className="inline-block w-[7px] h-[13px] bg-blue-500 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
              )}
            </>
          )}

          {/* Copy button — appears on hover for assistant */}
          {!isUser && !isStreaming && msg.content && (
            <button
              onClick={handleCopy}
              title="Copy response"
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Timestamp */}
        {msg.timestamp && (
          <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.timestamp)}</span>
        )}

        {/* Badges — web search + domain */}
        {!isUser && !isStreaming && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.webSearchUsed && msg.searchQuery && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-50 text-orange-700 border border-orange-200">
                <Search className="h-2.5 w-2.5" />
                Searched: {msg.searchQuery.slice(0, 40)}
                {msg.searchQuery.length > 40 ? "…" : ""}
              </span>
            )}
            {domainBadge && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${domainBadge.cls}`}
              >
                {domainBadge.label}
              </span>
            )}
          </div>
        )}

        {/* Thinking panel */}
        {!isUser && !isStreaming && msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
          <div className="w-full max-w-[92%]">
            <FalconThinkingPanel
              steps={msg.reasoningSteps}
              domain={msg.domain}
              isLive={false}
              defaultExpanded={false}
            />
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && !isStreaming && msg.suggestions && msg.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1 max-w-[92%]">
            {msg.suggestions.slice(0, 3).map((s, i) => (
              <button
                key={i}
                className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 hover:bg-blue-100 transition-colors"
                onClick={() => {
                  // Suggestions are handled by parent via a custom event
                  window.dispatchEvent(new CustomEvent("falcon-suggestion", { detail: s }));
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Feedback buttons */}
        {!isUser && !isStreaming && msg.id !== "welcome" && (
          <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onRate(msg.id, 1)}
              className={`p-1 rounded hover:bg-gray-100 transition-colors ${msg.feedback === 1 ? "text-green-500" : "text-gray-400"}`}
              title="Helpful"
            >
              <ThumbsUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => onRate(msg.id, -1)}
              className={`p-1 rounded hover:bg-gray-100 transition-colors ${msg.feedback === -1 ? "text-red-500" : "text-gray-400"}`}
              title="Not helpful"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  },
);
MessageBubble.displayName = "MessageBubble";

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────

const SettingsPanel = memo(({ onClose }: { onClose: () => void }) => {
  const { apiKey, setApiKey, model, setModel } = useFalconStore();
  const [draft, setDraft] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-3 py-3 space-y-3 text-[12px]">
      {/* API Key row */}
      <div>
        <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
          <Key className="h-3 w-3" /> Groq API Key
        </label>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <input
              type={show ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="gsk_…"
              className="w-full h-7 px-2 pr-8 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]"
            />
            <button
              onClick={() => setShow((p) => !p)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px]"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <button
            onClick={handleSave}
            className="h-7 px-2.5 bg-[#1557b0] text-white text-[11px] rounded-md hover:bg-[#0f4a96] flex items-center gap-1"
          >
            {saved ? <Check className="h-3 w-3" /> : "Save"}
          </button>
        </div>
        <p className="mt-0.5 text-[10px] text-gray-400">
          Free key at{" "}
          <a
            href="https://console.groq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            console.groq.com
          </a>
        </p>
      </div>

      {/* Model selector */}
      <div>
        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
          AI Model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full h-7 px-2 text-[11px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]"
        >
          {GROQ_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <p className="mt-0.5 text-[10px] text-gray-400">
          Llama 3.3 70B recommended for best reasoning
        </p>
      </div>

      <button onClick={onClose} className="text-[11px] text-gray-500 hover:text-gray-700 underline">
        Close settings
      </button>
    </div>
  );
});
SettingsPanel.displayName = "SettingsPanel";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────────────────────────────────────

export const FalconPanel: React.FC = () => {
  const store = useFalconStore();
  const {
    isOpen,
    closePanel,
    messages,
    isTyping,
    isStreaming,
    currentThinkingSteps,
    context,
    sendMessage,
    rateMessage,
    clearHistory,
    cancelStream,
  } = store;

  const [input, setInput] = useState("");
  const [promptTab, setPromptTab] = useState<"ERP" | "Finance" | "General">("ERP");
  const [showSettings, setShowSettings] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isStreaming]);

  // Listen for suggestion clicks from MessageBubble
  useEffect(() => {
    const handler = (e: Event) => {
      const suggestion = (e as CustomEvent).detail as string;
      if (suggestion) {
        setInput(suggestion);
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("falcon-suggestion", handler);
    return () => window.removeEventListener("falcon-suggestion", handler);
  }, []);

  // Focus textarea on open
  useEffect(() => {
    if (isOpen) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [isOpen]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping || isStreaming) return;
    setInput("");
    await sendMessage(text);
  }, [input, isTyping, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!isOpen) return null;

  const canSend = input.trim().length > 0 && !isTyping && !isStreaming;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[420px] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{ maxHeight: "min(82vh, 700px)", minHeight: 420 }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1557b0] text-white flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Bot className="h-4 w-4 flex-shrink-0" />
          <span className="font-bold text-[13px] tracking-tight">FALCON AI</span>
          {isStreaming && (
            <span className="text-[10px] text-blue-200 animate-pulse ml-1">● streaming</span>
          )}
          {isTyping && !isStreaming && (
            <span className="text-[10px] text-blue-200 animate-pulse ml-1">● thinking</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setShowSettings((p) => !p);
              setShowQuick(false);
            }}
            title="Settings"
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (window.confirm("Clear all messages?")) clearHistory();
            }}
            title="Clear history"
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={closePanel}
            title="Close"
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Settings Panel ──────────────────────────────────────────────────── */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* ── Context Banner ──────────────────────────────────────────────────── */}
      {context.route && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-700 flex-shrink-0">
          <Sparkles className="h-3 w-3" />
          <span>
            Context: <strong>{context.screenTitle || context.route}</strong>
          </span>
        </div>
      )}

      {/* ── Messages Area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} onRate={rateMessage} />
        ))}

        {/* Live thinking panel (while typing but NOT yet streaming) */}
        {isTyping && !isStreaming && currentThinkingSteps.length > 0 && (
          <div className="flex flex-col items-start animate-fadeIn">
            <FalconThinkingPanel
              steps={currentThinkingSteps}
              domain={undefined}
              isLive
              defaultExpanded
            />
          </div>
        )}

        {/* Streaming indicator (once content starts flowing) */}
        {isStreaming && (
          <p className="text-[10px] text-blue-400 animate-pulse px-1">Streaming response…</p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Prompts Toggle ────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 flex-shrink-0">
        <button
          onClick={() => setShowQuick((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            Quick prompts
          </span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showQuick ? "rotate-180" : ""}`}
          />
        </button>

        {showQuick && (
          <div className="px-3 pb-2 space-y-1.5">
            {/* Tab bar */}
            <div className="flex gap-1">
              {(["ERP", "Finance", "General"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPromptTab(tab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    promptTab === tab
                      ? "bg-[#1557b0] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {/* Prompt chips */}
            <div className="flex flex-wrap gap-1">
              {QUICK_PROMPTS[promptTab].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setInput(p);
                    setShowQuick(false);
                    textareaRef.current?.focus();
                  }}
                  className="px-2 py-0.5 text-[10px] bg-white border border-gray-200 rounded-full text-gray-700 hover:border-[#1557b0] hover:text-[#1557b0] transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Composer ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 px-3 pt-2 pb-2 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Falcon anything…"
            rows={2}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-2.5 py-1.5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]/20 disabled:bg-gray-50 disabled:cursor-not-allowed leading-relaxed"
            style={{ minHeight: 52, maxHeight: 120 }}
          />

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={cancelStream}
              title="Stop generation"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex-shrink-0"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              title="Send message (Enter)"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#1557b0] text-white hover:bg-[#0f4a96] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {isTyping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Hint bar */}
        <p className="mt-1 text-[10px] text-gray-400 leading-tight">
          Falcon AI can make mistakes · Ctrl+/ to toggle · Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default FalconPanel;
