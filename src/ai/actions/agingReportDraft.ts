/** SUTRA AI — aging report direction prefill from AI navigate */

export interface AiAgingReportDraft {
  direction: "receivable" | "payable";
  searchTerm?: string;
  partyId?: string;
}

export const AI_AGING_REPORT_DRAFT_KEY = "sutra:ai-aging-report-draft";

export function saveAiAgingReportDraft(draft: AiAgingReportDraft): void {
  sessionStorage.setItem(AI_AGING_REPORT_DRAFT_KEY, JSON.stringify(draft));
}

export function peekAiAgingReportDraft(): AiAgingReportDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_AGING_REPORT_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiAgingReportDraft;
  } catch {
    return null;
  }
}

export function consumeAiAgingReportDraft(): AiAgingReportDraft | null {
  const draft = peekAiAgingReportDraft();
  if (draft) sessionStorage.removeItem(AI_AGING_REPORT_DRAFT_KEY);
  return draft;
}
