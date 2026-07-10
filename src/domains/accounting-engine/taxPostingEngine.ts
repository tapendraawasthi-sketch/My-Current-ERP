import type { JournalLine } from "./accountingAggregate";

export interface TaxPostingResult {
  lines: JournalLine[];
  vatAmount: number;
  tdsAmount: number;
}

export function buildTaxLinesFromInvoice(invoice: Record<string, unknown>): TaxPostingResult {
  const lines: JournalLine[] = [];
  const invoiceType = String(invoice.type ?? invoice.invoiceType ?? "");
  const vat = Number(invoice.vatAmount ?? 0);
  const tds = Number(invoice.tdsAmount ?? 0);
  const isSales = invoiceType.includes("sales") && !invoiceType.includes("return");
  const isPurchase = invoiceType.includes("purchase") && !invoiceType.includes("return");

  if (vat > 0) {
    if (isSales || invoiceType === "sales-return") {
      lines.push({
        accountId: "acc-vat-payable",
        accountName: "VAT Payable",
        debit: invoiceType === "sales-return" ? vat : 0,
        credit: invoiceType === "sales-return" ? 0 : vat,
      });
    } else if (isPurchase || invoiceType === "purchase-return") {
      lines.push({
        accountId: "acc-vat-receivable",
        accountName: "VAT Receivable",
        debit: invoiceType === "purchase-return" ? 0 : vat,
        credit: invoiceType === "purchase-return" ? vat : 0,
      });
    }
  }

  if (tds > 0) {
    if (isSales) {
      lines.push({
        accountId: "acc-tds-receivable",
        accountName: "TDS Receivable",
        debit: tds,
        credit: 0,
      });
    } else if (isPurchase) {
      lines.push({
        accountId: "acc-tds-payable",
        accountName: "TDS Payable",
        debit: 0,
        credit: tds,
      });
    }
  }

  return { lines, vatAmount: vat, tdsAmount: tds };
}
