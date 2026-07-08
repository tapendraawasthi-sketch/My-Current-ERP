/**
 * Nepal Universal AI — safety gate before journal posting.
 */

import { SAFETY_PATTERNS } from "./generated/runtimeMaps";

const COMPILED = SAFETY_PATTERNS.map((p) => ({
  ...p,
  re: new RegExp(p.pattern, "i"),
}));

export interface SafetyGateResult {
  blocked: boolean;
  action: "refuse" | "disclaimer" | null;
  response_ne: string;
  response_en: string;
  category: string | null;
}

export function checkSafetyGate(text: string): SafetyGateResult | null {
  const t = text.trim();
  if (!t) return null;

  for (const entry of COMPILED) {
    if (entry.re.test(t)) {
      return {
        blocked: entry.action === "refuse",
        action: entry.action as "refuse" | "disclaimer",
        response_ne: entry.response_ne,
        response_en: entry.response_en,
        category: entry.category,
      };
    }
  }
  return null;
}
