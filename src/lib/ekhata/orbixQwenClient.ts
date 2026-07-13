/**
 * Orbix chat client — production ingress via OIP kernel at /orbix/chat/stream.
 */

import { resolveErpBotUrl } from "../erpBotClient";
import { isProviderRuntimeReady, isSelfContainedAi } from "../selfContainedAi";
import type { KhataConfirmationCard } from "./types";
import { normalizeOrbixCard } from "./orbixCardNormalize";
import { parseOrbixResponse } from "./orbixResponseAdapter";
import type { OrbixResponse } from "./orbixResponseTypes";

export { normalizeOrbixCard } from "./orbixCardNormalize";

export interface OrbixRouteInfo {
  intent: string;
  confidence: number;
  method: string;
  reasoning?: string;
  operation_class?: string;
  orbix_mode?: string;
  draft_id?: string;
  error?: Record<string, unknown>;
  report_spec?: Record<string, unknown>;
}

export interface OrbixStreamCompleteResult {
  message: string;
  card: KhataConfirmationCard | null;
  route?: OrbixRouteInfo;
  action: "confirm" | "chat";
  /** Typed domain response — prefer over heuristics */
  response: OrbixResponse | null;
  draft_id?: string | null;
  operation_class?: string | null;
  report_spec?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
  response_type?: string | null;
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
  onComplete: (result: OrbixStreamCompleteResult) => void;
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

export const ORBIX_QWEN_URL = resolveErpBotUrl();

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
  response: OrbixResponse | null;
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
  const parseResult = parseOrbixResponse({
    message: data.answer || data.message || "",
    card: data.card,
    route: data.route,
    action: data.action,
    orbix_mode: data.orbix_mode || options?.orbixMode,
    operation_class: data.operation_class,
    error: data.error,
    draft_id: data.draft_id,
    report_spec: data.report_spec,
    response_type: data.response_type,
  });
  const response = parseResult.ok ? parseResult.response : null;

  return {
    answer: data.answer || data.message || "",
    card: normalizeOrbixCard(data.card),
    route: data.route,
    response,
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
            const parseResult = parseOrbixResponse(data);
            const response = parseResult.ok ? parseResult.response : null;
            const card = normalizeOrbixCard(data.card as Record<string, unknown> | undefined);
            const serverAction = data.action === "confirm" || data.action === "chat" ? data.action : null;
            callbacks.onComplete({
              message: String(data.message || ""),
              card,
              route: data.route as OrbixRouteInfo | undefined,
              action: serverAction || (card ? "confirm" : "chat"),
              response,
              draft_id: (data.draft_id as string | null | undefined) ?? null,
              operation_class: (data.operation_class as string | null | undefined) ?? null,
              report_spec: (data.report_spec as Record<string, unknown> | null | undefined) ?? null,
              error: (data.error as Record<string, unknown> | null | undefined) ?? null,
              response_type:
                (data.response_type as string | null | undefined) ??
                response?.response_type ??
                null,
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

export const ORBIX_OFFLINE_MESSAGE = `Orbix is temporarily limited.

We could not reach the AI service for this request. You can still browse reports and masters in the ERP, then try Orbix again once the connection is restored.

If this continues, ask your administrator to check that the Orbix service is running.`;

/** Developer-facing diagnostics (not shown as primary chat copy). */
export const ORBIX_OFFLINE_DIAGNOSTICS = `OIP Provider Runtime offline. Ensure sutra-erp-bot is deployed and ERP_BOT_BACKEND_URL / OIP_* env vars are set.`;
