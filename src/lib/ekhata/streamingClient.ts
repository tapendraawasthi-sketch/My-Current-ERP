/**
 * SSE client for streaming e-Khata v2 responses.
 */
import { EKHATA_BOT_URL } from "./ekhataLlmClient";

export interface StreamCallbacks {
  onThinkingStart: () => void;
  onThinkingDone: () => void;
  onToken: (token: string) => void;
  onToolCalling: (tools: string[]) => void;
  onComplete: (metadata: Record<string, unknown>) => void;
  onError: (error: Error) => void;
}

/**
 * Stream chat tokens via Server-Sent Events.
 */
export async function streamChat(
  message: string,
  sessionId: string,
  callbacks: StreamCallbacks,
  options?: {
    context?: Record<string, unknown>;
    balance?: { udhaarOut: number; udhaarIn: number };
  },
): Promise<void> {
  if (!EKHATA_BOT_URL) {
    callbacks.onError(new Error("e-Khata bot URL not configured"));
    return;
  }

  const response = await fetch(`${EKHATA_BOT_URL}/v2/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      context: options?.context,
      balance: options?.balance
        ? { udhaar_out: options.balance.udhaarOut, udhaar_in: options.balance.udhaarIn }
        : undefined,
    }),
  });

  if (!response.ok) {
    callbacks.onError(new Error(`HTTP ${response.status}`));
    return;
  }
  if (!response.body) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  const reader = response.body.getReader();
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
        const data = JSON.parse(line.slice(6)) as { type: string; content?: string; tools?: string[] };
        switch (data.type) {
          case "thinking_start":
            callbacks.onThinkingStart();
            break;
          case "thinking_done":
            callbacks.onThinkingDone();
            break;
          case "token":
            if (data.content) callbacks.onToken(data.content);
            break;
          case "tool_calling":
            callbacks.onToolCalling(data.tools || []);
            break;
          case "complete":
            callbacks.onComplete(data as Record<string, unknown>);
            break;
          case "error":
            callbacks.onError(new Error(String((data as { message?: string }).message || "Stream error")));
            break;
        }
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }
}
