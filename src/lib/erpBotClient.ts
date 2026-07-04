/** Resolve ERP bot API base URL for dev vs production. */

import { isSelfContainedAi, SELF_CONTAINED_STATUS } from "./selfContainedAi";

export function resolveErpBotUrl(): string {
  if (isSelfContainedAi()) return "";

  const configured = (import.meta.env.VITE_ERP_BOT_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, "");

  return "http://localhost:8765";
}

export const ERP_BOT_URL = resolveErpBotUrl();

const SESSION_KEY = "erp_bot_session_id";

export function getErpBotSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface ErpBotStatus {
  online: boolean;
  indexedFiles: number;
  model?: string;
  error?: string;
  mode?: "live" | "builtin";
}

export async function checkErpBotStatus(): Promise<ErpBotStatus> {
  if (isSelfContainedAi()) {
    return {
      online: false,
      indexedFiles: 0,
      mode: "builtin",
    };
  }

  try {
    const resp = await fetch(`${ERP_BOT_URL}/status`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return { online: false, indexedFiles: 0, error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return {
      online: data.status === "online" && data.ollama === "connected",
      indexedFiles: data.indexed_files ?? 0,
      model: data.model,
      mode: data.mode === "builtin" || data.status === "offline" ? "builtin" : "live",
    };
  } catch (e: any) {
    return { online: false, indexedFiles: 0, error: e?.message || "Unreachable" };
  }
}

export async function askErpBot(
  message: string,
  sessionId: string,
  signal?: AbortSignal,
  contextBlock?: string,
): Promise<{ answer: string; sources: string[] }> {
  if (isSelfContainedAi()) {
    throw new Error(SELF_CONTAINED_STATUS.detail);
  }

  const payload = contextBlock
    ? `${contextBlock}\n\n--- USER QUESTION ---\n${message}`
    : message;

  const resp = await fetch(`${ERP_BOT_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: payload, session_id: sessionId }),
    signal,
  });
  if (!resp.ok) {
    throw new Error(`ERP bot error (${resp.status})`);
  }
  const data = await resp.json();
  return {
    answer: data.answer || "No response generated.",
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}
