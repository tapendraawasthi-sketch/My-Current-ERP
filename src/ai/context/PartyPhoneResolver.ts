/** SUTRA AI — resolve party mobile for WhatsApp deep links */

import type { ErpPartyRef, ErpRagContext } from "../types";
import { resolveUniqueParty } from "../rag/mai08MasterResolve";

export function normalizeWhatsAppPhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("977") && digits.length >= 12) return digits;
  if (digits.length === 10) return `977${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `977${digits.slice(1)}`;
  return digits;
}

export function resolvePartyPhone(
  partyQuery: string | undefined,
  ctx?: ErpRagContext,
): string | undefined {
  if (!partyQuery || !ctx?.parties?.length) return undefined;
  // MAI-08 slice 2: no silent top-1 bind below party floor / gap policy
  const resolved = resolveUniqueParty(partyQuery, ctx.parties);
  if (resolved.status !== "bound") return undefined;
  return normalizeWhatsAppPhone(resolved.hit.ref.phone);
}

export function phoneFromPartyRef(party?: ErpPartyRef): string | undefined {
  return normalizeWhatsAppPhone(party?.phone);
}
