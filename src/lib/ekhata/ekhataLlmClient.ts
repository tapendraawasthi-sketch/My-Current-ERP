/** e-Khata LLM client — Ollama via erp_bot (no API keys). */

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

export function resetEKhataSession(): void {
  const id = localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  if (id) {
    fetch(`${EKHATA_BOT_URL}/khata/clear_session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: id }),
    }).catch(() => undefined);
  }
}

export interface EKhataLlmStatus {
  online: boolean;
  khataLlm: boolean;
  model?: string;
  error?: string;
}

export async function checkEKhataLlmStatus(): Promise<EKhataLlmStatus> {
  try {
    const resp = await fetch(`${EKHATA_BOT_URL}/status`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return { online: false, khataLlm: false, error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const ollamaOk = data.ollama === "connected";
    return {
      online: data.status === "online" && ollamaOk,
      khataLlm: Boolean(data.khata_llm) && ollamaOk,
      model: data.model,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unreachable";
    return { online: false, khataLlm: false, error: msg };
  }
}

export interface EKhataLlmResponse {
  kind: "chat" | "entry" | "clarify";
  reply: string;
  card?: KhataConfirmationCard | null;
  engine: string;
}

export async function askEKhataLlm(
  message: string,
  sessionId: string,
  balance?: { udhaarOut: number; udhaarIn: number },
  signal?: AbortSignal,
): Promise<EKhataLlmResponse> {
  const resp = await fetch(`${EKHATA_BOT_URL}/khata/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
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
