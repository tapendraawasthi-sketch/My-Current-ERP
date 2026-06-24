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

    // SSF: 11% employee, 20% employer (simplified)
    const ssf = Math.round(basic * 0.31 * 100) / 100;

    // TDS: simplified slab (15% above 600k annual)
    const annualGross = gross * 12;
    let annualTax = 0;
    if (annualGross > 600000) {
      annualTax = (annualGross - 600000) * 0.15;
    }
    const tds = Math.round((annualTax / 12) * 100) / 100;

    const otherDeductions = emp.otherDeductions || 0;
    const net = Math.round((gross - pfEmployee - tds - otherDeductions) * 100) / 100;

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

export const computeNepalPayroll = () => [];
