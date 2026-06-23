/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee } from "./types";

/**
 * Computes Nepal specific payroll based on SSF and Income Tax rules.
 */
export function computeNepalPayroll(
  employee: Employee,
  year: number,
  month: number,
  paidDays: number,
  totalWorkingDays: number
): {
  grossSalary: number;
  basicSalary: number;
  allowances: Record<string, number>;
  ssfEmployee: number;
  ssfEmployer: number;
  incomeTax: number;
  netSalary: number;
  breakdown: Record<string, number>;
} {
  const prorateFactor = paidDays / totalWorkingDays;
  
  const basicSalary = employee.basicSalary * prorateFactor;
  
  const houseRent = (employee.allowances.houseRent || (employee.basicSalary * 0.5)) * prorateFactor;
  const transport = (employee.allowances.transport || 0) * prorateFactor;
  const medical = (employee.allowances.medical || 0) * prorateFactor;
  const dashain = (employee.allowances.dashain || 0);

  const grossSalary = basicSalary + houseRent + transport + medical + dashain;

  let ssfEmployee = 0;
  let ssfEmployer = 0;

  if (employee.ssf) {
    ssfEmployee = grossSalary * 0.11;
    ssfEmployer = grossSalary * 0.20;
  }

  const annualGross = grossSalary * 12;
  const annualSSFEmployee = ssfEmployee * 12;
  
  const lifeInsuranceLimit = 25000;
  const healthInsuranceLimit = 20000;
  
  const lifeInsuranceDed = Math.min(employee.taxDeclarations.lifeInsurance || 0, lifeInsuranceLimit);
  const healthInsuranceDed = Math.min(employee.taxDeclarations.healthInsurance || 0, healthInsuranceLimit);

  const annualTaxableIncome = Math.max(0, annualGross - annualSSFEmployee - lifeInsuranceDed - healthInsuranceDed);
  
  let remainingTaxable = annualTaxableIncome;
  let annualTax = 0;

  const slab1Limit = 600000;
  if (remainingTaxable > 0) {
    const amount = Math.min(remainingTaxable, slab1Limit);
    if (!employee.ssf) {
      annualTax += amount * 0.01;
    }
    remainingTaxable -= amount;
  }

  const slab2Limit = 200000;
  if (remainingTaxable > 0) {
    const amount = Math.min(remainingTaxable, slab2Limit);
    annualTax += amount * 0.10;
    remainingTaxable -= amount;
  }

  const slab3Limit = 250000;
  if (remainingTaxable > 0) {
    const amount = Math.min(remainingTaxable, slab3Limit);
    annualTax += amount * 0.20;
    remainingTaxable -= amount;
  }

  const slab4Limit = 950000;
  if (remainingTaxable > 0) {
    const amount = Math.min(remainingTaxable, slab4Limit);
    annualTax += amount * 0.30;
    remainingTaxable -= amount;
  }

  if (remainingTaxable > 0) {
    annualTax += remainingTaxable * 0.36;
  }

  const incomeTax = annualTax / 12;

  const netSalary = grossSalary - ssfEmployee - incomeTax;

  return {
    grossSalary,
    basicSalary,
    allowances: {
      houseRent,
      transport,
      medical,
      dashain
    },
    ssfEmployee,
    ssfEmployer,
    incomeTax,
    netSalary,
    breakdown: {
      annualGross,
      annualTaxableIncome,
      annualTax
    }
  };
}
