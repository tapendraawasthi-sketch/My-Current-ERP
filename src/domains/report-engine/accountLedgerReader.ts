import { readProjectionRow, readProjectionRows } from "@/platform/projections/projectionStorage";
import type { DBProjectionAccountBalance } from "@/platform/projections/projectionState";
import { readGeneralLedgerFromProjection } from "./generalLedgerProjectionReader";

export interface AccountLedgerReport {
  accountId: string;
  balance: number;
  debit: number;
  credit: number;
  entries: Awaited<ReturnType<typeof readGeneralLedgerFromProjection>>;
}

export async function readAccountLedger(accountId: string): Promise<AccountLedgerReport> {
  const balanceRow = await readProjectionRow<DBProjectionAccountBalance>(
    "projectionAccountBalances",
    accountId,
  );
  const entries = await readGeneralLedgerFromProjection(accountId);
  return {
    accountId,
    balance: Number(balanceRow?.balance ?? 0),
    debit: Number(balanceRow?.debit ?? 0),
    credit: Number(balanceRow?.credit ?? 0),
    entries,
  };
}

export async function readAllAccountBalances(): Promise<DBProjectionAccountBalance[]> {
  return readProjectionRows<DBProjectionAccountBalance>("projectionAccountBalances");
}
