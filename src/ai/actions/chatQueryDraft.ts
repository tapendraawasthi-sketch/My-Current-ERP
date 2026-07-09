/** SUTRA AI — pending chat query handoff (e.g. /setphone from aging report) */

import type { LanguageCode } from "../types";

export const AI_CHAT_QUERY_DRAFT_KEY = "sutra:ai-chat-query-draft";
export const AI_AGING_SETPHONE_RETURN_KEY = "sutra:ai-aging-setphone-return";

export interface AiAgingSetphoneReturnDraft {
  direction: "receivable" | "payable";
  searchTerm: string;
  outstanding?: number;
  daysOverdue?: number;
}

export function saveAiChatQueryDraft(query: string): void {
  try {
    sessionStorage.setItem(AI_CHAT_QUERY_DRAFT_KEY, query);
  } catch {
    /* ignore */
  }
}

export function peekAiChatQueryDraft(): string | null {
  try {
    return sessionStorage.getItem(AI_CHAT_QUERY_DRAFT_KEY);
  } catch {
    return null;
  }
}

export function consumeAiChatQueryDraft(): string | null {
  const query = peekAiChatQueryDraft();
  if (query) sessionStorage.removeItem(AI_CHAT_QUERY_DRAFT_KEY);
  return query;
}

export function buildSetPhoneHandoffQuery(partyName: string): string {
  return `/setphone ${partyName.trim()} `;
}

export function saveAgingSetphoneReturnDraft(draft: AiAgingSetphoneReturnDraft): void {
  try {
    sessionStorage.setItem(AI_AGING_SETPHONE_RETURN_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function peekAgingSetphoneReturnDraft(): AiAgingSetphoneReturnDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_AGING_SETPHONE_RETURN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiAgingSetphoneReturnDraft;
  } catch {
    return null;
  }
}

export function consumeAgingSetphoneReturnDraft(): AiAgingSetphoneReturnDraft | null {
  const draft = peekAgingSetphoneReturnDraft();
  if (draft) sessionStorage.removeItem(AI_AGING_SETPHONE_RETURN_KEY);
  return draft;
}

export const AGING_RETURN_QR_PREFIX = "__sutra_aging_return__:";

export function encodeAgingReturnQuickReplyValue(draft: AiAgingSetphoneReturnDraft): string {
  return `${AGING_RETURN_QR_PREFIX}${encodeURIComponent(JSON.stringify(draft))}`;
}

export function decodeAgingReturnQuickReplyValue(value: string): AiAgingSetphoneReturnDraft | null {
  if (!value.startsWith(AGING_RETURN_QR_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(value.slice(AGING_RETURN_QR_PREFIX.length)),
    ) as AiAgingSetphoneReturnDraft;
    if (!parsed.direction || !parsed.searchTerm) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function formatAgingReturnQuickReplyLabel(lang: LanguageCode): string {
  if (lang === "nepali") return "उमेर विवरण";
  if (lang === "roman") return "Aging report";
  return "Aging Report";
}

export function formatAgingReturnConfirmation(lang: LanguageCode): string {
  if (lang === "english") return "Opened Aging Report with party filter.";
  if (lang === "roman") return "Aging report khulyo — party filter lagi search bhariyo.";
  return "पार्टी फिल्टर सहित Aging Report खोलियो।";
}
