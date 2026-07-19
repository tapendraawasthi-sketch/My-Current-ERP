import { create } from "zustand";
import {
  buildIdempotencyKey,
  executeOrbixConfirm,
  type OrbixPostingResult,
} from "../lib/ekhata/orbixPostingService";
import { ensureCardConfirmToken } from "../lib/ekhata/confirmPathAuthority";
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
import { legacyCardFromResponse, relatedDraftId } from "../lib/ekhata/orbixResponseAdapter";
import { parseOrbixResponse } from "../lib/ekhata/orbixResponseAdapter";
import type { OrbixResponse } from "../lib/ekhata/orbixResponseTypes";
import type { PostingCompletedPayload } from "../lib/ekhata/orbixResponseTypes";

function normalizePostingSyncStatus(
  raw: string | undefined | null,
): PostingCompletedPayload["sync_status"] | undefined {
  if (!raw) return undefined;
  const allowed: NonNullable<PostingCompletedPayload["sync_status"]>[] = [
    "pending",
    "disabled",
    "syncing",
    "synced",
    "failed",
    "conflict",
    "waiting_to_sync",
    "offline_will_sync",
  ];
  return (allowed as string[]).includes(raw)
    ? (raw as NonNullable<PostingCompletedPayload["sync_status"]>)
    : "pending";
}
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
import { extractPartyMention, handleOrbixLocalQuery } from "../lib/ekhata/orbixLocalEngine";
import { buildSessionSnapshot } from "../lib/ekhata/dexieBridge";
import { handleOrbixReportQuery } from "../lib/ekhata/orbixReportEngine";
import type { PendingOrbixReport } from "../lib/ekhata/orbixReportTypes";
import { loadOrbixOperatingMode,
  saveOrbixOperatingMode,
  type OrbixOperatingMode,
} from "../lib/ekhata/orbixOperatingMode";
import { useStore } from "./useStore";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function resolveCompanyIdForConfirm(): string | null {
  const settings = useStore.getState().companySettings as
    | { companyId?: string; id?: string }
    | null
    | undefined;
  const id = settings?.companyId || settings?.id;
  return id != null ? String(id) : null;
}

function withPendingConfirmToken(card: KhataConfirmationCard | null): KhataConfirmationCard | null {
  if (!card) return null;
  const companyId = resolveCompanyIdForConfirm();
  if (!companyId) return card;
  return ensureCardConfirmToken(card, companyId);
}

const boot = loadOrbixSessions();
const bootSession = boot.sessions.find((s) => s.id === boot.activeSessionId) ?? boot.sessions[0];

let conversationContext: EKhataConversationContext = createConversationContext();

if (bootSession.llmSessionId) {
  setEKhataSessionId(bootSession.llmSessionId);
}

/** Recover open draft after page reload from last clarification/preview message. */
function recoverActiveDraftId(messages: EKhataChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;

    const rt = message.orbixResponse?.response_type;
    // Already posted — do not keep a live draft/confirm for refresh recovery
    if (rt === "posting_completed") return null;

    if (message.relatedDraftId) {
      if (
        !rt ||
        rt === "clarification_required" ||
        rt === "confirmation_required" ||
        rt === "transaction_preview" ||
        rt === "journal_preview" ||
        rt === "classification_required"
      ) {
        return message.relatedDraftId;
      }
    }

    if (message.orbixResponse) {
      const typed = message.orbixResponse;
      const draftId = relatedDraftId(typed);
      if (
        draftId &&
        (rt === "clarification_required" ||
          rt === "confirmation_required" ||
          rt === "transaction_preview" ||
          rt === "journal_preview" ||
          rt === "classification_required")
      ) {
        return draftId;
      }
    }
  }
  return null;
}

function recoverPendingCard(messages: EKhataChatMessage[]): KhataConfirmationCard | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant" || !message.orbixResponse) continue;

    const rt = message.orbixResponse.response_type;
    if (rt === "posting_completed") return null;

    if (rt === "confirmation_required" || rt === "transaction_preview") {
      const fromLegacy = legacyCardFromResponse(message.orbixResponse);
      if (fromLegacy) return fromLegacy;

      const p = message.orbixResponse.payload as Record<string, unknown>;
      const draftId = String(p.draft_id || message.relatedDraftId || "");
      if (!draftId) return null;
      return {
        intent: (String(p.intent || "purchase") as KhataConfirmationCard["intent"]),
        amount: Number(p.amount ?? p.grand_total ?? 0),
        date: String(p.transaction_date || new Date().toISOString().slice(0, 10)),
        raw_text: message.text || "Restored preview",
        draft_id: draftId,
        preview_hash: p.preview_hash != null ? String(p.preview_hash) : null,
        preview_version: (p.preview_version as string | number | null | undefined) ?? null,
        idempotency_key: p.idempotency_key != null ? String(p.idempotency_key) : null,
        item: p.item_name != null ? String(p.item_name) : p.item != null ? String(p.item) : null,
        party: p.party_name != null ? String(p.party_name) : null,
      };
    }
  }
  return null;
}

const bootMessages = bootSession.messages.map(deserializeMessage);
const bootDraftId = recoverActiveDraftId(bootMessages);
const bootPendingCard = recoverPendingCard(bootMessages);

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

function applyStructuredComplete(
  msg: EKhataChatMessage,
  opts: {
    text: string;
    response: OrbixResponse | null;
    draftId?: string | null;
  },
): EKhataChatMessage {
  return {
    ...msg,
    text: opts.text,
    streamStatus: "completed",
    orbixResponse: opts.response,
    relatedDraftId:
      opts.draftId ??
      (opts.response ? relatedDraftId(opts.response) : null) ??
      msg.relatedDraftId,
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
      orbixResponse: {
        schema_version: "1.0",
        response_type: "report_result",
        status: "success",
        display: { text: result.text, tone: "professional" },
        actions: [],
        operation_class: "report_query",
        payload: {
          report: result.report,
          report_id: undefined,
          report_type: result.report?.kind,
        },
      },
      relatedReportId: null,
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
  /** Backend draft_id for active clarification / preview continuation */
  activeDraftId: string | null;
  /** Last posting lifecycle stages for UI */
  postingStages: string[];
  lastPostingResult: OrbixPostingResult | null;
  streamingText: string;
  activeTools: string[];
  engineLabel: string;
  orbixMode: OrbixOperatingMode;
  /** Last stream Language-KB hints (interpretation only; not posting authority). */
  lastNpKb: import("../lib/ekhata/orbixQwenClient").OrbixNpKbHint | null;
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
  messages: bootMessages,
  pendingCard: bootPendingCard,
  pendingCompoundBatch: null,
  activeDraftId: bootDraftId,
  postingStages: [],
  lastPostingResult: null,
  streamingText: "",
  activeTools: [],
  engineLabel: "qwen3",
  orbixMode: loadOrbixOperatingMode(),
  lastNpKb: null,

  setOrbixMode: (mode: OrbixOperatingMode) => {
    saveOrbixOperatingMode(mode);
    set({ orbixMode: mode });
  },

  openPanel: () => set({ isOpen: true, windowMode: "normal" }),

  openWithPendingCard: (card: KhataConfirmationCard) =>
    set({
      isOpen: true,
      windowMode: "normal",
      pendingCard: withPendingConfirmToken(card),
    }),

  closePanel: () => {
    const { sessions, activeSessionId, messages, windowMode } = get();
    const updated = syncSession(sessions, activeSessionId, messages);
    persist(updated, activeSessionId, windowMode);
    set({ isOpen: false, windowMode: "normal", pendingCard: null, pendingCompoundBatch: null, activeDraftId: null });
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
      activeDraftId: null,
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
    const nextMessages = target.messages.map(deserializeMessage);
    set({
      sessions: updated,
      activeSessionId: id,
      messages: nextMessages,
      pendingCard: recoverPendingCard(nextMessages),
      pendingCompoundBatch: null,
      activeDraftId: recoverActiveDraftId(nextMessages),
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
        // Clear confirm card while streaming, but keep activeDraftId so
        // clarification continuations send the same draft_id to the backend.
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
      // Do not short-circuit clarification / draft continuations into local cash/report helpers.
      // e.g. "1, 50000 cash" must update the purchase draft, not answer "cash balance".
      if (!get().activeDraftId) {
        const localResult = await handleOrbixLocalQuery(trimmed, sessionSnapshot);
        if (localResult) {
          const mentioned = extractPartyMention(trimmed);
          if (mentioned) {
            conversationContext = {
              ...conversationContext,
              lastParty: mentioned,
              lastParties: [
                mentioned,
                ...(conversationContext.lastParties || []).filter(
                  (p) => p.toLowerCase() !== mentioned.toLowerCase(),
                ),
              ].slice(0, 5),
            };
          }
          finalize({
            messages: get().messages.map((m) =>
              m.id === assistantId ? { ...m, text: localResult.text } : m,
            ),
            engineLabel: "orbix-local",
          });
          return;
        }
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
        const mentionedParty = extractPartyMention(trimmed);
        if (mentionedParty) {
          conversationContext = {
            ...conversationContext,
            lastParty: mentionedParty,
            lastParties: [
              mentionedParty,
              ...(conversationContext.lastParties || []).filter(
                (p) => p.toLowerCase() !== mentionedParty.toLowerCase(),
              ),
            ].slice(0, 5),
          };
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
          onComplete: ({ message, card, action, response, draft_id, npKb }) => {
            const typed = response;
            const draftId =
              draft_id ||
              (typed ? relatedDraftId(typed) : null) ||
              get().activeDraftId;
            const resolvedCard =
              action === "confirm"
                ? card || (typed ? legacyCardFromResponse(typed) : null)
                : null;
            // Mode restriction / clarification must not set pending confirm card
            const isConfirm =
              typed?.response_type === "confirmation_required" ||
              typed?.response_type === "transaction_preview" ||
              (action === "confirm" && Boolean(resolvedCard) && typed?.response_type !== "mode_restriction");

            if (isConfirm && resolvedCard) {
              conversationContext = updateContextAfterEntry(conversationContext, resolvedCard, trimmed);
            }
            finalize({
              messages: get().messages.map((m) =>
                m.id === assistantId
                  ? applyStructuredComplete(m, {
                      text: message,
                      response: typed,
                      draftId,
                    })
                  : m,
              ),
              pendingCard: isConfirm ? withPendingConfirmToken(resolvedCard) : null,
              activeDraftId:
                typed?.response_type === "clarification_required" || isConfirm
                  ? draftId
                  : typed?.response_type === "mode_restriction"
                    ? get().activeDraftId
                    : draftId || get().activeDraftId,
              streamingText: "",
              activeTools: [],
              engineLabel: `qwen3 (${llmStatus.model || "32b"})`,
              llmOnline: true,
              llmModel: llmStatus.model,
              lastNpKb: npKb && npKb.enabled ? npKb : null,
            });
          },
          onError: async () => {
            const fallback = await askOrbixQwen(trimmed, sessionId, {
              orbixMode: get().orbixMode,
              context: {
                ...(sessionSnapshot || {}),
                orbix_mode: get().orbixMode,
                draft_id: get().activeDraftId,
                has_pending_confirmation: Boolean(get().pendingCard),
                has_active_report: Boolean(
                  [...get().messages].reverse().find((m) => m.report)?.report,
                ),
                user_role: useStore.getState().currentUser?.role,
                last_party: conversationContext.lastParty || undefined,
                recent_parties: conversationContext.lastParties || undefined,
              },
            });
            const typed = fallback.response;
            const draftId = typed ? relatedDraftId(typed) : get().activeDraftId;
            if (fallback.card) {
              conversationContext = updateContextAfterEntry(
                conversationContext,
                fallback.card,
                trimmed,
              );
            }
            finalize({
              messages: get().messages.map((m) =>
                m.id === assistantId
                  ? applyStructuredComplete(m, {
                      text: fallback.answer,
                      response: typed,
                      draftId,
                    })
                  : m,
              ),
              pendingCard: withPendingConfirmToken(fallback.card),
              activeDraftId: draftId || get().activeDraftId,
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
              draft_id: get().activeDraftId,
              has_pending_confirmation: Boolean(get().pendingCard),
              has_active_report: Boolean(
                [...get().messages].reverse().find((m) => m.report)?.report,
              ),
              user_role: useStore.getState().currentUser?.role,
              last_party: conversationContext.lastParty || undefined,
              recent_parties: conversationContext.lastParties || undefined,
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

        if ((result.kind === "entry" || result.kind === "compound") && get().orbixMode === "ask") {
          const restrictionText =
            "This action needs Accountant Mode. You can still review the proposed entry here without changing any records.";
          const parsed = parseOrbixResponse({
            message: restrictionText,
            response_type: "mode_restriction",
            orbix_mode: "ask",
            operation_class: "transaction_create",
            error: {
              type: "mode_restriction",
              required_mode: "accountant",
              can_preview: true,
              operation: "transaction_create",
            },
          });
          finalize({
            messages: get().messages.map((m) =>
              m.id === assistantId
                ? applyStructuredComplete(m, {
                    text: restrictionText,
                    response: parsed.ok ? parsed.response : null,
                  })
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
          pendingCard:
            result.kind === "entry" && result.card
              ? withPendingConfirmToken(result.card)
              : null,
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
    const offlineParsed = parseOrbixResponse({
      message: ORBIX_OFFLINE_MESSAGE,
      response_type: "provider_offline",
      status: "failed",
    });
    finalize({
      messages: get().messages.map((m) =>
        m.id === assistantId
          ? applyStructuredComplete(m, {
              text: ORBIX_OFFLINE_MESSAGE,
              response: offlineParsed.ok ? offlineParsed.response : null,
            })
          : m,
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
    const card = get().pendingCard;
    const batch = get().pendingCompoundBatch;
    if ((!card && !batch) || get().isLoading) return;

    set({ isLoading: true, postingStages: ["confirmation_received"], lastPostingResult: null });

    const companySettings = useStore.getState().companySettings as
      | { id?: string; companyId?: string }
      | null
      | undefined;
    // Prefer logical companyId over settings row id ("main")
    const companyId = companySettings?.companyId || companySettings?.id || null;
    const role = useStore.getState().currentUser?.role;
    const requestId = genId();

    try {
      if (batch) {
        const voucherNos: string[] = [];
        for (const part of batch.parts) {
          const partCard = ensureCardConfirmToken(part.card, companyId);
          const result = await executeOrbixConfirm({
            requestId: `${requestId}-${part.card.intent}`,
            conversationId: get().activeSessionId,
            draftId: partCard.draft_id ?? get().activeDraftId,
            draftVersion: null,
            previewVersion: partCard.preview_version ?? 1,
            previewHash: partCard.preview_hash ?? null,
            companyId: companyId ? String(companyId) : null,
            orbixMode: get().orbixMode,
            idempotencyKey: buildIdempotencyKey({
              draftId: partCard.draft_id,
              previewHash: partCard.preview_hash,
              sessionId: get().activeSessionId,
            }),
            confirmation: true,
            confirmToken: partCard.confirm_token,
            card: partCard,
            userRole: role,
          });
          set({ postingStages: result.stages, lastPostingResult: result });
          if (result.status !== "success" || !result.payload.voucher_number) {
            throw new Error(result.payload.safe_message || "Batch posting failed");
          }
          voucherNos.push(result.payload.voucher_number);
          recordTrainingFeedback(part.card, "confirmed");
        }

        const appendMsg: EKhataChatMessage = {
          id: genId(),
          role: "assistant",
          text: `Safalta! ${batch.compoundCount} entries save bhayo ✓ (${voucherNos.join(", ")})`,
          timestamp: new Date(),
          orbixResponse: {
            schema_version: "1.0",
            response_type: "posting_completed",
            status: "success",
            display: {
              text: `Posted ${voucherNos.length} entries: ${voucherNos.join(", ")}`,
              tone: "professional",
            },
            actions: [],
            payload: {
              draft_id: get().activeDraftId || "",
              posting_id: requestId,
              voucher_number: voucherNos.join(", "),
              posted_at: new Date().toISOString(),
              idempotent_replay: false,
            },
          },
        };
        set((s) => {
          const nextMessages = [...s.messages, appendMsg];
          const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
          persist(updatedSessions, s.activeSessionId, s.windowMode);
          return {
            pendingCompoundBatch: null,
            pendingCard: null,
            activeDraftId: null,
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
        return;
      }

      if (!card) return;

      const tokenCard = ensureCardConfirmToken(card, companyId);
      if (tokenCard.confirm_token !== card.confirm_token) {
        set({ pendingCard: tokenCard });
      }

      const result = await executeOrbixConfirm({
        requestId,
        conversationId: get().activeSessionId,
        draftId: tokenCard.draft_id ?? get().activeDraftId,
        draftVersion: null,
        previewVersion: tokenCard.preview_version ?? 1,
        previewHash: tokenCard.preview_hash ?? null,
        companyId: companyId ? String(companyId) : null,
        orbixMode: get().orbixMode,
        idempotencyKey:
          tokenCard.idempotency_key ||
          buildIdempotencyKey({
            draftId: tokenCard.draft_id ?? get().activeDraftId,
            previewHash: tokenCard.preview_hash,
            sessionId: get().activeSessionId,
          }),
        confirmation: true,
        confirmToken: tokenCard.confirm_token,
        card: tokenCard,
        userRole: role,
      });

      set({ postingStages: result.stages, lastPostingResult: result });

      if (result.response_type === "permission_denied" || result.status !== "success") {
        const failedType =
          result.response_type === "permission_denied" ? "permission_denied" : "posting_failed";
        const appendMsg: EKhataChatMessage = {
          id: genId(),
          role: "assistant",
          text: result.payload.safe_message || "Posting was not completed.",
          timestamp: new Date(),
          orbixResponse:
            failedType === "permission_denied"
              ? {
                  schema_version: "1.0",
                  response_type: "permission_denied",
                  status: "failed",
                  display: {
                    text: result.payload.safe_message || "Posting failed.",
                    tone: "professional",
                  },
                  actions: [],
                  payload: {
                    error_code: result.payload.error_code || result.response_type,
                    safe_message: result.payload.safe_message || "Posting failed.",
                  },
                }
              : {
                  schema_version: "1.0",
                  response_type: "posting_failed",
                  status: "failed",
                  display: {
                    text: result.payload.safe_message || "Posting failed.",
                    tone: "professional",
                  },
                  actions: [],
                  payload: {
                    draft_id: result.payload.draft_id,
                    error_code: result.payload.error_code || result.response_type,
                    safe_message: result.payload.safe_message || "Posting failed.",
                    rolled_back: result.payload.rolled_back ?? true,
                    retryable: result.payload.retryable ?? true,
                    user_action_required: true,
                    draft_retained: result.payload.draft_retained ?? true,
                  },
                },
        };
        set((s) => {
          const nextMessages = [...s.messages, appendMsg];
          const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
          persist(updatedSessions, s.activeSessionId, s.windowMode);
          return {
            isLoading: false,
            // Retain pending card on stale/permission so user can retry after fix
            pendingCard:
              result.payload.error_code === "stale_preview" ||
              result.response_type === "permission_denied"
                ? s.pendingCard
                : null,
            messages: nextMessages,
            sessions: updatedSessions,
          };
        });
        return;
      }

      const voucherNo = result.payload.voucher_number || "";
      const replayNote = result.payload.idempotent_replay ? " (already posted — idempotent replay)" : "";
      const appendMsg: EKhataChatMessage = {
        id: genId(),
        role: "assistant",
        text: `${replySaved(voucherNo)}${replayNote}`,
        timestamp: new Date(),
        orbixResponse: {
          schema_version: "1.0",
          response_type: "posting_completed",
          status: "success",
          display: { text: `Posted voucher ${voucherNo}${replayNote}`, tone: "professional" },
          actions: [
            { id: "open_voucher", type: "open_voucher", label: "Open voucher" },
            { id: "new_transaction", type: "new_transaction", label: "Create another" },
          ],
          payload: {
            draft_id: result.payload.draft_id || "",
            posting_id: result.payload.posting_id,
            voucher_id: result.payload.voucher_id || null,
            voucher_number: voucherNo,
            invoice_id: result.payload.invoice_id || null,
            invoice_number: result.payload.invoice_number || null,
            amount: result.payload.amount || null,
            currency: "NPR",
            posted_at: result.payload.posted_at || null,
            idempotent_replay: Boolean(result.payload.idempotent_replay),
            // Pass through authoritative sync state — never invent "synced"
            sync_status: normalizePostingSyncStatus(result.payload.sync_status),
            sync_event_id: result.payload.sync_event_id ?? null,
          },
        },
        relatedDraftId: result.payload.draft_id,
        relatedPostingId: result.payload.posting_id,
      };
      set((s) => {
        const nextMessages = [...s.messages, appendMsg];
        const updatedSessions = syncSession(s.sessions, s.activeSessionId, nextMessages);
        persist(updatedSessions, s.activeSessionId, s.windowMode);
        return {
          pendingCard: null,
          activeDraftId: null,
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
        postingStages: [...s.postingStages, "posting_failed"],
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
