/** SUTRA AI — IndexedDB feedback persistence (Dexie) */

import { sutraAiDb, type AiFeedbackRecord } from "./SutraAiDexie";

export type { AiFeedbackRecord };

export class FeedbackStore {
  async record(opts: {
    messageId: string;
    positive: boolean;
    userInput?: string;
    assistantText?: string;
  }): Promise<void> {
    await sutraAiDb.feedback.put({
      id: `fb-${Date.now().toString(36)}`,
      messageId: opts.messageId,
      positive: opts.positive,
      userInput: opts.userInput,
      assistantText: opts.assistantText,
      timestamp: Date.now(),
    });
  }

  async getStats(): Promise<{ positive: number; negative: number; total: number }> {
    const all = await sutraAiDb.feedback.toArray();
    const positive = all.filter((f) => f.positive).length;
    return { positive, negative: all.length - positive, total: all.length };
  }

  async getRecent(limit = 20): Promise<AiFeedbackRecord[]> {
    return sutraAiDb.feedback.orderBy("timestamp").reverse().limit(limit).toArray();
  }
}

export const feedbackStore = new FeedbackStore();
