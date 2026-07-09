/** Orbix v2 API client — talks to the erp_bot /orbix/v2 reasoning endpoints. */

import { resolveErpBotUrl } from "../erpBotClient";
import { isSelfContainedAi } from "../selfContainedAi";
import type {
  OrbixChatRequest,
  OrbixChatResponse,
  OrbixStatus,
  OrbixStreamEvent,
} from "./types";

export const ORBIX_BOT_URL = resolveErpBotUrl();

export async function checkOrbixStatus(): Promise<OrbixStatus> {
  if (isSelfContainedAi() || !ORBIX_BOT_URL) {
    return { online: false, mode: "offline", error: "erp_bot URL not configured" };
  }
  try {
    const resp = await fetch(`${ORBIX_BOT_URL}/orbix/v2/status`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { online: false, mode: "offline", error: `HTTP ${resp.status}` };
    const data = await resp.json();
    const mode = (data.mode as OrbixStatus["mode"]) ?? "offline";
    return {
      online: mode === "orbix",
      mode,
      ollama: data.ollama,
      agentModel: data.agent_model,
      agentModelInstalled: Boolean(data.agent_model_installed),
      availableModels: data.available_models ?? [],
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unreachable";
    return { online: false, mode: "offline", error: msg };
  }
}

export async function sendOrbixMessage(
  req: OrbixChatRequest,
  signal?: AbortSignal,
): Promise<OrbixChatResponse> {
  if (isSelfContainedAi() || !ORBIX_BOT_URL) {
    throw new Error("Orbix reasoning backend not configured");
  }
  const resp = await fetch(`${ORBIX_BOT_URL}/orbix/v2/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok) throw new Error(`Orbix error (${resp.status})`);
  return resp.json() as Promise<OrbixChatResponse>;
}

/** Stream tool activity + final answer as parsed SSE events. */
export async function* streamOrbixMessage(
  req: OrbixChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<OrbixStreamEvent> {
  if (isSelfContainedAi() || !ORBIX_BOT_URL) {
    throw new Error("Orbix reasoning backend not configured");
  }
  const resp = await fetch(`${ORBIX_BOT_URL}/orbix/v2/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!resp.ok || !resp.body) throw new Error(`Orbix stream error (${resp.status})`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (event) yield event;
    }
  }
}

function parseSseFrame(frame: string): OrbixStreamEvent | null {
  let eventName = "";
  let dataLine = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return null;

  try {
    const data = JSON.parse(dataLine);
    switch (eventName) {
      case "tool":
        return { type: "tool", tool: data };
      case "answer":
        return { type: "answer", response: data };
      case "done":
        return { type: "done" };
      case "error":
        return { type: "error", message: data.message ?? "Unknown error" };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function forgetOrbixSession(sessionId: string): Promise<void> {
  if (isSelfContainedAi() || !ORBIX_BOT_URL) return;
  try {
    await fetch(`${ORBIX_BOT_URL}/orbix/v2/memory/forget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch {
    /* best-effort */
  }
}
