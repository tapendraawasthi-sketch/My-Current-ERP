/** SUTRA AI — party edit draft bridge to Party Master */

import type { AiPartyDraft } from "../types";

export const AI_PARTY_DRAFT_KEY = "sutra:ai-party-draft";

export function saveAiPartyDraft(draft: AiPartyDraft): void {
  sessionStorage.setItem(AI_PARTY_DRAFT_KEY, JSON.stringify(draft));
}

export function peekAiPartyDraft(): AiPartyDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_PARTY_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiPartyDraft;
  } catch {
    return null;
  }
}

export function consumeAiPartyDraft(): AiPartyDraft | null {
  const draft = peekAiPartyDraft();
  if (draft) sessionStorage.removeItem(AI_PARTY_DRAFT_KEY);
  return draft;
}
