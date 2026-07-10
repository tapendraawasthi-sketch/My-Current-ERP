import type { JournalLine } from "./accountingAggregate";
import { buildTaxLinesFromInvoice } from "./taxPostingEngine";

function partyAccountId(invoice: Record<string, unknown>): string {
  if (invoice.partyAccountId) return String(invoice.partyAccountId);
  const type = String(invoice.type ?? invoice.invoiceType ?? "");
  return type.includes("sales") ? "acc-sundry-debtors" : "acc-sundry-creditors";
}

function sundryNet(invoice: Record<string, unknown>): number {
  const sundries = (invoice.billSundries as Array<{ amount?: number; type?: string }>) || [];
  return sundries.reduce((acc, s) => {
    const amt = Number(s.amount ?? 0);
    return s.type === "deductive" ? acc - amt : acc + amt;
  }, 0);
}

function pushRoundOff(lines: JournalLine[], roundOff: number): void {
  if (Math.abs(roundOff) < 0.005) return;
  if (roundOff > 0) {
    lines.push({ accountId: "acc-indirect-expenses", accountName: "Round Off", debit: 0, credit: roundOff });
  } else {
    lines.push({ accountId: "acc-indirect-expenses", accountName: "Round Off", debit: -roundOff, credit: 0 });
  }
}

export function buildInvoiceJournalLines(invoice: Record<string, unknown>): JournalLine[] {
  const lines: JournalLine[] = [];
  const type = String(invoice.type ?? invoice.invoiceType ?? "");
  const partyId = partyAccountId(invoice);
  const taxable = Number(invoice.taxableAmount ?? 0);
  const exempt = Number(invoice.exemptAmount ?? 0);
  const grandTotal = Number(invoice.grandTotal ?? 0);
  const roundOff = Number(invoice.roundOff ?? 0);
  const net = sundryNet(invoice);
  const tax = buildTaxLinesFromInvoice(invoice);

  if (type === "sales-invoice") {
    lines.push({ accountId: partyId, accountName: String(invoice.partyName ?? ""), debit: grandTotal, credit: 0 });
    if (taxable > 0) lines.push({ accountId: "acc-sales", accountName: "Sales", debit: 0, credit: taxable });
    if (exempt > 0) lines.push({ accountId: "acc-sales", accountName: "Sales (Exempt)", debit: 0, credit: exempt });
    lines.push(...tax.lines);
    if (net > 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: 0, credit: net });
    else if (net < 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: -net, credit: 0 });
    pushRoundOff(lines, roundOff);
  } else if (type === "sales-return") {
    lines.push({ accountId: partyId, accountName: String(invoice.partyName ?? ""), debit: 0, credit: grandTotal });
    if (taxable > 0) lines.push({ accountId: "acc-sales", accountName: "Sales Return", debit: taxable, credit: 0 });
    if (exempt > 0) lines.push({ accountId: "acc-sales", accountName: "Sales Return (Exempt)", debit: exempt, credit: 0 });
    lines.push(...tax.lines);
    if (net > 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: net, credit: 0 });
    else if (net < 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: 0, credit: -net });
    pushRoundOff(lines, roundOff);
  } else if (type === "purchase-invoice") {
    if (taxable > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchases", debit: taxable, credit: 0 });
    if (exempt > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchases (Exempt)", debit: exempt, credit: 0 });
    lines.push(...tax.lines);
    const partyCredit = Math.max(0, grandTotal - tax.tdsAmount);
    lines.push({ accountId: partyId, accountName: String(invoice.partyName ?? ""), debit: 0, credit: partyCredit });
    if (net > 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: net, credit: 0 });
    else if (net < 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: 0, credit: -net });
    pushRoundOff(lines, roundOff);
  } else if (type === "purchase-return") {
    if (taxable > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchase Return", debit: 0, credit: taxable });
    if (exempt > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchase Return (Exempt)", debit: 0, credit: exempt });
    lines.push(...tax.lines);
    lines.push({ accountId: partyId, accountName: String(invoice.partyName ?? ""), debit: grandTotal, credit: 0 });
    if (net > 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: 0, credit: net });
    else if (net < 0) lines.push({ accountId: "acc-sales", accountName: "Bill Sundries", debit: -net, credit: 0 });
    pushRoundOff(lines, roundOff);
  }

  return lines;
}

export function buildVoucherJournalLines(voucher: Record<string, unknown>): JournalLine[] {
  const rawLines = (voucher.lines as Array<Record<string, unknown>>) || [];
  return rawLines
    .filter((l) => l.accountId)
    .map((l) => ({
      accountId: String(l.accountId),
      accountName: l.accountName ? String(l.accountName) : undefined,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      narration: l.narration ? String(l.narration) : undefined,
    }));
}
