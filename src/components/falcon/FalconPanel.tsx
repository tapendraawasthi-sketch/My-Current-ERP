// src/components/falcon/FalconPanel.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  X,
  Bot,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useFalconStore } from "../../store/falconStore";

const quickPrompts = [
  "How do I create a sales invoice?",
  "How do I make a journal entry?",
  "How do I see VAT reports?",
  "How do I add a customer or supplier?",
  "How do I check Profit & Loss?",
  "How do I use POS day close?",
];

const FalconPanel: React.FC = () => {
  const { isOpen, closePanel, messages, isTyping, sendMessage, rateMessage, clearHistory } =
    useFalconStore();

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  // Stop most app-level keyboard side effects while Falcon is focused/open.
  useEffect(() => {
    if (!isOpen) return;

    const stopIfInsideFalcon = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const isInside = panelRef.current?.contains(target);
      if (!isInside) return;

      // Let normal typing work, but do not let ERP page-level shortcuts react.
      event.stopPropagation();

      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };

    document.addEventListener("keydown", stopIfInsideFalcon, true);
    return () => document.removeEventListener("keydown", stopIfInsideFalcon, true);
  }, [isOpen, closePanel]);

  if (!isOpen) return null;

  const submit = async (text?: string) => {
    const value = (text ?? draft).trim();
    if (!value || isTyping) return;
    setDraft("");
    await sendMessage(value);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div
      ref={panelRef}
      className="fixed bottom-20 right-5 z-[9998] w-[420px] max-w-[94vw] h-[620px] max-h-[78vh] bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1557b0] text-white">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-none">Falcon AI</p>
            <p className="text-[10px] text-white/75 leading-none mt-0.5">
              Sutra ERP help assistant · read-only
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearHistory}
            title="Clear chat"
            className="p-1.5 rounded hover:bg-white/15 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={closePanel}
            title="Close"
            className="p-1.5 rounded hover:bg-white/15 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick prompt strip */}
      <div className="px-3 py-2 border-b border-gray-200 bg-[#f5f6fa]">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-[#1557b0]" />
          <span className="text-[11px] font-semibold text-gray-700">Ask about Sutra ERP</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-0.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submit(prompt)}
              className="shrink-0 h-7 px-2.5 rounded-md border border-gray-300 bg-white text-[11px] text-gray-700 hover:bg-gray-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#f5f6fa]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="max-w-[88%] flex flex-col gap-1.5">
              <div
                className={`px-3 py-2 rounded-md text-[12px] leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-[#1557b0] text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                }`}
              >
                {message.content}
              </div>

              {message.role === "assistant" && message.id !== "welcome" && (
                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    onClick={() => rateMessage(message.id, 1)}
                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                      message.feedback === 1 ? "text-green-600" : "text-gray-400"
                    }`}
                    title="Helpful"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rateMessage(message.id, -1)}
                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                      message.feedback === -1 ? "text-red-600" : "text-gray-400"
                    }`}
                    title="Not helpful"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}

              {message.role === "assistant" &&
                message.suggestions &&
                message.suggestions.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => submit(suggestion)}
                        className="text-left text-[11px] px-2.5 py-1.5 rounded-md border border-[#1557b0]/30 text-[#1557b0] bg-white hover:bg-[#1557b0]/5 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-md bg-white border border-gray-200 rounded-bl-sm flex items-center gap-2 text-[12px] text-gray-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1557b0]" />
              Falcon is thinking…
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-2.5 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask Falcon about invoices, vouchers, reports, masters, VAT, POS..."
            className="flex-1 min-h-[38px] max-h-24 px-3 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] resize-none"
          />
          <button
            type="button"
            onClick={() => submit()}
            disabled={!draft.trim() || isTyping}
            className="h-9 w-9 flex items-center justify-center bg-[#1557b0] hover:bg-[#0f4a96] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">
          Falcon gives guidance only. It does not post vouchers, refresh pages or modify accounting
          data.
        </p>
      </div>
    </div>
  );
};

export default FalconPanel;
