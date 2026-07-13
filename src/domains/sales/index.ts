export {
  postSalesTransaction,
  buildSalesScopedIdempotencyKey,
  isInventorySalesIntent,
  resolveInventoryItemForSale,
  E2E_SALES_COMPANY_ID,
  E2E_SALES_COMPANY_NAME,
  E2E_SALES_ITEM_ID,
  E2E_SALES_ITEM_NAME,
  E2E_SALES_CUSTOMER_ID,
  E2E_SALES_CUSTOMER_NAME,
  type SalesPostingCommand,
  type SalesPostingResult,
} from "./postSalesTransaction";

export {
  classificationFromSalePayment,
  isSupportedInventorySale,
  PHASE6_SUPPORTED_SALES,
  type TransactionClassification,
} from "./transactionClassification";

export {
  seedOrbixSalesE2ECompany,
  resetOrbixSalesE2ECompany,
  E2E_SALES_USER_AUTHORIZED,
  E2E_SALES_USER_RESTRICTED,
} from "./e2eSeed";

export {
  resolveCompanyInventoryPolicy,
  E2E_SALES_INVENTORY_POLICY,
  DEFAULT_INVENTORY_POLICY,
  type CompanyInventoryPolicy,
  type InventoryAccountingMode,
  type ValuationMethod,
} from "./inventoryAccountingPolicy";

export { computeSalesVat, DEFAULT_TAX_RULE_VERSION } from "./salesVatEngine";
export { allocateSalesLineCost, sumAllocationCosts } from "./costAllocation";

export {
  postSalesAdjustmentTransaction,
  postSalesReturnTransaction,
  postSalesCreditNoteTransaction,
  buildSalesAdjustmentScopedIdempotencyKey,
  isSalesAdjustmentIntent,
  type SalesAdjustmentPostingCommand,
  type SalesAdjustmentPostingResult,
  type SalesAdjustmentType,
  type SalesAdjustmentSettlementMethod,
  type SalesAdjustmentLineInput,
} from "./postSalesAdjustmentTransaction";

export {
  computeInvoiceRemainingBalance,
  getOrCreateAdjustmentState,
  bumpAdjustmentVersion,
  listPostedAdjustmentsForInvoice,
  getOriginalSaleAdjustmentVersion,
  type InvoiceRemainingBalance,
  type LineRemainingBalance,
} from "./remainingBalance";

export {
  computeHistoricalLineReversal,
  computeFinancialCreditReversal,
  type HistoricalLineReversal,
  type StockCondition,
} from "./historicalReversal";
