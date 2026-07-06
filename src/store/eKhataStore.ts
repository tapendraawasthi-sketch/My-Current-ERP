import { create } from "zustand";
import { confirmKhataEntry } from "../lib/ekhata/confirmKhata";
import { replyCancel, replySaved } from "../lib/ekhata/conversationEngine";
import { recordTrainingFeedback } from "../lib/ekhata/trainingFeedback";
import {
  createConversationContext,
  processEKhataMessageAsync,
  updateContextAfterConfirm,
  updateContextAfterEntry,
  type EKhataConversationContext,
} from "../lib/ekhata/processMessage";
import type { ConversationTurn } from "../lib/ekhata/conversationalBrain";
import type { EKhataChatMessage, KhataConfirmationCard } from "../lib/ekhata/types";
import { useStore } from "./useStore";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}


function buildWelcome(): string {
  return (
    "Namaste! Ma **e-Khata CA Brain** — tapaiko accounting intelligence sahayogi.\n\n" +
    "Ma bujhchhu ra jawaf dinchhu:\n" +
    "• **Accounting entries** — Nepali, English, Roman Nepali ('ram le 500 ko saman kinyo')\n" +
    "• **IFRS/NAS concepts** — sampatti, dayitwo, recognition, VAT/SSF/TDS\n" +
    "• **Three languages** — Devanagari, Roman, English\n\n" +
    "📒 CA Entries · 📘 Framework Q&A · 🌐 Web (external facts only)"
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

export interface EKhataState {
  isOpen: boolean;
  isLoading: boolean;
  llmOnline: boolean;
  llmModel?: string;
  messages: EKhataChatMessage[];
  pendingCard: KhataConfirmationCard | null;
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

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

  refreshLlmStatus: async () => {
    try {
      const { checkEKhataLlmStatus } = await import("../lib/ekhata/ekhataLlmClient");
      const status = await checkEKhataLlmStatus();
      set({
        llmOnline: status.online && status.khataLlm,
        llmModel: status.model,
      });
    } catch {
      set({ llmOnline: false, llmModel: undefined });
    }
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    set((s) => ({
      messages: [
        ...s.messages,
        { id: genId(), role: "user", text: trimmed, timestamp: new Date() },
      ],
      isLoading: true,
      pendingCard: null,
    }));

    try {
      const history: ConversationTurn[] = get()
        .messages.filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      const { checkEKhataLlmStatus } = await import("../lib/ekhata/ekhataLlmClient");
      const llmStatus = await checkEKhataLlmStatus();

      const result = await processEKhataMessageAsync(trimmed, {
        balance: getKhataBalance(),
        history,
        llmOnline: llmStatus.online && llmStatus.khataLlm,
        llmModel: llmStatus.model,
        conversationContext,
      });

      set({
        llmOnline: llmStatus.online && llmStatus.khataLlm,
        llmModel: llmStatus.model,
      });

      if (result.kind === "entry" && result.card) {
        conversationContext = updateContextAfterEntry(conversationContext, result.card, trimmed);
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: genId(),
              role: "assistant",
              text: result.reply,
              timestamp: new Date(),
            },
          ],
          pendingCard: result.card ?? null,
          isLoading: false,
        }));
        return;
      }

      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant",
            text: result.reply,
            timestamp: new Date(),
          },
        ],
        pendingCard: null,
        isLoading: false,
      }));
    } catch (error) {
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant",
            text: error instanceof Error ? error.message : "Parse garna sakina.",
            timestamp: new Date(),
          },
        ],
        isLoading: false,
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
    });
  },
}));
