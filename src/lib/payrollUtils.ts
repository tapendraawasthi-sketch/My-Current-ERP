// src/lib/payrollUtils.ts

export interface PayrollLine {
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  allowances: number;
  grossSalary: number;
  pfEmployee: number;
  pfEmployer: number;
  ssf: number;
  tds: number;
  otherDeductions: number;
  netSalary: number;
}

export function computePayroll(
  employees: any[],
  month: number,
  year: number
): PayrollLine[] {
  return employees.map((emp) => {
    const basic = emp.basicSalary || 0;
    const allowances = (emp.allowances || []).reduce((s: number, a: any) => s + (a.amount || 0), 0);
    const gross = basic + allowances;

    // Nepal PF: 10% employee, 10% employer on basic
    const pfEmployee = Math.round(basic * 0.1 * 100) / 100;
    const pfEmployer = Math.round(basic * 0.1 * 100) / 100;

    // SSF: 11% employee, 20% employer on basic
    const ssfEmployee = Math.round(basic * 0.11 * 100) / 100;
    const ssfEmployer = Math.round(basic * 0.20 * 100) / 100;
    const ssf = ssfEmployee + ssfEmployer;

    // TDS: Nepal simplified slabs
    // 0–600k → 1%, 600k–800k → 10%, above 800k → 15%
    const annualGross = gross * 12;
    let annualTax = 0;
    if (annualGross > 800000) {
      annualTax = 600000 * 0.01 + 200000 * 0.10 + (annualGross - 800000) * 0.15;
    } else if (annualGross > 600000) {
      annualTax = 600000 * 0.01 + (annualGross - 600000) * 0.10;
    } else {
      annualTax = annualGross * 0.01;
    }
    const tds = Math.round((annualTax / 12) * 100) / 100;

    const otherDeductions = emp.otherDeductions || 0;
    const net = Math.round((gross - pfEmployee - ssfEmployee - tds - otherDeductions) * 100) / 100;

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      basicSalary: basic,
      allowances,
      grossSalary: gross,
      pfEmployee,
      pfEmployer,
      ssf,
      tds,
      otherDeductions,
      netSalary: net,
    };
  });
}

export interface NepalPayrollResult {
  basicSalary: number;
  allowances: {
    houseRent: number;
    transport: number;
    medical: number;
    dashain: number;
  };
  grossSalary: number;
  ssfEmployee: number;
  ssfEmployer: number;
  incomeTax: number;
  netSalary: number;
}

/**
 * Computes Nepal payroll for one employee for a given BS month.
 * SSF rates: Employee 11%, Employer 20% of basic (simplified).
 * Income tax: Nepal slab FY 2080/81 for individuals.
 * Dashain bonus: paid only in Asoj (month 6) — 1 month basic.
 */
export function computeNepalPayroll(
  emp: any,
  bsYear: number,
  bsMonth: number, // 1–12
  paidDays: number,
  workingDays: number
): NepalPayrollResult {
  const safePaidDays = Math.max(0, Number(paidDays) || 0);
  const safeWorkingDays = Math.max(1, Number(workingDays) || 1);
  const ratio = Math.min(1, safePaidDays / safeWorkingDays);

  const basicSalary = Math.round((emp.basicSalary || 0) * ratio * 100) / 100;
  const gradePay = Math.round(basicSalary * ((emp.gradePayPercent || 0) / 100) * 100) / 100;
  const effectiveBasic = basicSalary + gradePay;

  const empAllowances = emp.allowances || {};
  const houseRent  = Math.round((empAllowances.houseRent  || 0) * ratio * 100) / 100;
  const transport  = Math.round((empAllowances.transport  || 0) * ratio * 100) / 100;
  const medical    = Math.round((empAllowances.medical    || 0) * ratio * 100) / 100;
  // Dashain bonus (Asoj = month 6 in BS calendar) — one month basic, not pro-rated
  const dashain    = bsMonth === 6 ? (emp.basicSalary || 0) : 0;

  const grossSalary = Math.round((effectiveBasic + houseRent + transport + medical + dashain) * 100) / 100;

  // SSF (Social Security Fund) — applicable if emp.ssf === true
  const ssfEmployee = emp.ssf ? Math.round(effectiveBasic * 0.11 * 100) / 100 : 0;
  const ssfEmployer = emp.ssf ? Math.round(effectiveBasic * 0.20 * 100) / 100 : 0;

  // Taxable income = gross – SSF employee contribution – approved declarations (annual)
  const taxDecl = emp.taxDeclarations || {};
  const annualDeclarations = ((taxDecl.lifeInsurance || 0) + (taxDecl.healthInsurance || 0));
  // Compute annual gross from regular salary (without dashain) + add dashain once
  const regularMonthlyGross = Math.round((effectiveBasic + houseRent + transport + medical) * 100) / 100;
  const annualGross = regularMonthlyGross * 12 + dashain;
  const annualSSF   = ssfEmployee * 12;
  const annualTaxable = Math.max(0, annualGross - annualSSF - annualDeclarations);

  // Nepal income tax slabs (Individual, FY 2080/81):
  // 0 – 600,000  → 1%
  // 600,001 – 800,000  → 10%
  // 800,001 – 1,100,000  → 20%
  // 1,100,001 – 2,000,000  → 30%
  // Above 2,000,000  → 36%
  let annualTax = 0;
  if (annualTaxable > 2_000_000) {
    annualTax = 600_000 * 0.01 + 200_000 * 0.10 + 300_000 * 0.20 + 900_000 * 0.30 + (annualTaxable - 2_000_000) * 0.36;
  } else if (annualTaxable > 1_100_000) {
    annualTax = 600_000 * 0.01 + 200_000 * 0.10 + 300_000 * 0.20 + (annualTaxable - 1_100_000) * 0.30;
  } else if (annualTaxable > 800_000) {
    annualTax = 600_000 * 0.01 + 200_000 * 0.10 + (annualTaxable - 800_000) * 0.20;
  } else if (annualTaxable > 600_000) {
    annualTax = 600_000 * 0.01 + (annualTaxable - 600_000) * 0.10;
  } else {
    annualTax = annualTaxable * 0.01;
  }

  const incomeTax = Math.round((annualTax / 12) * 100) / 100;
  const netSalary = Math.round((grossSalary - ssfEmployee - incomeTax) * 100) / 100;

  return {
    basicSalary: effectiveBasic,
    allowances: { houseRent, transport, medical, dashain },
    grossSalary,
    ssfEmployee,
    ssfEmployer,
    incomeTax,
    netSalary,
  };
}
