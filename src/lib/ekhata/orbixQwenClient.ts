/**
 * Orbix chat client — production ingress via OIP kernel at /orbix/chat/stream.
 */

import { resolveErpBotUrl } from "../erpBotClient";
import { isProviderRuntimeReady, isSelfContainedAi } from "../selfContainedAi";
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
    const runtimeReady = isProviderRuntimeReady(data);
    const isBuiltin = data.mode === "builtin" || !runtimeReady;
    const modelLabel =
      data.default_model ||
      data.configured_provider ||
      data.conversational_model ||
      data.model;

    return {
      online: botOk && data.mode !== "builtin",
      qwenReady: botOk && runtimeReady,
      degraded: botOk && !runtimeReady,
      model: modelLabel,
      conversationalModel: modelLabel,
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
  options?: {
    signal?: AbortSignal;
    orbixMode?: string;
    context?: Record<string, unknown>;
  },
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
    body: JSON.stringify({
      message,
      session_id: sessionId,
      orbix_mode: options?.orbixMode || "ask",
      context: options?.context,
    }),
    signal: options?.signal,
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
  options?: {
    context?: Record<string, unknown>;
    signal?: AbortSignal;
    orbixMode?: string;
  },
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
      orbix_mode: options?.orbixMode || "ask",
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

export const ORBIX_OFFLINE_MESSAGE = `⚠️ **Orbix AI offline** — OIP Provider Runtime is not connected.

**On Render**, ensure the **sutra-erp-bot** Python service is deployed and **sutra-erp** has:
\`ERP_BOT_BACKEND_URL\` set to the erp_bot service URL (auto-wired in \`render.yaml\`).

**Required on sutra-erp-bot:**
\`\`\`
OIP_ENABLED=true
OIP_FORCE_STUB_PROVIDERS=false
OIP_PROVIDER=groq
OIP_GROQ_API_KEY=<your-groq-key>
OIP_DEFAULT_MODEL=llama-3.3-70b-versatile
\`\`\`

Then redeploy both services and refresh this page.`;
