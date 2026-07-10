import { getAccountBalance as legacyGetAccountBalance } from "@/lib/accounting";
import { createLegacyStateReader } from "@fios/legacy";
import { getAccountingAggregate } from "./accountingSnapshot";

const state = createLegacyStateReader();

export function calculateShadowAccountBalance(accountId: string): number {
  const aggregate = getAccountingAggregate(accountId);
  return aggregate?.balance ?? 0;
}

export function calculateLegacyAccountBalance(accountId: string): number {
  return legacyGetAccountBalance(accountId, state.getVouchers(), state.getAccounts());
}

export function calculateAllShadowBalances(): Map<string, number> {
  const map = new Map<string, number>();
  for (const account of state.getAccounts() as Array<{ id: string }>) {
    map.set(account.id, calculateShadowAccountBalance(account.id));
  }
  return map;
}
