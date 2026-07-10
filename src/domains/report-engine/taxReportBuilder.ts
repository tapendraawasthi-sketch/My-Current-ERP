import { readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionTax } from "@/platform/projections/projectionState";
import { createLegacyStateReader } from "@fios/legacy";

const state = createLegacyStateReader();

export interface TaxReportRow {
  entryId: string;
  vatAmount: number;
  tdsAmount: number;
  payload: Record<string, unknown>;
}

export async function buildTaxReportFromProjection(): Promise<{
  rows: TaxReportRow[];
  totalVat: number;
  totalTds: number;
}> {
  const taxRows = await readProjectionRows<DBProjectionTax>("projectionTax");
  const rows: TaxReportRow[] = taxRows.map((r) => {
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    return {
      entryId: String(r.entryId),
      vatAmount: Number(payload.vatAmount ?? 0),
      tdsAmount: Number(payload.tdsAmount ?? 0),
      payload,
    };
  });

  let totalVat = rows.reduce((s, r) => s + r.vatAmount, 0);
  let totalTds = rows.reduce((s, r) => s + r.tdsAmount, 0);

  if (rows.length === 0) {
    const invoices = state.getInvoices() as Array<Record<string, unknown>>;
    totalVat = invoices.reduce((s, inv) => s + Number(inv.vatAmount ?? 0), 0);
    totalTds = invoices.reduce((s, inv) => s + Number(inv.tdsAmount ?? 0), 0);
  }

  return { rows, totalVat, totalTds };
}
