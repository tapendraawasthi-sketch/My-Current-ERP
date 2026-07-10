export const AccountingPolicies = {
  shadowModeOnly: true,
  parityTolerance: 0.01,
  allowAutoRoundOff: false,
  enforcePeriodLock: true,
  enforceFiscalYear: true,
  enforceDoubleEntry: true,
  maxVoucherLines: 500,
} as const;

export function isShadowMode(): boolean {
  return AccountingPolicies.shadowModeOnly;
}
