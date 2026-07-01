// src/components/falcon/FalconPanel.tsx
import React, { useEffect, useRef, useState } from "react";
import { Send, ThumbsUp, ThumbsDown, Trash2, X, Bot } from "lucide-react";
import { useFalconStore } from "../../store/falconStore";

const FalconPanel: React.FC = () => {
  const { isOpen, closePanel, messages, isTyping, sendMessage, rateMessage, clearHistory } =
    useFalconStore();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  if (!isOpen) return null;

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  };

  return (
    <div className="fixed bottom-20 right-5 z-[9998] w-[360px] max-w-[92vw] h-[520px] max-h-[75vh] bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1557b0] text-white">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-none">Falcon</p>
            <p className="text-[10px] text-white/70 leading-none mt-0.5">Sutra ERP Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearHistory}
            title="Clear conversation"
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#f5f6fa]">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] flex flex-col gap-1.5">
              <div
                className={`px-3 py-2 rounded-md text-[12px] leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[#1557b0] text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>

              {m.role === "assistant" && m.id !== "welcome" && (
                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    onClick={() => rateMessage(m.id, 1)}
                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                      m.feedback === 1 ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rateMessage(m.id, -1)}
                    className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                      m.feedback === -1 ? "text-red-600" : "text-gray-400"
                    }`}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>
              )}

              {m.role === "assistant" && m.suggestions && m.suggestions.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  {m.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-md border border-[#1557b0]/30 text-[#1557b0] bg-white hover:bg-[#1557b0]/5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-md bg-white border border-gray-200 rounded-bl-sm flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-2.5 border-t border-gray-200 bg-white flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Ask Falcon anything about Sutra ERP…"
          className="flex-1 h-9 px-3 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
        />
        <button
          type="button"
          onClick={handleSend}
          className="h-9 w-9 flex items-center justify-center bg-[#1557b0] hover:bg-[#0f4a96] text-white rounded-md transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default FalconPanel;
