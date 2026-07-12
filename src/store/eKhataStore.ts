import { create } from "zustand";
import { confirmKhataViaProposal } from "../domains/nios";
import {
  checkEKhataLlmStatus,
  getEKhataSessionId,
  setEKhataSessionId,
} from "../lib/ekhata/ekhataLlmClient";
import { replyCancel, replySaved } from "../lib/ekhata/conversationEngine";
import { recordTrainingFeedback } from "../lib/ekhata/trainingFeedback";
import type { ConversationTurn } from "../lib/ekhata/conversationalBrain";
import {
  askOrbixQwen,
  ORBIX_OFFLINE_MESSAGE,
  streamOrbixQwen,
} from "../lib/ekhata/orbixQwenClient";
import {
  createConversationContext,
  processEKhataMessageAsync,
  updateContextAfterConfirm,
  updateContextAfterEntry,
  type EKhataConversationContext,
} from "../lib/ekhata/processMessage";
import { updateContextAfterClarify } from "../lib/ekhata/conversationState";
import { extractWorkItem } from "../lib/ekhata/smartWorkBrain";
import type { EKhataChatMessage, KhataConfirmationCard } from "../lib/ekhata/types";
import type { KhataCompoundBatchCard } from "../lib/ekhata/compoundBatch";
import { isSelfContainedAi } from "../lib/selfContainedAi";
import {
  createEmptySession,
  deriveSessionTitle,
  deserializeMessage,
  loadOrbixSessions,
  saveOrbixSessions,
  serializeMessage,
  type OrbixChatSession,
  type OrbixWindowMode,
} from "../lib/ekhata/orbixChatStorage";
import { handleOrbixLocalQuery } from "../lib/ekhata/orbixLocalEngine";
import { buildSessionSnapshot } from "../lib/ekhata/dexieBridge";
import { handleOrbixReportQuery } from "../lib/ekhata/orbixReportEngine";
import type { PendingOrbixReport } from "../lib/ekhata/orbixReportTypes";
import {
  loadOrbixOperatingMode,
  saveOrbixOperatingMode,
  type OrbixOperatingMode,
} from "../lib/ekhata/orbixOperatingMode";
import { isAccountantOrAdmin } from "../lib/permissions";
import { useStore } from "./useStore";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const boot = loadOrbixSessions();
const bootSession = boot.sessions.find((s) => s.id === boot.activeSessionId) ?? boot.sessions[0];

let conversationContext: EKhataConversationContext = createConversationContext();

if (bootSession.llmSessionId) {
  setEKhataSessionId(bootSession.llmSessionId);
}

function getKhataBalance() {
  const accounts = useStore.getState().accounts ?? [];
  const debt = accounts.find((a) => a.code === "KH-DEBT");
  const cred = accounts.find((a) => a.code === "KH-CRED");
  return {
    udhaarOut: Math.max(0, debt?.balance ?? 0),
    udhaarIn: Math.max(0, cred?.balance ?? 0),
  };
}

function syncSession(
  sessions: OrbixChatSession[],
  activeSessionId: string,
  messages: EKhataChatMessage[],
): OrbixChatSession[] {
  const now = new Date().toISOString();
  return sessions.map((s) => {
    if (s.id !== activeSessionId) return s;
    return {
      ...s,
      title: deriveSessionTitle(messages),
      updatedAt: now,
      messages: messages.map(serializeMessage),
    };
  });
}

function getReportContext() {
  const store = useStore.getState();
  return {
    parties: (store.parties ?? []).map((p) => ({ id: p.id, name: p.name })),
    fyStart: store.currentFiscalYear?.startDate,
    fyEnd: store.currentFiscalYear?.endDate,
    companyName:
      store.companySettings?.companyNameEn ||
      store.companySettings?.name ||
      undefined,
  };
}

function applyReportToMessage(
  msg: EKhataChatMessage,
  result: Awaited<ReturnType<typeof handleOrbixReportQuery>>,
): EKhataChatMessage {
  if (!result) return { ...msg, text: "Could not generate report." };
  if (result.type === "report") {
    return {
      ...msg,
      text: result.text,
      report: result.report,
      reportClarify: undefined,
    };
  }
  return {
    ...msg,
    text: result.text,
    reportClarify: result.pending,
    report: undefined,
  };
}

function persist(
  sessions: OrbixChatSession[],
  activeSessionId: string,
  windowMode?: OrbixWindowMode,
): void {
  saveOrbixSessions(sessions, activeSessionId, windowMode);
}

export interface EKhataState {
  isOpen: boolean;
  windowMode: OrbixWindowMode;
  sidebarCollapsed: boolean;
  isLoading: boolean;
  llmOnline: boolean;
  llmModel?: string;
  sessions: OrbixChatSession[];
  activeSessionId: string;
  messages: EKhataChatMessage[];
  pendingCard: KhataConfirmationCard | null;
  pendingCompoundBatch: KhataCompoundBatchCard | null;
  streamingText: string;
  activeTools: string[];
  engineLabel: string;
  orbixMode: OrbixOperatingMode;
  openPanel: () => void;
  openWithPendingCard: (card: KhataConfirmationCard) => void;
  closePanel: () => void;
  togglePanel: () => void;
  minimizePanel: () => void;
  maximizePanel: () => void;
  restorePanel: () => void;
  toggleSidebar: () => void;
  newChat: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  refreshLlmStatus: () => Promise<void>;
  setOrbixMode: (mode: OrbixOperatingMode) => void;
  sendMessage: (text: string) => Promise<void>;
  generateOrbixReport: (pending: PendingOrbixReport) => Promise<void>;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
}

export const useEKhataStore = create<EKhataState>((set, get) => ({
  isOpen: false,
  windowMode: boot.windowMode === "minimized" ? "normal" : boot.windowMode,
  sidebarCollapsed: false,
  isLoading: false,
  llmOnline: false,
  llmModel: undefined,
  sessions: boot.sessions,
  activeSessionId: boot.activeSessionId,
  messages: bootSession.messages.map(deserializeMessage),
  pendingCard: null,
  pendingCompoundBatch: null,
  streamingText: "",
  activeTools: [],
  engineLabel: "qwen3",
  orbixMode: loadOrbixOperatingMode(),

  setOrbixMode: (mode: OrbixOperatingMode) => {
    saveOrbixOperatingMode(mode);
    set({ orbixMode: mode });
  },

  openPanel: () => set({ isOpen: true, windowMode: "normal" }),

  openWithPendingCard: (card: KhataConfirmationCard) =>
    set({ isOpen: true, windowMode: "normal", pendingCard: card }),

  closePanel: () => {
    const { sessions, activeSessionId, messages, windowMode } = get();
    const updated = syncSession(sessions, activeSessionId, messages);
    persist(updated, activeSessionId, windowMode);
    set({ isOpen: false, windowMode: "normal", pendingCard: null, pendingCompoundBatch: null });
  },

  togglePanel: () => {
    const { isOpen, windowMode } = get();
    if (!isOpen) {
      set({ isOpen: true, windowMode: windowMode === "minimized" ? "normal" : windowMode });
      return;
    }
    if (windowMode === "minimized") {
      set({ windowMode: "normal" });
      return;
    }
    get().closePanel();
  },

  minimizePanel: () => {
    const { sessions, activeSessionId, messages, windowMode } = get();
    const updated = syncSession(sessions, activeSessionId, messages);
    persist(updated, activeSessionId, "minimized");
    set({ windowMode: "minimized", sessions: updated });
  },

  maximizePanel: () => {
    const { windowMode } = get();
    const next: OrbixWindowMode = windowMode === "maximized" ? "normal" : "maximized";
    persist(get().sessions, get().activeSessionId, next);
    set({
      windowMode: next,
      sidebarCollapsed: next === "maximized" ? false : get().sidebarCollapsed,
    });
  },

  restorePanel: () => {
    persist(get().sessions, get().activeSessionId, "normal");
    set({ windowMode: "normal" });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  newChat: () => {
    const { sessions, activeSessionId, messages, isLoading } = get();
    if (isLoading) return;

    const hasContent = messages.some((m) => m.text.trim());
    if (!hasContent) return;

    const updated = [createEmptySession(), ...syncSession(sessions, activeSessionId, messages)];
    const fresh = updated[0];

    conversationContext = createConversationContext();
    setEKhataSessionId(fresh.llmSessionId!);

    persist(updated, fresh.id, get().windowMode);
    set({
      sessions: updated,
      activeSessionId: fresh.id,
      messages: [],
      pendingCard: null,
      pendingCompoundBatch: null,
      streamingText: "",
      activeTools: [],
    });
  },

  selectSession: (id: string) => {
    const { sessions, activeSessionId, messages, isLoading } = get();
    if (isLoading || id === activeSessionId) return;

    let updated = syncSession(sessions, activeSessionId, messages);
    const target = updated.find((s) => s.id === id);
    if (!target) return;

    conversationContext = createConversationContext();
    if (target.llmSessionId) setEKhataSessionId(target.llmSessionId);

    persist(updated, id, get().windowMode);
    set({
      sessions: updated,
      activeSessionId: id,
      messages: target.messages.map(deserializeMessage),
      pendingCard: null,
      pendingCompoundBatch: null,
      streamingText: "",
      activeTools: [],
    });
  },

  deleteSession: (id: string) => {
    const { sessions, activeSessionId, messages, isLoading } = get();
    if (isLoading) return;

    let updated = syncSession(sessions, activeSessionId, messages);
    updated = updated.filter((s) => s.id !== id);

    if (updated.length === 0) {
      updated = [createEmptySession()];
    }

    if (id === activeSessionId) {
      const next = updated[0];
      conversationContext = createConversationContext();
      if (next.llmSessionId) setEKhataSessionId(next.llmSessionId);
      persist(updated, next.id, get().windowMode);
      set({
        sessions: updated,
        activeSessionId: next.id,
        messages: next.messages.map(deserializeMessage),
        pendingCard: null,
        pendingCompoundBatch: null,
      });
      return;
    }

    persist(updated, activeSessionId, get().windowMode);
    set({ sessions: updated });
  },

  refreshLlmStatus: async () => {
    try {
      const status = await checkEKhataLlmStatus();
      set({
        llmOnline: status.khataLlm,
        llmModel: status.khataLlm ? status.model : status.degraded ? "KB-only" : status.model,
        engineLabel: status.khataLlm
          ? status.model || "groq"
          : status.degraded
            ? "degraded"
            : "offline",
      });
    } catch {
      set({ llmOnline: false, llmModel: undefined, engineLabel: "offline" });
    }
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    const assistantId = genId();

    set((s) => {
      const nextMessages: EKhataChatMessage[] = [
        ...s.messages,
        { id: genId(), role: "user", text: trimmed, timestamp: new Date() },
        { id: assistantId, role: "assistant", text: "", timestamp: new Date() },
      ];
      const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
      persist(updatedSessions, s.activeSessionId, s.windowMode);
      return {
        messages: nextMessages,
        sessions: updatedSessions,
        isLoading: true,
        pendingCard: null,
        pendingCompoundBatch: null,
        streamingText: "",
        activeTools: [],
      };
    });

    const finalize = (patch: Partial<EKhataState>) => {
      set((s) => {
        const merged = { ...s, ...patch, isLoading: false };
        const updatedSessions = syncSession(merged.sessions, merged.activeSessionId, merged.messages);
        persist(updatedSessions, merged.activeSessionId, merged.windowMode);
        return { ...merged, sessions: updatedSessions };
      });
    };

    try {
      const pendingFromChat = [...get().messages]
        .reverse()
        .find((m) => m.reportClarify)?.reportClarify;

      const reportResult = await handleOrbixReportQuery(trimmed, {
        pendingReport: pendingFromChat,
        activeReportSpec: [...get().messages]
          .reverse()
          .find((m) => m.report?.spec)?.report?.spec,
        ...getReportContext(),
      });

      if (reportResult) {
        finalize({
          messages: get().messages.map((m) =>
            m.id === assistantId ? applyReportToMessage(m, reportResult) : m,
          ),
          engineLabel: "orbix-report",
        });
        return;
      }
    } catch {
      /* fall through to normal chat */
    }

    let sessionSnapshot: Awaited<ReturnType<typeof buildSessionSnapshot>> | null = null;

    try {
      sessionSnapshot = await buildSessionSnapshot();
      const localResult = await handleOrbixLocalQuery(trimmed, sessionSnapshot);
      if (localResult) {
        finalize({
          messages: get().messages.map((m) =>
            m.id === assistantId ? { ...m, text: localResult.text } : m,
          ),
          engineLabel: "orbix-local",
        });
        return;
      }
    } catch {
      /* fall through to LLM */
    }

    const balance = getKhataBalance();
    const userName = useStore.getState().currentUser?.name || useStore.getState().currentUser?.username;

    // Refresh Qwen status only when previously offline (saves ~1s per message)
    if (!get().llmOnline) {
      await get().refreshLlmStatus();
    }
    const stateAfterRefresh = get();
    const llmStatus = stateAfterRefresh.llmOnline
      ? {
          khataLlm: true,
          model: stateAfterRefresh.llmModel || "llama-3.3-70b-versatile",
          degraded: false,
        }
      : await checkEKhataLlmStatus();
    const sessionId = getEKhataSessionId();

    // ── QWEN-ONLY PATH (ultra stack: router + RAG + qwen3:32b) ─────────────────
    if (llmStatus.khataLlm && !isSelfContainedAi()) {
      try {
        if (!sessionSnapshot) {
          sessionSnapshot = await buildSessionSnapshot();
        }
        await streamOrbixQwen(
          trimmed,
          sessionId,
          {
          onThinkingStart: () => {
            set({ streamingText: "", activeTools: [] });
          },
          onThinkingDone: () => undefined,
          onRoute: (route) => {
            if (route.intent) {
              set({ activeTools: [route.intent] });
            }
          },
          onToken: (token) => {
            set((s) => {
              const next = s.streamingText + token;
              const nextMessages = s.messages.map((m) =>
                m.id === assistantId ? { ...m, text: next } : m,
              );
              return { streamingText: next, messages: nextMessages };
            });
          },
          onComplete: ({ message, card, action }) => {
            if (action === "confirm" && card) {
              conversationContext = updateContextAfterEntry(conversationContext, card, trimmed);
            }
            finalize({
              messages: get().messages.map((m) =>
                m.id === assistantId ? { ...m, text: message } : m,
              ),
              pendingCard: action === "confirm" ? card : null,
              streamingText: "",
              activeTools: [],
              engineLabel: `qwen3 (${llmStatus.model || "32b"})`,
              llmOnline: true,
              llmModel: llmStatus.model,
            });
          },
          onError: async () => {
            const fallback = await askOrbixQwen(trimmed, sessionId, {
              orbixMode: get().orbixMode,
              context: sessionSnapshot || undefined,
            });
            if (fallback.card) {
              conversationContext = updateContextAfterEntry(
                conversationContext,
                fallback.card,
                trimmed,
              );
            }
            finalize({
              messages: get().messages.map((m) =>
                m.id === assistantId ? { ...m, text: fallback.answer } : m,
              ),
              pendingCard: fallback.card,
              streamingText: "",
              activeTools: [],
              engineLabel: `qwen3 (${llmStatus.model || "32b"})`,
            });
          },
        },
          {
            context: {
              ...(sessionSnapshot || {}),
              orbix_mode: get().orbixMode,
              has_pending_confirmation: Boolean(get().pendingCard),
              has_active_report: Boolean(
                [...get().messages].reverse().find((m) => m.report)?.report,
              ),
              user_role: useStore.getState().currentUser?.role,
            },
            orbixMode: get().orbixMode,
          },
        );
        return;
      } catch (error) {
        finalize({
          streamingText: "",
          messages: get().messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: error instanceof Error ? error.message : "Qwen connection failed.",
                }
              : m,
          ),
        });
        return;
      }
    }

    // ── FORCED OFFLINE TEMPLATES (VITE_SELF_CONTAINED_AI=true only) ───────────
    if (isSelfContainedAi()) {
      try {
        const history: ConversationTurn[] = get()
          .messages.filter((m) => m.id !== assistantId)
          .slice(-10)
          .map((m) => ({ role: m.role, text: m.text }));

        const result = await processEKhataMessageAsync(trimmed, {
          balance,
          history,
          conversationContext,
          userName,
        });

        if (result.kind === "entry" || result.kind === "compound") && get().orbixMode === "ask") {
          finalize({
            messages: get().messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    text:
                      "I can explain or preview the entry in Ask Mode, but posting requires Accountant Mode.\n\nSwitch to Accountant Mode to create or modify authorized ERP records.",
                  }
                : m,
            ),
            pendingCard: null,
            pendingCompoundBatch: null,
            engineLabel: "builtin (ask)",
            llmOnline: false,
          });
          return;
        }

        if (result.kind === "entry" && result.card) {
          conversationContext = updateContextAfterEntry(conversationContext, result.card, trimmed);
        } else if (result.kind === "clarify") {
          conversationContext = updateContextAfterClarify(
            conversationContext,
            trimmed,
            result.reply,
            "khata_cash_sale",
            extractWorkItem(trimmed, "khata_cash_sale"),
          );
        }

        finalize({
          messages: get().messages.map((m) =>
            m.id === assistantId ? { ...m, text: result.reply } : m,
          ),
          pendingCard: result.kind === "entry" && result.card ? result.card : null,
          pendingCompoundBatch: result.kind === "compound" ? result.batch : null,
          engineLabel: "builtin (forced)",
          llmOnline: false,
        });
      } catch (error) {
        finalize({
          messages: get().messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: error instanceof Error ? error.message : "Parse garna sakina.",
                }
              : m,
          ),
        });
      }
      return;
    }

    // ── QWEN NOT CONNECTED — clear instructions (no template brain) ───────────
    finalize({
      messages: get().messages.map((m) =>
        m.id === assistantId ? { ...m, text: ORBIX_OFFLINE_MESSAGE } : m,
      ),
      llmOnline: false,
      engineLabel: "offline",
    });
  },

  generateOrbixReport: async (pending: PendingOrbixReport) => {
    if (get().isLoading) return;

    const existing = [...get().messages].reverse().find((m) => m.reportClarify);
    const assistantId = existing?.id ?? genId();

    set((s) => {
      const nextMessages = existing
        ? s.messages.map((m) =>
            m.id === assistantId
              ? { ...m, text: "", reportClarify: undefined, report: undefined }
              : m,
          )
        : [
            ...s.messages,
            { id: assistantId, role: "assistant" as const, text: "", timestamp: new Date() },
          ];
      return {
        messages: nextMessages,
        isLoading: true,
        activeTools: ["ledger-report"],
        streamingText: "",
      };
    });

    const finalize = (patch: Partial<EKhataState>) => {
      set((s) => {
        const merged = { ...s, ...patch, isLoading: false, activeTools: [] };
        const updatedSessions = syncSession(merged.sessions, merged.activeSessionId, merged.messages);
        persist(updatedSessions, merged.activeSessionId, merged.windowMode);
        return { ...merged, sessions: updatedSessions };
      });
    };

    try {
      const synthetic = `${pending.kind} ${pending.fromDate} to ${pending.toDate}${pending.partyName ? ` ${pending.partyName}` : ""}`;
      const reportResult = await handleOrbixReportQuery(synthetic, {
        pendingReport: pending,
        ...getReportContext(),
      });

      finalize({
        messages: get().messages.map((m) =>
          m.id === assistantId ? applyReportToMessage(m, reportResult) : m,
        ),
        engineLabel: "orbix-report",
      });
    } catch (error) {
      finalize({
        messages: get().messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: error instanceof Error ? error.message : "Report generation failed.",
              }
            : m,
        ),
      });
    }
  },

  confirmPending: async () => {
    if (get().orbixMode !== "accountant") {
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant",
            text: "Posting requires Accountant Mode. Switch to Accountant Mode, then confirm again.",
            timestamp: new Date(),
          },
        ],
      }));
      return;
    }

    const role = useStore.getState().currentUser?.role;
    if (!isAccountantOrAdmin(role) && role !== "manager") {
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant",
            text: "Permission denied: your role cannot post purchase or khata entries.",
            timestamp: new Date(),
          },
        ],
        pendingCard: null,
        pendingCompoundBatch: null,
      }));
      return;
    }

    const batch = get().pendingCompoundBatch;
    if (batch) {
      if (get().isLoading) return;
      set({ isLoading: true });
      try {
        const sessionId = get().activeSessionId;
        const voucherNos: string[] = [];
        for (const part of batch.parts) {
          const { voucherNo } = await confirmKhataViaProposal(part.card, sessionId);
          voucherNos.push(voucherNo);
          recordTrainingFeedback(part.card, "confirmed");
        }

        const appendMsg: EKhataChatMessage = {
          id: genId(),
          role: "assistant",
          text: `Safalta! ${batch.compoundCount} entries save bhayo ✓ (${voucherNos.join(", ")})`,
          timestamp: new Date(),
        };
        set((s) => {
          const nextMessages = [...s.messages, appendMsg];
          const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
          persist(updatedSessions, s.activeSessionId, s.windowMode);
          return {
            pendingCompoundBatch: null,
            isLoading: false,
            messages: nextMessages,
            sessions: updatedSessions,
          };
        });
        if (voucherNos.length > 0) {
          conversationContext = updateContextAfterConfirm(
            conversationContext,
            voucherNos[voucherNos.length - 1],
          );
        }
      } catch (error) {
        set((s) => ({
          isLoading: false,
          messages: [
            ...s.messages,
            {
              id: genId(),
              role: "assistant",
              text: error instanceof Error ? error.message : "Batch save failed",
              timestamp: new Date(),
            },
          ],
        }));
      }
      return;
    }

    const card = get().pendingCard;
    if (!card || get().isLoading) return;

    set({ isLoading: true });
    try {
      const { voucherNo } = await confirmKhataViaProposal(card, get().activeSessionId);

      const appendMsg: EKhataChatMessage = {
        id: genId(),
        role: "assistant",
        text: replySaved(voucherNo),
        timestamp: new Date(),
      };
      set((s) => {
        const nextMessages = [...s.messages, appendMsg];
        const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
        persist(updatedSessions, s.activeSessionId, s.windowMode);
        return {
          pendingCard: null,
          isLoading: false,
          messages: nextMessages,
          sessions: updatedSessions,
        };
      });
      conversationContext = updateContextAfterConfirm(conversationContext, voucherNo);
      recordTrainingFeedback(card, "confirmed");
    } catch (error) {
      set((s) => ({
        isLoading: false,
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant",
            text: error instanceof Error ? error.message : "Save failed",
            timestamp: new Date(),
          },
        ],
      }));
    }
  },

  cancelPending: () => {
    const card = get().pendingCard;
    const batch = get().pendingCompoundBatch;
    if (card) recordTrainingFeedback(card, "cancelled");
    if (batch) {
      for (const part of batch.parts) {
        recordTrainingFeedback(part.card, "cancelled");
      }
    }
    set((s) => {
      const appendMsg: EKhataChatMessage = {
        id: genId(),
        role: "assistant",
        text: replyCancel(),
        timestamp: new Date(),
      };
      const nextMessages = [...s.messages, appendMsg];
      const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
      persist(updatedSessions, s.activeSessionId, s.windowMode);
      return {
        pendingCard: null,
        pendingCompoundBatch: null,
        messages: nextMessages,
        sessions: updatedSessions,
      };
    });
  },
}));
