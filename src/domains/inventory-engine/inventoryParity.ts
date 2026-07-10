import { createLegacyStateReader } from "@fios/legacy";
import {
  computeStockSummary,
  computeTotalClosingStockValue,
  mapConfigMethodToValuation,
  movementsToStockRaw,
} from "@/lib/stockValuation";
import { isMigrationFlagEnabled } from "@/platform/flags/registry";
import { listAggregates, listMovements } from "./inventoryRepository";
import { InventoryPolicies } from "./inventoryPolicies";
import { recordInventoryDiagnostic } from "./inventoryDiagnostics";
import { inventoryMetrics } from "./inventoryMetrics";
import { createValuationEngine } from "./inventoryValuation";

const state = createLegacyStateReader();

export interface InventoryParityResult {
  metric: string;
  itemId?: string;
  legacyValue: number;
  shadowValue: number;
  diff: number;
  withinTolerance: boolean;
  passed: boolean;
}

export interface InventoryParityReport {
  checks: InventoryParityResult[];
  passed: boolean;
  recordedAt: string;
}

function checkMetric(
  metric: string,
  legacyValue: number,
  shadowValue: number,
  itemId?: string,
): InventoryParityResult {
  const diff = Math.abs(legacyValue - shadowValue);
  const withinTolerance = diff <= InventoryPolicies.parityTolerance;
  return {
    metric,
    itemId,
    legacyValue,
    shadowValue,
    diff,
    withinTolerance,
    passed: withinTolerance,
  };
}

export function validateStockBalanceParity(): InventoryParityResult[] {
  const legacyMovements = movementsToStockRaw(state.getStockMovements());
  const legacyByItem = new Map<string, number>();
  for (const mov of legacyMovements) {
    legacyByItem.set(mov.itemId, (legacyByItem.get(mov.itemId) ?? 0) + mov.qty);
  }

  const shadowByItem = new Map<string, number>();
  for (const agg of listAggregates()) {
    shadowByItem.set(agg.itemId, (shadowByItem.get(agg.itemId) ?? 0) + agg.onHandQty);
  }

  const results: InventoryParityResult[] = [];
  const allItems = new Set([...legacyByItem.keys(), ...shadowByItem.keys()]);
  for (const itemId of allItems) {
    results.push(
      checkMetric(
        "stockBalance",
        legacyByItem.get(itemId) ?? 0,
        shadowByItem.get(itemId) ?? 0,
        itemId,
      ),
    );
  }
  return results;
}

export function validateWeightedAverageParity(): InventoryParityResult[] {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  const method = mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
  if (method !== "weighted_average") return [];

  const legacyMovements = movementsToStockRaw(state.getStockMovements());
  const byItem = new Map<string, typeof legacyMovements>();
  for (const mov of legacyMovements) {
    const list = byItem.get(mov.itemId) ?? [];
    list.push(mov);
    byItem.set(mov.itemId, list);
  }

  const results: InventoryParityResult[] = [];
  const engine = createValuationEngine("weighted_average");

  for (const [itemId, movs] of byItem) {
    const legacySummary = computeStockSummary(movs, "weighted_average")[0];
    const shadowAgg = listAggregates().find((a) => a.itemId === itemId);
    const shadowLayers = listMovements()
      .filter((m) => m.itemId === itemId && m.qty > 0)
      .map((m) => ({ qty: m.qty, rate: m.rate }));
    const shadowRate =
      shadowAgg && shadowAgg.onHandQty > 0
        ? shadowAgg.totalValue / shadowAgg.onHandQty
        : engine.computeIssueCost(shadowLayers, 1);

    results.push(
      checkMetric(
        "weightedAverageRate",
        legacySummary?.closingRate ?? 0,
        shadowRate,
        itemId,
      ),
    );
  }
  return results;
}

export function validateInventoryValuationParity(): InventoryParityResult[] {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  const method = mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
  const legacyTotal = computeTotalClosingStockValue(state.getStockMovements(), method);
  const shadowTotal = listAggregates().reduce((sum, agg) => sum + agg.totalValue, 0);
  return [checkMetric("totalValuation", legacyTotal, shadowTotal)];
}

export function validateStockLedgerParity(itemId?: string): InventoryParityResult[] {
  const settings = state.getCompanySettings() as Record<string, unknown> | null;
  const method = mapConfigMethodToValuation(String(settings?.stockValuationMethod ?? "fifo"));
  const legacyMovements = movementsToStockRaw(state.getStockMovements());
  const targetItemId = itemId ?? legacyMovements[0]?.itemId;
  if (!targetItemId) return [];

  const legacySummary = computeStockSummary(
    legacyMovements.filter((m) => m.itemId === targetItemId),
    method,
  )[0];
  const shadowQty = listMovements()
    .filter((m) => m.itemId === targetItemId)
    .reduce((sum, m) => sum + m.qty, 0);

  return [
    checkMetric(
      "stockLedgerClosingQty",
      legacySummary?.closingQty ?? 0,
      shadowQty,
      targetItemId,
    ),
  ];
}

export function validateMovementHistoryParity(): InventoryParityResult[] {
  const legacyCount = state.getStockMovements().length;
  const shadowCount = listMovements().length;
  return [checkMetric("movementHistoryCount", legacyCount, shadowCount)];
}

export function runInventoryParityValidation(): InventoryParityReport {
  if (!isMigrationFlagEnabled("MIGRATION_INVENTORY_PARITY")) {
    return { checks: [], passed: true, recordedAt: new Date().toISOString() };
  }

  inventoryMetrics.incrementParityChecks();
  const checks: InventoryParityResult[] = [
    ...validateStockBalanceParity(),
    ...validateWeightedAverageParity(),
    ...validateInventoryValuationParity(),
    ...validateStockLedgerParity(),
    ...validateMovementHistoryParity(),
  ];

  for (const check of checks) {
    recordInventoryDiagnostic({
      stage: check.passed ? "parity-pass" : "parity-fail",
      itemId: check.itemId,
      message: `${check.metric} legacy=${check.legacyValue} shadow=${check.shadowValue} diff=${check.diff}`,
      timestamp: new Date().toISOString(),
    });
    if (!check.passed) inventoryMetrics.incrementParityFailures();
  }

  const passed = checks.every((c) => c.passed);
  return { checks, passed, recordedAt: new Date().toISOString() };
}
