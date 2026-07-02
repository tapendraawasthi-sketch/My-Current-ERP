import { ERP_MODULE_KNOWLEDGE, ACCOUNTING_CONCEPTS, KEYBOARD_SHORTCUTS } from './falconKnowledge';
import type { QuestionCategory, ReasoningStep } from './falconReasoning';

export interface FalconMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  stream?: boolean;
}

export function buildSystemPrompt(options: {
  currentRoute?: string;
  category: QuestionCategory;
  webSearchResults?: string;
  companyName?: string;
}): string {
  const { currentRoute, category, webSearchResults, companyName } = options;
  const company = companyName ? companyName : "this organization";

  let prompt = `You are Falcon AI, an advanced intelligent assistant embedded in Sutra ERP (an accounting and business management system). You were created to help users with ${company} accounting tasks AND answer any general question.

You have THREE modes of operation:
MODE 1 — ERP EXPERT: For questions about the accounting system, invoices, vouchers, ledgers, reports, inventory, payroll, VAT, etc. Give step-by-step guidance.
MODE 2 — ACCOUNTING TEACHER: For questions about accounting concepts, financial terms, business principles. Explain clearly with examples.
MODE 3 — GENERAL ASSISTANT: For ALL other questions (science, history, math, cooking, health, technology, daily life). Answer helpfully and accurately. You are NOT restricted to only ERP topics. Help with everything.

--- ERP KNOWLEDGE ---
`;

  // Inject route-specific knowledge if available
  if (currentRoute && ERP_MODULE_KNOWLEDGE[currentRoute]) {
    const module = ERP_MODULE_KNOWLEDGE[currentRoute];
    prompt += `\nCurrent Module Context (${currentRoute}):\n`;
    prompt += `Description: ${module.description}\n`;
    prompt += `How to use: ${module.howToUse.join(" ")}\n`;
    prompt += `Key Features: ${module.keyFeatures.join(", ")}\n`;
  }

  // Inject general accounting concepts
  prompt += `\nAccounting Concepts Summary:\n`;
  Object.entries(ACCOUNTING_CONCEPTS).forEach(([key, value]) => {
    prompt += `- ${key}: ${value}\n`;
  });

  prompt += `\n--- REASONING INSTRUCTIONS ---
When answering complex questions, think step by step:
1. First understand exactly what is being asked
2. Identify what type of question it is (Current Category: ${category})
3. Recall relevant knowledge
4. Form your answer logically
5. Check if your answer is complete and accurate

For ERP questions: Always mention which menu/page to go to, what fields to fill, and what to expect as result.
For general questions: Be accurate, concise, and helpful. Use examples when useful.
`;

  if (webSearchResults) {
    prompt += `\n--- WEB SEARCH RESULTS ---
I found this real-time information from the web:
${webSearchResults}
Use this information to answer the user's question accurately.
`;
  }

  prompt += `\n--- RESPONSE FORMAT ---
Format your response as:
- Use clear headings with ** for bold
- Use numbered lists for steps
- Use bullet points for features/options
- Keep responses focused (not too long unless detail is needed)
- End ERP answers with 1-2 quick tips
- End general answers naturally

--- KEYBOARD SHORTCUTS ---
Here are some helpful shortcuts you can mention if relevant:
F2=Save, F3=New, F4=Narration, F5=Refresh, F6=Change Voucher Type, Ctrl+G=Global Search, Ctrl+/=Toggle Falcon.

--- BOUNDARIES ---
You can answer ANY question. Never say 'I can only answer ERP questions'.
If a question is completely unrelated to ERP and you don't know the answer, say so honestly and offer to help find it.
`;

  return prompt;
}

export function buildUserMessage(query: string, reasoningSteps: ReasoningStep[], context?: { currentRoute?: string }): string {
  let message = '';
  
  if (context?.currentRoute) {
    message += `[System Context: The user is currently on the '${context.currentRoute}' page.]\n\n`;
  }

  if (reasoningSteps.length > 0) {
    message += `[My Reasoning Process before answering]:\n`;
    reasoningSteps.forEach(step => {
      message += `- Step ${step.stepNumber}: ${step.title}. Conclusion: ${step.conclusion}\n`;
    });
    message += `\n`;
  }

  message += `User Query: ${query}`;
  return message;
}

export function buildConversationHistory(messages: Array<{ role: string; content: string }>, maxMessages: number = 8): FalconMessage[] {
  // Ensure we only grab the last N messages
  const recent = messages.slice(-maxMessages);
  return recent.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant',
    content: m.content
  }));
}

export function getDefaultLLMConfig(): LLMConfig {
  return {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    temperature: 0.7,
    maxTokens: 1024,
    stream: false
  };
}

export function getERPSpecificConfig(): LLMConfig {
  return {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    temperature: 0.3, // Lower temp for precise instructions
    maxTokens: 1024,
    stream: false
  };
}

export function getCreativeConfig(): LLMConfig {
  return {
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    temperature: 0.8, // Higher temp for creative answers
    maxTokens: 2048,
    stream: false
  };
}
