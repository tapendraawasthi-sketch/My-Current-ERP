/** SUTRA AI — Web Speech API text-to-speech for assistant replies */

import React, { useCallback, useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { LanguageCode } from "../types";
import {
  ensureVoicesLoaded,
  pickSpeechVoice,
  speechLangCode,
  speechTextForLanguage,
} from "./ttsUtils";

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function speakText(text: string, outputLanguage: LanguageCode = "nepali"): Promise<void> {
  if (!isSpeechSynthesisSupported()) return;
  const spoken = speechTextForLanguage(text, outputLanguage);
  if (!spoken) return;

  await ensureVoicesLoaded();
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(spoken);
  const lang = speechLangCode(outputLanguage);
  utter.lang = lang;
  utter.rate = outputLanguage === "nepali" ? 0.88 : 0.95;
  utter.pitch = 1;
  const voice = pickSpeechVoice(lang);
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

interface VoiceOutputProps {
  text: string;
  outputLanguage: LanguageCode;
  compact?: boolean;
}

const VoiceOutput: React.FC<VoiceOutputProps> = ({ text, outputLanguage, compact = true }) => {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isSpeechSynthesisSupported());
    void ensureVoicesLoaded();
  }, []);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    void speakText(text, outputLanguage).then(() => setSpeaking(true));
    const timer = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        setSpeaking(false);
        clearInterval(timer);
      }
    }, 300);
  }, [supported, speaking, text, outputLanguage]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={speaking ? "Stop speaking" : "Listen"}
      className={`rounded ${compact ? "p-0.5" : "p-1"} ${
        speaking ? "text-[#1557b0]" : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
    </button>
  );
};

export default VoiceOutput;
