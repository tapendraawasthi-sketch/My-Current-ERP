/** Payroll + simulation engines (TS mirror of Python cap.engine.*). */

export const EPF_EMPLOYEE_RATE = 0.1;
export const SSF_EMPLOYEE_RATE = 0.01;
export const EXEMPTION_SINGLE = 400_000;
export const EXEMPTION_MARRIED = 500_000;

export interface PayrollResult {
  grossSalary: number;
  netPay: number;
  tdsMonthly: number;
  employerCost: number;
}

export function computePayroll(
  basicSalary: number,
  opts: { grossSalary?: number; maritalStatus?: "single" | "married" } = {},
): PayrollResult {
  const gross = opts.grossSalary ?? basicSalary;
  const epf = basicSalary * EPF_EMPLOYEE_RATE;
  const ssf = gross * SSF_EMPLOYEE_RATE;
  const exemption = opts.maritalStatus === "married" ? EXEMPTION_MARRIED : EXEMPTION_SINGLE;
  const taxable = Math.max(0, gross * 12 - (epf * 12) - exemption);
  const annualTax = taxable <= 0 ? 0 : Math.round(taxable * 0.1);
  const tdsMonthly = Math.round(annualTax / 12);
  const netPay = gross - epf - ssf - tdsMonthly;
  return {
    grossSalary: gross,
    netPay,
    tdsMonthly,
    employerCost: gross + basicSalary * EPF_EMPLOYEE_RATE + gross * 0.0333,
  };
}

export function simulateSalaryIncrease(basicSalary: number, increasePercent: number): {
  baseline: PayrollResult;
  projected: PayrollResult;
  deltas: { netPay: number; employerCost: number };
} {
  const baseline = computePayroll(basicSalary);
  const projected = computePayroll(basicSalary * (1 + increasePercent / 100));
  return {
    baseline,
    projected,
    deltas: {
      netPay: projected.netPay - baseline.netPay,
      employerCost: projected.employerCost - baseline.employerCost,
    },
  };
}
