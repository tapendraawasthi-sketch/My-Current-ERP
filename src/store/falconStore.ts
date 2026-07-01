// src/store/falconStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { askFalcon, type FalconContext } from "../lib/falcon/engine";

export interface FalconMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestions?: string[];
  feedback?: 1 | -1 | null;
}

interface FalconState {
  isOpen: boolean;
  messages: FalconMessage[];
  context: FalconContext;
  isTyping: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (ctx: FalconContext) => void;
  sendMessage: (text: string) => void;
  rateMessage: (id: string, rating: 1 | -1) => void;
  clearHistory: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const WELCOME_MESSAGE: FalconMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I'm Falcon 🦅 — your built-in Sutra ERP assistant. Ask me how to create a voucher, understand a report, manage inventory, VAT, payroll or anything else in this system.",
  timestamp: new Date().toISOString(),
  suggestions: [
    "How do I create a sales invoice?",
    "How do I pass a journal entry?",
    "What reports are available?",
  ],
};

export const useFalconStore = create<FalconState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      messages: [WELCOME_MESSAGE],
      context: {},
      isTyping: false,

      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

      setContext: (ctx) => set({ context: ctx }),

      sendMessage: (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        const userMsg: FalconMessage = {
          id: uid(),
          role: "user",
          content: trimmed,
          timestamp: new Date().toISOString(),
        };

        set((s) => ({ messages: [...s.messages, userMsg], isTyping: true }));

        // Simulate a brief "thinking" delay for a natural feel — all matching
        // is instant/local, this is purely a UX touch.
        setTimeout(() => {
          const { context } = get();
          const result = askFalcon(trimmed, context);

          const assistantMsg: FalconMessage = {
            id: uid(),
            role: "assistant",
            content: result.text,
            timestamp: new Date().toISOString(),
            suggestions: result.suggestions,
          };

          set((s) => ({ messages: [...s.messages, assistantMsg], isTyping: false }));
        }, 350);
      },

      rateMessage: (id, rating) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, feedback: rating } : m)),
        })),

      clearHistory: () => set({ messages: [WELCOME_MESSAGE] }),
    }),
    {
      name: "sutra_falcon_chat",
      partialize: (s) => ({ messages: s.messages }),
    },
  ),
);
