export {
  AccountingEventTypes,
  type AccountingEventType,
  type JournalLine,
  type AccountingAggregate,
  type VoucherAggregate,
  type ShadowJournalEntry,
  type ShadowAccountingEvent,
  type AccountingCheckpoint,
} from "./accountingAggregate";

export { processAccountingDomainEvent, isAccountingDomainEvent } from "./postingEngine";
export { createVoucherAggregate, isPosted } from "./voucherAggregate";
export { createJournalEntry, mergeJournalLines } from "./journalEntryEngine";
export { validateJournalLines, assertBalanced, type DoubleEntryValidation } from "./doubleEntryValidator";
export { runPostingRules, allRulesPassed, type PostingRuleResult } from "./postingRulesEngine";
export { runPostingPipeline, type PostingPipelineInput, type PostingPipelineResult } from "./postingPipeline";
export { executeInvoicePostingSaga, type InvoicePostingSagaInput } from "./invoicePostingSaga";
export { executeVoucherPostingSaga, type VoucherPostingSagaInput } from "./voucherPostingSaga";
export {
  beginShadowTransaction,
  commitShadowTransaction,
  rollbackShadowTransaction,
  runInShadowBoundary,
  type TransactionScope,
} from "./transactionBoundaryManager";
export { AccountingPolicies, isShadowMode } from "./accountingPolicies";
export { isDateLocked, checkPeriodLock, type PeriodLockViolation } from "./periodLockService";
export { validateDateInFiscalYear, type FiscalViolation } from "./fiscalValidation";
export { buildTaxLinesFromInvoice, type TaxPostingResult } from "./taxPostingEngine";
export { allocateCostCenter, type CostAllocationInput } from "./costAllocationEngine";
export { buildInvoiceJournalLines, buildVoucherJournalLines } from "./journalBuilder";
export { buildLedgerEntries, buildAccountLedger, sumLines, type LedgerEntry } from "./ledgerBuilder";
export {
  buildShadowTrialBalance,
  buildLegacyTrialBalance,
  buildTrialBalanceFromVouchers,
  type TrialBalanceRow,
  type TrialBalanceResult,
} from "./trialBalanceBuilder";
export {
  calculateShadowAccountBalance,
  calculateLegacyAccountBalance,
  calculateAllShadowBalances,
} from "./accountBalanceCalculator";
export { recordPostingDiagnostic, getPostingDiagnostics, clearPostingDiagnostics } from "./postingDiagnostics";
export { accountingMetrics } from "./accountingMetrics";
export { accountingLogger } from "./accountingLogger";
export {
  runAccountingIntegrityChecks,
  checkTrialBalanceIntegrity,
  type AccountingIntegrityIssue,
} from "./accountingIntegrityChecker";
export {
  replayAccountingFromEventStore,
  dryRunReplay,
  rebuildFromCheckpoint,
  type AccountingReplayOptions,
  type AccountingReplayResult,
} from "./accountingReplay";
export {
  getAccountingAggregate,
  listAccountingAggregates,
  getShadowVoucher,
  listShadowVouchers,
  listShadowJournals,
  listShadowAccountingEvents,
  listCheckpoints,
  saveCheckpoint,
  getLatestCheckpoint,
  clearShadowAccountingState,
} from "./accountingSnapshot";
export {
  createAccountingShadowHandler,
  bootstrapAccountingEngine,
  shutdownAccountingEngine,
  isAccountingEngineBootstrapped,
} from "./accountingBootstrap";
export {
  runAccountingParityValidation,
  validateTrialBalanceParity,
  validateAccountBalanceParity,
  type AccountingParityResult,
  type AccountingParityReport,
} from "./accountingParity";
export { resetShadowAccounting, diagnoseAccountingState, repairShadowAccounting, type RepairReport } from "./accountingRepair";
export { ACCOUNTING_ENGINE_VERSION, versionPayload, unwrapVersioned, type VersionedPayload } from "./accountingVersioning";
