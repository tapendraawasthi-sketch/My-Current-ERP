/**
 * Self-contained AI mode — built-in e-Khata + Falcon brains only.
 * No erp_bot, Ollama, or external API services required (Render production default).
 *
 * Local (vite dev OR production build on localhost): erp_bot on :8765 unless VITE_SELF_CONTAINED_AI=true.
 * Render/production host: built-in brain unless VITE_ERP_BOT_URL was set at build time.
 */

function isLocalMachine(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function isSelfContainedAi(): boolean {
  const forceBuiltin = (import.meta.env.VITE_SELF_CONTAINED_AI as string | undefined)?.trim();
  if (forceBuiltin === "true" || forceBuiltin === "1") return true;

  const explicit = (import.meta.env.VITE_ERP_BOT_URL as string | undefined)?.trim();
  // Local machine: keep erp_bot/Ollama even when running the Render-style production build.
  if (import.meta.env.DEV || isLocalMachine()) return false;
  // Remote production (Render): built-in brain unless a remote erp_bot URL was baked in at build.
  return !explicit;
}

export const SELF_CONTAINED_STATUS = {
  mode: "builtin" as const,
  label: "Built-in CA Brain",
  detail: "Self-contained — no external API or Ollama required",
};
