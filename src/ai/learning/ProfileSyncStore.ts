/** SUTRA AI — IndexedDB profile sync (cross-session persistence) */

import type { UserProfile } from "../types";
import { sutraAiDb } from "./SutraAiDexie";

export class ProfileSyncStore {
  async save(profile: UserProfile): Promise<void> {
    await sutraAiDb.profiles.put({
      userId: profile.userId,
      data: profile,
      updatedAt: Date.now(),
    });
  }

  async load(userId: string): Promise<UserProfile | null> {
    const row = await sutraAiDb.profiles.get(userId);
    return row?.data ?? null;
  }
}

export const profileSyncStore = new ProfileSyncStore();
