// Falcon AI — Enhanced with Falcon Brain (no API keys required)
// Now powered by advanced NLP, code structure parsing, and precision response composition

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  classifyQuestion,
  buildReasoningPlan,
  generateFollowUpSuggestions,
} from "../lib/falcon/chainOfThought";
import type { ThoughtStep, QuestionDomain, QuestionIntent } from "../lib/falcon/chainOfThought";
import { ERP_BOT_URL, askErpBot, checkErpBotStatus, getErpBotSessionId } from "../lib/erpBotClient";
import {
  askSmartAssistant,
  askSmartAssistantAsync,
  buildErpBotContextBlock,
  type SmartAssistantContext,
} from "../lib/falcon/smartAssistant";
import { getCodebaseStats } from "../lib/falcon/codeStructureParser";

let _activeController: AbortController | null = null;

function createController(): AbortController {
  _activeController?.abort();
  _activeController = new AbortController();
  return _activeController;
}

function abortActive() {
  _activeController?.abort();
  _activeController = null;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const WELCOME_MESSAGE = `Hi — I'm **Falcon AI**, your intelligent ERP assistant for Sutra.

**What I can do:**
- Answer questions about any ERP module, voucher, or report
- Provide step-by-step instructions tailored to your question
- Navigate you to any screen in the system
- Explain accounting concepts and Nepal tax rules
- Troubleshoot common errors

I read your ERP's code structure in real-time, so I always give you accurate, up-to-date answers. **Ask me anything!**`;

function toAssistantContext(ctx: FalconContext): SmartAssistantContext {
  return {
    route: ctx.route,
    screenTitle: ctx.screenTitle,
    companyName: ctx.companyName,
  };
}

async function buildSmartReply(
  text: string,
  context: FalconContext,
  history: FalconChatMessage[],
): Promise<FalconChatMessage> {
  const convo = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-6)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  // Use async version for web search support
  const result = await askSmartAssistantAsync(text, toAssistantContext(context), convo);

  return {
    id: genId(),
    role: "assistant",
    content: result.answer,
    timestamp: new Date(),
    domain: "erp",
    sources: result.sources,
    suggestions: result.suggestions,
  };
}

export interface FalconChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  domain?: QuestionDomain;
  intent?: QuestionIntent;
  reasoningSteps?: ThoughtStep[];
  sources?: string[];
  feedback?: 1 | -1;
  suggestions?: string[];
  isStreaming?: boolean;
}

export interface FalconContext {
  route?: string;
  screenTitle?: string;
  companyName?: string;
  userName?: string;
}

export interface FalconState {
  isOpen: boolean;
  isTyping: boolean;
  isStreaming: boolean;
  showThinking: boolean;
  messages: FalconChatMessage[];
  currentThinkingSteps: ThoughtStep[];
  context: FalconContext;
  botOnline: boolean;
  indexedFiles: number;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (ctx: Partial<FalconContext>) => void;
  refreshBotStatus: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  rateMessage: (id: string, rating: 1 | -1) => void;
  clearHistory: () => void;
  toggleShowThinking: () => void;
  cancelStream: () => void;
}

export const useFalconStore = create<FalconState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isTyping: false,
      isStreaming: false,
      showThinking: true,
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: WELCOME_MESSAGE,
          timestamp: new Date(),
        },
      ],
      currentThinkingSteps: [],
      context: {},
      botOnline: false,
      indexedFiles: 0,

      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
      setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
      toggleShowThinking: () => set((s) => ({ showThinking: !s.showThinking })),
      rateMessage: (id, rating) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, feedback: rating } : m)),
        })),
      clearHistory: () =>
        set({
          messages: [
            {
              id: "welcome",
              role: "assistant",
              content: WELCOME_MESSAGE,
              timestamp: new Date(),
            },
          ],
          currentThinkingSteps: [],
          isTyping: false,
          isStreaming: false,
        }),
      cancelStream: () => {
        abortActive();
        set({
          isTyping: false,
          isStreaming: false,
          currentThinkingSteps: [],
        });
      },

      refreshBotStatus: async () => {
        const status = await checkErpBotStatus();
        set({
          botOnline: status.online,
          indexedFiles: status.indexedFiles,
        });
      },

      sendMessage: async (text: string) => {
        const state = get();
        const cleanText = text.trim();
        if (!cleanText || state.isTyping) return;

        const userMsg: FalconChatMessage = {
          id: genId(),
          role: "user",
          content: cleanText,
          timestamp: new Date(),
        };
        set((s) => ({
          messages: [...s.messages, userMsg],
          isTyping: true,
          isStreaming: false,
          currentThinkingSteps: [],
        }));

        const status = await checkErpBotStatus();
        set({ botOnline: status.online, indexedFiles: status.indexedFiles });

        if (!status.online) {
          const smartMsg = await buildSmartReply(cleanText, state.context, state.messages);
          set((s) => ({
            messages: [...s.messages, smartMsg],
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
          }));
          return;
        }

        const classification = classifyQuestion(cleanText, state.context.route);
        const plan = buildReasoningPlan(
          cleanText,
          classification.domain,
          classification.intent,
          state.context.route,
        );
        set({ currentThinkingSteps: plan.steps });
        await new Promise((r) => setTimeout(r, 400));

        const contextBlock = buildErpBotContextBlock(toAssistantContext(state.context));
        const payload = cleanText;

        const abortController = createController();
        const assistantId = genId();

        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: assistantId,
              role: "assistant",
              content: "",
              timestamp: new Date(),
              isStreaming: true,
              domain: classification.domain,
              intent: classification.intent,
            },
          ],
          isStreaming: true,
        }));

        try {
          const result = await askErpBot(
            payload,
            getErpBotSessionId(),
            abortController.signal,
            contextBlock,
          );
          const followUps = generateFollowUpSuggestions(
            cleanText,
            classification.domain,
            state.context.route,
          );

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: result.answer,
                    isStreaming: false,
                    reasoningSteps: plan.steps,
                    sources: result.sources,
                    suggestions: followUps,
                  }
                : m,
            ),
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
          }));
        } catch (err: any) {
          const isAbort = err?.name === "AbortError";
          let errorContent: string;
          if (isAbort) {
            errorContent = "_(Response cancelled)_";
          } else if (err?.message?.includes("Failed to fetch")) {
            // Fall back to local Falcon Brain when remote bot fails
            const smart = await buildSmartReply(cleanText, state.context, state.messages);
            errorContent = smart.content;
          } else {
            errorContent = `**Error:** ${err?.message || "Could not reach ERP bot."}`;
          }

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId
                ? { ...m, content: errorContent, isStreaming: false, reasoningSteps: plan.steps }
                : m,
            ),
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
          }));
        }
      },
    }),
    {
      name: "falcon-store-v4",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        context: state.context,
        showThinking: state.showThinking,
        messages: state.messages.slice(-50),
      }),
    },
  ),
);

export default useFalconStore;
