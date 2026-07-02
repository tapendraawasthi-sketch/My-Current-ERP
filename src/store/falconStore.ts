import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { 
  classifyQuestion, 
  buildReasoningChain, 
  shouldSearchWeb, 
  extractSearchQuery, 
  generateFollowUps, 
  analyzeERPContext,
  type QuestionCategory, 
  type ReasoningStep, 
  type ReasoningResult 
} from '../lib/falconReasoning';
import { searchWeb, formatSearchResults } from '../lib/falconWebSearch';
import { 
  buildSystemPrompt, 
  buildUserMessage, 
  buildConversationHistory,
  getDefaultLLMConfig, 
  getERPSpecificConfig,
  type FalconMessage 
} from '../lib/falconPromptBuilder';
import { ERP_MODULE_KNOWLEDGE, ACCOUNTING_CONCEPTS } from '../lib/falconKnowledge';

export interface FalconChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  category?: QuestionCategory;
  reasoningSteps?: ReasoningStep[];
  webSearchUsed?: boolean;
  searchQuery?: string;
  feedback?: 1 | -1;
  suggestions?: string[];
  isThinking?: boolean;
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
  showThinking: boolean;
  messages: FalconChatMessage[];
  currentThinkingSteps: ReasoningStep[];
  context: FalconContext;
  apiKey: string;
  apiEndpoint: string;
  
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setContext: (ctx: Partial<FalconContext>) => void;
  setApiKey: (key: string) => void;
  sendMessage: (text: string) => Promise<void>;
  rateMessage: (id: string, rating: 1 | -1) => void;
  clearHistory: () => void;
  toggleShowThinking: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const INITIAL_WELCOME: FalconChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 Hello! I'm **Falcon AI**, your intelligent assistant for Sutra ERP.

I can help you with:
• 📊 **ERP Tasks** — invoices, vouchers, reports, inventory, VAT
• 📚 **Accounting** — concepts, calculations, best practices  
• 🌐 **General Questions** — science, math, history, daily life
• 🔍 **Web Search** — I can search the web for current information

What would you like to know?`,
  timestamp: new Date(),
  suggestions: [
    'How do I create a sales invoice?',
    'What is double-entry bookkeeping?',
    'Search for Nepal tax updates 2024'
  ]
};

function getInitialApiKey() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('falcon_api_key');
    if (saved) return saved;
  }
  // @ts-ignore
  return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_GROQ_API_KEY || '' : '';
}

function buildFallbackResponse(text: string, category: QuestionCategory, route: string = ''): string {
  if (category === 'erp-how-to' || category === 'erp-explain') {
    const safeRoute = route || 'dashboard';
    const module = ERP_MODULE_KNOWLEDGE[safeRoute];
    if (module) {
      return `Here is some information about the **${safeRoute}** module:\n\n` +
             `${module.description}\n\n**How to use:**\n- ` + module.howToUse.join('\n- ') +
             `\n\n*(Note: Set your Groq API key in settings for full conversational capability)*`;
    }
    return `I am currently in fallback mode (API key not set). Please provide an API key in the settings to get detailed ERP assistance.`;
  }
  if (category === 'accounting-concept') {
    // try to find a matching concept
    const found = Object.entries(ACCOUNTING_CONCEPTS).find(([k]) => text.toLowerCase().includes(k.toLowerCase()));
    if (found) {
      return `**${found[0]}**: ${found[1]}\n\n*(Note: Set API key for deeper explanations)*`;
    }
    return `I am in fallback mode. I know about terms like debit, credit, VAT, etc. Set your API key for full capabilities.`;
  }
  if (category === 'greeting') {
    return `Hello! I am Falcon AI. Please set your API key in the settings to enable my full intelligence!`;
  }
  if (category === 'math-calculation') {
    try {
      // Basic math extraction and eval
      const expression = text.replace(/[^0-9\+\-\*\/\(\)\.]/g, '');
      if (expression) {
        // eslint-disable-next-line no-eval
        const result = eval(expression);
        return `The result is **${result}**.\n\n*(Calculated via fallback logic)*`;
      }
    } catch {
      // ignore
    }
    return "I couldn't calculate that in fallback mode.";
  }
  
  return `Please set your Groq API key in settings to unlock my full reasoning and search capabilities!`;
}

export const useFalconStore = create<FalconState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      isTyping: false,
      showThinking: false,
      messages: [INITIAL_WELCOME],
      currentThinkingSteps: [],
      context: {},
      apiKey: getInitialApiKey(),
      apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',

      openPanel: () => set({ isOpen: true }),
      closePanel: () => set({ isOpen: false }),
      togglePanel: () => set(state => ({ isOpen: !state.isOpen })),
      
      setContext: (ctx) => set(state => ({ context: { ...state.context, ...ctx } })),
      
      setApiKey: (key) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('falcon_api_key', key);
        }
        set({ apiKey: key });
      },

      toggleShowThinking: () => set(state => ({ showThinking: !state.showThinking })),

      rateMessage: (id, rating) => set(state => ({
        messages: state.messages.map(m => m.id === id ? { ...m, feedback: rating } : m)
      })),

      clearHistory: () => set({ messages: [{ ...INITIAL_WELCOME, timestamp: new Date() }] }),

      sendMessage: async (text: string) => {
        const cleanText = text.trim();
        if (!cleanText) return;

        const userMsg: FalconChatMessage = {
          id: generateId(),
          role: 'user',
          content: cleanText,
          timestamp: new Date()
        };

        set(state => ({
          messages: [...state.messages, userMsg],
          isTyping: true,
          currentThinkingSteps: []
        }));

        const state = get();
        const route = state.context.route || '';
        
        let assistantMsg: FalconChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: '',
          timestamp: new Date()
        };

        try {
          // Reason & Plan
          const category = classifyQuestion(cleanText, route);
          assistantMsg.category = category;
          
          const steps = buildReasoningChain(cleanText, category, route);
          set({ currentThinkingSteps: steps });
          assistantMsg.reasoningSteps = steps;

          // Web Search if needed
          let webSearchResults = '';
          if (shouldSearchWeb(cleanText, category)) {
            assistantMsg.webSearchUsed = true;
            const sq = extractSearchQuery(cleanText, category);
            assistantMsg.searchQuery = sq;
            const searchRes = await searchWeb(sq);
            webSearchResults = formatSearchResults(searchRes);
          }

          // Generate response
          if (!state.apiKey) {
            assistantMsg.content = buildFallbackResponse(cleanText, category, route);
          } else {
            const systemPrompt = buildSystemPrompt({
              currentRoute: route,
              category,
              webSearchResults,
              companyName: state.context.companyName
            });

            const config = category.startsWith('erp') ? getERPSpecificConfig() : getDefaultLLMConfig();
            
            // Build history
            const coreMessages = state.messages.map(m => ({ role: m.role as string, content: m.content }));
            const userPrompt = buildUserMessage(cleanText, steps, { currentRoute: route });
            
            const reqMessages = [
              { role: 'system', content: systemPrompt },
              ...buildConversationHistory(coreMessages, 8),
              { role: 'user', content: userPrompt }
            ];

            const response = await fetch(state.apiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.apiKey}`
              },
              body: JSON.stringify({
                model: config.model,
                messages: reqMessages,
                max_tokens: config.maxTokens,
                temperature: config.temperature
              })
            });

            if (!response.ok) {
              if (response.status === 401) {
                assistantMsg.content = "Please set your Groq API key in settings (or check if it is correct).";
              } else if (response.status === 429) {
                assistantMsg.content = "I've reached my request limit. Please try again in a moment.";
              } else {
                assistantMsg.content = `API error: ${response.statusText}`;
              }
            } else {
              const data = await response.json();
              assistantMsg.content = data.choices?.[0]?.message?.content || "No response generated.";
            }
          }

          // Followups
          assistantMsg.suggestions = generateFollowUps(cleanText, category, route);

        } catch (error: any) {
          console.error("Falcon sendMessage error:", error);
          assistantMsg.content = "I'm having trouble connecting or processing your request. Please check your internet or try again.";
        } finally {
          set(state => ({
            messages: [...state.messages, assistantMsg],
            isTyping: false,
            currentThinkingSteps: []
          }));
        }
      }
    }),
    {
      name: 'falcon-store-persist',
      partialize: (state) => ({
        context: state.context,
        apiKey: state.apiKey
      }),
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);


