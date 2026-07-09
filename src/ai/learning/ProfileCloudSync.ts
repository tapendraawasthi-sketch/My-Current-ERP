/** SUTRA AI — export/import learning bundle for cross-device sync */

import type { UserProfile } from "../types";
import { contextualMemory, type LearnedCorrection } from "../knowledge/ContextualMemory";
import { userProfileManager } from "../knowledge/UserProfileManager";
import { profileSyncStore } from "./ProfileSyncStore";

export interface CloudSyncBundle {
  version: 1;
  exportedAt: string;
  profile: UserProfile;
  corrections: LearnedCorrection[];
}

function mergeFrequentWords(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [word, count] of Object.entries(b)) {
    out[word] = Math.max(out[word] ?? 0, count);
  }
  return out;
}

export async function exportLearningBundle(): Promise<string> {
  const profile = userProfileManager.getProfile();
  const corrections = contextualMemory.getAll();
  const bundle: CloudSyncBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    corrections,
  };
  return JSON.stringify(bundle, null, 2);
}

export async function importLearningBundle(
  json: string,
): Promise<{ ok: boolean; message: string }> {
  let bundle: CloudSyncBundle;
  try {
    bundle = JSON.parse(json) as CloudSyncBundle;
  } catch {
    return { ok: false, message: "Invalid JSON file." };
  }

  if (bundle.version !== 1 || !bundle.profile) {
    return { ok: false, message: "Unsupported or corrupt learning bundle." };
  }

  const localId = userProfileManager.getUserId();
  const mergedProfile: UserProfile = {
    ...userProfileManager.getProfile(),
    ...bundle.profile,
    userId: localId,
    commonMisspellings: {
      ...bundle.profile.commonMisspellings,
      ...userProfileManager.getProfile().commonMisspellings,
    },
    frequentWords: mergeFrequentWords(
      bundle.profile.frequentWords ?? {},
      userProfileManager.getProfile().frequentWords,
    ),
    commonProducts: [
      ...new Set([
        ...(bundle.profile.commonProducts ?? []),
        ...userProfileManager.getProfile().commonProducts,
      ]),
    ].slice(0, 30),
    commonParties: [
      ...new Set([
        ...(bundle.profile.commonParties ?? []),
        ...userProfileManager.getProfile().commonParties,
      ]),
    ].slice(0, 30),
  };

  userProfileManager.importProfile(mergedProfile);
  if (bundle.corrections?.length) {
    contextualMemory.importCorrections(bundle.corrections);
  }
  await profileSyncStore.save(mergedProfile);

  return {
    ok: true,
    message: `Imported ${bundle.corrections?.length ?? 0} corrections and profile preferences.`,
  };
}

export function downloadLearningBundle(filename?: string): Promise<void> {
  return exportLearningBundle().then((json) => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      filename ?? `sutra-ai-learning-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
