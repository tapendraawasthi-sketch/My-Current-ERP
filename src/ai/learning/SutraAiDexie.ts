/** SUTRA AI — shared IndexedDB (feedback + profile sync) */

import Dexie, { type Table } from "dexie";
import type { SessionSnapshot, UserProfile } from "../types";

export interface AiFeedbackRecord {
  id: string;
  messageId: string;
  positive: boolean;
  userInput?: string;
  assistantText?: string;
  timestamp: number;
}

interface StoredProfile {
  userId: string;
  data: UserProfile;
  updatedAt: number;
}

export interface StoredPhraseUsage {
  phrase: string;
  count: number;
  lastUsedAt: number;
}

export interface StoredSession {
  userId: string;
  snapshot: SessionSnapshot;
  updatedAt: number;
}

export interface CachedLlmEntry {
  key: string;
  input: string;
  intent: string;
  responseJson: string;
  cachedAt: number;
}

class SutraAiDexie extends Dexie {
  feedback!: Table<AiFeedbackRecord, string>;
  profiles!: Table<StoredProfile, string>;
  phraseUsage!: Table<StoredPhraseUsage, string>;
  sessions!: Table<StoredSession, string>;
  llmCache!: Table<CachedLlmEntry, string>;

  constructor() {
    super("SutraAiLearning");
    this.version(1).stores({
      feedback: "id, messageId, timestamp",
    });
    this.version(2).stores({
      feedback: "id, messageId, timestamp",
      profiles: "userId, updatedAt",
    });
    this.version(3).stores({
      feedback: "id, messageId, timestamp",
      profiles: "userId, updatedAt",
      phraseUsage: "phrase, lastUsedAt, count",
      sessions: "userId, updatedAt",
    });
    this.version(4).stores({
      feedback: "id, messageId, timestamp",
      profiles: "userId, updatedAt",
      phraseUsage: "phrase, lastUsedAt, count",
      sessions: "userId, updatedAt",
      llmCache: "key, cachedAt, intent",
    });
  }
}

export const sutraAiDb = new SutraAiDexie();
