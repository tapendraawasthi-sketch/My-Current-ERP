// src/lib/nepalSSFCalculation.ts
export function computeSSFContribution(basicSalary: number) {
  // Employee: 10% PF + 1% SST = 11%
  const employeeProvidentFund = basicSalary * 0.1;
  const employeeSocialSecurityTax = basicSalary * 0.01;
  const totalEmployeeContribution = employeeProvidentFund + employeeSocialSecurityTax;

  // Employer: 10% PF + 8.33% Gratuity + 1.67% Additional = 20%
  const employerProvidentFund = basicSalary * 0.1;
  const employerGratuity = basicSalary * 0.0833;
  const employerAdditional = basicSalary * 0.0167;
  const totalEmployerContribution = employerProvidentFund + employerGratuity + employerAdditional;

  return {
    employeeProvidentFund,
    employeeSocialSecurityTax,
    totalEmployeeContribution,
    employerProvidentFund,
    employerGratuity,
    employerAdditional,
    totalEmployerContribution,
    grandTotal: totalEmployeeContribution + totalEmployerContribution,
  };
}
