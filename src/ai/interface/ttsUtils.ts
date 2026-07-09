/** SUTRA AI — TTS text preparation and voice selection */

import type { LanguageCode } from "../types";

const DEVANAGARI_RE = /[\u0900-\u097F]/;

/** Strip markdown and normalize whitespace for speech */
export function prepareTextForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/[#*_`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, ". ")
    .trim();
}

/** Roman output with Devanagari → speak romanized approximation for clearer TTS */
export function speechTextForLanguage(text: string, outputLanguage: LanguageCode): string {
  const clean = prepareTextForSpeech(text);
  if (!clean) return "";

  if (outputLanguage === "roman" && DEVANAGARI_RE.test(clean)) {
    return clean.replace(/[\u0900-\u097F]+/g, (chunk) => `[${chunk}]`);
  }

  return clean;
}

export function speechLangCode(outputLanguage: LanguageCode): string {
  if (outputLanguage === "english") return "en-US";
  if (outputLanguage === "nepali") return "ne-NP";
  return "ne-NP";
}

const VOICE_PRIORITY: Record<string, string[]> = {
  "ne-NP": ["ne-NP", "ne", "hi-IN", "hi"],
  "en-US": ["en-US", "en-GB", "en"],
};

export function pickSpeechVoice(langCode: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const prefs = VOICE_PRIORITY[langCode] ?? [langCode, langCode.split("-")[0]];
  for (const pref of prefs) {
    const exact = voices.find((v) => v.lang === pref);
    if (exact) return exact;
    const prefix = voices.find((v) => v.lang.startsWith(pref));
    if (prefix) return prefix;
  }

  return voices[0] ?? null;
}

export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 250);
  });
}
