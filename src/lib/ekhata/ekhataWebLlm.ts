/**
 * Browser-side Nepali LLM via WebLLM (WebGPU).
 * Runs entirely in the user's browser — no API keys, no Ollama server.
 * Used on Render/production when erp_bot + Ollama are unavailable.
 */

import type { InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";
import type { LedgerBalanceSnapshot } from "./conversationEngine";

export const EKHATA_BROWSER_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

const KHATA_SYSTEM_PROMPT = `You are e-Khata (इ-खाता), a warm, intelligent personal ledger assistant for Nepali small traders.

Language:
- Reply primarily in Nepali — Romanized (Latin) or Devanagari, matching the user's style.
- You understand Nepali, Hindi-mixed, English-mixed, and local trader slang naturally.
- Spelling variants are normal: udhaar/udhar/udharo, nagad/nakad, vayo/bhayo/gyo/gayo, aaja/aja, chha/cha.
- You know casual Nepali: k xa, khana khayeu, kasto cha, ramro cha — answer like a real person, not a robot.

Your job:
1. Khata entries — When user describes money in/out (udhaar, bikri, tiryo, kineko, kharcha), acknowledge and help confirm.
2. General conversation — Answer any question naturally like a helpful didi/bhai. You are NOT limited to transactions only.
3. Tone — Friendly, concise, practical. Use tapai, hajur, ramro.

Transaction types: credit sale (udhaar), payment received (tiryo), cash sale (nagad bikri), purchase (kineko), payment out, expense (kharcha).

Rules:
- Never invent amounts or parties the user did not say.
- If amount or party unclear for a transaction, ask ONE short question in Nepali.
- For pure chat (food, weather, greetings, jokes), respond naturally — do NOT say "Ke transaction ho?"
- You do NOT post to ledger; the app shows Confirm after parsing entries.
- Keep replies under 6 sentences unless user asks for detail.`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

let engine: MLCEngineInterface | null = null;
let loadPromise: Promise<MLCEngineInterface> | null = null;
let chatHistory: ChatMessage[] = [];

export type WebLlmLoadState = "idle" | "loading" | "ready" | "error";

let loadState: WebLlmLoadState = "idle";
let loadError: string | undefined;
let loadProgress = 0;
let loadProgressText = "";

type ProgressListener = (progress: number, text: string, state: WebLlmLoadState) => void;
const progressListeners = new Set<ProgressListener>();

function notifyProgress() {
  for (const fn of progressListeners) {
    fn(loadProgress, loadProgressText, loadState);
  }
}

export function onWebLlmProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  listener(loadProgress, loadProgressText, loadState);
  return () => progressListeners.delete(listener);
}

export function getWebLlmState(): { state: WebLlmLoadState; progress: number; text: string; error?: string } {
  return { state: loadState, progress: loadProgress, text: loadProgressText, error: loadError };
}

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

function buildSystemPrompt(balance?: LedgerBalanceSnapshot): string {
  let prompt = KHATA_SYSTEM_PROMPT;
  if (balance) {
    prompt += `\n\nCurrent khata balance:\nUdharo baahir (dainu baki): NPR ${balance.udhaarOut.toLocaleString()}\nUdharo bhitra (linu baki): NPR ${balance.udhaarIn.toLocaleString()}`;
  }
  return prompt;
}

export async function loadEKhataBrowserAi(
  onProgress?: (report: InitProgressReport) => void,
): Promise<MLCEngineInterface> {
  if (engine) return engine;
  if (loadPromise) return loadPromise;

  if (!isWebGpuAvailable()) {
    loadState = "error";
    loadError = "WebGPU chaina — Chrome/Edge latest version prayog garnus.";
    notifyProgress();
    throw new Error(loadError);
  }

  loadState = "loading";
  loadProgress = 0;
  loadProgressText = "Nepali AI load hudai cha...";
  notifyProgress();

  loadPromise = (async () => {
    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const eng = await CreateMLCEngine(EKHATA_BROWSER_MODEL, {
        initProgressCallback: (report) => {
          loadProgress = Math.round((report.progress ?? 0) * 100);
          loadProgressText = report.text ?? "Loading model...";
          onProgress?.(report);
          notifyProgress();
        },
      });
      engine = eng;
      loadState = "ready";
      loadProgress = 100;
      loadProgressText = "Nepali AI tayar cha";
      notifyProgress();
      return eng;
    } catch (err) {
      loadState = "error";
      loadError = err instanceof Error ? err.message : "Model load failed";
      loadPromise = null;
      notifyProgress();
      throw err;
    }
  })();

  return loadPromise;
}

export function isEKhataBrowserAiReady(): boolean {
  return loadState === "ready" && engine !== null;
}

export function resetEKhataBrowserChat(): void {
  chatHistory = [];
}

export async function askEKhataBrowserAi(
  message: string,
  balance?: LedgerBalanceSnapshot,
): Promise<string> {
  const eng = engine ?? (await loadEKhataBrowserAi());
  const system = buildSystemPrompt(balance);

  chatHistory.push({ role: "user", content: message });
  if (chatHistory.length > 24) {
    chatHistory = chatHistory.slice(-24);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...chatHistory,
  ];

  const reply = await eng.chat.completions.create({
    messages,
    temperature: 0.55,
    max_tokens: 512,
  });

  const text =
    typeof reply.choices[0]?.message?.content === "string"
      ? reply.choices[0].message.content.trim()
      : "";

  if (text) {
    chatHistory.push({ role: "assistant", content: text });
  }

  return text || "Maile bujhina — feri lekhnu hola?";
}

export function replyNeedsBrowserAi(): string {
  if (!isWebGpuAvailable()) {
    return (
      "Yo kura Nepali ma samjhan lai AI chaincha. Tapai ko browser ma WebGPU chaina.\n\n" +
      "Chrome athaba Edge (latest) ma kholnus, athaba local ma `ollama serve` + erp_bot chalaunus."
    );
  }
  if (loadState === "loading") {
    return `Nepali AI load hudai cha (${loadProgress}%)... Ali parkinus, tes pachi sabai kura Nepali ma kura garna milcha.`;
  }
  return (
    "Yo Nepali kura samjhan lai AI chaincha — ma hardcoded jawaf chaina.\n\n" +
    "**Load Nepali AI** button thichnus (ek choti ~300MB download, tapai ko browser ma chalcha, API key chaina). " +
    "Tes pachi `khana khayeu?`, `k xa`, khata entry — sabai natural Nepali ma."
  );
}
