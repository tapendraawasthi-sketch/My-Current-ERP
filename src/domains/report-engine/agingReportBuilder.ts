import { readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionDocument } from "@/platform/projections/projectionState";
import { computeAgingReport } from "@/lib/accounting";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export async function buildAgingReportFromProjection(
  asOfDate?: string,
  partyType?: string,
): Promise<ReturnType<typeof computeAgingReport>> {
  const invoiceRows = await readProjectionRows<DBProjectionDocument>("projectionInvoice");
  if (invoiceRows.length === 0) {
    return computeAgingReport(
      state.getInvoices(),
      state.getParties(),
      asOfDate,
      partyType,
    );
  }

  const invoices = invoiceRows.map((r) => r.payload as never);
  return computeAgingReport(invoices, state.getParties(), asOfDate, partyType);
}
