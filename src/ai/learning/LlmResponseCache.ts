/** SUTRA AI — offline LLM response cache (IndexedDB) */

import { sutraAiDb, type CachedLlmEntry } from "./SutraAiDexie";
import type { AIResponse } from "../types";

export type { CachedLlmEntry };

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 80;

function cacheKey(input: string, intent: string): string {
  return `${intent}:${input.trim().toLowerCase().slice(0, 240)}`;
}

export class LlmResponseCache {
  private memory = new Map<string, Partial<AIResponse>>();
  private sessionHits = 0;
  private sessionMisses = 0;

  private static COUNT_KEY = "sutra:llm-cache-hits";
  private static MISS_KEY = "sutra:llm-cache-misses";
  private static HISTORY_KEY = "sutra:llm-cache-history";

  private appendHistory(hit: 0 | 1): void {
    try {
      const raw = localStorage.getItem(LlmResponseCache.HISTORY_KEY);
      const arr: number[] = raw ? (JSON.parse(raw) as number[]) : [];
      arr.push(hit);
      while (arr.length > 16) arr.shift();
      localStorage.setItem(LlmResponseCache.HISTORY_KEY, JSON.stringify(arr));
    } catch {
      /* ignore */
    }
  }

  getHitHistory(): number[] {
    try {
      const raw = localStorage.getItem(LlmResponseCache.HISTORY_KEY);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }

  recordHit(): void {
    this.sessionHits += 1;
    this.appendHistory(1);
    try {
      const prev = Number(localStorage.getItem(LlmResponseCache.COUNT_KEY) ?? "0");
      localStorage.setItem(LlmResponseCache.COUNT_KEY, String(prev + 1));
    } catch {
      /* ignore */
    }
  }

  recordMiss(): void {
    this.sessionMisses += 1;
    this.appendHistory(0);
    try {
      const prev = Number(localStorage.getItem(LlmResponseCache.MISS_KEY) ?? "0");
      localStorage.setItem(LlmResponseCache.MISS_KEY, String(prev + 1));
    } catch {
      /* ignore */
    }
  }

  getHitRate(): { hits: number; misses: number; rate: number } {
    try {
      const hits =
        Number(localStorage.getItem(LlmResponseCache.COUNT_KEY) ?? "0") + this.sessionHits;
      const misses =
        Number(localStorage.getItem(LlmResponseCache.MISS_KEY) ?? "0") + this.sessionMisses;
      const total = hits + misses;
      return { hits, misses, rate: total > 0 ? hits / total : 0 };
    } catch {
      const total = this.sessionHits + this.sessionMisses;
      return {
        hits: this.sessionHits,
        misses: this.sessionMisses,
        rate: total > 0 ? this.sessionHits / total : 0,
      };
    }
  }

  async get(input: string, intent: string): Promise<Partial<AIResponse> | null> {
    const key = cacheKey(input, intent);
    const mem = this.memory.get(key);
    if (mem) return mem;

    try {
      const row = await sutraAiDb.llmCache?.get(key);
      if (!row) return null;
      if (Date.now() - row.cachedAt > MAX_AGE_MS) {
        await sutraAiDb.llmCache?.delete(key);
        return null;
      }
      const parsed = JSON.parse(row.responseJson) as Partial<AIResponse>;
      this.memory.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async set(input: string, intent: string, response: Partial<AIResponse>): Promise<void> {
    const key = cacheKey(input, intent);
    this.memory.set(key, response);
    try {
      await sutraAiDb.llmCache?.put({
        key,
        input: input.slice(0, 300),
        intent,
        responseJson: JSON.stringify(response),
        cachedAt: Date.now(),
      });
      const count = await sutraAiDb.llmCache?.count();
      if (count != null && count > MAX_ENTRIES) {
        const old = await sutraAiDb.llmCache?.orderBy("cachedAt").limit(count - MAX_ENTRIES).toArray();
        for (const row of old ?? []) {
          await sutraAiDb.llmCache?.delete(row.key);
        }
      }
    } catch {
      /* ignore cache write errors */
    }
  }

  async getStats(): Promise<{ count: number; newestAt?: number; oldestAt?: number }> {
    try {
      const count = (await sutraAiDb.llmCache?.count()) ?? this.memory.size;
      const rows = await sutraAiDb.llmCache?.orderBy("cachedAt").toArray();
      if (!rows?.length) {
        return { count: Math.max(count, this.memory.size) };
      }
      return {
        count: rows.length,
        oldestAt: rows[0]?.cachedAt,
        newestAt: rows[rows.length - 1]?.cachedAt,
      };
    } catch {
      return { count: this.memory.size };
    }
  }

  async clear(): Promise<number> {
    try {
      const count = (await sutraAiDb.llmCache?.count()) ?? 0;
      await sutraAiDb.llmCache?.clear();
      this.memory.clear();
      localStorage.removeItem(LlmResponseCache.COUNT_KEY);
      localStorage.removeItem(LlmResponseCache.MISS_KEY);
      localStorage.removeItem(LlmResponseCache.HISTORY_KEY);
      this.sessionHits = 0;
      this.sessionMisses = 0;
      return count;
    } catch {
      const n = this.memory.size;
      this.memory.clear();
      return n;
    }
  }
}

export const llmResponseCache = new LlmResponseCache();
