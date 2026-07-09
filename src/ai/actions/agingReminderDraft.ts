/** SUTRA AI — aging report row → chat reminder handoff */

export interface AiAgingReminderDraft {
  partyName: string;
  direction: "receivable" | "payable";
  outstanding?: number;
  daysOverdue?: number;
  autoOpenWhatsApp?: boolean;
}

export const AI_AGING_REMINDER_DRAFT_KEY = "sutra:ai-aging-reminder-draft";
export const AI_AGING_WA_AUTO_OPEN_KEY = "sutra:ai-aging-wa-auto-open";

export function saveAiAgingReminderDraft(draft: AiAgingReminderDraft): void {
  try {
    sessionStorage.setItem(AI_AGING_REMINDER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function peekAiAgingReminderDraft(): AiAgingReminderDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_AGING_REMINDER_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiAgingReminderDraft;
  } catch {
    return null;
  }
}

export function consumeAiAgingReminderDraft(): AiAgingReminderDraft | null {
  const draft = peekAiAgingReminderDraft();
  if (draft) sessionStorage.removeItem(AI_AGING_REMINDER_DRAFT_KEY);
  return draft;
}

export function buildReminderQueryFromDraft(draft: AiAgingReminderDraft): string {
  const days =
    draft.daysOverdue && draft.daysOverdue > 0 ? ` ${draft.daysOverdue} days overdue` : "";
  if (draft.direction === "payable") {
    return `/reminder supplier ${draft.partyName}${days}`;
  }
  return `/reminder ${draft.partyName}${days}`;
}

export function queueAgingWaAutoOpen(partyName: string): void {
  try {
    sessionStorage.setItem(AI_AGING_WA_AUTO_OPEN_KEY, partyName);
  } catch {
    /* ignore */
  }
}

export function consumeAgingWaAutoOpen(): string | null {
  try {
    const name = sessionStorage.getItem(AI_AGING_WA_AUTO_OPEN_KEY);
    if (name) sessionStorage.removeItem(AI_AGING_WA_AUTO_OPEN_KEY);
    return name;
  } catch {
    return null;
  }
}
