/** SUTRA AI — resolve party mobile for WhatsApp deep links */

import type { ErpPartyRef, ErpRagContext } from "../types";
import { erpRagRetriever } from "../rag/ErpRagRetriever";

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
  const hit = erpRagRetriever.findParties(partyQuery, ctx.parties, 1)[0];
  if (!hit || hit.score < 0.55) return undefined;
  return normalizeWhatsAppPhone(hit.ref.phone);
}

export function phoneFromPartyRef(party?: ErpPartyRef): string | undefined {
  return normalizeWhatsAppPhone(party?.phone);
}
