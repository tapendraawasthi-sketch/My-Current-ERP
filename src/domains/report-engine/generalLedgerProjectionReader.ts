import { readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionGeneralLedger } from "@/platform/projections/projectionState";

export interface GeneralLedgerRow {
  accountId: string;
  voucherId: string;
  date: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function readGeneralLedgerFromProjection(
  accountId?: string,
): Promise<GeneralLedgerRow[]> {
  const rows = await readProjectionRows<DBProjectionGeneralLedger>("projectionGeneralLedger");
  const filtered = accountId ? rows.filter((r) => r.accountId === accountId) : rows;
  return filtered.map((r) => ({
    accountId: String(r.accountId),
    voucherId: String(r.voucherId),
    date: String(r.date),
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    balance: Number(r.balance ?? 0),
  }));
}
