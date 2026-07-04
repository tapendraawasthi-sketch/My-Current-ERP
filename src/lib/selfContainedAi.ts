/**
 * Self-contained AI mode — built-in e-Khata + Falcon brains only.
 * No erp_bot, Ollama, or external API services required (Render production default).
 *
 * Opt-in to external erp_bot in dev by setting VITE_ERP_BOT_URL in .env.local
 */

export function isSelfContainedAi(): boolean {
  const explicit = (import.meta.env.VITE_ERP_BOT_URL as string | undefined)?.trim();
  // Production Render: always built-in. Dev: built-in unless URL explicitly set.
  if (import.meta.env.PROD) return true;
  return !explicit;
}

export const SELF_CONTAINED_STATUS = {
  mode: "builtin" as const,
  label: "Built-in CA Brain",
  detail: "Self-contained — no external API or Ollama required",
};
