/**
 * CA Entry Engine — orchestrates intent → journal draft for e-Khata.
 * Used by parseKhata and confirmKhata for Chartered Accountant-level entries.
 */

import type { KhataConfirmationCard, KhataIntent, JournalLineDraft } from "./types";
import {
  buildJournalLines,
  findTemplateByKeywords,
  getEntryTemplate,
  validateJournalBalance,
  type EntryBuildParams,
} from "./caEntryTemplates";
import type { AccountClass } from "./types";

export interface CAEntryResult {
  card: KhataConfirmationCard;
  lines: JournalLineDraft[];
  balanced: boolean;
  explanation: string;
}

export function generateCAEntry(
  intent: KhataIntent,
  params: {
    amount: number;
    secondaryAmount?: number;
    party?: string | null;
    item?: string | null;
    date: string;
    rawText: string;
  },
): CAEntryResult {
  const template = getEntryTemplate(intent);
  if (!template) {
    throw new Error(`Unsupported intent: ${intent}`);
  }

  const buildParams: EntryBuildParams = {
    amount: params.amount,
    secondaryAmount: params.secondaryAmount,
    party: params.party,
    item: params.item,
    narration: params.rawText,
  };

  const lines = buildJournalLines(intent, buildParams);
  const { balanced, totalDebit, totalCredit } = validateJournalBalance(lines);

  if (!balanced) {
    throw new Error(
      `Journal not balanced: Dr ${totalDebit} ≠ Cr ${totalCredit} for intent ${intent}`,
    );
  }

  const card: KhataConfirmationCard = {
    intent,
    party: params.party ?? null,
    amount: params.amount,
    secondaryAmount: params.secondaryAmount ?? null,
    item: params.item ?? null,
    date: params.date,
    raw_text: params.rawText,
    journalLines: lines,
    caExplanation: template.explanation,
    primaryClass: template.primaryClass as AccountClass,
    tags: template.tags,
  };

  return {
    card,
    lines,
    balanced,
    explanation: template.explanation,
  };
}

/** Format journal lines for chat display */
export function formatJournalPreview(lines: JournalLineDraft[]): string {
  const rows = lines.map((l) => {
    const dr = l.debit > 0 ? `Dr ${l.debit.toLocaleString()}` : "";
    const cr = l.credit > 0 ? `Cr ${l.credit.toLocaleString()}` : "";
    const side = dr || cr;
    return `  ${l.accountName} (${l.accountClass}) — ${side}`;
  });
  const { totalDebit, totalCredit, balanced } = validateJournalBalance(lines);
  const balanceLine = balanced
    ? `✓ Balanced: Dr ${totalDebit.toLocaleString()} = Cr ${totalCredit.toLocaleString()}`
    : `✗ Unbalanced: Dr ${totalDebit} ≠ Cr ${totalCredit}`;
  return rows.join("\n") + "\n" + balanceLine;
}

/** Training helper: classify a narration into suggested intent + explanation */
export function classifyScenario(narration: string): {
  suggestedIntent: KhataIntent | null;
  explanation: string;
  tags: string[];
} | null {
  const template = getEntryTemplateByText(narration);
  if (!template) return null;
  return {
    suggestedIntent: template.intent,
    explanation: template.explanation,
    tags: template.tags,
  };
}

function getEntryTemplateByText(text: string) {
  return findTemplateByKeywords(text);
}

export { validateJournalBalance, buildJournalLines, getEntryTemplate };
