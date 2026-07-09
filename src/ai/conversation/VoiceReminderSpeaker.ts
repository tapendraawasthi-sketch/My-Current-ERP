/** SUTRA AI — pick optimal text for TTS (prefer short share/reminder copy) */

import type { LanguageCode } from "../types";
import { speechTextForLanguage } from "../interface/ttsUtils";

export function pickTtsText(
  displayText: string,
  outputLanguage: LanguageCode,
  shareText?: string,
): string {
  const source = shareText?.trim() || displayText;
  return speechTextForLanguage(source, outputLanguage);
}

export function shouldPreferShareTts(shareText?: string): boolean {
  return Boolean(shareText?.trim());
}
