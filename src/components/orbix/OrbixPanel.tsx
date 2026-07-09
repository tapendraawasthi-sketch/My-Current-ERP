// src/components/orbix/OrbixPanel.tsx
// Orbix v2 — grounded reasoning chat panel.
// Shows the answer, intent, confidence, tool activity, evidence, and
// confirmation cards for ledger mutations. Honest about offline/builtin modes.

import React, { memo, useEffect, useRef, useState } from "react";
import {
  Send,
  Trash2,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileCode,
  Globe,
  Database,
  Calculator,
  Check,
  AlertTriangle,
} from "lucide-react";

import { MarkdownRenderer } from "../../lib/falcon/markdownRenderer";
import { useOrbixStore, type OrbixMessage } from "../../store/orbixStore";
import type {
  OrbixEvidenceRef,
  OrbixRuntimeMode,
  OrbixToolTrace,
} from "../../lib/orbix/types";

interface OrbixPanelProps {
  onClose?: () => void;
  debug?: boolean;
}

const MODE_LABEL: Record<OrbixRuntimeMode | "unknown", { text: string; cls: string }> = {
  orbix: { text: "Reasoning agent online", cls: "bg-green-100 text-green-700" },
  builtin: { text: "Ollama offline — limited", cls: "bg-amber-100 text-amber-700" },
  offline: { text: "Backend offline", cls: "bg-red-100 text-red-700" },
  unknown: { text: "Checking…", cls: "bg-gray-100 text-gray-700" },
};

function evidenceIcon(type: OrbixEvidenceRef["source_type"]) {
  switch (type) {
    case "code":
    case "navigation":
      return <FileCode className="h-3 w-3" />;
    case "web":
      return <Globe className="h-3 w-3" />;
    case "memory":
      return <Database className="h-3 w-3" />;
    case "ledger":
      return <Calculator className="h-3 w-3" />;
    default:
      return <FileCode className="h-3 w-3" />;
  }
}

const IntentBadge = memo(function IntentBadge({
  intent,
  confidence,
}: {
  intent?: string;
  confidence?: number;
}) {
  if (!intent) return null;
  const pct = typeof confidence === "number" ? Math.round(confidence * 100) : null;
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
      {intent}
      {pct !== null ? <span className="text-blue-500">· {pct}%</span> : null}
    </span>
  );
});

const EvidenceList = memo(function EvidenceList({
  evidence,
}: {
  evidence: OrbixEvidenceRef[];
}) {
  const [open, setOpen] = useState(false);
  if (!evidence.length) return null;
  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Evidence ({evidence.length})
      </button>
      {open ? (
        <ul className="mt-1.5 space-y-1">
          {evidence.map((e) => (
            <li key={e.id} className="flex items-start gap-1.5 text-[11px] text-gray-600">
              <span className="mt-0.5 text-gray-400">{evidenceIcon(e.source_type)}</span>
              <span className="font-mono break-all">
                {e.uri}
                {e.line_start ? `:${e.line_start}-${e.line_end}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

const ToolTraceList = memo(function ToolTraceList({
  trace,
}: {
  trace: OrbixToolTrace[];
}) {
  if (!trace.length) return null;
  return (
    <div className="mt-2 rounded-md bg-[#f5f6fa] p-2">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        Tool activity
      </div>
      <ul className="mt-1 space-y-0.5">
        {trace.map((t, i) => (
          <li key={i} className="flex items-center gap-1.5 text-[11px]">
            {t.ok ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-red-600" />
            )}
            <span className="font-mono text-gray-700">{t.name}</span>
            {t.summary ? <span className="text-gray-500 truncate">— {t.summary}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
});

const ConfirmationCard = memo(function ConfirmationCard({
  message,
}: {
  message: OrbixMessage;
}) {
  const confirmAction = useOrbixStore((s) => s.confirmAction);
  const isLoading = useOrbixStore((s) => s.isLoading);
  if (!message.needsConfirmation || !message.confirmationPayload) return null;

  const payload = message.confirmationPayload as {
    lines?: Array<{ account: string; debit?: number; credit?: number }>;
    debit_total?: number;
    credit_total?: number;
  };
  const balanced =
    typeof payload.debit_total === "number" &&
    typeof payload.credit_total === "number" &&
    Math.abs(payload.debit_total - payload.credit_total) < 0.01;

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-white p-2.5">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        Proposed voucher
      </div>
      {payload.lines?.length ? (
        <table className="w-full text-[11px]">
          <tbody>
            {payload.lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-1 text-gray-700">
                  {l.debit ? "DR" : "CR"} {l.account}
                </td>
                <td className="py-1 text-right font-mono text-gray-800">
                  {(l.debit || l.credit || 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div
        className={`mt-1.5 rounded px-2 py-1 text-[10px] font-semibold ${
          balanced
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}
      >
        {balanced ? "Balanced" : "Not balanced"} · DR{" "}
        {payload.debit_total?.toLocaleString("en-IN") ?? "?"} / CR{" "}
        {payload.credit_total?.toLocaleString("en-IN") ?? "?"}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={isLoading || !balanced}
          onClick={() => confirmAction(message.id, message.confirmationPayload!)}
          className="h-7 px-3 bg-[#1557b0] hover:bg-[#0f4a96] disabled:opacity-50 text-white text-[12px] font-medium rounded-md"
        >
          Confirm &amp; post
        </button>
      </div>
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({
  message,
  debug,
}: {
  message: OrbixMessage;
  debug: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-md px-3 py-2 text-[12px] ${
          isUser
            ? "bg-[#1557b0] text-white"
            : "bg-white border border-gray-200 text-gray-800"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <IntentBadge intent={message.intent} confidence={message.confidence} />
              {message.engine && message.engine !== "orbix" ? (
                <span className="text-[10px] text-gray-400">{message.engine}</span>
              ) : null}
            </div>
            {message.isStreaming && !message.content ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
            {message.warnings?.length ? (
              <div className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
                <AlertTriangle className="h-3 w-3 mt-0.5" />
                <span>{message.warnings.join("; ")}</span>
              </div>
            ) : null}
            <ConfirmationCard message={message} />
            {message.evidence?.length ? <EvidenceList evidence={message.evidence} /> : null}
            {debug && message.toolTrace?.length ? (
              <ToolTraceList trace={message.toolTrace} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
});

export function OrbixPanel({ onClose, debug = false }: OrbixPanelProps) {
  const { messages, isLoading, status, agentModel, sendMessage, refreshStatus, clearHistory } =
    useOrbixStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage(text);
  };

  const modeInfo = MODE_LABEL[status];

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa]">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Orbix AI</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${modeInfo.cls}`}>
              {modeInfo.text}
            </span>
            {agentModel ? (
              <span className="text-[10px] text-gray-400 font-mono">{agentModel}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearHistory}
            title="Clear conversation"
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose ? (
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="text-[12px] text-gray-500">
            Ask about ERP screens, code, or record a transaction (e.g.{" "}
            <span className="font-mono">Ram le 10000 tiryo tara 500 discount diye</span>).
            Every factual answer is grounded in source evidence.
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} debug={debug} />)
        )}
      </div>

      <div className="border-t border-gray-200 bg-white px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Ask Orbix…"
            className="flex-1 resize-none h-8 px-2.5 py-1.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] disabled:opacity-50 text-white text-[12px] font-medium rounded-md flex items-center gap-1"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrbixPanel;
