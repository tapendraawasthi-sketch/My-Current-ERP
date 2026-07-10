import Dexie from "dexie";
import type { SutraERPDatabase } from "@/lib/db";
import { resetDB } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/store/store.types";
import { useStore } from "@/store/useStore";
import { invalidatePeriodLockCache } from "@/lib/ledger/periodLockService";
import { clearW1FlagOverrides, setW1FlagOverride } from "@/platform/flags/w1Registry";

export async function resetAccountingTestDb(): Promise<SutraERPDatabase> {
  clearW1FlagOverrides();
  setW1FlagOverride("W1_PERIOD_LOCK_ENFORCE", true);
  setW1FlagOverride("W1_FAIL_CLOSED_INIT", true);
  await Dexie.delete("SutraERPDatabase");
  const db = await resetDB();
  await db.open();
  invalidatePeriodLockCache();
  return db;
}

export async function seedMinimalAccounting(db: SutraERPDatabase): Promise<void> {
  await db.fiscalYears.add(DEFAULT_FISCAL_YEAR as never);
  await db.accounts.bulkAdd([
    {
      id: "acc-cash",
      code: "CASH",
      name: "Cash",
      type: "asset",
      level: "ledger",
      balance: 0,
      isActive: true,
    },
    {
      id: "acc-sales",
      code: "SALES",
      name: "Sales",
      type: "income",
      level: "ledger",
      balance: 0,
      isActive: true,
    },
    {
      id: "acc-sundry-debtors",
      code: "DEBT",
      name: "Sundry Debtors",
      type: "asset",
      level: "ledger",
      balance: 0,
      isActive: true,
    },
  ] as never);

  useStore.setState({
    isDbReady: true,
    initLifecycle: "ready",
    isInitializing: false,
    currentFiscalYear: DEFAULT_FISCAL_YEAR,
    accounts: await db.accounts.toArray(),
    vouchers: [],
    invoices: [],
  });
}

export async function lockPeriod(
  db: SutraERPDatabase,
  periodKey: string,
  sampleDate: string,
): Promise<string> {
  await db.periodLocks.add({
    id: `lock-${periodKey}`,
    periodKey,
    lockedAt: new Date().toISOString(),
    isUnlocked: false,
  });
  invalidatePeriodLockCache();
  return sampleDate;
}

export function balancedVoucherLines(amount = 1000) {
  return [
    { id: "l1", accountId: "acc-cash", accountName: "Cash", debit: amount, credit: 0 },
    { id: "l2", accountId: "acc-sales", accountName: "Sales", debit: 0, credit: amount },
  ];
}

export function minimalInvoice(date: string, status: "draft" | "posted" = "posted") {
  return {
    type: "sales-invoice",
    status,
    date,
    partyId: "party-1",
    partyName: "Test Party",
    lines: [{ id: "il1", itemId: "item-1", qty: 1, rate: 1000, amount: 1000 }],
    subTotal: 1000,
    vatAmount: 0,
    grandTotal: 1000,
    taxableAmount: 1000,
  };
}
