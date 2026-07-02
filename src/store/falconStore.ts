import { create } from "zustand";
import { persist } from "zustand/middleware";
import { askFalcon } from "../lib/falcon/engine";

export type FalconRole = "user" | "assistant";

export interface FalconMessage {
  id: string;
  role: FalconRole;
  content: string;
  createdAt: string;
  suggestions?: string[];
  feedback?: 1 | -1;
}

interface FalconContext {
  route?: string;
  screenTitle?: string;
}

interface FalconState {
  isOpen: boolean;
  isTyping: boolean;
  messages: FalconMessage[];
  context: FalconContext;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (context: Partial<FalconContext>) => void;

  sendMessage: (text: string) => Promise<void>;
  rateMessage: (id: string, feedback: 1 | -1) => void;
  clearHistory: () => void;
}

const now = () => new Date().toISOString();

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `falcon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const WELCOME_MESSAGE: FalconMessage = {
  id: "welcome",
  role: "assistant",
  createdAt: now(),
  content:
    "Namaste! I’m Falcon, your Sutra ERP assistant. Ask me how to create vouchers, invoices, masters, reports, VAT reports, stock entries, company settings, users, audit logs, print/export, or shortcuts. I only guide you — I will not change your data.",
  suggestions: [
    "How do I create a sales invoice?",
    "How do I see Profit & Loss?",
    "How do I add a new party?",
    "How do I configure company settings?",
  ],
};

const getPageHint = (route?: string) => {
  if (!route) return "";
  const pretty = route.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `\n\nCurrent screen context: You appear to be on **${pretty}**. If your question is about this screen, tell me exactly what you want to do here and I’ll guide step-by-step.`;
};

export const useFalconStore = create<FalconState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isTyping: false,
      messages: [WELCOME_MESSAGE],
      context: {},

      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

      setContext: (context) =>
        set((state) => ({
          context: {
            ...state.context,
            ...context,
          },
        })),

      sendMessage: async (text: string) => {
        const clean = text.trim();
        if (!clean) return;

        const userMessage: FalconMessage = {
          id: makeId(),
          role: "user",
          content: clean,
          createdAt: now(),
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          isTyping: true,
        }));

        // Small delay so the chat feels natural
        await new Promise((resolve) => setTimeout(resolve, 250));

        // Build conversation history from current messages (last 6, excluding welcome)
        const recentMessages = get()
          .messages.filter((m) => m.id !== "welcome")
          .slice(-6)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const result = askFalcon(clean, get().context.route, recentMessages);

        let content = result.answer;
        // Only append the page hint for very low-confidence answers (not for reasoning results)
        if (result.confidence > 0 && result.confidence < 10 && get().context.route) {
          content += getPageHint(get().context.route);
        }

        const assistantMessage: FalconMessage = {
          id: makeId(),
          role: "assistant",
          content,
          suggestions: result.suggestions,
          createdAt: now(),
        };

        set((state) => ({
          messages: [...state.messages, assistantMessage],
          isTyping: false,
        }));
      },

      rateMessage: (id, feedback) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id ? { ...message, feedback } : message,
          ),
        })),

      clearHistory: () =>
        set({
          messages: [
            {
              ...WELCOME_MESSAGE,
              createdAt: now(),
            },
          ],
          isTyping: false,
        }),
    }),
    {
      name: "sutra-falcon-chat-v2",
      partialize: (state) => ({
        messages: state.messages.slice(-60),
        context: state.context,
      }),
    },
  ),
);
