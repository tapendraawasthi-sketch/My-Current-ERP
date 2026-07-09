/**
 * Self-contained AI mode detection and status.
 *
 * PHASE 1 — CONVERSATION BRAIN: The LLM path is now PRIMARY.
 * The built-in rule-based brain is only an OFFLINE EMERGENCY FALLBACK.
 *
 * Priority order:
 * 1. If erp_bot backend is available → use LLM (conversational, natural, tri-lingual)
 * 2. If erp_bot is unreachable → fall back to built-in (labeled as "OFFLINE MODE")
 *
 * Local (vite dev OR production build on localhost):
 *   → Always try erp_bot on :8765 (via serve.mjs proxy)
 *   → Fall back to builtin only if /erp-bot/status returns mode=builtin
 *
 * Render/production host:
 *   → Set ERP_BOT_BACKEND_URL to your erp_bot instance
 *   → Without it, falls back to builtin (clearly labeled as degraded)
 */

function isLocalMachine(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * Whether to use the self-contained (rule-based) AI mode.
 *
 * In Phase 1, we ALWAYS prefer the LLM path. This function returns true
 * only when explicitly forced via env var, which should be rare.
 */
export function isSelfContainedAi(): boolean {
  const forceBuiltin = (import.meta.env.VITE_SELF_CONTAINED_AI as string | undefined)?.trim();
  if (forceBuiltin === "true" || forceBuiltin === "1") return true;

  const explicit = (import.meta.env.VITE_ERP_BOT_URL as string | undefined)?.trim();

  // Local machine: ALWAYS try the LLM path first
  if (import.meta.env.DEV || isLocalMachine()) return false;

  // Remote production (Render): try LLM if URL was baked in at build, else builtin
  return !explicit;
}

/**
 * Determine AI mode based on backend status response.
 *
 * Call this AFTER checking /erp-bot/status to determine the actual mode.
 * The status response tells us whether the backend has a real LLM or is
 * returning the builtin fallback.
 */
export function determineAiMode(statusResponse: {
  mode?: string;
  ollama?: string;
  conversational_model?: string;
  streaming?: boolean;
}): "llm" | "builtin" {
  // If mode is explicitly 'builtin', we're in fallback mode
  if (statusResponse.mode === "builtin") return "builtin";

  // If ollama is connected and we have a model, we're in LLM mode
  if (statusResponse.ollama === "connected" && statusResponse.conversational_model) {
    return "llm";
  }

  // Default to builtin if unclear
  return "builtin";
}

export type AiMode = "llm" | "builtin";

export interface AiModeStatus {
  mode: AiMode;
  label: string;
  detail: string;
  model?: string;
  streaming?: boolean;
}

/**
 * Status object for the self-contained (builtin) mode.
 * This is the OFFLINE FALLBACK — clearly labeled as degraded.
 */
export const SELF_CONTAINED_STATUS: AiModeStatus = {
  mode: "builtin" as const,
  label: "⚠️ Offline Mode",
  detail:
    "Using built-in rule-based brain (limited). " +
    "Connect erp_bot for full AI conversation capabilities.",
};

/**
 * Create status object for LLM mode.
 */
export function createLlmModeStatus(model: string, streaming: boolean): AiModeStatus {
  return {
    mode: "llm",
    label: "🧠 AI Connected",
    detail: `Using ${model} — full conversational AI with memory`,
    model,
    streaming,
  };
}
