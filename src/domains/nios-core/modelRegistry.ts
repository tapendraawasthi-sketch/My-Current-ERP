export interface ModelDescriptor {
  id: string;
  provider: string;
  modelName: string;
  costTier: 0 | 1 | 2 | 3 | 4 | 5;
  maxTokens: number;
  supportsReasoning: boolean;
}

const models = new Map<string, ModelDescriptor>();

const DEFAULT_MODELS: ModelDescriptor[] = [
  { id: "ollama-local", provider: "ollama", modelName: "llama3", costTier: 0, maxTokens: 4096, supportsReasoning: false },
  { id: "openai-gpt4", provider: "openai", modelName: "gpt-4", costTier: 3, maxTokens: 8192, supportsReasoning: true },
  { id: "anthropic-claude", provider: "anthropic", modelName: "claude-3", costTier: 3, maxTokens: 8192, supportsReasoning: true },
];

for (const model of DEFAULT_MODELS) {
  models.set(model.id, model);
}

export function registerModel(descriptor: ModelDescriptor): void {
  models.set(descriptor.id, descriptor);
}

export function getModel(id: string): ModelDescriptor | null {
  return models.get(id) ?? null;
}

export function listModels(): ModelDescriptor[] {
  return Array.from(models.values());
}
