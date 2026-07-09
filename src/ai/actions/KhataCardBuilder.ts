/** SUTRA AI — build e-Khata confirmation cards from extracted entities */

import type { AiKhataDraft, ExtractedEntities } from "../types";
import type { KhataIntent } from "@/lib/ekhata/types";
import { buildJournalLines, getEntryTemplate } from "@/lib/ekhata/caEntryTemplates";
import type { KhataConfirmationCard } from "@/lib/ekhata/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function resolveKhataIntent(entities: ExtractedEntities): KhataIntent | null {
  if (entities.transactionType === "receipt") return "khata_payment_in";
  if (entities.transactionType === "payment") return "khata_payment_out";
  if (entities.transactionType === "expense") return "khata_expense";
  return null;
}

export function buildAiKhataDraft(
  entities: ExtractedEntities,
  understoodInput: string,
): AiKhataDraft | null {
  const intent = resolveKhataIntent(entities);
  if (!intent) return null;

  const amount = entities.amount;
  if (!amount || amount <= 0) return null;

  return {
    intent,
    party: entities.partyResolvedName ?? entities.party,
    partyId: entities.partyId,
    amount,
    item: entities.productEnglish ?? entities.product,
    date: todayIso(),
    rawText: understoodInput,
    narration: `SUTRA AI: ${understoodInput}`,
  };
}

export function toKhataConfirmationCard(draft: AiKhataDraft): KhataConfirmationCard {
  const template = getEntryTemplate(draft.intent);
  const journalLines = buildJournalLines(draft.intent, {
    amount: draft.amount,
    party: draft.party ?? null,
    item: draft.item ?? null,
    narration: draft.narration,
  });

  return {
    intent: draft.intent,
    party: draft.party ?? null,
    amount: draft.amount,
    item: draft.item ?? null,
    date: draft.date,
    raw_text: draft.rawText,
    journalLines,
    caExplanation: template?.explanation,
    primaryClass: template?.primaryClass as KhataConfirmationCard["primaryClass"],
    tags: template?.tags,
  };
}
