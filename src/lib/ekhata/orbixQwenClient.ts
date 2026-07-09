/**
 * Orbix Qwen-only client — ultra stack for production + local.
 *
 * Routes every message through erp_bot:
 *   qwen3:4b router → RAG / khata engine → qwen3:32b brain
 *
 * Endpoint: POST /orbix/chat/stream (JSON SSE)
 */

import { resolveErpBotUrl } from "../erpBotClient";
import { isSelfContainedAi } from "../selfContainedAi";
import type { AccountClass, KhataConfirmationCard, KhataIntent } from "./types";

export const ORBIX_QWEN_URL = resolveErpBotUrl();

export interface OrbixRouteInfo {
  intent: string;
  confidence: number;
  method: string;
  reasoning?: string;
}

export interface OrbixQwenStatus {
  online: boolean;
  qwenReady: boolean;
  degraded: boolean;
  model?: string;
  conversationalModel?: string;
  streaming: boolean;
  mode: "llm" | "builtin";
  error?: string;
}

export interface OrbixQwenCallbacks {
  onThinkingStart?: () => void;
  onThinkingDone?: () => void;
  onRoute?: (route: OrbixRouteInfo) => void;
  onToken: (token: string) => void;
  onComplete: (result: {
    message: string;
    card: KhataConfirmationCard | null;
    route?: OrbixRouteInfo;
    action: "confirm" | "chat";
  }) => void;
  onError: (error: Error) => void;
}

export async function checkOrbixQwenStatus(): Promise<OrbixQwenStatus> {
  if (isSelfContainedAi() || !ORBIX_QWEN_URL) {
    return {
      online: false,
      qwenReady: false,
      degraded: false,
      streaming: false,
      mode: "builtin",
      error: "Self-contained mode forced",
    };
  }

  try {
    const resp = await fetch(`${ORBIX_QWEN_URL}/status`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      return {
        online: false,
        qwenReady: false,
        degraded: false,
        streaming: false,
        mode: "builtin",
        error: `HTTP ${resp.status}`,
      };
    }

    const data = await resp.json();
    const botOk = data.status === "online";
    const ollamaOk = data.ollama === "connected";
    const isBuiltin = data.mode === "builtin" || !ollamaOk;

    return {
      online: botOk && data.mode !== "builtin",
      qwenReady: botOk && ollamaOk && Boolean(data.khata_llm ?? data.conversational_model),
      degraded: botOk && !ollamaOk,
      model: data.model,
      conversationalModel: data.conversational_model || data.model,
      streaming: Boolean(data.streaming),
      mode: isBuiltin ? "builtin" : "llm",
      error: isBuiltin ? data.message : undefined,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unreachable";
    return {
      online: false,
      qwenReady: false,
      degraded: false,
      streaming: false,
      mode: "builtin",
      error: msg,
    };
  }
}

/** Map backend khata card JSON to frontend KhataConfirmationCard. */
export function normalizeOrbixCard(raw: Record<string, unknown> | null | undefined): KhataConfirmationCard | null {
  if (!raw) return null;

  const journalLines = Array.isArray(raw.journalLines)
    ? raw.journalLines.map((line: Record<string, unknown>) => ({
        accountCode: String(line.accountCode ?? line.account_code ?? ""),
        accountName: String(line.accountName ?? line.account_name ?? ""),
        accountClass: (line.accountClass as AccountClass | undefined) ?? "asset",
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        narration: line.narration ? String(line.narration) : undefined,
      }))
    : undefined;

  return {
    intent: String(raw.intent ?? "khata_expense") as KhataIntent,
    party: raw.party != null ? String(raw.party) : null,
    amount: Number(raw.amount ?? 0),
    item: raw.item != null ? String(raw.item) : null,
    date: raw.date != null ? String(raw.date) : undefined,
    raw_text: String(raw.raw_text ?? raw.narration ?? ""),
    journalLines,
    narration: raw.narration ? String(raw.narration) : undefined,
    confidence: raw.confidence != null ? Number(raw.confidence) : undefined,
  };
}

/** Non-streaming fallback — POST /chat (routed Qwen). */
export async function askOrbixQwen(
  message: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<{
  answer: string;
  card: KhataConfirmationCard | null;
  route?: OrbixRouteInfo;
}> {
  if (!ORBIX_QWEN_URL) {
    throw new Error("Orbix Qwen backend URL not configured");
  }

  const resp = await fetch(`${ORBIX_QWEN_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`Orbix Qwen error (${resp.status})`);
  }

  const data = await resp.json();
  return {
    answer: data.answer || "",
    card: normalizeOrbixCard(data.card),
    route: data.route,
  };
}

/** Stream routed Qwen response — POST /orbix/chat/stream */
export async function streamOrbixQwen(
  message: string,
  sessionId: string,
  callbacks: OrbixQwenCallbacks,
  options?: { context?: Record<string, unknown>; signal?: AbortSignal },
): Promise<void> {
  if (!ORBIX_QWEN_URL) {
    callbacks.onError(new Error("Orbix Qwen backend URL not configured"));
    return;
  }

  const resp = await fetch(`${ORBIX_QWEN_URL}/orbix/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      context: options?.context,
    }),
    signal: options?.signal,
  });

  if (!resp.ok) {
    callbacks.onError(new Error(`Orbix Qwen stream error (${resp.status})`));
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
        switch (data.type) {
          case "thinking_start":
            callbacks.onThinkingStart?.();
            break;
          case "thinking_done":
            callbacks.onThinkingDone?.();
            break;
          case "route":
            if (data.route) callbacks.onRoute?.(data.route as OrbixRouteInfo);
            break;
          case "token":
            if (data.content) callbacks.onToken(String(data.content));
            break;
          case "complete": {
            const card = normalizeOrbixCard(data.card as Record<string, unknown> | undefined);
            callbacks.onComplete({
              message: String(data.message || ""),
              card,
              route: data.route as OrbixRouteInfo | undefined,
              action: card ? "confirm" : "chat",
            });
            return;
          }
          case "error":
            callbacks.onError(new Error(String(data.message || "Stream error")));
            return;
          default:
            break;
        }
      } catch {
        /* ignore malformed SSE */
      }
    }
  }
}

export const ORBIX_OFFLINE_MESSAGE = `⚠️ **Orbix AI offline** — Qwen3 brain is not connected.

**On Render**, set environment variable:
\`ERP_BOT_BACKEND_URL=http://YOUR_GPU_SERVER_IP:8765\`

**On your GPU server**, run:
\`\`\`
ollama pull qwen3:32b
ollama pull qwen3:4b
ollama pull nomic-embed-text
cd erp_bot && python scripts/start.py
\`\`\`

Then redeploy Render and refresh this page.`;
