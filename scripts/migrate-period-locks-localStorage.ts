/**
 * One-shot CLI: import legacy localStorage period locks into Dexie periodLocks.
 *
 * Usage (browser console after app load):
 *   import { importLegacyPeriodLocksIntoDexie } from './src/lib/periodLock';
 *   import { getDB } from './src/lib/db';
 *   await importLegacyPeriodLocksIntoDexie(getDB());
 *
 * This script is documentation for operators; Dexie v26 upgrade runs the same import automatically.
 */
import { getDB } from "../src/lib/db";
import { importLegacyPeriodLocksIntoDexie } from "../src/lib/periodLock";
import { invalidatePeriodLockCache } from "../src/lib/ledger/periodLockService";

async function main() {
  const db = getDB();
  const result = await importLegacyPeriodLocksIntoDexie(db, { clearLocalStorageAfterImport: true });
  invalidatePeriodLockCache();
  console.log("[migrate-period-locks-localStorage]", result);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
