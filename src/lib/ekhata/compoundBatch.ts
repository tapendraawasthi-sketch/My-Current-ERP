import { normalizeNepaliText } from "./normalizeNepali";
import { parseKhataMessage } from "./parseKhata";
import { splitCompoundTransactions } from "./compound";
import type { JournalLineDraft, KhataConfirmationCard, KhataIntent } from "./types";
import { KHATA_INTENT_LABELS } from "./types";

export interface KhataCompoundPart {
  index: number;
  text: string;
  card: KhataConfirmationCard;
}

export interface KhataCompoundBatchCard {
  compound: true;
  compoundCount: number;
  raw_text: string;
  amount: number;
  parts: KhataCompoundPart[];
  journalLines: JournalLineDraft[];
}

export type CompoundBatchBuildResult =
  | { ok: true; batch: KhataCompoundBatchCard; reply: string }
  | { ok: false; reply: string; failedPart?: string };

function mergeJournalLines(parts: KhataCompoundPart[]): JournalLineDraft[] {
  const lines: JournalLineDraft[] = [];
  for (const part of parts) {
    for (const line of part.card.journalLines ?? []) {
      lines.push({
        ...line,
        narration: `[${part.index}] ${line.narration ?? part.text}`,
      });
    }
  }
  return lines;
}

export function formatBatchConfirmation(
  parts: KhataCompoundPart[],
  language: "english" | "mixed" = "mixed",
): string {
  const header =
    language === "english"
      ? `📎 **${parts.length} separate transactions** — each verified. Please confirm:`
      : `📎 **${parts.length} alag transaction** — pratyek verify bhayo. Confirm garnus:`;

  const body = parts
    .map((part) => {
      const label = KHATA_INTENT_LABELS[part.card.intent as KhataIntent] ?? part.card.intent;
      return `\n**${part.index}.** ${part.text}\n   → ${label} | NPR ${part.card.amount.toLocaleString()}`;
    })
    .join("");

  return header + body;
}

export function buildCompoundBatch(rawText: string): CompoundBatchBuildResult {
  const parts = splitCompoundTransactions(rawText);
  if (parts.length < 2) {
    return { ok: false, reply: "Compound entry detect vayena." };
  }

  const subEntries: KhataCompoundPart[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const normalized = normalizeNepaliText(part);
    const parsed = parseKhataMessage(part, normalized);

    if (parsed.clarifying_question || !parsed.card) {
      return {
        ok: false,
        failedPart: part,
        reply:
          `Compound entry ko bhag ${i + 1} bujhiyena: «${part}». ` +
          "Pratyek line ma amount ra transaction type clear lekhnus.",
      };
    }

    subEntries.push({
      index: i + 1,
      text: part,
      card: parsed.card,
    });
  }

  const amount = subEntries.reduce((sum, s) => sum + s.card.amount, 0);
  const batch: KhataCompoundBatchCard = {
    compound: true,
    compoundCount: subEntries.length,
    raw_text: rawText,
    amount,
    parts: subEntries,
    journalLines: mergeJournalLines(subEntries),
  };

  return {
    ok: true,
    batch,
    reply: formatBatchConfirmation(subEntries),
  };
}
