/**
 * Explicit company synchronization policy (Phase 5).
 * Do not infer policy solely from whether a server URL exists.
 */

import { getDB, type DBCompanySettings } from "@/lib/db";

export type CompanySyncPolicy = "local_only" | "sync_enabled" | "sync_required";

const DEFAULT_POLICY: CompanySyncPolicy = "sync_enabled";

export function normalizeSyncPolicy(raw: unknown): CompanySyncPolicy {
  if (raw === "local_only" || raw === "sync_enabled" || raw === "sync_required") {
    return raw;
  }
  return DEFAULT_POLICY;
}

export function readSyncPolicyFromSettings(
  settings: DBCompanySettings | null | undefined,
): CompanySyncPolicy {
  return normalizeSyncPolicy((settings as { syncPolicy?: unknown } | null | undefined)?.syncPolicy);
}

export async function getCompanySyncPolicy(companyId: string): Promise<CompanySyncPolicy> {
  try {
    const db = getDB();
    const byCompany = await db.companySettings
      .filter((row) => (row as { companyId?: string }).companyId === companyId)
      .first()
      .catch(() => null);
    if (byCompany) return readSyncPolicyFromSettings(byCompany);

    const main = await db.companySettings.get("main");
    if (main) return readSyncPolicyFromSettings(main);

    const any = await db.companySettings.toCollection().first();
    return readSyncPolicyFromSettings(any);
  } catch {
    return DEFAULT_POLICY;
  }
}

export function requiresOutboxEvent(policy: CompanySyncPolicy): boolean {
  return policy === "sync_enabled" || policy === "sync_required";
}

export function isLocalOnly(policy: CompanySyncPolicy): boolean {
  return policy === "local_only";
}
