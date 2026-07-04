import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, Send, Trash2, X } from "lucide-react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import { KHATA_INTENT_LABELS } from "../../lib/ekhata/types";
import { validateJournalBalance } from "../../lib/ekhata/caEntryTemplates";

function statusLabel(llmOnline: boolean, llmModel?: string): string {
  if (llmOnline) {
    return llmModel
      ? `Autonomous AI · Ollama ${llmModel} · Web Search`
      : "Autonomous AI · Ollama · Web Search";
  }
  return "Autonomous AI · Web Search · CA Brain";
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
    sendMessage,
    confirmPending,
    cancelPending,
    clearHistory,
    refreshLlmStatus,
  } = useEKhataStore();
  const closeFalcon = useFalconStore((state) => state.closePanel);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingCard, isLoading]);

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

  const journalLines = pendingCard?.journalLines ?? [];
  const balance = journalLines.length > 0 ? validateJournalBalance(journalLines) : null;

  if (!isOpen) return null;

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
            {statusLabel(llmOnline, llmModel)}
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
              Confirm CA Journal Entry
            </p>
            <dl className="mt-2 space-y-1 text-[12px] text-gray-700">
              <div className="flex justify-between gap-4">
                <dt>Type</dt>
                <dd>{KHATA_INTENT_LABELS[pendingCard.intent]}</dd>
              </div>
              {pendingCard.primaryClass && (
                <div className="flex justify-between gap-4">
                  <dt>Class</dt>
                  <dd>
                    <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                      {pendingCard.primaryClass}
                    </span>
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt>Party</dt>
                <dd>{pendingCard.party ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Amount</dt>
                <dd className="font-mono">NPR {pendingCard.amount.toLocaleString()}</dd>
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

            {journalLines.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Journal Lines
                </p>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Account
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Dr
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Cr
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalLines.map((line, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-1.5 text-[11px] text-gray-700">
                          {line.accountName}
                          <span className="ml-1 text-[9px] text-gray-400">({line.accountClass})</span>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-right text-[11px] text-gray-700">
                          {line.debit > 0 ? line.debit.toLocaleString() : "—"}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-right text-[11px] text-gray-700">
                          {line.credit > 0 ? line.credit.toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {balance && (
                    <tfoot>
                      <tr className="bg-[#eef2ff] font-bold text-[11px] border-t-2 border-[#c7d2fe]">
                        <td className="px-2 py-1.5">Total</td>
                        <td className="px-2 py-1.5 font-mono text-right">
                          {balance.totalDebit.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-right">
                          {balance.totalCredit.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {balance && (
                  <div
                    className={`mt-2 rounded px-2 py-1 text-[10px] font-medium border ${
                      balance.balanced
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {balance.balanced ? "✓ Journal Balanced" : "✗ Journal Unbalanced"}
                  </div>
                )}
              </div>
            )}

            {pendingCard.caExplanation && (
              <p className="mt-2 text-[10px] text-gray-500 italic">{pendingCard.caExplanation}</p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmPending}
                disabled={isLoading || (balance !== null && !balance.balanced)}
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
            Sochdai cha...
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
            placeholder="Nepali/English ma entry lekhnu hola..."
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
          Ctrl+Shift+K · Autonomous AI · Web Search · Saves to ledger
        </p>
      </div>
    </div>
  );
};

export default EKhataPanel;
