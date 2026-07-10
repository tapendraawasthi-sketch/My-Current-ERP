export {
  InventoryEventTypes,
  MovementKinds,
  type InventoryEventType,
  type MovementKind,
  type InventoryAggregate,
  type StockMovementRecord,
  type InventoryTransaction,
  type InventoryReservation,
  type CostLayer,
  type ShadowInventoryEvent,
  type WarehouseRef,
  type LotRef,
  type SerialRef,
} from "./inventoryAggregate";

export {
  movementKindToEventType,
  mapInvoiceTypeToMovementKind,
  isInwardMovement,
  signedQty,
} from "./inventoryMovements";

export { processInventoryDomainEvent, isInventoryEventType } from "./inventoryService";
export {
  getAggregate,
  listAggregates,
  listMovements,
  listShadowEvents,
  clearShadowRepository,
} from "./inventoryRepository";

export {
  createReservation,
  releaseReservation,
  listReservations,
  activeReservedQty,
} from "./inventoryReservations";

export { addCostLayer, consumeCostLayers, listCostLayers } from "./inventoryCostLayers";
export { recordTransaction, listTransactions } from "./inventoryTransactions";
export { buildAdjustmentMovement } from "./inventoryAdjustments";
export { buildTransferMovements } from "./inventoryTransfers";
export { classifyReturnKind } from "./inventoryReturns";
export { buildOpeningEvent, buildClosingEvent } from "./inventoryOpening";
export { closeInventoryPeriod } from "./inventoryClosing";
export { runIntegrityChecks, type IntegrityIssue } from "./inventoryIntegrity";
export { InventoryPolicies, isShadowMode } from "./inventoryPolicies";
export { runReconciliation, type ReconciliationDiff } from "./inventoryReconciliation";
export {
  runInventoryParityValidation,
  validateStockBalanceParity,
  validateInventoryValuationParity,
  type InventoryParityResult,
  type InventoryParityReport,
} from "./inventoryParity";
export { getInventoryDiagnostics, recordInventoryDiagnostic } from "./inventoryDiagnostics";
export { inventoryMetrics } from "./inventoryMetrics";
export { inventoryLogger } from "./inventoryLogger";
export {
  createInventoryShadowHandler,
  bootstrapInventoryEngine,
  shutdownInventoryEngine,
  isInventoryEngineBootstrapped,
} from "./inventoryBootstrap";

export {
  createValuationEngine,
  WeightedAverageValuation,
  FifoValuation,
  LifoValuationStub,
  StandardCostValuationStub,
  SpecificIdentificationValuationStub,
  type IValuationEngine,
  type ValuationMethod,
} from "./inventoryValuation";
