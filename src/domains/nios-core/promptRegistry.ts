export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  version: string;
}

const prompts = new Map<string, PromptTemplate>();

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: "system-default",
    name: "Default System Prompt",
    version: "1.0",
    template: "You are a read-only ERP assistant. Never write data directly. Propose actions only.",
  },
  {
    id: "voucher-propose",
    name: "Voucher Proposal",
    version: "1.0",
    template: "Analyze the request and produce a voucher proposal. Do not execute.",
  },
  {
    id: "khata-propose",
    name: "Khata Proposal",
    version: "1.0",
    template: "Analyze the khata entry and produce a proposal for user approval.",
  },
];

for (const prompt of DEFAULT_PROMPTS) {
  prompts.set(prompt.id, prompt);
}

export function registerPrompt(template: PromptTemplate): void {
  prompts.set(template.id, template);
}

export function getPrompt(id: string): PromptTemplate | null {
  return prompts.get(id) ?? null;
}

export function listPrompts(): PromptTemplate[] {
  return Array.from(prompts.values());
}

export function renderPrompt(id: string, vars: Record<string, string> = {}): string {
  const template = getPrompt(id);
  if (!template) return "";
  let rendered = template.template;
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return rendered;
}
