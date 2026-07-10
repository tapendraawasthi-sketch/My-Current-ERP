import type { JournalLine } from "./accountingAggregate";
import { buildInvoiceJournalLines } from "./journalBuilder";
import { runPostingPipeline, type PostingPipelineResult } from "./postingPipeline";
import { accountingLogger } from "./accountingLogger";

export interface InvoicePostingSagaInput {
  sourceEventId: string;
  sourceEventType: string;
  invoice: Record<string, unknown>;
  dryRun?: boolean;
}

export async function executeInvoicePostingSaga(
  input: InvoicePostingSagaInput,
): Promise<PostingPipelineResult> {
  accountingLogger.debug("invoice-posting-saga-start", { eventId: input.sourceEventId });
  const lines: JournalLine[] = buildInvoiceJournalLines(input.invoice);
  if (lines.length === 0) {
    return { accepted: false, errors: ["No journal lines generated from invoice"] };
  }

  const invoiceId = String(input.invoice.id ?? input.sourceEventId);
  const invoiceNo = String(input.invoice.invoiceNo ?? invoiceId);
  const invoiceType = String(input.invoice.type ?? input.invoice.invoiceType ?? "invoice");
  const date = String(input.invoice.date ?? new Date().toISOString().slice(0, 10));

  return runPostingPipeline({
    sourceEventId: input.sourceEventId,
    sourceEventType: input.sourceEventType,
    voucherId: `jnl-${invoiceId}`,
    voucherNo: invoiceNo,
    voucherType: invoiceType,
    date,
    lines,
    partyId: input.invoice.partyId ? String(input.invoice.partyId) : undefined,
    referenceId: invoiceId,
    dryRun: input.dryRun,
  });
}
