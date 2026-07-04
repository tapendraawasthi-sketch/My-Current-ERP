import { isNativePlatform } from "./platform";

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

let nativeSpeechPlugin: any = null;

async function getNativeSpeechPlugin() {
  if (nativeSpeechPlugin) return nativeSpeechPlugin;
  try {
    const mod = await import("@capacitor-community/speech-recognition");
    nativeSpeechPlugin = mod.SpeechRecognition;
    return nativeSpeechPlugin;
  } catch {
    return null;
  }
}

export function isVoiceInputSupported(): boolean {
  if (isNativePlatform()) return true;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export async function listenOnce(lang = "ne-NP"): Promise<string> {
  if (isNativePlatform()) {
    return listenNative(lang);
  }
  return listenWeb(lang);
}

async function listenNative(lang: string): Promise<string> {
  const plugin = await getNativeSpeechPlugin();
  if (!plugin) {
    throw new Error("Speech recognition plugin not available");
  }

  const permResult = await plugin.requestPermissions();
  if (permResult.speechRecognition !== "granted") {
    throw new Error("Microphone permission denied");
  }

  const available = await plugin.available();
  if (!available.available) {
    throw new Error("Speech recognition not available on this device");
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    plugin.addListener("partialResults", (_data: { matches: string[] }) => {
      // We wait for final results
    });

    plugin.addListener("listeningState", (data: { status: string }) => {
      if (data.status === "stopped" && !resolved) {
        resolved = true;
        resolve("");
      }
    });

    plugin
      .start({
        language: lang,
        maxResults: 1,
        partialResults: false,
        popup: true,
      })
      .then((result: { matches?: string[] }) => {
        if (!resolved) {
          resolved = true;
          const transcript = result?.matches?.[0]?.trim() ?? "";
          resolve(transcript);
        }
      })
      .catch((err: Error) => {
        if (!resolved) {
          resolved = true;
          if (lang === "ne-NP") {
            listenNative("en-IN").then(resolve).catch(reject);
          } else {
            reject(err);
          }
        }
      });
  });
}

function listenWeb(lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      reject(new Error("unsupported"));
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      resolve(transcript ?? "");
    };
    recognition.onerror = () => {
      if (lang === "ne-NP") {
        recognition.lang = "en-IN";
        recognition.start();
      } else {
        reject(new Error("Speech recognition error"));
      }
    };
    recognition.onend = () => undefined;
    recognition.start();
  });
}

export {};
