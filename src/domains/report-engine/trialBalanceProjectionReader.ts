import { readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionTrialBalance } from "@/platform/projections/projectionState";

export interface TrialBalanceReport {
  rows: Array<{
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
}

export async function readTrialBalanceFromProjection(): Promise<TrialBalanceReport> {
  const rows = await readProjectionRows<DBProjectionTrialBalance>("projectionTrialBalance");
  const mapped = rows.map((r) => ({
    accountId: String(r.accountId),
    accountName: String(r.accountName ?? ""),
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
  }));
  const totalDebit = mapped.reduce((s, r) => s + r.debit, 0);
  const totalCredit = mapped.reduce((s, r) => s + r.credit, 0);
  return { rows: mapped, totalDebit, totalCredit };
}
