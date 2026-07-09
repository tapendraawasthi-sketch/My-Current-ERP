/** SUTRA AI — learn from quick-reply chip selections */

import { phraseUsageStore } from "./PhraseUsageStore";

const QUICK_REPLY_BOOST = 2;

export class QuickReplyLearningStore {
  async recordSelection(value: string): Promise<void> {
    const normalized = value.trim().toLowerCase();
    if (normalized.length < 2) return;

    await phraseUsageStore.record(normalized);
    for (let i = 1; i < QUICK_REPLY_BOOST; i += 1) {
      await phraseUsageStore.record(normalized);
    }
  }

  async recordSlashShortcut(value: string): Promise<void> {
    if (!value.startsWith("/")) return;
    await this.recordSelection(value);
  }
}

export const quickReplyLearningStore = new QuickReplyLearningStore();
