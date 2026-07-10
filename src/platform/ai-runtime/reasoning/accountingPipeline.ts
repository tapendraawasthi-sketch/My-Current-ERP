import { createImmutable } from "../types/immutable";
import type { AccountingIntentExtract, JournalProposal } from "../types/accounting";
import { extractAccountingIntent, isAccountingCommand } from "./accountingIntentExtractor";
import { buildJournalProposal, reasonAboutJournal } from "./journalProposalBuilder";
import { getMemoryStore } from "../memory";

export interface AccountingPipelineContext {
  readonly extract: AccountingIntentExtract | null;
  readonly proposal: JournalProposal | null;
}

export function runAccountingIntentExtraction(
  rawInput: string,
  sessionId: string,
): AccountingPipelineContext {
  const extract = extractAccountingIntent(rawInput);
  const memory = getMemoryStore();

  if (!extract || !isAccountingCommand(extract)) {
    memory.working.delete(`accounting:${sessionId}`);
    memory.working.delete(`journal:${sessionId}`);
    return { extract, proposal: null };
  }

  memory.working.set(`accounting:${sessionId}`, extract);
  return { extract, proposal: null };
}

export function runAccountingReasoning(sessionId: string): AccountingPipelineContext {
  const memory = getMemoryStore();
  const extract = memory.working.get(`accounting:${sessionId}`) as AccountingIntentExtract | undefined;

  if (!extract || !isAccountingCommand(extract)) {
    return { extract: extract ?? null, proposal: null };
  }

  const proposal = buildJournalProposal(extract);
  memory.working.set(`journal:${sessionId}`, proposal);

  return { extract, proposal };
}

export function getStoredJournalProposal(sessionId: string): JournalProposal | null {
  return (getMemoryStore().working.get(`journal:${sessionId}`) as JournalProposal | undefined) ?? null;
}

export function getStoredAccountingExtract(sessionId: string): AccountingIntentExtract | null {
  return (getMemoryStore().working.get(`accounting:${sessionId}`) as AccountingIntentExtract | undefined) ?? null;
}

export function buildAccountingReasoningText(proposal: JournalProposal): string {
  return reasonAboutJournal(proposal);
}

export function buildAccountingExplanation(proposal: JournalProposal, voucherNo?: string): string {
  const lines = [
    proposal.explanation,
    "",
    "Why this entry:",
    `- ${proposal.khataIntent === "khata_payment_out" ? "You paid a party — this settles a payable (creditor)." : "Accounting treatment per Nepal GAAP double-entry."}`,
    `- Bank payment: Bank Account (asset) decreases on credit side.`,
    `- Creditor/Payable (liability) decreases on debit side.`,
    `- Party ${proposal.party ?? ""} payable balance reduces by NPR ${proposal.amount.toLocaleString()}.`,
  ];
  if (voucherNo) {
    lines.push("", `Voucher posted: ${voucherNo}`);
  }
  return lines.join("\n");
}

export type { AccountingIntentExtract, JournalProposal };
