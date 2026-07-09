/** SUTRA AI — persistent user profile tracking */

import type { InputLanguage, LanguageCode, UserProfile } from "../types";
import { contextualMemory } from "./ContextualMemory";
import { profileSyncStore } from "../learning/ProfileSyncStore";

const PROFILE_KEY = "sutra_ai_user_profile";
const USER_ID_KEY = "sutra_ai_user_id";

function defaultProfile(userId: string): UserProfile {
  return {
    userId,
    preferredInputLanguage: "auto",
    preferredOutputLanguage: "nepali",
    commonMisspellings: {},
    customTerms: [],
    frequentWords: {},
    commonProducts: [],
    commonParties: [],
    preferredTransactionTypes: [],
    correctionAcceptanceRate: 0.85,
    averageResponseTimeMs: 0,
    totalInteractions: 0,
    errorRate: 0,
  };
}

export class UserProfileManager {
  private profile: UserProfile;
  private syncReady = false;

  constructor() {
    this.profile = this.loadSync();
    void this.hydrateFromIndexedDb();
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    try {
      const userId = this.getUserId();
      const remote = await profileSyncStore.load(userId);
      if (remote && (remote.totalInteractions ?? 0) >= (this.profile.totalInteractions ?? 0)) {
        this.profile = { ...defaultProfile(userId), ...remote, userId };
        this.saveSync();
      }
      this.syncReady = true;
    } catch {
      this.syncReady = true;
    }
  }

  getUserId(): string {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = `user_${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  }

  getProfile(): UserProfile {
    return { ...this.profile, commonMisspellings: { ...this.profile.commonMisspellings } };
  }

  updateProfile(patch: Partial<UserProfile>): UserProfile {
    this.profile = {
      ...this.profile,
      ...patch,
      commonMisspellings: {
        ...this.profile.commonMisspellings,
        ...patch.commonMisspellings,
      },
      frequentWords: {
        ...this.profile.frequentWords,
        ...patch.frequentWords,
      },
      lastActiveAt: new Date().toISOString(),
    };
    this.save();
    return this.getProfile();
  }

  setLanguagePrefs(input: InputLanguage, output: LanguageCode): void {
    this.updateProfile({
      preferredInputLanguage: input,
      preferredOutputLanguage: output,
    });
  }

  trackWordFrequency(text: string): void {
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const freq = { ...this.profile.frequentWords };
    for (const w of words) {
      freq[w] = (freq[w] ?? 0) + 1;
    }
    this.updateProfile({ frequentWords: freq });
  }

  trackProduct(product: string): void {
    if (!product) return;
    const list = [...new Set([product, ...this.profile.commonProducts])].slice(0, 30);
    this.updateProfile({ commonProducts: list });
  }

  trackParty(party: string): void {
    if (!party) return;
    const list = [...new Set([party, ...this.profile.commonParties])].slice(0, 30);
    this.updateProfile({ commonParties: list });
  }

  trackTransactionType(type: string): void {
    if (!type) return;
    const list = [...new Set([type, ...this.profile.preferredTransactionTypes])].slice(0, 10);
    this.updateProfile({ preferredTransactionTypes: list });
  }

  syncMisspellingsFromMemory(): void {
    const learned = contextualMemory.getUserMisspellings();
    this.updateProfile({ commonMisspellings: learned });
  }

  recordInteraction(opts: {
    hadError?: boolean;
    accepted?: boolean;
    responseTimeMs?: number;
  }): void {
    const total = this.profile.totalInteractions + 1;
    const prevAvg = this.profile.averageResponseTimeMs;
    const newAvg = opts.responseTimeMs
      ? (prevAvg * (total - 1) + opts.responseTimeMs) / total
      : prevAvg;

    let acceptance = this.profile.correctionAcceptanceRate;
    if (opts.accepted !== undefined) {
      const acceptedCount = acceptance * (total - 1) + (opts.accepted ? 1 : 0);
      acceptance = acceptedCount / total;
    }

    let errorRate = this.profile.errorRate;
    if (opts.hadError !== undefined) {
      const errorCount = errorRate * (total - 1) + (opts.hadError ? 1 : 0);
      errorRate = errorCount / total;
    }

    this.updateProfile({
      totalInteractions: total,
      averageResponseTimeMs: newAvg,
      correctionAcceptanceRate: acceptance,
      errorRate,
    });
  }

  private loadSync(): UserProfile {
    const userId = this.getUserId();
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return defaultProfile(userId);
      const parsed = JSON.parse(raw) as UserProfile;
      return { ...defaultProfile(userId), ...parsed, userId };
    } catch {
      return defaultProfile(userId);
    }
  }

  private saveSync(): void {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
    if (this.syncReady) {
      void profileSyncStore.save(this.profile);
    }
  }

  private load(): UserProfile {
    return this.loadSync();
  }

  private save(): void {
    this.saveSync();
    if (!this.syncReady) {
      void profileSyncStore.save(this.profile);
    }
  }

  reset(): void {
    this.profile = defaultProfile(this.getUserId());
    this.save();
  }

  importProfile(remote: UserProfile): void {
    const userId = this.getUserId();
    this.profile = {
      ...this.profile,
      ...remote,
      userId,
      commonMisspellings: {
        ...this.profile.commonMisspellings,
        ...remote.commonMisspellings,
      },
      frequentWords: {
        ...this.profile.frequentWords,
        ...remote.frequentWords,
      },
    };
    this.save();
  }
}

export const userProfileManager = new UserProfileManager();
