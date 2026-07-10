import { clearShadowAccountingState, listShadowJournals, listShadowVouchers } from "./accountingSnapshot";
import { runAccountingIntegrityChecks } from "./accountingIntegrityChecker";
import { runAccountingParityValidation } from "./accountingParity";
import { accountingLogger } from "./accountingLogger";

export interface RepairReport {
  integrityIssuesBefore: number;
  parityPassed: boolean;
  actions: string[];
  recordedAt: string;
}

export function resetShadowAccounting(): void {
  clearShadowAccountingState();
  accountingLogger.info("shadow-accounting-reset");
}

export async function diagnoseAccountingState(): Promise<RepairReport> {
  const integrityIssues = runAccountingIntegrityChecks();
  const parity = runAccountingParityValidation();
  return {
    integrityIssuesBefore: integrityIssues.length,
    parityPassed: parity.passed,
    actions: [
      `shadow vouchers: ${listShadowVouchers().length}`,
      `shadow journals: ${listShadowJournals().length}`,
      `integrity issues: ${integrityIssues.length}`,
      `parity checks: ${parity.checks.length}`,
    ],
    recordedAt: new Date().toISOString(),
  };
}

export async function repairShadowAccounting(): Promise<RepairReport> {
  const before = await diagnoseAccountingState();
  resetShadowAccounting();
  return {
    ...before,
    actions: [...before.actions, "shadow state cleared for rebuild"],
    recordedAt: new Date().toISOString(),
  };
}
