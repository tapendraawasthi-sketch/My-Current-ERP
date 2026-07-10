import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { QueryTypes } from "../queryTypes";
import {
  readProjectionAccountBalance,
  readProjectionTrialBalanceTotal,
  validateAccountBalanceParity,
  validateInventoryParity,
  validateTrialBalanceParity,
} from "@/platform/projections/projectionParity";
import { diffValues, summarizeDiff } from "@/platform/projections/projectionDiff";
import { recordQueryDiagnostic } from "../queryDiagnostics";

export interface ShadowCompareResult {
  queryType: string;
  legacyResult: unknown;
  projectionResult: unknown;
  diffs: ReturnType<typeof diffValues>;
  summary: string;
}

const SHADOW_QUERY_MAP: Partial<Record<string, (payload: Record<string, unknown>) => Promise<unknown>>> = {
  [QueryTypes.TRIAL_BALANCE]: async () => readProjectionTrialBalanceTotal(),
  [QueryTypes.LEDGER]: async (payload) =>
    readProjectionAccountBalance(String(payload.accountId ?? "")),
  [QueryTypes.INVENTORY_VALUATION]: async () => {
    const parity = await validateInventoryParity();
    return { totalValue: parity[0]?.projectionValue ?? 0 };
  },
};

export async function runShadowCompare(
  queryType: string,
  payload: Record<string, unknown>,
  legacyResult: unknown,
): Promise<ShadowCompareResult | null> {
  if (!isMigrationFlagEnabled("MIGRATION_SHADOW_PROJECTIONS")) return null;
  if (!isMigrationFlagEnabled("MIGRATION_PROJECTIONS")) return null;

  let projectionResult: unknown = null;

  const reader = SHADOW_QUERY_MAP[queryType];
  if (reader) {
    projectionResult = await reader(payload);
  } else if (queryType === QueryTypes.TRIAL_BALANCE) {
    projectionResult = await readProjectionTrialBalanceTotal();
  }

  if (projectionResult === null) return null;

  const diffs = diffValues(legacyResult, projectionResult);
  const summary = summarizeDiff(diffs);

  recordQueryDiagnostic({
    queryId: crypto.randomUUID(),
    queryType,
    correlationId: crypto.randomUUID(),
    stage: diffs.length === 0 ? "ok" : "rejected",
    error: diffs.length > 0 ? `shadow-diff: ${summary}` : undefined,
    timestamp: new Date().toISOString(),
  });

  if (queryType === QueryTypes.TRIAL_BALANCE) {
    await validateTrialBalanceParity();
  }
  if (queryType === QueryTypes.LEDGER && payload.accountId) {
    await validateAccountBalanceParity(String(payload.accountId));
  }

  return { queryType, legacyResult, projectionResult, diffs, summary };
}
