/**
 * Self-contained AI mode detection and status.
 *
 * Production chat uses the OIP kernel (Provider Runtime) via erp_bot.
 * The built-in rule-based brain runs ONLY when:
 *   - VITE_SELF_CONTAINED_AI=true is set explicitly, OR
 *   - erp_bot Provider Runtime is unreachable after a live /erp-bot/status check
 *
 * Render/production:
 *   → Frontend always calls same-origin /erp-bot (serve.mjs proxy)
 *   → ERP_BOT_BACKEND_URL points to sutra-erp-bot (Render Python service)
 *   → No VITE_ERP_BOT_URL required at build time
 */

export function isProviderRuntimeReady(statusResponse: {
  mode?: string;
  provider_runtime_enabled?: boolean;
  provider_runtime_ready?: boolean;
  llm_ready?: boolean;
  khata_llm?: boolean;
  ollama?: string;
  conversational_model?: string;
  default_model?: string;
  configured_provider?: string;
}): boolean {
  if (statusResponse.mode === "oip") {
    return Boolean(
      statusResponse.provider_runtime_ready ??
        statusResponse.llm_ready ??
        statusResponse.khata_llm,
    );
  }
  return statusResponse.ollama === "connected" && Boolean(statusResponse.conversational_model);
}

/**
 * Whether to use the self-contained (rule-based) AI mode.
 *
 * Returns true ONLY when explicitly forced — never auto-fallback on Render.
 * Call checkErpBotStatus() / checkEKhataLlmStatus() to detect live LLM availability.
 */
export function isSelfContainedAi(): boolean {
  const forceBuiltin = (import.meta.env.VITE_SELF_CONTAINED_AI as string | undefined)?.trim();
  return forceBuiltin === "true" || forceBuiltin === "1";
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
  provider_runtime_enabled?: boolean;
  provider_runtime_ready?: boolean;
  llm_ready?: boolean;
  khata_llm?: boolean;
  default_model?: string;
  configured_provider?: string;
}): "llm" | "builtin" {
  if (statusResponse.mode === "builtin") return "builtin";

  if (isProviderRuntimeReady(statusResponse)) {
    return "llm";
  }

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
    detail: `Using ${model} via OIP Provider Runtime`,
    model,
    streaming,
  };
}
