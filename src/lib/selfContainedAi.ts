/**
 * Self-contained AI mode — built-in e-Khata + Falcon brains only.
 * No erp_bot, Ollama, or external API services required (Render production default).
 *
 * Opt-in to external erp_bot in dev by setting VITE_ERP_BOT_URL in .env.local
 */

export function isSelfContainedAi(): boolean {
  const explicit = (import.meta.env.VITE_ERP_BOT_URL as string | undefined)?.trim();
  // Built-in rule-based brain only, UNLESS a real erp_bot/Ollama URL is configured
  // (works the same in dev and production — set VITE_ERP_BOT_URL to your self-hosted
  // erp_bot instance to enable the real local LLM instead of pattern matching).
  return !explicit;
}

export const SELF_CONTAINED_STATUS = {
  mode: "builtin" as const,
  label: "Built-in CA Brain",
  detail: "Self-contained — no external API or Ollama required",
};
