/**
 * Particle direction detection from Nepal Universal AI BATCH 04.
 * Uses full particle_direction_map.json via generated PARTICLE_MAP.
 */

import { PARTICLE_MAP, type ParticleRuntimeEntry } from "./generated/runtimeMaps";

export type ParticleDirectionVector =
  | "OUTBOUND"
  | "INBOUND_SOURCE"
  | "AGENT_IDENTIFIER"
  | "BILATERAL_OR_HOLDER"
  | "OWNERSHIP_SCOPE"
  | "LOCATION_OR_TARGET"
  | "TEMPORAL_RANGE_START"
  | "TEMPORAL_OR_AMOUNT_CEILING"
  | "PURPOSE_OR_BENEFICIARY"
  | "UNIT_RATE_OR_FORMAL_ADDRESSEE"
  | "ABSENT_ELEMENT"
  | "EXCLUSION"
  | "COMPARATIVE_THRESHOLD"
  | "APPROXIMATION"
  | "TEMPORAL_AFTER"
  | "TEMPORAL_BEFORE_OR_ADVANCE"
  | "ABOVE_THRESHOLD_OR_ADDITIONAL"
  | "BELOW_THRESHOLD"
  | "WITHIN_SCOPE_OR_DEADLINE"
  | "OUTSIDE_SCOPE_OR_ZONE"
  | "LOCATION_PROXIMITY"
  | "DISTANCE_OR_REMOTE"
  | "INTER_PARTY_OR_RANGE"
  | "OWN_SIDE_DOMESTIC"
  | "COUNTERPARTY_OR_CROSS_BORDER"
  | "APPROXIMATE_DIRECTION"
  | "PROXIMITY_OR_APPROACHING_DEADLINE"
  | "UNDER_CATEGORY_OR_AUTHORITY"
  | "ADDITIONAL_CHARGE_ON_BASE"
  | "PRIOR_HISTORICAL_REFERENCE";

export interface ParticleMatch {
  particle: string;
  direction_vector: ParticleDirectionVector;
  intent_hint: string;
  signal_strength?: string;
}

const CORE_PARTICLES: Record<string, Omit<ParticleMatch, "particle">> = Object.fromEntries(
  Object.entries(PARTICLE_MAP).map(([k, v]) => [
    k,
    {
      direction_vector: v.direction_vector as ParticleDirectionVector,
      intent_hint: v.intent_hint,
    },
  ]),
);

const OUTBOUND_VERBS = /\b(diye|diyo|deko|tiryo|tireko|becheko|bechyo|pathaaeko|pathayo|udharo\s+deko)\b/i;
const INBOUND_VERBS = /\b(aayo|aayeko|paayo|payo|paayeko|leko|liyo|jhikeko|kineko)\b/i;

/** Find all particle matches in text (longest token wins per position). */
export function detectParticlesInText(text: string): ParticleMatch[] {
  const tokens = text.toLowerCase().split(/\s+/);
  const found: ParticleMatch[] = [];
  for (const token of tokens) {
    const hit = CORE_PARTICLES[token];
    if (hit) found.push({ particle: token, ...hit });
  }
  return found;
}

/** Infer money flow direction from particles + verbs. */
export function inferTransactionDirection(text: string): {
  direction: "inbound" | "outbound" | "bilateral" | "unknown";
  confidence: "high" | "medium" | "low";
  reason: string;
} {
  const t = text.toLowerCase();
  const particles = detectParticlesInText(t);
  const hasLai = particles.some((p) => p.direction_vector === "OUTBOUND");
  const hasBata = particles.some((p) => p.direction_vector === "INBOUND_SOURCE");
  const hasLe = particles.some((p) => p.direction_vector === "AGENT_IDENTIFIER");
  const hasSanga = particles.some((p) => p.direction_vector === "BILATERAL_OR_HOLDER");

  if (hasLai && OUTBOUND_VERBS.test(t)) {
    return { direction: "outbound", confidence: "high", reason: "lai + outgoing verb" };
  }
  if (hasBata && INBOUND_VERBS.test(t)) {
    return { direction: "inbound", confidence: "high", reason: "bata + inbound verb" };
  }
  if (hasLai && !hasBata) {
    return { direction: "outbound", confidence: "medium", reason: "lai recipient marker" };
  }
  if (hasBata && !hasLai) {
    return { direction: "inbound", confidence: "medium", reason: "bata source marker" };
  }
  if (hasSanga && /\b(baki|hisab|saadh)\b/i.test(t)) {
    return { direction: "bilateral", confidence: "medium", reason: "sanga + balance/settlement" };
  }
  if (hasLe && OUTBOUND_VERBS.test(t)) {
    return { direction: "outbound", confidence: "low", reason: "le agent + outgoing verb" };
  }
  if (hasLe && INBOUND_VERBS.test(t)) {
    return { direction: "inbound", confidence: "low", reason: "le agent + inbound verb" };
  }
  return { direction: "unknown", confidence: "low", reason: "no clear particle direction" };
}

/** Flag approximate amounts (jasto) or compliance gaps (bina bill/receipt). */
export function detectParticleFlags(text: string): string[] {
  const flags: string[] = [];
  const t = text.toLowerCase();
  if (/\bjasto\b/.test(t)) flags.push("approximate_amount");
  if (/\bbina\b.*\b(bill|receipt|hisab|anumati)\b/.test(t)) flags.push("undocumented_transaction");
  if (/\bvat\b.*\bbahek\b/.test(t)) flags.push("tax_exclusive_amount");
  if (/\bprati\b/.test(t)) flags.push("unit_rate_present");
  if (/\bdekhi\b.*\bsamma\b/.test(t)) flags.push("date_range_filter");
  if (/\bbhitra\b/.test(t) && /\b(din|gate|mahina)\b/.test(t)) flags.push("payment_deadline");
  return flags;
}

export { CORE_PARTICLES };
