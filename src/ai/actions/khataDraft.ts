/** SUTRA AI — khata draft session bridge to e-Khata panel */

import type { AiKhataDraft } from "../types";
import type { KhataConfirmationCard } from "@/lib/ekhata/types";
import { toKhataConfirmationCard } from "./KhataCardBuilder";

export const AI_KHATA_DRAFT_KEY = "sutra:ai-khata-draft";

export function saveAiKhataDraft(draft: AiKhataDraft): void {
  sessionStorage.setItem(AI_KHATA_DRAFT_KEY, JSON.stringify(draft));
}

export function peekAiKhataDraft(): AiKhataDraft | null {
  try {
    const raw = sessionStorage.getItem(AI_KHATA_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiKhataDraft;
  } catch {
    return null;
  }
}

export function consumeAiKhataDraft(): KhataConfirmationCard | null {
  const draft = peekAiKhataDraft();
  if (!draft) return null;
  sessionStorage.removeItem(AI_KHATA_DRAFT_KEY);
  return toKhataConfirmationCard(draft);
}
