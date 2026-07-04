// src/store/falconStore.ts
// Falcon AI — Zustand Store with Streaming, Chain-of-Thought, and Web Search
// Replaces the original falconStore.ts entirely.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  classifyQuestion,
  buildReasoningPlan,
  generateFollowUpSuggestions,
  buildEnhancedUserMessage,
} from "../lib/falcon/chainOfThought";
import type { ThoughtStep, QuestionDomain, QuestionIntent } from "../lib/falcon/chainOfThought";
import { buildMasterSystemPrompt } from "../lib/falcon/masterSystemPrompt";
import { getModuleContext } from "../lib/falcon/erpCodeKnowledge";
import { searchWeb, formatSearchResultsForLLM } from "../lib/falcon/searchService";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Best)", recommended: true },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Fast)" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B (Balanced)" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B (Efficient)" },
] as const;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const WELCOME_MESSAGE = `🦅 Hello! I'm **Falcon AI**, your intelligent reasoning assistant for Sutra ERP.

✅ **ERP Expert** — Step-by-step guidance for any module
✅ **Accounting Teacher** — Concepts, formulas, Nepal tax rules
✅ **Web Search** — Live internet data when you need it
✅ **General Knowledge** — Science, math, history, daily life
✅ **Streaming Responses** — Real-time answers as I think

Powered by **Llama 3.3 70B** via Groq. Set your API key in ⚙️ Settings.

What would you like to know?`;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL AbortController (avoids Zustand serialization issues)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// ID GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface FalconChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  domain?: QuestionDomain;
  intent?: QuestionIntent;
  reasoningSteps?: ThoughtStep[];
  webSearchUsed?: boolean;
  searchQuery?: string;
  feedback?: 1 | -1;
  suggestions?: string[];
  isStreaming?: boolean;
  streamBuffer?: string;
}

export interface FalconContext {
  route?: string;
  screenTitle?: string;
  companyName?: string;
  userName?: string;
}

export interface FalconState {
  // ── UI State ────────────────────────────────────────────────────────────
  isOpen: boolean;
  isTyping: boolean;
  isStreaming: boolean;
  showThinking: boolean;

  // ── Conversation ────────────────────────────────────────────────────────
  messages: FalconChatMessage[];
  currentThinkingSteps: ThoughtStep[];
  streamingContent: string;

  // ── Config ──────────────────────────────────────────────────────────────
  context: FalconContext;
  apiKey: string;
  apiEndpoint: string;
  model: string;

  // ── Actions ──────────────────────────────────────────────────────────────
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (ctx: Partial<FalconContext>) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  sendMessage: (text: string) => Promise<void>;
  rateMessage: (id: string, rating: 1 | -1) => void;
  clearHistory: () => void;
  toggleShowThinking: () => void;
  cancelStream: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK RESPONSE (no API key)
// ─────────────────────────────────────────────────────────────────────────────

function buildFallbackResponse(query: string, domain: QuestionDomain, route?: string): string {
  const routeCtx = route ? ` You appear to be on the **${route}** page.` : "";

  if (domain === "greeting") {
    return WELCOME_MESSAGE;
  }

  if (domain === "erp") {
    const moduleCtx = route ? getModuleContext(route) : "";
    return (
      `I'd love to give you a detailed answer about **${query}**, but I need a Groq API key to power my full reasoning.nn` +
      `${moduleCtx ? `Here is what I know about the current page:nn${moduleCtx}nn` : ""}` +
      `🔑 **To enable Falcon AI:**n` +
      `1. Visit [console.groq.com](https://console.groq.com) (free)n` +
      `2. Create a free account and generate an API keyn` +
      `3. Open Falcon settings (⚙️ icon) and paste your keynn` +
      `Once configured, I can give you step-by-step ERP guidance, accounting help, web search, and much more!`
    );
  }

  return (
    `I need a Groq API key to answer **"${query}"** fully.${routeCtx}nn` +
    `Get your free key at [console.groq.com](https://console.groq.com), then add it in Falcon settings (⚙️).`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useFalconStore = create<FalconState>()(
  persist(
    (set, get) => ({
      // ── Initial State ────────────────────────────────────────────────────
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
      streamingContent: "",
      context: {},
      apiKey: "",
      apiEndpoint: GROQ_ENDPOINT,
      model: "llama-3.3-70b-versatile",

      // ── Simple Actions ───────────────────────────────────────────────────
      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set((s) => ({ isOpen: !s.isOpen })),
      setContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
      setApiKey: (key) => set({ apiKey: key.trim() }),
      setModel: (model) => set({ model }),
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
          streamingContent: "",
          isTyping: false,
          isStreaming: false,
        }),
      cancelStream: () => {
        abortActive();
        set({
          isTyping: false,
          isStreaming: false,
          currentThinkingSteps: [],
          streamingContent: "",
        });
      },

      // ── sendMessage — The Core Action ─────────────────────────────────────
      sendMessage: async (text: string) => {
        const state = get();
        const cleanText = text.trim();
        if (!cleanText || state.isTyping) return;

        // ── STEP 1: Add user message ────────────────────────────────────────
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
          streamingContent: "",
        }));

        // ── STEP 2: Chain-of-thought classification ─────────────────────────
        const classification = classifyQuestion(cleanText, state.context.route);
        const plan = buildReasoningPlan(
          cleanText,
          classification.domain,
          classification.intent,
          state.context.route,
        );

        // Show thinking steps immediately
        set({ currentThinkingSteps: plan.steps });

        // Artificial delay so user can see thinking steps animate
        await new Promise((r) => setTimeout(r, 500));

        // ── STEP 3: Web search (conditional) ────────────────────────────────
        let webSearchResults: string | undefined;
        let webSearchUsed = false;
        let usedSearchQuery: string | undefined;

        if (plan.shouldSearchWeb && plan.searchQuery) {
          // Update last thinking step visually
          set((s) => {
            const steps = [...s.currentThinkingSteps];
            if (steps.length > 0) {
              steps[steps.length - 1] = {
                ...steps[steps.length - 1],
                title: "🌐 Searching the web…",
              };
            }
            return { currentThinkingSteps: steps };
          });

          try {
            const searchResponse = await searchWeb(plan.searchQuery, {
              maxResults: 4,
              timeoutMs: 6000,
            });
            webSearchResults = formatSearchResultsForLLM(searchResponse);
            webSearchUsed = searchResponse.results.length > 0;
            usedSearchQuery = plan.searchQuery;
          } catch {
            // Non-fatal — proceed without web results
          }
        }

        // ── STEP 4 & 6: Build system prompt and enhanced user message ────────
        const systemPrompt = buildMasterSystemPrompt({
          currentRoute: state.context.route,
          questionCategory: classification.domain,
          webSearchResults: webSearchResults,
          companyName: state.context.companyName,
          userName: state.context.userName,
          conversationTurnCount: Math.floor(state.messages.filter((m) => m.role === "user").length),
          hasApiKey: !!state.apiKey,
        });

        const enhancedUserMessage = buildEnhancedUserMessage(cleanText, plan, {
          route: state.context.route,
          webResults: webSearchResults,
        });

        // ── STEP 5: Build conversation history (last 10 messages) ────────────
        const conversationHistory = state.messages
          .filter((m) => m.role !== "system" && m.id !== "welcome")
          .slice(-10)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        // ── STEP 7: API Call (with streaming or fallback) ────────────────────
        if (!state.apiKey) {
          // ── No API key: use fallback response ─────────────────────────────
          const fallback = buildFallbackResponse(
            cleanText,
            classification.domain,
            state.context.route,
          );
          const fallbackMsg: FalconChatMessage = {
            id: genId(),
            role: "assistant",
            content: fallback,
            timestamp: new Date(),
            domain: classification.domain,
            intent: classification.intent,
            reasoningSteps: plan.steps,
            suggestions: generateFollowUpSuggestions(
              cleanText,
              classification.domain,
              state.context.route,
            ),
          };
          set((s) => ({
            messages: [...s.messages, fallbackMsg],
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
          }));
          return;
        }

        // ── Streaming API call ────────────────────────────────────────────────
        const abortController = createController();
        const assistantId = genId();

        // Add placeholder streaming message immediately
        const placeholderMsg: FalconChatMessage = {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true,
          domain: classification.domain,
          intent: classification.intent,
          webSearchUsed,
          searchQuery: usedSearchQuery,
        };
        set((s) => ({
          messages: [...s.messages, placeholderMsg],
          isStreaming: true,
        }));

        try {
          const response = await fetch(state.apiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${state.apiKey}`,
            },
            body: JSON.stringify({
              model: state.model || "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: systemPrompt },
                ...conversationHistory,
                { role: "user", content: enhancedUserMessage },
              ],
              max_tokens: 1500,
              temperature: classification.domain === "erp" ? 0.3 : 0.7,
              stream: true,
            }),
            signal: abortController.signal,
          });

          // ── Handle non-200 responses ───────────────────────────────────────
          if (!response.ok) {
            let errorMsg: string;
            if (response.status === 401) {
              errorMsg =
                "❌ **Invalid API key.** Please check your Groq API key in settings. Get a free key at [console.groq.com](https://console.groq.com).";
            } else if (response.status === 429) {
              errorMsg =
                "⏳ **Rate limit reached.** You've hit Groq's rate limit. Please wait a moment and try again.";
            } else if (response.status === 400) {
              errorMsg =
                "⚠️ **Request error.** The model may not support the current request. Try switching to a different model in settings.";
            } else {
              errorMsg = `❌ **API Error ${response.status}.** Please try again or check your settings.`;
            }
            set((s) => ({
              messages: s.messages.map((m) =>
                m.id === assistantId ? { ...m, content: errorMsg, isStreaming: false } : m,
              ),
              isTyping: false,
              isStreaming: false,
              currentThinkingSteps: [],
            }));
            return;
          }

          if (!response.body) {
            throw new Error("Response body is null — streaming not supported");
          }

          // ── SSE Stream Parsing ─────────────────────────────────────────────
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("n").filter((l) => l.startsWith("data: "));

            for (const line of lines) {
              const data = line.replace(/^data:s*/, "").trim();
              if (data === "[DONE]") break;
              if (!data) continue;

              try {
                const parsed = JSON.parse(data);
                const delta: string = parsed?.choices?.[0]?.delta?.content || "";
                if (delta) {
                  fullContent += delta;
                  // Real-time update of the streaming message
                  set((s) => ({
                    messages: s.messages.map((m) =>
                      m.id === assistantId ? { ...m, content: fullContent } : m,
                    ),
                    streamingContent: fullContent,
                  }));
                }
              } catch {
                // Malformed SSE chunk — skip silently
                continue;
              }
            }
          }

          // ── Finalize the streamed message ──────────────────────────────────
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
                    content: fullContent || "_(No response received — please try again)_",
                    isStreaming: false,
                    reasoningSteps: plan.steps,
                    suggestions: followUps,
                  }
                : m,
            ),
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
            streamingContent: "",
          }));
        } catch (err: any) {
          const isAbort = err?.name === "AbortError";
          const errorContent = isAbort
            ? "_(Response cancelled by user)_"
            : err?.message?.includes("Failed to fetch")
              ? "❌ **Network error.** Please check your internet connection and try again."
              : `❌ **Error:** ${err?.message || "An unexpected error occurred."}`;

          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: errorContent, isStreaming: false } : m,
            ),
            isTyping: false,
            isStreaming: false,
            currentThinkingSteps: [],
            streamingContent: "",
          }));
        }
      },
    }),

    // ── Persistence config ─────────────────────────────────────────────────
    {
      name: "falcon-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        apiKey: state.apiKey,
        context: state.context,
        model: state.model,
        showThinking: state.showThinking,
        // Persist last 50 messages
        messages: state.messages.slice(-50),
      }),
    },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// Named re-export for backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

export default useFalconStore;
