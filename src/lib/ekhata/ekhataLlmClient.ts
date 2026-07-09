/** e-Khata / Orbix — Qwen backend client (erp_bot + Ollama). */

import { isSelfContainedAi } from "../selfContainedAi";
import { checkOrbixQwenStatus } from "./orbixQwenClient";
import { resolveErpBotUrl } from "../erpBotClient";
import type { KhataConfirmationCard } from "./types";

export const EKHATA_BOT_URL = resolveErpBotUrl();

const SESSION_KEY = "ekhata_llm_session_id";

export function getEKhataSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function setEKhataSessionId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

export function resetEKhataSession(): void {
  const id = localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  if (id && EKHATA_BOT_URL) {
    fetch(`${EKHATA_BOT_URL}/khata/clear_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id }),
    }).catch(() => undefined);
  }
}

export interface EKhataLlmStatus {
  /** erp_bot API reachable (chat works; may be KB-only without Ollama). */
  online: boolean;
  /** Full LLM stack: erp_bot + Ollama connected. */
  khataLlm: boolean;
  /** erp_bot up but Ollama down — glossary/KB fallbacks only. */
  degraded?: boolean;
  model?: string;
  error?: string;
}

export async function checkEKhataLlmStatus(): Promise<EKhataLlmStatus> {
  if (isSelfContainedAi()) {
    return {
      online: false,
      khataLlm: false,
      error: "VITE_SELF_CONTAINED_AI=true — built-in brain only",
    };
  }

  const status = await checkOrbixQwenStatus();
  return {
    online: status.qwenReady || status.degraded,
    khataLlm: status.qwenReady,
    degraded: status.degraded,
    model: status.conversationalModel || status.model,
    error: status.error,
  };
}

export interface EKhataLlmResponse {
  kind: "chat" | "entry" | "clarify";
  reply: string;
  card?: KhataConfirmationCard | null;
  engine: string;
}

export interface EKhataV2Response {
  message: string;
  action: "confirm" | "clarify" | "posted" | "info" | "report" | "chat";
  entry?: Record<string, unknown> | null;
  card?: KhataConfirmationCard | null;
  suggestions: string[];
  insight?: string | null;
  metadata: Record<string, unknown>;
  session_id: string;
}

/** v2 chat with Dexie session snapshot */
export async function askEKhataV2(
  message: string,
  sessionId: string,
  options?: {
    balance?: { udhaarOut: number; udhaarIn: number };
    language?: "nepali" | "english" | "mixed";
    context?: Record<string, unknown>;
    signal?: AbortSignal;
  },
): Promise<EKhataV2Response> {
  if (isSelfContainedAi() || !EKHATA_BOT_URL) {
    throw new Error("Built-in CA brain only — no external LLM service");
  }

  const resp = await fetch(`${EKHATA_BOT_URL}/v2/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      language: options?.language,
      context: options?.context,
      balance: options?.balance
        ? { udhaar_out: options.balance.udhaarOut, udhaar_in: options.balance.udhaarIn }
        : undefined,
    }),
    signal: options?.signal,
  });

  if (!resp.ok) {
    throw new Error(`e-Khata v2 error (${resp.status})`);
  }

  return resp.json() as Promise<EKhataV2Response>;
}

export async function askEKhataLlm(
  message: string,
  sessionId: string,
  balance?: { udhaarOut: number; udhaarIn: number },
  signal?: AbortSignal,
  language?: "nepali" | "english" | "mixed",
): Promise<EKhataLlmResponse> {
  if (isSelfContainedAi() || !EKHATA_BOT_URL) {
    throw new Error("Built-in CA brain only — no external LLM service");
  }

  const resp = await fetch(`${EKHATA_BOT_URL}/khata/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      language,
      balance: balance
        ? { udhaar_out: balance.udhaarOut, udhaar_in: balance.udhaarIn }
        : undefined,
    }),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`e-Khata LLM error (${resp.status})`);
  }

  const data = await resp.json();
  const card = data.card as KhataConfirmationCard | null | undefined;

  return {
    kind: (data.kind as EKhataLlmResponse["kind"]) || "chat",
    reply: data.reply || "",
    card: card ?? null,
    engine: data.engine || "ollama",
  };
}
