/**
 * ERP Bot API client — Phase 1 Conversation Brain
 *
 * Supports:
 * - Standard chat with conversation memory
 * - Streaming chat via SSE for responsive UX
 * - Conversation history management
 */

import {
  isSelfContainedAi,
  SELF_CONTAINED_STATUS,
  determineAiMode,
  createLlmModeStatus,
  type AiModeStatus,
} from "./selfContainedAi";

export function resolveErpBotUrl(): string {
  // In production via serve.mjs, always use the proxy path
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "/erp-bot";
  }

  if (isSelfContainedAi()) return "";

  const configured = (import.meta.env.VITE_ERP_BOT_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, "");

  // Dev mode: direct to local erp_bot OR via serve.mjs proxy
  // Check if we're behind serve.mjs (port 3000) or direct vite (port 5173)
  if (typeof window !== "undefined") {
    const port = window.location.port;
    if (port === "3000") {
      return "/erp-bot"; // serve.mjs proxy
    }
  }

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

export function resetErpBotSessionId(): string {
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export interface ErpBotStatus {
  online: boolean;
  indexedFiles: number;
  model?: string;
  conversationalModel?: string;
  fastModel?: string;
  error?: string;
  mode: "llm" | "builtin";
  streaming?: boolean;
  conversationMemory?: boolean;
  modeStatus: AiModeStatus;
}

export async function checkErpBotStatus(): Promise<ErpBotStatus> {
  if (isSelfContainedAi()) {
    return {
      online: false,
      indexedFiles: 0,
      mode: "builtin",
      modeStatus: SELF_CONTAINED_STATUS,
    };
  }

  try {
    const resp = await fetch(`${ERP_BOT_URL}/status`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) {
      return {
        online: false,
        indexedFiles: 0,
        error: `HTTP ${resp.status}`,
        mode: "builtin",
        modeStatus: SELF_CONTAINED_STATUS,
      };
    }

    const data = await resp.json();
    const aiMode = determineAiMode(data);
    const online = data.status === "online" && data.ollama === "connected";

    return {
      online,
      indexedFiles: data.indexed_files ?? 0,
      model: data.model,
      conversationalModel: data.conversational_model,
      fastModel: data.fast_model,
      mode: aiMode,
      streaming: data.streaming ?? false,
      conversationMemory: data.conversation_memory ?? false,
      modeStatus:
        aiMode === "llm" && online
          ? createLlmModeStatus(data.conversational_model || data.model || "Unknown", data.streaming ?? false)
          : SELF_CONTAINED_STATUS,
    };
  } catch (e: any) {
    return {
      online: false,
      indexedFiles: 0,
      error: e?.message || "Unreachable",
      mode: "builtin",
      modeStatus: SELF_CONTAINED_STATUS,
    };
  }
}

/**
 * Phase 2 — Route info from intent classification.
 */
export interface RouteInfo {
  intent: string;
  confidence: number;
  method: string;
  reasoning?: string;
}

/**
 * Chat response with Phase 2 routing info.
 */
export interface ChatResult {
  answer: string;
  sources: string[];
  route?: RouteInfo;
}

/**
 * Standard chat endpoint with conversation memory and Phase 2 routing.
 */
export async function askErpBot(
  message: string,
  sessionId: string,
  signal?: AbortSignal,
  contextBlock?: string,
): Promise<ChatResult> {
  if (isSelfContainedAi()) {
    throw new Error(SELF_CONTAINED_STATUS.detail);
  }

  const payload = contextBlock ? `${contextBlock}\n\n--- USER QUESTION ---\n${message}` : message;

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
    route: data.route || undefined,
  };
}

/**
 * Phase 2 — Classify intent without generating a response.
 */
export async function classifyIntent(message: string): Promise<RouteInfo> {
  if (isSelfContainedAi()) {
    return { intent: "unknown", confidence: 0, method: "offline" };
  }

  try {
    const resp = await fetch(`${ERP_BOT_URL}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!resp.ok) {
      return { intent: "unknown", confidence: 0, method: "error" };
    }
    const data = await resp.json();
    return {
      intent: data.intent,
      confidence: data.confidence,
      method: data.method,
      reasoning: data.reasoning,
    };
  } catch {
    return { intent: "unknown", confidence: 0, method: "error" };
  }
}

/**
 * Streaming chat endpoint via Server-Sent Events.
 *
 * @param message - User's message
 * @param sessionId - Session ID for conversation continuity
 * @param onChunk - Callback for each text chunk received
 * @param onDone - Callback when streaming is complete
 * @param onError - Callback for errors
 * @param signal - AbortSignal for cancellation
 */
export async function askErpBotStream(
  message: string,
  sessionId: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (isSelfContainedAi()) {
    onError(new Error(SELF_CONTAINED_STATUS.detail));
    return;
  }

  try {
    const resp = await fetch(`${ERP_BOT_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ message, session_id: sessionId }),
      signal,
    });

    if (!resp.ok) {
      throw new Error(`ERP bot error (${resp.status})`);
    }

    const reader = resp.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            onDone();
            return;
          }
          // Unescape newlines from SSE format
          const chunk = data.replace(/\\n/g, "\n");
          onChunk(chunk);
        }
      }
    }

    onDone();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      onDone();
    } else {
      onError(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

/**
 * Clear conversation history for a session.
 */
export async function clearChatSession(sessionId: string): Promise<void> {
  if (isSelfContainedAi()) return;

  try {
    await fetch(`${ERP_BOT_URL}/chat/session/${sessionId}`, {
      method: "DELETE",
    });
  } catch {
    // Ignore errors — this is a best-effort cleanup
  }
}

/**
 * Get conversation history for a session.
 */
export async function getChatHistory(
  sessionId: string,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  if (isSelfContainedAi()) return [];

  try {
    const resp = await fetch(`${ERP_BOT_URL}/chat/session/${sessionId}/history`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.history || [];
  } catch {
    return [];
  }
}
