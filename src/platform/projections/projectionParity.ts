import { getDB } from "@/lib/db";
import { computeTrialBalance, getAccountBalance } from "@/lib/accounting";
import {
  computeStockSummary,
  computeTotalClosingStockValue,
  mapConfigMethodToValuation,
  movementsToStockRaw,
} from "@/lib/stockValuation";
import { createLegacyStateReader, readLegacyState } from "@fios/legacy";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { diffValues, summarizeDiff } from "./projectionDiff";
import { recordProjectionDiagnostic } from "./projectionDiagnostics";
import { projectionMetrics } from "./projectionMetrics";
import { readProjectionRows } from "./projectionStorage";
import { ProjectionNames, type DBProjectionParityResult, type ProjectionName } from "./projectionState";
import { isProjectionSchemaReady } from "./projectionCheckpoint";

const PARITY_TOLERANCE = 0.01;
const state = createLegacyStateReader();

export interface ParityCheckResult {
  projectionName: ProjectionName;
  metric: string;
  legacyValue: number;
  projectionValue: number;
  diff: number;
  withinTolerance: boolean;
  passed: boolean;
}

export interface ParityReport {
  checks: ParityCheckResult[];
  passed: boolean;
  recordedAt: string;
}

async function recordParityResult(result: ParityCheckResult, details?: Record<string, unknown>): Promise<void> {
  if (!isProjectionSchemaReady()) return;
  const row: DBProjectionParityResult = {
    id: `${result.projectionName}:${result.metric}:${Date.now()}`,
    projectionName: result.projectionName,
    metric: result.metric,
    legacyValue: result.legacyValue,
    projectionValue: result.projectionValue,
    diff: result.diff,
    withinTolerance: result.withinTolerance,
    recordedAt: new Date().toISOString(),
    details,
  };
  const db = getDB() as Record<string, { put: (r: unknown) => Promise<unknown> }>;
  await db.projectionParityResults?.put(row);
}

function checkMetric(
  projectionName: ProjectionName,
  metric: string,
  legacyValue: number,
  projectionValue: number,
): ParityCheckResult {
  const diff = Math.abs(legacyValue - projectionValue);
  const withinTolerance = diff <= PARITY_TOLERANCE;
  return {
    projectionName,
    metric,
    legacyValue,
    projectionValue,
    diff,
    withinTolerance,
    passed: withinTolerance,
  };
}

export async function validateTrialBalanceParity(): Promise<ParityCheckResult[]> {
  const legacy = computeTrialBalance(state.getAccounts() as never[], state.getVouchers());
  const projectionRows = await readProjectionRows("projectionTrialBalance");
  const projectionDebit = projectionRows.reduce((s, r) => s + Number(r.debit ?? 0), 0);
  const projectionCredit = projectionRows.reduce((s, r) => s + Number(r.credit ?? 0), 0);

  return [
    checkMetric(ProjectionNames.TRIAL_BALANCE, "totalDebit", legacy.totalDebit, projectionDebit),
    checkMetric(ProjectionNames.TRIAL_BALANCE, "totalCredit", legacy.totalCredit, projectionCredit),
  ];
}

export async function validateAccountBalanceParity(accountId?: string): Promise<ParityCheckResult[]> {
  const accounts = accountId
    ? (state.getAccounts() as Array<{ id?: string }>).filter((a) => a.id === accountId)
    : (state.getAccounts() as Array<{ id?: string }>).slice(0, 20);

  const results: ParityCheckResult[] = [];
  const projectionRows = await readProjectionRows("projectionAccountBalances");
  const projectionMap = new Map(projectionRows.map((r) => [String(r.accountId), Number(r.balance ?? 0)]));

  for (const account of accounts) {
    const id = String(account.id ?? "");
    if (!id) continue;
    const legacyBalance = getAccountBalance(id, state.getVouchers(), state.getAccounts());
    const projectionBalance = projectionMap.get(id) ?? 0;
    results.push(
      checkMetric(ProjectionNames.ACCOUNT_BALANCE, `balance:${id}`, legacyBalance, projectionBalance),
    );
  }
  return results;
}

export async function validateInventoryParity(): Promise<ParityCheckResult[]> {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  const method = mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
  const legacyTotal = computeTotalClosingStockValue(state.getStockMovements(), method);
  const projectionRows = await readProjectionRows("projectionStockBalances");
  const projectionTotal = projectionRows.reduce((s, r) => s + Number(r.value ?? 0), 0);
  return [
    checkMetric(ProjectionNames.STOCK_BALANCE, "totalValue", legacyTotal, projectionTotal),
  ];
}

export async function validateStockLedgerParity(itemId?: string): Promise<ParityCheckResult[]> {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  const method = mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
  const movements = movementsToStockRaw(state.getStockMovements());
  const targetItemId = itemId ?? movements[0]?.itemId;
  if (!targetItemId) return [];

  const legacySummary = computeStockSummary(
    movements.filter((m) => m.itemId === targetItemId),
    method,
  )[0];
  const projectionRows = await readProjectionRows("projectionStockLedger");
  const itemRows = projectionRows.filter((r) => String(r.itemId) === targetItemId);
  const projectionQty = itemRows.reduce(
    (s, r) => s + Number(r.inQty ?? 0) - Number(r.outQty ?? 0),
    0,
  );

  return [
    checkMetric(
      ProjectionNames.STOCK_LEDGER,
      `closingQty:${targetItemId}`,
      legacySummary?.closingQty ?? 0,
      projectionQty,
    ),
  ];
}

export async function validateTaxParity(): Promise<ParityCheckResult[]> {
  const legacyEntries = readLegacyState().tdsEntries || [];
  const projectionRows = await readProjectionRows("projectionTax");
  return [
    checkMetric(ProjectionNames.TAX, "entryCount", legacyEntries.length, projectionRows.length),
  ];
}

export async function runFullParityValidation(): Promise<ParityReport> {
  if (!isMigrationFlagEnabled("MIGRATION_PROJECTIONS")) {
    return { checks: [], passed: true, recordedAt: new Date().toISOString() };
  }

  projectionMetrics.incrementParityChecks();
  const checks: ParityCheckResult[] = [
    ...(await validateTrialBalanceParity()),
    ...(await validateAccountBalanceParity()),
    ...(await validateInventoryParity()),
    ...(await validateStockLedgerParity()),
    ...(await validateTaxParity()),
  ];

  for (const check of checks) {
    const diffs = diffValues(check.legacyValue, check.projectionValue, check.metric, PARITY_TOLERANCE);
    await recordParityResult(check, { summary: summarizeDiff(diffs) });
    recordProjectionDiagnostic({
      projectionName: check.projectionName,
      stage: check.passed ? "parity-pass" : "parity-fail",
      message: `${check.metric} legacy=${check.legacyValue} projection=${check.projectionValue}`,
      timestamp: new Date().toISOString(),
    });
    if (!check.passed) projectionMetrics.incrementParityFailures();
  }

  const passed = checks.every((c) => c.passed);
  return { checks, passed, recordedAt: new Date().toISOString() };
}

export async function readProjectionTrialBalanceTotal(): Promise<{ debit: number; credit: number }> {
  const rows = await readProjectionRows("projectionTrialBalance");
  return {
    debit: rows.reduce((s, r) => s + Number(r.debit ?? 0), 0),
    credit: rows.reduce((s, r) => s + Number(r.credit ?? 0), 0),
  };
}

export async function readProjectionAccountBalance(accountId: string): Promise<number> {
  const rows = await readProjectionRows("projectionAccountBalances");
  const row = rows.find((r) => String(r.accountId) === accountId);
  return Number(row?.balance ?? 0);
}
