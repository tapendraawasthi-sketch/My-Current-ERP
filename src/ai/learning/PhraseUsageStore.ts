/** SUTRA AI — phrase usage tracking for autocomplete ranking */

import { sutraAiDb } from "./SutraAiDexie";

export class PhraseUsageStore {
  async record(phrase: string): Promise<void> {
    const normalized = phrase.trim().toLowerCase();
    if (normalized.length < 4) return;

    const existing = await sutraAiDb.phraseUsage.get(normalized);
    await sutraAiDb.phraseUsage.put({
      phrase: normalized,
      count: (existing?.count ?? 0) + 1,
      lastUsedAt: Date.now(),
    });
  }

  async getWeights(limit = 40): Promise<Record<string, number>> {
    const rows = await sutraAiDb.phraseUsage.orderBy("count").reverse().limit(limit).toArray();
    const weights: Record<string, number> = {};
    for (const row of rows) {
      weights[row.phrase] = row.count;
    }
    return weights;
  }

  async getTopPhrases(limit = 10): Promise<string[]> {
    const rows = await sutraAiDb.phraseUsage.orderBy("count").reverse().limit(limit).toArray();
    return rows.map((r) => r.phrase);
  }
}

export const phraseUsageStore = new PhraseUsageStore();
