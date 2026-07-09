/** SUTRA AI — Web Speech API voice input (Nepali / English / Roman) */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type { InputLanguage } from "../types";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  inputLanguage?: InputLanguage;
}

function langForInput(inputLanguage: InputLanguage): string {
  if (inputLanguage === "nepali") return "ne-NP";
  if (inputLanguage === "english") return "en-US";
  return "ne-NP";
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  disabled = false,
  inputLanguage = "auto",
}) => {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || disabled) return;

    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }

    rec.lang = langForInput(inputLanguage);
    rec.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript?.trim();
      if (text) onTranscript(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [disabled, inputLanguage, listening, onTranscript]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? "Stop listening" : "Voice input"}
      className={`h-8 w-8 flex items-center justify-center rounded-md border text-[12px] transition-colors ${
        listening
          ? "border-red-300 bg-red-50 text-red-600 animate-pulse"
          : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      } disabled:opacity-40`}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </button>
  );
};

export default VoiceInput;
