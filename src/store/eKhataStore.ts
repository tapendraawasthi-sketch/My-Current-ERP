import { create } from "zustand";
import { confirmKhataEntry } from "../lib/ekhata/confirmKhata";
import { parseKhataMessage } from "../lib/ekhata/parseKhata";
import type { EKhataChatMessage, KhataConfirmationCard } from "../lib/ekhata/types";
import { useStore } from "./useStore";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const WELCOME =
  "Namaste! **e-Khata** ma Nepali/Romanized bhasa ma entry garnus.\n\n**Udharo:** `Ram lai 500 udhaar diye`\n**Payment:** `Shyam le 200 tiryo`\n**Cash sale:** `aaja 200 ko nagad bikri vayo`\n**Purchase:** `aja sabji kineko 1000`\n\nConfirm garnu agadi card dekhincha.";

export interface EKhataState {
  isOpen: boolean;
  isLoading: boolean;
  messages: EKhataChatMessage[];
  pendingCard: KhataConfirmationCard | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
  clearHistory: () => void;
}

export const useEKhataStore = create<EKhataState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  messages: [
    {
      id: "welcome",
      role: "assistant",
      text: WELCOME,
      timestamp: new Date(),
    },
  ],
  pendingCard: null,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

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
      const result = parseKhataMessage(trimmed);

      if (result.clarifying_question) {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: genId(),
              role: "assistant",
              text: result.clarifying_question!,
              timestamp: new Date(),
            },
          ],
          isLoading: false,
        }));
        return;
      }

      if (result.card) {
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: genId(),
              role: "assistant",
              text: "Yo transaction confirm garnu hunchha?",
              timestamp: new Date(),
            },
          ],
          pendingCard: result.card,
          isLoading: false,
        }));
      }
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
            text: `Transaction saved ✓ (${voucherNo})`,
            timestamp: new Date(),
          },
        ],
      }));
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
    set((s) => ({
      pendingCard: null,
      messages: [
        ...s.messages,
        {
          id: genId(),
          role: "assistant",
          text: "Ok, kei gardina.",
          timestamp: new Date(),
        },
      ],
    }));
  },

  clearHistory: () =>
    set({
      messages: [
        {
          id: "welcome",
          role: "assistant",
          text: WELCOME,
          timestamp: new Date(),
        },
      ],
      pendingCard: null,
    }),
}));
