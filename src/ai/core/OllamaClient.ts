/** SUTRA AI — Ollama API wrapper with streaming support */

import { resolveErpBotUrl } from "@/lib/erpBotClient";
import type { ChatOptions, OllamaConfig, OllamaMessage } from "../types";

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: resolveErpBotUrl() || "http://localhost:11434",
  model: "qwen3:32b",
  contextLength: 32768,
  temperature: 0.3,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  numPredict: -1,
  numCtx: 32768,
};

export class OllamaClient {
  private config: OllamaConfig;
  private healthCache: { result: { online: boolean; model?: string; error?: string }; at: number } | null = null;
  private static HEALTH_TTL_MS = 60_000;

  constructor(config?: Partial<OllamaConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getConfig(): OllamaConfig {
    return { ...this.config };
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  async checkHealth(): Promise<{ online: boolean; model?: string; error?: string }> {
    if (
      this.healthCache &&
      Date.now() - this.healthCache.at < OllamaClient.HEALTH_TTL_MS
    ) {
      return this.healthCache.result;
    }

    const result = await this.fetchHealth();
    this.healthCache = { result, at: Date.now() };
    return result;
  }

  invalidateHealthCache(): void {
    this.healthCache = null;
  }

  private async fetchHealth(): Promise<{ online: boolean; model?: string; error?: string }> {
    const erpBotUrl = resolveErpBotUrl();
    if (erpBotUrl) {
      try {
        const resp = await fetch(`${erpBotUrl}/status`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return { online: false, error: `HTTP ${resp.status}` };
        const data = await resp.json();
        const ollamaOk = data.ollama === "connected";
        return {
          online: ollamaOk,
          model: data.model ?? this.config.model,
          error: ollamaOk ? undefined : "Ollama not connected",
        };
      } catch (e: unknown) {
        return { online: false, error: e instanceof Error ? e.message : "Unreachable" };
      }
    }

    try {
      const resp = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return { online: false, error: `HTTP ${resp.status}` };
      const data = await resp.json();
      const models = (data.models ?? []).map((m: { name: string }) => m.name);
      const hasModel = models.some((m: string) => m.startsWith(this.config.model.split(":")[0]));
      return { online: true, model: this.config.model, error: hasModel ? undefined : "Model not found" };
    } catch (e: unknown) {
      return { online: false, error: e instanceof Error ? e.message : "Ollama unreachable" };
    }
  }

  async chat(messages: OllamaMessage[], options?: ChatOptions): Promise<string> {
    const erpBotUrl = resolveErpBotUrl();
    if (erpBotUrl) {
      return this.chatViaErpBot(messages, erpBotUrl, options);
    }
    return this.chatDirect(messages, options);
  }

  private async chatViaErpBot(
    messages: OllamaMessage[],
    erpBotUrl: string,
    options?: ChatOptions,
  ): Promise<string> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const system = messages.find((m) => m.role === "system");

    const resp = await fetch(`${erpBotUrl}/khata/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: lastUser?.content ?? "",
        system_prompt: system?.content,
        session_id: "sutra-ai",
        temperature: options?.temperature ?? this.config.temperature,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!resp.ok) throw new Error(`erp_bot chat failed: HTTP ${resp.status}`);
    const data = await resp.json();
    return data.reply ?? data.message ?? "";
  }

  private async chatDirect(messages: OllamaMessage[], options?: ChatOptions): Promise<string> {
    const resp = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? this.config.temperature,
          top_p: this.config.topP,
          top_k: this.config.topK,
          repeat_penalty: this.config.repeatPenalty,
          num_ctx: this.config.numCtx,
          seed: this.config.seed,
        },
        format: options?.format,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!resp.ok) throw new Error(`Ollama chat failed: HTTP ${resp.status}`);
    const data = await resp.json();
    return data.message?.content ?? "";
  }

  async streamChat(
    messages: OllamaMessage[],
    onChunk: (chunk: string) => void,
    options?: ChatOptions,
  ): Promise<void> {
    const resp = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
        options: {
          temperature: options?.temperature ?? this.config.temperature,
          top_p: this.config.topP,
          top_k: this.config.topK,
          repeat_penalty: this.config.repeatPenalty,
          num_ctx: this.config.numCtx,
        },
      }),
    });

    if (!resp.ok || !resp.body) throw new Error(`Ollama stream failed: HTTP ${resp.status}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content;
          if (content) onChunk(content);
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const resp = await fetch(`${this.config.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.config.model, prompt: text }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) throw new Error(`Embedding failed: HTTP ${resp.status}`);
    const data = await resp.json();
    return data.embedding ?? [];
  }
}

export const defaultOllamaClient = new OllamaClient();
