import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, PanelLeft, Send } from "lucide-react";
import { useEKhataStore } from "../../store/eKhataStore";
import { useFalconStore } from "../../store/falconStore";
import { useStore } from "../../store/useStore";
import { validateJournalBalance } from "../../lib/ekhata/caEntryTemplates";
import AchievementSystem from "./AchievementSystem";
import OrbixLogo from "./OrbixLogo";
import OrbixMessageContent from "./OrbixMessageContent";
import OrbixJournalCard from "./OrbixJournalCard";
import OrbixWindowControls from "./OrbixWindowControls";
import OrbixChatSidebar from "./OrbixChatSidebar";
import OrbixNeuronThinking from "./OrbixNeuronThinking";
import OrbixReportTable from "./OrbixReportTable";
import OrbixReportDateClarify from "./OrbixReportDateClarify";

/** TopMenuBar (40px) + BusyMenuBar (40px) on desktop — panel stays below ERP menus */
const ORBIX_CHROME_TOP_DESKTOP = 80;
const ORBIX_CHROME_TOP_MOBILE = 88;
const ORBIX_CHROME_BOTTOM = 28;

function useOrbixChromeInsets() {
  const [top, setTop] = React.useState(ORBIX_CHROME_TOP_DESKTOP);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setTop(mq.matches ? ORBIX_CHROME_TOP_MOBILE : ORBIX_CHROME_TOP_DESKTOP);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return { top, bottom: ORBIX_CHROME_BOTTOM };
}

const EmptyChatState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-6 text-center">
    <div className="relative mb-4">
      <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl scale-150" />
      <OrbixLogo size={48} variant="full" className="relative opacity-80" />
    </div>
    <p className="text-[13px] font-medium text-slate-300">Orbix — Accounting Mode</p>
    <p className="mt-1.5 text-[11px] text-slate-600 max-w-[260px] leading-relaxed">
      Record entries, check balances, or ask accounting questions in Nepali or English.
    </p>
  </div>
);

const EKhataPanel: React.FC = () => {
  const {
    isOpen,
    windowMode,
    sidebarCollapsed,
    closePanel,
    minimizePanel,
    maximizePanel,
    toggleSidebar,
    newChat,
    sessions,
    activeSessionId,
    selectSession,
    deleteSession,
    messages,
    pendingCard,
    pendingCompoundBatch,
    isLoading,
    llmOnline,
    llmModel,
    activeTools,
    sendMessage,
    confirmPending,
    cancelPending,
    refreshLlmStatus,
    generateOrbixReport,
  } = useEKhataStore();
  const closeFalcon = useFalconStore((state) => state.closePanel);
  const parties = useStore((s) => s.parties ?? []);
  const chrome = useOrbixChromeInsets();

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMaximized = windowMode === "maximized";
  const showSidebar = isMaximized && !sidebarCollapsed;
  const showCollapsedRail = isMaximized && sidebarCollapsed;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingCard, pendingCompoundBatch, isLoading]);

  useEffect(() => {
    if (isOpen && windowMode !== "minimized") {
      closeFalcon();
      refreshLlmStatus();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, windowMode, closeFalcon, refreshLlmStatus]);

  useEffect(() => {
    if (!isOpen || windowMode === "minimized") return;
    const interval = window.setInterval(() => {
      refreshLlmStatus();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isOpen, windowMode, refreshLlmStatus]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const journalLines = pendingCompoundBatch?.journalLines ?? pendingCard?.journalLines ?? [];
  const balance = journalLines.length > 0 ? validateJournalBalance(journalLines) : null;

  const lastMessage = messages[messages.length - 1];
  const showTyping =
    isLoading && lastMessage?.role === "assistant" && !lastMessage.text;

  if (!isOpen || windowMode === "minimized") return null;

  const panelShell = isMaximized
    ? {
        className:
          "fixed left-0 right-0 z-[45] flex flex-col overflow-hidden border-t border-white/10 shadow-2xl shadow-black/50",
        style: {
          top: chrome.top,
          bottom: chrome.bottom,
          background: "linear-gradient(180deg, #0f1420 0%, #0a0e17 100%)",
        },
      }
    : {
        className:
          "fixed bottom-4 right-4 z-[9998] flex flex-col rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40",
        style: {
          width: historyOpen ? 560 : 440,
          maxHeight: "min(85vh, 720px)",
          minHeight: 460,
          background: "linear-gradient(180deg, #0f1420 0%, #0a0e17 100%)",
          transition: "width 0.2s ease",
        },
      };

  return (
    <div {...panelShell} data-component="ekhata-panel">
      {/* Title bar */}
      <div className="relative flex-shrink-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-violet-600/10 to-orange-500/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="relative flex items-center gap-2 px-3 py-2">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md scale-150" />
            <OrbixLogo size={28} variant="full" className="relative" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-white tracking-tight leading-none">
              Orbix
              <span className="text-cyan-400 font-normal"> — AI</span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${llmOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-amber-400"}`}
              />
              {llmOnline
                ? `Qwen · ${llmModel || "32b"}`
                : "Offline — connect GPU server"}
            </p>
          </div>

          {!isMaximized && (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              title="Chat history"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/10"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {!isMaximized && (
            <button
              type="button"
              onClick={newChat}
              title="New chat"
              className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-white/10"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </button>
          )}
          <AchievementSystem compact />
          <OrbixWindowControls
            windowMode={windowMode}
            onMinimize={minimizePanel}
            onMaximize={maximizePanel}
            onClose={closePanel}
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — maximized mode */}
        {showSidebar && (
          <OrbixChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            collapsed={false}
            onToggleCollapse={toggleSidebar}
            onNewChat={newChat}
            onSelectSession={selectSession}
            onDeleteSession={deleteSession}
          />
        )}
        {showCollapsedRail && (
          <OrbixChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            collapsed
            onToggleCollapse={toggleSidebar}
            onNewChat={newChat}
            onSelectSession={selectSession}
            onDeleteSession={deleteSession}
          />
        )}

        {/* Floating history drawer */}
        {!isMaximized && historyOpen && (
          <div className="w-[220px] flex-shrink-0 border-r border-white/10">
            <OrbixChatSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              collapsed={false}
              onToggleCollapse={() => setHistoryOpen(false)}
              onNewChat={() => {
                newChat();
              }}
              onSelectSession={(id) => {
                selectSession(id);
              }}
              onDeleteSession={deleteSession}
            />
          </div>
        )}

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
            {messages.length === 0 && !pendingCard && !pendingCompoundBatch && !showTyping ? (
              <EmptyChatState />
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  if (
                    msg.role === "assistant" &&
                    !msg.text &&
                    !msg.report &&
                    !msg.reportClarify
                  ) {
                    return null;
                  }
                  const hasWideContent = Boolean(msg.report || msg.reportClarify);
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${
                        hasWideContent && isMaximized ? "w-full" : ""
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-white/10">
                          <OrbixLogo size={14} />
                        </div>
                      )}
                      <div
                        className={`${
                          hasWideContent
                            ? isMaximized
                              ? "flex-1 min-w-0 max-w-full"
                              : "max-w-[96%] min-w-0"
                            : "max-w-[88%] min-w-0"
                        } ${
                          msg.role === "user"
                            ? "rounded-xl rounded-br-sm bg-gradient-to-br from-cyan-600 to-blue-700 px-3 py-2 text-[12px] text-white shadow-lg shadow-cyan-900/20"
                            : "rounded-xl rounded-tl-sm border border-white/10 bg-white/[0.04] px-3 py-2.5"
                        }`}
                      >
                        {msg.role === "user" ? (
                          <p className="text-[12px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        ) : (
                          <>
                            {msg.text && <OrbixMessageContent text={msg.text} />}
                            {msg.report && (
                              <OrbixReportTable report={msg.report} maximized={isMaximized} />
                            )}
                            {msg.reportClarify && (
                              <OrbixReportDateClarify
                                pending={msg.reportClarify}
                                parties={parties.map((p) => ({ id: p.id, name: p.name }))}
                                disabled={isLoading}
                                onSubmit={(pending) => void generateOrbixReport(pending)}
                              />
                            )}
                          </>
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
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-white/10 bg-[#0a0e17]/80 backdrop-blur-sm p-3">
            <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask in Nepali or English — entries, balances, reports..."
                disabled={isLoading}
                className="h-9 flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50 transition-colors"
                data-component="ekhata-input"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 transition-all shadow-lg shadow-cyan-900/30"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[9px] text-slate-600">
              Ctrl+Shift+K · Chats saved 7 days · Saves to ledger
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EKhataPanel;
