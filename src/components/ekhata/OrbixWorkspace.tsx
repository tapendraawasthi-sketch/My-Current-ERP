import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  MessageSquarePlus,
  PanelRight,
  Search,
  Send,
  Shield,
  Square,
} from "lucide-react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import { useStore } from "../../store/useStore";
import { validateJournalBalance } from "../../lib/ekhata/caEntryTemplates";
import { ORBIX_MODE_META, type OrbixOperatingMode } from "../../lib/ekhata/orbixOperatingMode";
import OrbixLogo from "./OrbixLogo";
import OrbixJournalCard from "./OrbixJournalCard";
import OrbixChatSidebar from "./OrbixChatSidebar";
import OrbixNeuronThinking from "./OrbixNeuronThinking";
import OrbixReportTable from "./OrbixReportTable";
import OrbixReportDateClarify from "./OrbixReportDateClarify";
import OrbixModeSelector from "./OrbixModeSelector";
import OrbixResponseRenderer from "./OrbixResponseRenderer";
import ContextInspector from "./ContextInspector";
import { classifyAssistantTextHeuristic } from "../../lib/ekhata/orbixHeuristicFallback";
import { parseOrbixResponse } from "../../lib/ekhata/orbixResponseAdapter";
import type { OrbixResponse } from "../../lib/ekhata/orbixResponseTypes";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const ASK_STARTERS = [
  "Show this year’s Balance Sheet",
  "Compare profit with last year",
  "Show overdue receivables",
  "Explain today’s cash position",
  "Show low-stock items",
];

const ACCOUNTANT_STARTERS = [
  "Record a purchase",
  "Create a sales invoice",
  "Record a payment",
  "Record a receipt",
  "Create a journal entry",
];

/** Build a typed response from message.orbixResponse, else deprecated text fallback. */
function resolveMessageResponse(msg: {
  orbixResponse?: OrbixResponse | null;
  text: string;
}): OrbixResponse | null {
  if (msg.orbixResponse) return msg.orbixResponse;
  const kind = classifyAssistantTextHeuristic(msg.text);
  if (!kind) return null;
  const parsed = parseOrbixResponse({
    message: msg.text,
    response_type: kind,
    ...(kind === "mode_restriction"
      ? {
          error: {
            type: "mode_restriction",
            required_mode: "accountant",
            can_preview: true,
            operation: "transaction_create",
          },
          orbix_mode: "ask",
        }
      : {}),
  });
  return parsed.ok ? parsed.response : null;
}

interface OrbixWorkspaceProps {
  /** Embedded in main content vs floating overlay shell */
  variant?: "page" | "overlay";
  onClose?: () => void;
}

const OrbixWorkspace: React.FC<OrbixWorkspaceProps> = ({ variant = "page", onClose }) => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    newChat,
    sessions,
    activeSessionId,
    selectSession,
    deleteSession,
    messages,
    pendingCard,
    pendingCompoundBatch,
    postingStages,
    isLoading,
    llmOnline,
    llmModel,
    activeTools,
    sendMessage,
    confirmPending,
    cancelPending,
    refreshLlmStatus,
    generateOrbixReport,
    orbixMode,
    setOrbixMode,
    lastNpKb,
  } = useEKhataStore();
  const closeFalcon = useFalconStore((s) => s.closePanel);
  const parties = useStore((s) => s.parties ?? []);
  const companySettings = useStore((s) => s.companySettings);
  const currentFiscalYear = useStore((s) => s.currentFiscalYear);

  const [input, setInput] = useState("");
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1440;
  });
  const [sessionQuery, setSessionQuery] = useState("");
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const companyName =
    companySettings?.companyNameEn || companySettings?.name || "your company";
  const fyName = currentFiscalYear?.name || "—";

  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sessionQuery, sessions]);

  useEffect(() => {
    if (!stickToBottom) {
      setShowJumpLatest(true);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    // scrollIntoView(block:start) on the end sentinel pins an empty node to the
    // top of the scrollport and hides all messages above it.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    setShowJumpLatest(false);
  }, [messages, pendingCard, pendingCompoundBatch, isLoading, stickToBottom]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1440) setInspectorOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    closeFalcon();
    refreshLlmStatus();
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [closeFalcon, refreshLlmStatus]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 80;
    setStickToBottom(nearBottom);
    setShowJumpLatest(!nearBottom && messages.length > 0);
  };

  const jumpToLatest = () => {
    setStickToBottom(true);
    setShowJumpLatest(false);
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;
    if (!textOverride) setInput("");
    setStickToBottom(true);
    await sendMessage(text);
  };

  const journalLines = pendingCompoundBatch?.journalLines ?? pendingCard?.journalLines ?? [];
  const balance = journalLines.length > 0 ? validateJournalBalance(journalLines) : null;
  const lastMessage = messages[messages.length - 1];
  const showTyping = isLoading && lastMessage?.role === "assistant" && !lastMessage.text;
  const activeReport = [...messages].reverse().find((m) => m.report)?.report ?? null;
  const stalePreview = messages.some((m) => {
    const code =
      m.orbixResponse &&
      "payload" in m.orbixResponse &&
      m.orbixResponse.payload &&
      typeof m.orbixResponse.payload === "object" &&
      "error_code" in m.orbixResponse.payload
        ? String((m.orbixResponse.payload as { error_code?: string }).error_code || "")
        : "";
    return code === "stale_preview";
  });

  const placeholders: Record<OrbixOperatingMode, string> = {
    ask: "Ask about accounts, reports, transactions, inventory or business performance…",
    accountant: "Ask, generate a report, or create an authorized accounting entry…",
  };

  const starters = orbixMode === "accountant" ? ACCOUNTANT_STARTERS : ASK_STARTERS;

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] shadow-[var(--ds-shadow-1)] ${
        variant === "page" ? "min-h-0" : ""
      }`}
      data-component="orbix-workspace"
    >
      {/* Workspace header */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[var(--ds-border-default)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative">
            {isLoading && (
              <span className="absolute -inset-1 animate-pulse rounded-full border border-[var(--ds-action-primary)]/40" />
            )}
            <OrbixLogo size={28} variant="full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold text-[var(--ds-text-default)]">Orbix</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                  llmOnline
                    ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                    : "bg-[var(--ds-status-warning-surface)] text-[var(--ds-status-warning)]"
                }`}
                title={
                  llmOnline
                    ? "Orbix interpretation available"
                    : "Orbix interpretation limited — ERP functions remain available"
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {llmOnline ? "Ready" : "Limited"}
              </span>
            </div>
            <p className="truncate text-[12px] text-[var(--ds-text-muted)]">
              Connected to {companyName} · FY {fyName}
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2" data-testid="orbix-toolbar">
          <OrbixModeSelector mode={orbixMode} onChange={setOrbixMode} disabled={isLoading} />
          <button
            type="button"
            onClick={newChat}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 text-[12px] font-medium text-[var(--ds-text-default)] hover:bg-[var(--ds-surface-muted)]"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New
          </button>
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            className="hidden h-8 w-8 items-center justify-center rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)] xl:inline-flex"
            aria-label="Toggle evidence and context panel"
            title="Evidence and context"
          >
            <PanelRight className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] px-2.5 text-[12px] text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-muted)]"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Conversation sidebar */}
        <div
            className={`hidden flex-shrink-0 border-r border-[var(--ds-border-default)] bg-[var(--ds-surface)] md:flex ${
            sidebarCollapsed ? "w-14" : "w-[240px]"
          }`}
        >
          <div className="flex w-full flex-col">
            {!sidebarCollapsed && (
              <div className="border-b border-[var(--ds-border-default)] p-2">
                <div className="flex h-8 items-center gap-2 rounded-[var(--ds-radius-md)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2">
                  <Search className="h-3.5 w-3.5 text-[var(--ds-text-subtle)]" />
                  <input
                    value={sessionQuery}
                    onChange={(e) => setSessionQuery(e.target.value)}
                    placeholder="Search conversations"
                    className="h-full w-full border-0 bg-transparent text-[12px] outline-none"
                  />
                </div>
              </div>
            )}
            <OrbixChatSidebar
              sessions={filteredSessions}
              activeSessionId={activeSessionId}
              collapsed={sidebarCollapsed}
              onToggleCollapse={toggleSidebar}
              onNewChat={newChat}
              onSelectSession={selectSession}
              onDeleteSession={deleteSession}
            />
          </div>
        </div>

        {/* Main canvas */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 && !pendingCard && !pendingCompoundBatch && !showTyping ? (
              <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10 text-center">
                <OrbixLogo size={48} variant="full" className="mb-5" />
                <h2 className="text-[22px] font-semibold tracking-tight text-[var(--ds-text-default)]">
                  {greeting()}. What would you like to understand or do in {companyName}?
                </h2>
                <p className="mt-2 max-w-md text-[14px] text-[var(--ds-text-muted)]">
                  {ORBIX_MODE_META[orbixMode].description}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 py-1 text-[12px] text-[var(--ds-text-muted)]">
                    {companyName}
                  </span>
                  <span className="rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-2.5 py-1 text-[12px] text-[var(--ds-text-muted)]">
                    FY {fyName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                      orbixMode === "ask"
                        ? "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]"
                        : "bg-[var(--ds-surface-selected)] text-[var(--ds-action-primary)]"
                    }`}
                  >
                    {orbixMode === "ask" ? "Ask Mode · read only" : "Accountant Mode · confirm to post"}
                  </span>
                </div>
                <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void handleSend(s)}
                      className="rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-3 py-3 text-left text-[13px] text-[var(--ds-text-default)] hover:border-[var(--ds-action-primary)]/40 hover:bg-[var(--ds-surface-selected)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-4xl space-y-4">
                {messages.map((msg) => {
                  if (
                    msg.role === "assistant" &&
                    !msg.text &&
                    !msg.report &&
                    !msg.reportClarify &&
                    !msg.orbixResponse
                  ) {
                    return null;
                  }
                  const structured =
                    msg.role === "assistant" ? resolveMessageResponse(msg) : null;
                  const wide =
                    Boolean(msg.report || msg.reportClarify) ||
                    structured?.response_type === "mode_restriction" ||
                    structured?.response_type === "clarification_required" ||
                    structured?.response_type === "provider_offline" ||
                    structured?.response_type === "report_result" ||
                    structured?.response_type === "report_updated";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={
                        msg.role === "assistant" && structured?.response_type
                          ? `orbix-msg-${structured.response_type}`
                          : undefined
                      }
                      data-voucher-number={
                        structured?.response_type === "posting_completed"
                          ? String(
                              (structured.payload as { voucher_number?: string })?.voucher_number ||
                                "",
                            )
                          : undefined
                      }
                      data-invoice-number={
                        structured?.response_type === "posting_completed"
                          ? String(
                              (structured.payload as { invoice_number?: string })?.invoice_number ||
                                "",
                            )
                          : undefined
                      }
                    >
                      {msg.role === "assistant" && (
                        <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-status-info-surface)]">
                          <OrbixLogo size={14} />
                        </div>
                      )}
                      <div
                        className={`min-w-0 ${
                          wide ? "w-full max-w-full" : "max-w-[min(100%,42rem)]"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <div className="rounded-[var(--ds-radius-lg)] bg-[var(--ds-action-primary)] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <OrbixResponseRenderer
                              response={structured}
                              displayText={msg.text}
                              onSwitchMode={() => setOrbixMode("accountant")}
                            />
                            {msg.report && (
                              <OrbixReportTable report={msg.report} maximized />
                            )}
                            {msg.reportClarify && (
                              <OrbixReportDateClarify
                                pending={msg.reportClarify}
                                parties={parties.map((p) => ({ id: p.id, name: p.name }))}
                                disabled={isLoading}
                                onSubmit={(pending) => void generateOrbixReport(pending)}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(pendingCard || pendingCompoundBatch) && (
                  <OrbixJournalCard
                    pendingCard={pendingCard}
                    pendingCompoundBatch={pendingCompoundBatch}
                    journalLines={journalLines}
                    balance={balance}
                    isLoading={isLoading}
                    postingStages={postingStages}
                    stalePreview={stalePreview}
                    onConfirm={confirmPending}
                    onCancel={cancelPending}
                  />
                )}

                {showTyping && (
                  <OrbixNeuronThinking intent={activeTools[0]} tools={activeTools} />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
            {showJumpLatest && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="sticky bottom-3 left-1/2 z-10 mx-auto flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--ds-border-default)] bg-[var(--ds-surface-raised)] px-3 py-1.5 text-[12px] font-medium text-[var(--ds-text-default)] shadow-[var(--ds-shadow-2)]"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Jump to latest
              </button>
            )}
          </div>

          {/* Composer */}
          <div className="flex-shrink-0 border-t border-[var(--ds-border-default)] bg-[var(--ds-surface)] px-4 py-3">
            <div className="mx-auto max-w-4xl">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ds-text-muted)]">
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--ds-surface-muted)] px-2 py-0.5">
                  {orbixMode === "ask" ? (
                    <>
                      <Shield className="h-3 w-3" /> Ask · Read only
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Accountant · Confirmation required
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-end gap-2 rounded-[var(--ds-radius-lg)] border border-[var(--ds-border-default)] bg-[var(--ds-surface-muted)] p-2 focus-within:border-[var(--ds-action-primary)] focus-within:ring-2 focus-within:ring-[var(--ds-border-focus)]">
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={placeholders[orbixMode]}
                  disabled={isLoading}
                  className="max-h-[140px] min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[13px] text-[var(--ds-text-default)] outline-none placeholder:text-[var(--ds-text-subtle)]"
                  aria-label="Message to Orbix"
                  data-component="ekhata-input"
                  data-testid="orbix-composer"
                />
                {isLoading ? (
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)]"
                    title="Generating…"
                    aria-label="Generating"
                    data-testid="orbix-send-busy"
                    disabled
                  >
                    <Square className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!input.trim()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--ds-radius-md)] bg-[var(--ds-action-primary)] text-white hover:bg-[var(--ds-action-primary-hover)] disabled:opacity-40"
                    aria-label="Send message"
                    data-testid="orbix-send"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-center text-[12px] text-[var(--ds-text-subtle)]">
                Enter to send · Shift+Enter for new line · Ctrl+Shift+K toggles Orbix
              </p>
            </div>
          </div>
        </div>

        {/* Context inspector */}
        {inspectorOpen && (
          <div className="hidden w-[280px] flex-shrink-0 border-l border-[var(--ds-border-default)] xl:block">
            <ContextInspector
              companyName={companyName}
              fyName={fyName}
              mode={orbixMode}
              report={activeReport}
              pendingCard={pendingCard}
              llmOnline={llmOnline}
              llmModel={llmModel}
              npKb={lastNpKb}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrbixWorkspace;
