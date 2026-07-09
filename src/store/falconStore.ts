// Falcon AI — Phase 1 Conversation Brain
// Warm, natural, tri-lingual (EN/Devanagari/Romanized Nepali)
// Now with real conversation memory and streaming responses

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  classifyQuestion,
  buildReasoningPlan,
  generateFollowUpSuggestions,
} from "../lib/falcon/chainOfThought";
import type { ThoughtStep, QuestionDomain, QuestionIntent } from "../lib/falcon/chainOfThought";
import { isSelfContainedAi, SELF_CONTAINED_STATUS } from "../lib/selfContainedAi";
import {
  ERP_BOT_URL,
  askErpBot,
  askErpBotStream,
  checkErpBotStatus,
  getErpBotSessionId,
  clearChatSession,
  type ErpBotStatus,
  type RouteInfo,
} from "../lib/erpBotClient";
import {
  askSmartAssistant,
  askSmartAssistantAsync,
  buildErpBotContextBlock,
  type SmartAssistantContext,
} from "../lib/falcon/smartAssistant";
import { getCodebaseStats } from "../lib/falcon/codeStructureParser";
import type { FalconIntent } from "../lib/falcon/intentTaxonomy";

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

const WELCOME_MESSAGE = `नमस्ते! म **Falcon AI** हुँ, Sutra ERP को तपाईंको AI सहायक।

**म के गर्न सक्छु:**
- कुनै पनि ERP module, voucher, वा report बारे जवाफ दिनु
- Step-by-step instructions दिनु
- System को कुनै पनि screen मा navigate गर्न मद्दत गर्नु
- Nepal ko accounting concepts र tax rules explain गर्नु

तपाईं English, नेपाली, वा Romanized Nepali मा सोध्न सक्नुहुन्छ — म सबै बुझ्छु!

**Ke help chahiyo aaja?**`;

const WELCOME_MESSAGE_OFFLINE = `Hi — I'm **Falcon AI**, your ERP assistant for Sutra.

⚠️ **Offline Mode:** The AI backend is not connected. Using built-in rule-based answers (limited).

For full conversational AI with memory, connect the erp_bot service.

**I can still help with:**
- Basic ERP navigation
- Common accounting questions
- Screen locations

Ask me anything!`;

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

  const result = await askSmartAssistantAsync(text, toAssistantContext(context), convo);

  return {
    id: genId(),
    role: "assistant",
    content: result.answer,
    timestamp: new Date(),
    domain: result.mode === "hybrid" ? "web-search" : "erp",
    falconIntent: result.falconIntent,
    sources: result.sources,
    suggestions: result.suggestions,
    isOfflineMode: true,
  };
}

export interface FalconChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  domain?: QuestionDomain;
  intent?: QuestionIntent;
  falconIntent?: FalconIntent;
  reasoningSteps?: ThoughtStep[];
  sources?: string[];
  feedback?: 1 | -1;
  suggestions?: string[];
  isStreaming?: boolean;
  isOfflineMode?: boolean;
  route?: RouteInfo; // Phase 2 — Intent routing info
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
  aiMode: "llm" | "builtin";
  aiModel?: string;
  supportsStreaming: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (ctx: Partial<FalconContext>) => void;
  refreshBotStatus: () => Promise<ErpBotStatus>;
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
      aiMode: "builtin",
      aiModel: undefined,
      supportsStreaming: false,

      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
      setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
      toggleShowThinking: () => set((s) => ({ showThinking: !s.showThinking })),
      rateMessage: (id, rating) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, feedback: rating } : m)),
        })),

      clearHistory: async () => {
        // Clear server-side conversation history
        try {
          await clearChatSession(getErpBotSessionId());
        } catch {
          // Ignore errors
        }

        set({
          messages: [
            {
              id: "welcome",
              role: "assistant",
              content: get().botOnline ? WELCOME_MESSAGE : WELCOME_MESSAGE_OFFLINE,
              timestamp: new Date(),
            },
          ],
          currentThinkingSteps: [],
          isTyping: false,
          isStreaming: false,
        });
      },

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
          aiMode: status.mode,
          aiModel: status.conversationalModel || status.model,
          supportsStreaming: status.streaming ?? false,
        });

        // Update welcome message if status changed
        const state = get();
        if (state.messages.length === 1 && state.messages[0].id === "welcome") {
          const welcomeContent = status.online ? WELCOME_MESSAGE : WELCOME_MESSAGE_OFFLINE;
          if (state.messages[0].content !== welcomeContent) {
            set({
              messages: [
                {
                  id: "welcome",
                  role: "assistant",
                  content: welcomeContent,
                  timestamp: new Date(),
                },
              ],
            });
          }
        }

        return status;
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
        set({
          botOnline: status.online,
          indexedFiles: status.indexedFiles,
          aiMode: status.mode,
          aiModel: status.conversationalModel || status.model,
          supportsStreaming: status.streaming ?? false,
        });

        // Use offline fallback if bot is not online
        if (isSelfContainedAi() || !status.online || status.mode === "builtin") {
          const smartMsg = await buildSmartReply(cleanText, state.context, state.messages);
          set((s) => ({
            messages: [...s.messages, smartMsg],
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
          }));
          return;
        }

        // Online mode — use LLM with streaming if supported
        const { classifyIntent } = await import("../lib/falcon/intentTaxonomy");
        const falconIntent = classifyIntent(cleanText);

        const classification = classifyQuestion(cleanText, state.context.route);
        const plan = buildReasoningPlan(
          cleanText,
          classification.domain,
          classification.intent,
          state.context.route,
        );
        set({ currentThinkingSteps: plan.steps });

        const contextBlock = buildErpBotContextBlock(toAssistantContext(state.context));
        const abortController = createController();
        const assistantId = genId();

        // Create placeholder message for streaming
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
              falconIntent,
            },
          ],
          isStreaming: true,
        }));

        // Use streaming if supported, otherwise fall back to regular request
        if (status.streaming) {
          try {
            let streamedContent = "";

            await askErpBotStream(
              cleanText,
              getErpBotSessionId(),
              (chunk) => {
                streamedContent += chunk;
                set((s) => ({
                  messages: s.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: streamedContent } : m,
                  ),
                }));
              },
              () => {
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
                          content: streamedContent,
                          isStreaming: false,
                          reasoningSteps: plan.steps,
                          suggestions: followUps,
                          falconIntent,
                        }
                      : m,
                  ),
                  isTyping: false,
                  isStreaming: false,
                  currentThinkingSteps: [],
                }));
              },
              (error) => {
                // On streaming error, fall back to offline mode
                console.error("Streaming error:", error);
                buildSmartReply(cleanText, state.context, state.messages).then((smart) => {
                  set((s) => ({
                    messages: s.messages.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            content: smart.content,
                            isStreaming: false,
                            isOfflineMode: true,
                            reasoningSteps: plan.steps,
                          }
                        : m,
                    ),
                    isTyping: false,
                    isStreaming: false,
                    currentThinkingSteps: [],
                  }));
                });
              },
              abortController.signal,
            );
          } catch (err: any) {
            if (err?.name === "AbortError") {
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: "_(Response cancelled)_", isStreaming: false }
                    : m,
                ),
                isTyping: false,
                isStreaming: false,
                currentThinkingSteps: [],
              }));
            }
          }
        } else {
          // Non-streaming fallback
          try {
            const result = await askErpBot(
              cleanText,
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
                      falconIntent,
                      route: result.route, // Phase 2 — Include route info
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
        }
      },
    }),
    {
      name: "falcon-store-v5",
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
