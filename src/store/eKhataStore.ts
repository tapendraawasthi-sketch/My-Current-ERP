import { create } from "zustand";
import { confirmKhataEntry } from "../lib/ekhata/confirmKhata";
import { buildSessionSnapshot } from "../lib/ekhata/dexieBridge";
import {
  askEKhataV2,
  checkEKhataLlmStatus,
  getEKhataSessionId,
} from "../lib/ekhata/ekhataLlmClient";
import { replyCancel, replySaved } from "../lib/ekhata/conversationEngine";
import { recordTrainingFeedback } from "../lib/ekhata/trainingFeedback";
import { streamChat } from "../lib/ekhata/streamingClient";
import {
  createConversationContext,
  updateContextAfterConfirm,
  updateContextAfterEntry,
  type EKhataConversationContext,
} from "../lib/ekhata/processMessage";
import type { EKhataChatMessage, KhataConfirmationCard } from "../lib/ekhata/types";
import { useStore } from "./useStore";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildWelcome(): string {
  return (
    "Namaste! Ma **e-Khata CA Brain** — tapaiko accounting intelligence sahayogi.\n\n" +
    "Ma bujhchhu ra jawaf dinchhu:\n" +
    "• **Accounting entries** — Nepali, English, Roman Nepali\n" +
    "• **IFRS/NAS concepts** — sampatti, dayitwo, recognition, VAT/SSF/TDS\n" +
    "• **Real ledger data** — party balance, reports, trial balance\n\n" +
    "📒 CA Entries · 📘 Framework Q&A · 🔧 Agentic tools"
  );
}

let conversationContext: EKhataConversationContext = createConversationContext();

function getKhataBalance() {
  const accounts = useStore.getState().accounts ?? [];
  const debt = accounts.find((a) => a.code === "KH-DEBT");
  const cred = accounts.find((a) => a.code === "KH-CRED");
  return {
    udhaarOut: Math.max(0, debt?.balance ?? 0),
    udhaarIn: Math.max(0, cred?.balance ?? 0),
  };
}

function formatAssistantText(message: string, insight?: string | null): string {
  return insight ? `${message}\n\n${insight}` : message;
}

export interface EKhataState {
  isOpen: boolean;
  isLoading: boolean;
  llmOnline: boolean;
  llmModel?: string;
  messages: EKhataChatMessage[];
  pendingCard: KhataConfirmationCard | null;
  streamingText: string;
  activeTools: string[];
  engineLabel: string;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  refreshLlmStatus: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
  clearHistory: () => void;
}

export const useEKhataStore = create<EKhataState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  llmOnline: false,
  llmModel: undefined,
  messages: [
    {
      id: "welcome",
      role: "assistant",
      text: buildWelcome(),
      timestamp: new Date(),
    },
  ],
  pendingCard: null,
  streamingText: "",
  activeTools: [],
  engineLabel: "v2",

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  refreshLlmStatus: async () => {
    const status = await checkEKhataLlmStatus();
    set({
      llmOnline: status.online,
      llmModel: status.khataLlm ? status.model : status.degraded ? "KB-only" : status.model,
      engineLabel: status.degraded ? "v2 (KB)" : status.khataLlm ? "v2" : "offline",
    });
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    const assistantId = genId();

    set((s) => ({
      messages: [
        ...s.messages,
        { id: genId(), role: "user", text: trimmed, timestamp: new Date() },
        { id: assistantId, role: "assistant", text: "", timestamp: new Date() },
      ],
      isLoading: true,
      pendingCard: null,
      streamingText: "",
      activeTools: [],
    }));

    const balance = getKhataBalance();

    if (!get().llmOnline) {
      set((s) => ({
        isLoading: false,
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text:
                  "erp_bot reach vayena. Dev setup:\n" +
                  "1. `.env.local` ma `VITE_ERP_BOT_URL=http://localhost:8765`\n" +
                  "2. `cd erp_bot && python3 -m uvicorn src.api.server:app --port 8765`\n" +
                  "3. Ports tab ma **8765** forward garnus, panel refresh\n" +
                  "4. Full AI: `ollama serve` (local machine ma)",
              }
            : m,
        ),
      }));
      return;
    }

    try {
      const snapshot = await buildSessionSnapshot();
      const sessionId = getEKhataSessionId();

      await streamChat(trimmed, sessionId, {
        onThinkingStart: () => {
          set({ streamingText: "", activeTools: [] });
        },
        onThinkingDone: () => undefined,
        onToken: (token) => {
          set((s) => {
            const next = s.streamingText + token;
            return {
              streamingText: next,
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, text: next } : m,
              ),
            };
          });
        },
        onToolCalling: (tools) => set({ activeTools: tools }),
        onComplete: (meta) => {
          const action = meta.action as string | undefined;
          const card = (meta.card as KhataConfirmationCard | null) ?? null;
          const message = String(meta.message || get().streamingText || "");
          const insight = meta.insight as string | null | undefined;
          const finalText = formatAssistantText(message, insight);

          if (action === "confirm" && card) {
            conversationContext = updateContextAfterEntry(conversationContext, card, trimmed);
          }

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, text: finalText } : m,
            ),
            pendingCard: action === "confirm" ? card : null,
            isLoading: false,
            streamingText: "",
            activeTools: [],
            engineLabel: "v2-stream",
          }));
        },
        onError: async () => {
          const v2 = await askEKhataV2(trimmed, sessionId, { balance, context: snapshot });
          const finalText = formatAssistantText(v2.message, v2.insight);
          if (v2.action === "confirm" && v2.card) {
            conversationContext = updateContextAfterEntry(
              conversationContext,
              v2.card as KhataConfirmationCard,
              trimmed,
            );
          }
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, text: finalText } : m,
            ),
            pendingCard: v2.action === "confirm" ? (v2.card ?? null) : null,
            isLoading: false,
            streamingText: "",
            activeTools: [],
            engineLabel: "v2",
          }));
        },
      }, { context: snapshot, balance });
    } catch (error) {
      set((s) => ({
        isLoading: false,
        streamingText: "",
        messages: s.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: error instanceof Error ? error.message : "Parse garna sakina.",
              }
            : m,
        ),
      }));
    }
  },

  confirmPending: async () => {
    const card = get().pendingCard;
    if (!card || get().isLoading) return;

    set({ isLoading: true });
    try {
      const { addVoucher } = useStore.getState();
      const { voucherNo } = await confirmKhataEntry(card, {
        addVoucher: addVoucher as (voucher: Record<string, unknown>) => Promise<unknown>,
      });

      set((s) => ({
        pendingCard: null,
        isLoading: false,
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant",
            text: replySaved(voucherNo),
            timestamp: new Date(),
          },
        ],
      }));
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
    if (card) recordTrainingFeedback(card, "cancelled");
    set((s) => ({
      pendingCard: null,
      messages: [
        ...s.messages,
        {
          id: genId(),
          role: "assistant",
          text: replyCancel(),
          timestamp: new Date(),
        },
      ],
    }));
  },

  clearHistory: () => {
    conversationContext = createConversationContext();
    set({
      messages: [
        {
          id: "welcome",
          role: "assistant",
          text: buildWelcome(),
          timestamp: new Date(),
        },
      ],
      pendingCard: null,
      streamingText: "",
      activeTools: [],
    });
  },
}));
