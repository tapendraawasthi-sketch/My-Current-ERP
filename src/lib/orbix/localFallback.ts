/** Honest degraded fallback when the Orbix reasoning backend is unavailable.
 *
 * Deliberately does NOT pretend to be the full agent. The browser cannot do
 * code-grounded, tool-using reasoning without the local erp_bot service.
 */

import type { OrbixChatResponse } from "./types";

export function buildLocalFallbackAnswer(
  message: string,
  sessionId: string,
): OrbixChatResponse {
  return {
    answer:
      "Orbix reasoning service is offline. I can only give basic navigation/help " +
      "right now — code-grounded reasoning, ledger math verification, and live " +
      "source lookups need the local erp_bot service (with Ollama) running.\n\n" +
      "Start it with: `python -m erp_bot.scripts.start`",
    intent: "fallback",
    confidence: 0.2,
    evidence: [],
    tool_trace: [],
    needs_confirmation: false,
    warnings: ["Local reasoning backend unavailable"],
    session_id: sessionId,
    engine: "builtin-fallback",
  };
}
