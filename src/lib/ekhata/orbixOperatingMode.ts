/** Orbix operating modes — Ask (read-only) vs Accountant (authorized mutations). */

export type OrbixOperatingMode = "ask" | "accountant";

export const ORBIX_MODE_STORAGE_KEY = "orbix-operating-mode-v1";

export const ORBIX_MODE_META: Record<
  OrbixOperatingMode,
  { label: string; description: string }
> = {
  ask: {
    label: "Ask",
    description: "Ask questions, generate reports and analyze ERP data.",
  },
  accountant: {
    label: "Accountant",
    description:
      "Ask questions, generate reports and create or modify authorized ERP records.",
  },
};

export function normalizeOrbixMode(value: unknown): OrbixOperatingMode {
  if (value === "accountant") return "accountant";
  return "ask";
}

export function loadOrbixOperatingMode(): OrbixOperatingMode {
  try {
    return normalizeOrbixMode(localStorage.getItem(ORBIX_MODE_STORAGE_KEY));
  } catch {
    return "ask";
  }
}

export function saveOrbixOperatingMode(mode: OrbixOperatingMode): void {
  try {
    localStorage.setItem(ORBIX_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}
