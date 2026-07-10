import { buildJournalLines, getEntryTemplate, validateJournalBalance } from "@/lib/ekhata/caEntryTemplates";
import type { KhataConfirmationCard, KhataIntent, JournalLineDraft } from "@/lib/ekhata/types";
import { createImmutable } from "../types/immutable";
import type { AccountingIntentExtract, JournalProposal, PaymentMode } from "../types/accounting";

const CREDIT_ACCOUNT_BY_MODE: Partial<Record<KhataIntent, Partial<Record<PaymentMode, string>>>> = {
  khata_payment_out: { bank: "KH-BANK", cash: "KH-CASH", unknown: "KH-CASH" },
  khata_payment_in: { bank: "KH-BANK", cash: "KH-CASH", unknown: "KH-CASH" },
  khata_expense: { bank: "KH-BANK", cash: "KH-CASH", unknown: "KH-CASH" },
  khata_purchase: { bank: "KH-BANK", cash: "KH-CASH", unknown: "KH-CASH" },
};

function applyPaymentModeOverride(
  intent: KhataIntent,
  lines: JournalLineDraft[],
  paymentMode: PaymentMode,
): JournalLineDraft[] {
  const creditCode = CREDIT_ACCOUNT_BY_MODE[intent]?.[paymentMode];
  if (!creditCode) return lines;

  return lines.map((l) => {
    if (l.credit > 0 && l.accountCode === "KH-CASH" && paymentMode === "bank") {
      return { ...l, accountCode: "KH-BANK", accountName: "Bank Account" };
    }
    if (l.debit > 0 && l.accountCode === "KH-CASH" && paymentMode === "bank") {
      return { ...l, accountCode: "KH-BANK", accountName: "Bank Account" };
    }
    return l;
  });
}

function buildExplanation(
  extract: AccountingIntentExtract,
  templateExplanation: string | undefined,
  lines: JournalLineDraft[],
): string {
  const dr = lines.find((l) => l.debit > 0);
  const cr = lines.find((l) => l.credit > 0);
  const modeLabel = extract.paymentMode === "bank" ? "bank transfer" : "cash";

  return [
    templateExplanation ?? "Standard double-entry treatment applies.",
    `Party: ${extract.party ?? "—"}. Amount: NPR ${extract.amount.toLocaleString()}. Mode: ${modeLabel}.`,
    dr && cr
      ? `Journal: Dr ${dr.accountName} (${dr.debit.toLocaleString()}) / Cr ${cr.accountName} (${cr.credit.toLocaleString()}).`
      : "",
    extract.khataIntent === "khata_payment_out"
      ? "Paying a creditor reduces Payable (liability) and reduces Bank/Cash (asset)."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildJournalProposal(extract: AccountingIntentExtract): JournalProposal {
  const template = getEntryTemplate(extract.khataIntent);
  let lines = buildJournalLines(extract.khataIntent, {
    amount: extract.amount,
    party: extract.party,
    narration: extract.rawInput,
  });

  lines = applyPaymentModeOverride(extract.khataIntent, lines, extract.paymentMode);
  const balance = validateJournalBalance(lines);

  const card: KhataConfirmationCard = {
    intent: extract.khataIntent,
    party: extract.party,
    amount: extract.amount,
    date: new Date().toISOString().slice(0, 10),
    raw_text: extract.rawInput,
    journalLines: lines,
    caExplanation: template?.explanation,
    primaryClass: template?.primaryClass as KhataConfirmationCard["primaryClass"],
    tags: template?.tags,
  };

  const explanation = buildExplanation(extract, template?.explanation, lines);

  return createImmutable({
    id: `journal-${Date.now()}`,
    khataIntent: extract.khataIntent,
    party: extract.party,
    amount: extract.amount,
    paymentMode: extract.paymentMode,
    lines: lines.map((l) => ({
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.debit,
      credit: l.credit,
      narration: l.narration,
    })),
    balanced: balance.balanced,
    explanation,
    card: card as unknown as Record<string, unknown>,
  });
}

export function reasonAboutJournal(proposal: JournalProposal): string {
  return [
    `Accounting intent: ${proposal.khataIntent}`,
    `Double-entry ${proposal.balanced ? "balanced" : "UNBALANCED — refuse execution"}.`,
    proposal.explanation,
  ].join("\n");
}
