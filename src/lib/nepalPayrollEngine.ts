export interface SalaryStructure {
  basicSalary: number;
  gradeAllowance: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  fuelAllowance: number;
  telephoneAllowance: number;
  otherAllowances: number;
  totalAllowances?: number;
  grossSalary?: number;
}

export interface EmployeePayrollInput {
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  panNo: string;
  pfNo: string;
  ssfNo: string;
  citizenshipNo: string;
  bankAccount: string;
  bankName: string;
  joiningDate: string;
  salaryStructure: SalaryStructure;
  presentDays: number;
  workingDays: number;
  overtimeHours: number;
  overtimeRate: number;
  advanceDeduction: number;
  otherDeductions: number;
  arrears: number;
  bonus: number;
  isSSFContributor: boolean;
  isPFContributor: boolean;
  fiscalYear: string;
  month: number;
  paymentMode: "bank" | "cash" | "cheque";
}

export interface PayrollResult {
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  paymentMode: string;

  basicSalary: number;
  gradeAllowance: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  fuelAllowance: number;
  telephoneAllowance: number;
  otherAllowances: number;
  overtimePay: number;
  arrears: number;
  bonus: number;
  grossEarnings: number;

  proratedDays: number;
  proratedGross: number;

  employeePF: number;
  employerPF: number;
  employeeSSF: number;
  employerSSF: number;
  incomeTax: number;
  cit: number;
  advanceDeduction: number;
  otherDeductions: number;
  totalDeductions: number;

  netSalary: number;

  annualTaxableIncome: number;
  annualTax: number;
  monthlyTax: number;

  totalEmployerCost: number;
}

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function computeNepalIncomeTax(annualIncome: number, isCouple: boolean = false): number {
  const income = Math.max(0, Number(annualIncome || 0));

  const slabs = isCouple
    ? [
        { upto: 600000, rate: 0.01 },
        { upto: 800000, rate: 0.1 },
        { upto: 1100000, rate: 0.2 },
        { upto: 2100000, rate: 0.3 },
        { upto: Infinity, rate: 0.36 },
      ]
    : [
        { upto: 500000, rate: 0.01 },
        { upto: 700000, rate: 0.1 },
        { upto: 1000000, rate: 0.2 },
        { upto: 2000000, rate: 0.3 },
        { upto: Infinity, rate: 0.36 },
      ];

  let previousLimit = 0;
  let tax = 0;

  for (const slab of slabs) {
    if (income <= previousLimit) break;

    const taxableInSlab = Math.min(income, slab.upto) - previousLimit;
    if (taxableInSlab > 0) tax += taxableInSlab * slab.rate;

    previousLimit = slab.upto;
  }

  return round2(tax);
}

export function computeSSF(grossSalary: number): { employee: number; employer: number } {
  return {
    employee: round2(Number(grossSalary || 0) * 0.11),
    employer: round2(Number(grossSalary || 0) * 0.2),
  };
}

export function computePF(basicSalary: number): { employee: number; employer: number } {
  return {
    employee: round2(Number(basicSalary || 0) * 0.1),
    employer: round2(Number(basicSalary || 0) * 0.1),
  };
}

export function computeGratuity(basicSalary: number, yearsOfService: number): number {
  const salary = Math.max(0, Number(basicSalary || 0));
  const years = Math.max(0, Number(yearsOfService || 0));
  return round2(salary * years * 0.0833);
}

export function computeMonthlyPayroll(
  input: EmployeePayrollInput,
  isCouple: boolean = false,
): PayrollResult {
  const s = input.salaryStructure;

  const basicSalary = round2(s.basicSalary);
  const gradeAllowance = round2(s.gradeAllowance);
  const houseRentAllowance = round2(s.houseRentAllowance);
  const medicalAllowance = round2(s.medicalAllowance);
  const fuelAllowance = round2(s.fuelAllowance);
  const telephoneAllowance = round2(s.telephoneAllowance);
  const otherAllowances = round2(s.otherAllowances);

  const totalAllowances = round2(
    gradeAllowance +
      houseRentAllowance +
      medicalAllowance +
      fuelAllowance +
      telephoneAllowance +
      otherAllowances,
  );

  const overtimePay = round2(Number(input.overtimeHours || 0) * Number(input.overtimeRate || 0));
  const arrears = round2(input.arrears);
  const bonus = round2(input.bonus);

  const grossEarnings = round2(basicSalary + totalAllowances + overtimePay + arrears + bonus);

  const workingDays = Number(input.workingDays || 0);
  const presentDays = Number(input.presentDays || 0);
  const prorateFactor = workingDays === 0 ? 1 : presentDays / workingDays;
  const proratedGross = round2(grossEarnings * prorateFactor);

  const employeePF = input.isPFContributor ? round2(basicSalary * 0.1 * prorateFactor) : 0;
  const employerPF = employeePF;

  const ssf = input.isSSFContributor ? computeSSF(proratedGross) : { employee: 0, employer: 0 };
  const employeeSSF = ssf.employee;
  const employerSSF = ssf.employer;

  const cit = 0;

  const annualTaxableIncome = round2((proratedGross - employeePF - employeeSSF) * 12);
  const annualTax = computeNepalIncomeTax(annualTaxableIncome, isCouple);
  const monthlyTax = round2(annualTax / 12);
  const incomeTax = round2(monthlyTax);

  const advanceDeduction = round2(input.advanceDeduction);
  const otherDeductions = round2(input.otherDeductions);

  const totalDeductions = round2(
    employeePF + employeeSSF + incomeTax + cit + advanceDeduction + otherDeductions,
  );

  const netSalary = round2(proratedGross - totalDeductions);
  const totalEmployerCost = round2(proratedGross + employerPF + employerSSF);

  return {
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    designation: input.designation,
    department: input.department,
    paymentMode: input.paymentMode,

    basicSalary,
    gradeAllowance,
    houseRentAllowance,
    medicalAllowance,
    fuelAllowance,
    telephoneAllowance,
    otherAllowances,
    overtimePay,
    arrears,
    bonus,
    grossEarnings,

    proratedDays: presentDays,
    proratedGross,

    employeePF,
    employerPF,
    employeeSSF,
    employerSSF,
    incomeTax,
    cit,
    advanceDeduction,
    otherDeductions,
    totalDeductions,

    netSalary,

    annualTaxableIncome,
    annualTax,
    monthlyTax,

    totalEmployerCost,
  };
}

export function computePayrollBatch(
  inputs: EmployeePayrollInput[],
  isCouple: boolean = false,
): PayrollResult[] {
  return inputs.map((input) => computeMonthlyPayroll(input, isCouple));
}

export function getPayrollSummary(results: PayrollResult[]): {
  totalEmployees: number;
  totalGrossEarnings: number;
  totalEmployeePF: number;
  totalEmployerPF: number;
  totalEmployeeSSF: number;
  totalEmployerSSF: number;
  totalIncomeTax: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalEmployerCost: number;
} {
  return {
    totalEmployees: results.length,
    totalGrossEarnings: round2(results.reduce((s, r) => s + r.grossEarnings, 0)),
    totalEmployeePF: round2(results.reduce((s, r) => s + r.employeePF, 0)),
    totalEmployerPF: round2(results.reduce((s, r) => s + r.employerPF, 0)),
    totalEmployeeSSF: round2(results.reduce((s, r) => s + r.employeeSSF, 0)),
    totalEmployerSSF: round2(results.reduce((s, r) => s + r.employerSSF, 0)),
    totalIncomeTax: round2(results.reduce((s, r) => s + r.incomeTax, 0)),
    totalDeductions: round2(results.reduce((s, r) => s + r.totalDeductions, 0)),
    totalNetSalary: round2(results.reduce((s, r) => s + r.netSalary, 0)),
    totalEmployerCost: round2(results.reduce((s, r) => s + r.totalEmployerCost, 0)),
  };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function belowThousandToWords(num: number): string {
  let n = Math.floor(num);
  const parts: string[] = [];

  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }

  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
  }

  if (n > 0) {
    parts.push(ONES[n]);
  }

  return parts.join(" ");
}

export function numberToWords(amount: number): string {
  let n = Math.floor(Math.abs(Number(amount || 0)));

  if (n === 0) return "Rupees Zero Only";

  const parts: string[] = [];

  const millions = Math.floor(n / 1000000);
  if (millions > 0) {
    parts.push(`${belowThousandToWords(millions)} Million`);
    n %= 1000000;
  }

  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    parts.push(`${belowThousandToWords(thousands)} Thousand`);
    n %= 1000;
  }

  if (n > 0) {
    parts.push(belowThousandToWords(n));
  }

  return `Rupees ${parts.join(" ")} Only`;
}

export function generatePayslipData(
  result: PayrollResult,
  companyName: string,
  month: string,
  year: string,
): {
  header: {
    companyName: string;
    month: string;
    year: string;
    employeeName: string;
    designation: string;
    department: string;
    panNo?: string;
  };
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  netSalaryWords: string;
} {
  const earnings = [
    { label: "Basic Salary", amount: result.basicSalary },
    { label: "Grade Allowance", amount: result.gradeAllowance },
    { label: "House Rent Allowance", amount: result.houseRentAllowance },
    { label: "Medical Allowance", amount: result.medicalAllowance },
    { label: "Fuel Allowance", amount: result.fuelAllowance },
    { label: "Telephone Allowance", amount: result.telephoneAllowance },
    { label: "Other Allowances", amount: result.otherAllowances },
    { label: "Overtime Pay", amount: result.overtimePay },
    { label: "Arrears", amount: result.arrears },
    { label: "Bonus", amount: result.bonus },
  ].filter((x) => x.amount > 0);

  const deductions = [
    { label: "Employee PF", amount: result.employeePF },
    { label: "Employee SSF", amount: result.employeeSSF },
    { label: "Income Tax", amount: result.incomeTax },
    { label: "CIT", amount: result.cit },
    { label: "Advance Deduction", amount: result.advanceDeduction },
    { label: "Other Deductions", amount: result.otherDeductions },
  ].filter((x) => x.amount > 0);

  return {
    header: {
      companyName,
      month,
      year,
      employeeName: result.employeeName,
      designation: result.designation,
      department: result.department,
      panNo: undefined,
    },
    earnings,
    deductions,
    grossEarnings: result.grossEarnings,
    totalDeductions: result.totalDeductions,
    netSalary: result.netSalary,
    netSalaryWords: numberToWords(result.netSalary),
  };
}
