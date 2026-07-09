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
import { getAccountByCode } from "./caAccountClassification";
import {
  matchJournalEntryRule,
  resolveJeAccountCode,
  type JournalRuleMatch,
} from "../nepal-ai/journalEntryRules";

export interface CAEntryResult {
  card: KhataConfirmationCard;
  lines: JournalLineDraft[];
  balanced: boolean;
  explanation: string;
}

function buildLinesFromJeRule(
  match: JournalRuleMatch,
  params: EntryBuildParams,
): JournalLineDraft[] {
  const amount = params.amount;
  const party = params.party;
  const debitLabel = match.rule.thenDebit.replace(/\{party\}/gi, party ?? "").trim();
  const creditLabel = match.rule.thenCredit.replace(/\{party\}/gi, party ?? "").trim();
  const debitCode = resolveJeAccountCode(debitLabel);
  const creditCode = resolveJeAccountCode(creditLabel);
  const d = getAccountByCode(debitCode);
  const c = getAccountByCode(creditCode);
  if (!d || !c) {
    return buildJournalLines(match.rule.baseIntent as KhataIntent, params);
  }
  const narration = params.narration;
  return [
    {
      accountCode: d.code,
      accountName: party && /debtors|creditors|payable|receivable/i.test(debitLabel)
        ? `${d.name}${party ? ` / ${party}` : ""}`
        : d.name,
      accountClass: d.class as JournalLineDraft["accountClass"],
      debit: Math.round(amount * 100) / 100,
      credit: 0,
      narration: narration ?? debitLabel,
    },
    {
      accountCode: c.code,
      accountName: party && /debtors|creditors|payable|receivable/i.test(creditLabel)
        ? `${c.name}${party ? ` / ${party}` : ""}`
        : c.name,
      accountClass: c.class as JournalLineDraft["accountClass"],
      debit: 0,
      credit: Math.round(amount * 100) / 100,
      narration: narration ?? creditLabel,
    },
  ];
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
    jeMatch?: JournalRuleMatch | null;
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

  const jeMatch = params.jeMatch ?? matchJournalEntryRule(params.rawText);
  const lines =
    jeMatch && jeMatch.rule.baseIntent === intent
      ? buildLinesFromJeRule(jeMatch, buildParams)
      : buildJournalLines(intent, buildParams);
  const { balanced, totalDebit, totalCredit } = validateJournalBalance(lines);

  if (!balanced) {
    throw new Error(
      `Journal not balanced: Dr ${totalDebit} ≠ Cr ${totalCredit} for intent ${intent}`,
    );
  }

  const explanation = jeMatch
    ? `${template.explanation} [${jeMatch.rule.ruleId}: Dr ${jeMatch.rule.thenDebit} / Cr ${jeMatch.rule.thenCredit}]`
    : template.explanation;

  const card: KhataConfirmationCard = {
    intent,
    party: params.party ?? null,
    amount: params.amount,
    secondaryAmount: params.secondaryAmount ?? null,
    item: params.item ?? null,
    date: params.date,
    raw_text: params.rawText,
    journalLines: lines,
    caExplanation: explanation,
    primaryClass: template.primaryClass as AccountClass,
    tags: [
      ...template.tags,
      ...(jeMatch ? [`je:${jeMatch.rule.ruleId}`, jeMatch.rule.thenIntent] : []),
    ],
    jeRuleId: jeMatch?.rule.ruleId ?? null,
    jeThenIntent: jeMatch?.rule.thenIntent ?? null,
  };

  return {
    card,
    lines,
    balanced,
    explanation,
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
