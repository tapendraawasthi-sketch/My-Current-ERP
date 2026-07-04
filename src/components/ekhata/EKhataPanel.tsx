import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Cpu, Loader2, Send, Trash2, X } from "lucide-react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import { KHATA_INTENT_LABELS } from "../../lib/ekhata/types";
import { isWebGpuAvailable } from "../../lib/ekhata/ekhataWebLlm";

function statusLabel(llmOnline: boolean, browserAiReady: boolean, llmModel?: string): string {
  if (llmOnline) return `Ollama LLM · ${llmModel ?? "local"}`;
  if (browserAiReady) return "Browser Nepali AI · Qwen2.5";
  return "Load Nepali AI for full chat";
}

const EKhataPanel: React.FC = () => {
  const {
    isOpen,
    closePanel,
    messages,
    pendingCard,
    isLoading,
    llmOnline,
    llmModel,
    browserAiReady,
    browserAiLoading,
    browserAiProgress,
    browserAiProgressText,
    sendMessage,
    confirmPending,
    cancelPending,
    clearHistory,
    refreshLlmStatus,
    loadBrowserAi,
  } = useEKhataStore();
  const closeFalcon = useFalconStore((state) => state.closePanel);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const showLoadAi = !llmOnline && !browserAiReady && isWebGpuAvailable();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingCard, isLoading, browserAiLoading]);

  useEffect(() => {
    if (isOpen) {
      closeFalcon();
      refreshLlmStatus();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, closeFalcon, refreshLlmStatus]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  if (!isOpen) return null;

  const aiActive = llmOnline || browserAiReady;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[420px] flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{ maxHeight: "min(82vh, 700px)", minHeight: 420 }}
      data-component="ekhata-panel"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#059669] text-white flex-shrink-0">
        <BookOpen className="h-4 w-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-[13px] tracking-tight">e-KHATA</span>
          <p className="text-[10px] text-emerald-100 truncate">
            {statusLabel(llmOnline, browserAiReady, llmModel)}
          </p>
        </div>
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
          <X className="h-4 w-4" />
        </button>
      </div>

      {showLoadAi && (
        <div className="px-3 py-2 bg-[#f5f6fa] border-b border-gray-200 flex-shrink-0">
          {browserAiLoading ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-gray-600">
                <span>{browserAiProgressText || "Loading Nepali AI..."}</span>
                <span>{browserAiProgress}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#059669] transition-all duration-300"
                  style={{ width: `${browserAiProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void loadBrowserAi()}
              className="h-7 w-full flex items-center justify-center gap-1.5 rounded-md bg-[#1557b0] text-white text-[11px] font-medium hover:bg-[#0f4a96]"
            >
              <Cpu className="h-3.5 w-3.5" />
              Load Nepali AI (browser, ~300MB, no API key)
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-md px-3 py-2 text-[12px] whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#1557b0] text-white"
                  : "border border-gray-200 bg-white text-gray-700"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {pendingCard && (
          <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Confirm transaction
            </p>
            <dl className="mt-2 space-y-1 text-[12px] text-gray-700">
              <div className="flex justify-between gap-4">
                <dt>Type</dt>
                <dd>{KHATA_INTENT_LABELS[pendingCard.intent]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Party</dt>
                <dd>{pendingCard.party ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Amount</dt>
                <dd className="font-mono">NPR {pendingCard.amount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Item</dt>
                <dd>{pendingCard.item ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Date</dt>
                <dd>{pendingCard.date}</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmPending}
                disabled={isLoading}
                className="h-8 flex-1 rounded-md bg-[#1557b0] text-[12px] font-medium text-white hover:bg-[#0f4a96] disabled:opacity-50"
              >
                Confirm ✓
              </button>
              <button
                type="button"
                onClick={cancelPending}
                disabled={isLoading}
                className="h-8 flex-1 rounded-md border border-gray-300 bg-white text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel ✗
              </button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {browserAiLoading ? browserAiProgressText || "Nepali AI load hudai cha..." : "Socheko cha..."}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white p-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={aiActive ? "Nepali ma lekhnu hola..." : "Ram lai 500 udhaar diye..."}
            disabled={isLoading}
            className="h-8 flex-1 rounded-md border border-gray-300 bg-white px-2.5 text-[12px] focus:border-[#1557b0] focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 disabled:opacity-50"
            data-component="ekhata-input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="h-8 w-8 rounded-md bg-[#1557b0] text-white flex items-center justify-center hover:bg-[#0f4a96] disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-gray-400">
          Ctrl+Shift+K ·{" "}
          {llmOnline ? "Ollama AI" : browserAiReady ? "Browser AI" : "Khata parser + Load AI"} · Saves
          to ledger
        </p>
      </div>
    </div>
  );
};

export default EKhataPanel;
