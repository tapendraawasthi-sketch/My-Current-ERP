import { create } from "zustand";
import { confirmKhataEntry } from "../lib/ekhata/confirmKhata";
import { replyCancel, replyGreeting, replySaved } from "../lib/ekhata/conversationEngine";
import {
  checkEKhataLlmStatus,
  getWebLlmState,
  isEKhataBrowserAiReady,
  isWebGpuAvailable,
  loadEKhataBrowserAi,
  onWebLlmProgress,
  processEKhataMessageAsync,
} from "../lib/ekhata/processMessage";
import { resetEKhataBrowserChat } from "../lib/ekhata/ekhataWebLlm";
import { resetEKhataSession } from "../lib/ekhata/ekhataLlmClient";
import type { EKhataChatMessage, KhataConfirmationCard } from "../lib/ekhata/types";
import { useStore } from "./useStore";

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildWelcome(ollamaOnline: boolean, browserReady: boolean, model?: string): string {
  const base = replyGreeting();
  if (ollamaOnline) {
    return (
      `${base}\n\n🟢 **Ollama LLM** (${model ?? "local"}) — Nepali ma kura garna ra khata entry dono milcha. API key chaina.`
    );
  }
  if (browserReady) {
    return (
      `${base}\n\n🟢 **Browser Nepali AI** tayar cha — k xa, khana khayeu, udhaar entry — sabai natural Nepali ma. Tapai ko device ma chalcha, data bahira jadaina.`
    );
  }
  const webgpu = isWebGpuAvailable();
  return (
    `${base}\n\n` +
    (webgpu
      ? "🔵 **Load Nepali AI** thichnus — browser ma real AI (Qwen, ~300MB ek choti). Tes pachi Nepali kura human jastai.\n\nKhata entry chai sidhai lekhna milcha: `Ram lai 500 udhaar diye`."
      : "🟡 WebGPU chaina — full Nepali chat ko lagi Chrome/Edge athaba local Ollama chaincha.\n\nKhata entry: `Ram lai 500 udhaar diye`.")
  );
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

export interface EKhataState {
  isOpen: boolean;
  isLoading: boolean;
  llmOnline: boolean;
  llmModel?: string;
  browserAiReady: boolean;
  browserAiLoading: boolean;
  browserAiProgress: number;
  browserAiProgressText: string;
  messages: EKhataChatMessage[];
  pendingCard: KhataConfirmationCard | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  refreshLlmStatus: () => Promise<void>;
  loadBrowserAi: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  confirmPending: () => Promise<void>;
  cancelPending: () => void;
  clearHistory: () => void;
}

let progressUnsub: (() => void) | undefined;

function syncBrowserProgress(set: (partial: Partial<EKhataState>) => void) {
  progressUnsub?.();
  progressUnsub = onWebLlmProgress((progress, text, state) => {
    set({
      browserAiProgress: progress,
      browserAiProgressText: text,
      browserAiLoading: state === "loading",
      browserAiReady: state === "ready",
    });
  });
}

export const useEKhataStore = create<EKhataState>((set, get) => {
  syncBrowserProgress(set);
  const initialBrowser = getWebLlmState();

  return {
    isOpen: false,
    isLoading: false,
    llmOnline: false,
    llmModel: undefined,
    browserAiReady: initialBrowser.state === "ready",
    browserAiLoading: initialBrowser.state === "loading",
    browserAiProgress: initialBrowser.progress,
    browserAiProgressText: initialBrowser.text,
    messages: [
      {
        id: "welcome",
        role: "assistant",
        text: buildWelcome(false, initialBrowser.state === "ready"),
        timestamp: new Date(),
      },
    ],
    pendingCard: null,

    openPanel: () => set({ isOpen: true }),
    closePanel: () => set({ isOpen: false }),
    togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),

    refreshLlmStatus: async () => {
      const status = await checkEKhataLlmStatus();
      const browserReady = isEKhataBrowserAiReady();
      set({
        llmOnline: status.khataLlm,
        llmModel: status.model,
        browserAiReady: browserReady,
        messages:
          get().messages.length === 1 && get().messages[0]?.id === "welcome"
            ? [
                {
                  id: "welcome",
                  role: "assistant",
                  text: buildWelcome(status.khataLlm, browserReady, status.model),
                  timestamp: new Date(),
                },
              ]
            : get().messages,
      });
    },

    loadBrowserAi: async () => {
      if (get().browserAiLoading || get().browserAiReady) return;
      set({ browserAiLoading: true, browserAiProgressText: "Nepali AI load hudai cha..." });
      try {
        await loadEKhataBrowserAi();
        set({ browserAiReady: true, browserAiLoading: false });
        if (get().messages.length === 1 && get().messages[0]?.id === "welcome") {
          set({
            messages: [
              {
                id: "welcome",
                role: "assistant",
                text: buildWelcome(get().llmOnline, true, get().llmModel),
                timestamp: new Date(),
              },
            ],
          });
        }
      } catch (error) {
        set({
          browserAiLoading: false,
          messages: [
            ...get().messages,
            {
              id: genId(),
              role: "assistant",
              text: error instanceof Error ? error.message : "Browser AI load failed",
              timestamp: new Date(),
            },
          ],
        });
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
        const result = await processEKhataMessageAsync(trimmed, {
          balance: getKhataBalance(),
          autoLoadBrowserAi: true,
        });

        const browserNow = isEKhataBrowserAiReady();

        if (result.kind === "entry" && result.card) {
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
            llmOnline: result.engine === "ollama" || result.engine === "hybrid" || s.llmOnline,
            browserAiReady: browserNow || s.browserAiReady,
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
          llmOnline: result.engine === "ollama" || result.engine === "hybrid" || s.llmOnline,
          browserAiReady: result.engine === "browser" || browserNow || s.browserAiReady,
          browserAiLoading: getWebLlmState().state === "loading",
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
            text: replyCancel(),
            timestamp: new Date(),
          },
        ],
      }));
    },

    clearHistory: () => {
      resetEKhataSession();
      resetEKhataBrowserChat();
      const { llmOnline, llmModel, browserAiReady } = get();
      set({
        messages: [
          {
            id: "welcome",
            role: "assistant",
            text: buildWelcome(llmOnline, browserAiReady, llmModel),
            timestamp: new Date(),
          },
        ],
        pendingCard: null,
      });
    },
  };
});
