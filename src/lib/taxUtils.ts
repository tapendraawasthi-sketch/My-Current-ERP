// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Invoice,
  InvoiceLine,
  JournalEntry,
  Account,
  TdsEntry,
  Party,
  CompanySettings,
  TdsType,
  VoucherType,
  VoucherStatus,
  Employee,
} from "./types";
import { VAT_RATE, TDS_RATES, TDS_SECTIONS } from "./constants";

export interface VatComputation {
  lines: {
    itemName: string;
    qty: number;
    rate: number;
    taxableAmount: number;
    exemptAmount: number;
    vatAmount: number;
    netAmount: number;
  }[];
  subTotal: number;
  taxableTotal: number;
  exemptTotal: number;
  vatAmount: number;
  grandTotal: number;
  roundOff: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ==========================================
// 1. VAT COMPUTATION CORE
// ==========================================

export function computeVAT(
  lines: {
    itemName: string;
    qty: number;
    rate: number;
    discount: number;
    isTaxable: boolean;
    vatRate?: number;
  }[],
): VatComputation {
  let subTotal = 0;
  let taxableTotal = 0;
  let exemptTotal = 0;
  let vatAmountTotal = 0;
  const computedLines = [];

  for (const line of lines) {
    const grossVal = round2(line.qty * line.rate);
    const netAmt = round2(line.qty * line.rate * (1 - line.discount / 100));

    subTotal = round2(subTotal + grossVal);

    if (line.isTaxable) {
      const rateFactor = line.vatRate !== undefined ? line.vatRate : VAT_RATE;
      const vatVal = round2(netAmt * (rateFactor / 100));

      taxableTotal = round2(taxableTotal + netAmt);
      vatAmountTotal = round2(vatAmountTotal + vatVal);

      computedLines.push({
        itemName: line.itemName,
        qty: line.qty,
        rate: line.rate,
        taxableAmount: netAmt,
        exemptAmount: 0,
        vatAmount: vatVal,
        netAmount: round2(netAmt + vatVal),
      });
    } else {
      exemptTotal = round2(exemptTotal + netAmt);

      computedLines.push({
        itemName: line.itemName,
        qty: line.qty,
        rate: line.rate,
        taxableAmount: 0,
        exemptAmount: netAmt,
        vatAmount: 0,
        netAmount: netAmt,
      });
    }
  }

  const grandTotalBeforeRoundOff = round2(taxableTotal + vatAmountTotal + exemptTotal);
  const roundedGrandTotal = Math.round(grandTotalBeforeRoundOff);
  const roundOff = round2(roundedGrandTotal - grandTotalBeforeRoundOff);

  return {
    lines: computedLines,
    subTotal,
    taxableTotal,
    exemptTotal,
    vatAmount: vatAmountTotal,
    grandTotal: roundedGrandTotal,
    roundOff,
  };
}

export function reverseCalculateVAT(
  amountIncludingVat: number,
  vatRate: number,
): { baseAmount: number; vatAmount: number } {
  const base = round2(amountIncludingVat / (1 + vatRate / 100));
  const vat = round2(amountIncludingVat - base);
  return { baseAmount: base, vatAmount: vat };
}

// ==========================================
// 2. VAT ANNEX REPORTS
// ==========================================

export function computeVatAnnexA(
  invoices: Invoice[],
  startDate: string,
  endDate: string,
): {
  rows: {
    sNo: number;
    date: string;
    billNo: string;
    partyName: string;
    partyPan: string;
    taxableAmt: number;
    vatAmt: number;
    exemptAmt: number;
    totalAmt: number;
  }[];
  totals: { taxable: number; vat: number; exempt: number; total: number };
} {
  const filtered = invoices.filter(
    (inv) =>
      inv.type === VoucherType.PURCHASE_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate,
  );

  let totalTaxable = 0;
  let totalVat = 0;
  let totalExempt = 0;

  const rows = filtered.map((inv, idx) => {
    const pan = inv.partyPan || "";

    totalTaxable = round2(totalTaxable + inv.taxableAmount);
    totalVat = round2(totalVat + inv.vatAmount);
    totalExempt = round2(totalExempt + inv.exemptAmount);

    return {
      sNo: idx + 1,
      date: inv.date,
      billNo: inv.invoiceNo,
      partyName: inv.partyName,
      partyPan: pan,
      taxableAmt: inv.taxableAmount,
      vatAmt: inv.vatAmount,
      exemptAmt: inv.exemptAmount,
      totalAmt: inv.grandTotal,
    };
  });

  return {
    rows,
    totals: {
      taxable: totalTaxable,
      vat: totalVat,
      exempt: totalExempt,
      total: round2(totalTaxable + totalVat + totalExempt),
    },
  };
}

export function computeVatAnnexB(
  invoices: Invoice[],
  startDate: string,
  endDate: string,
): {
  rows: {
    sNo: number;
    date: string;
    billNo: string;
    partyName: string;
    partyPan: string;
    taxableAmt: number;
    vatAmt: number;
    exemptAmt: number;
    totalAmt: number;
  }[];
  totals: { taxable: number; vat: number; exempt: number; total: number };
} {
  const filtered = invoices.filter(
    (inv) =>
      inv.type === VoucherType.SALES_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate,
  );

  let totalTaxable = 0;
  let totalVat = 0;
  let totalExempt = 0;

  const rows = filtered.map((inv, idx) => {
    totalTaxable = round2(totalTaxable + inv.taxableAmount);
    totalVat = round2(totalVat + inv.vatAmount);
    totalExempt = round2(totalExempt + inv.exemptAmount);

    return {
      sNo: idx + 1,
      date: inv.date,
      billNo: inv.invoiceNo,
      partyName: inv.partyName,
      partyPan: inv.partyPan || "",
      taxableAmt: inv.taxableAmount,
      vatAmt: inv.vatAmount,
      exemptAmt: inv.exemptAmount,
      totalAmt: inv.grandTotal,
    };
  });

  return {
    rows,
    totals: {
      taxable: totalTaxable,
      vat: totalVat,
      exempt: totalExempt,
      total: round2(totalTaxable + totalVat + totalExempt),
    },
  };
}

export function computeVatAnnexC(
  invoices: Invoice[],
  startDate: string,
  endDate: string,
): {
  rows: {
    sNo: number;
    date: string;
    billNo: string;
    partyName: string;
    partyPan: string;
    taxableAmt: number;
    vatAmt: number;
    exemptAmt: number;
    totalAmt: number;
  }[];
  totals: { taxable: number; vat: number; exempt: number; total: number };
} {
  const filtered = invoices.filter(
    (inv) =>
      inv.type === VoucherType.SALES_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate &&
      (!inv.partyPan || inv.partyPan.trim() === ""),
  );

  let totalTaxable = 0;
  let totalVat = 0;
  let totalExempt = 0;

  const rows = filtered.map((inv, idx) => {
    totalTaxable = round2(totalTaxable + inv.taxableAmount);
    totalVat = round2(totalVat + inv.vatAmount);
    totalExempt = round2(totalExempt + inv.exemptAmount);

    return {
      sNo: idx + 1,
      date: inv.date,
      billNo: inv.invoiceNo,
      partyName: inv.partyName,
      partyPan: "",
      taxableAmt: inv.taxableAmount,
      vatAmt: inv.vatAmount,
      exemptAmt: inv.exemptAmount,
      totalAmt: inv.grandTotal,
    };
  });

  return {
    rows,
    totals: {
      taxable: totalTaxable,
      vat: totalVat,
      exempt: totalExempt,
      total: round2(totalTaxable + totalVat + totalExempt),
    },
  };
}

export function computeVAT3Return(
  invoices: Invoice[],
  vouchers: JournalEntry[],
  accounts: Account[],
  startDate: string,
  endDate: string,
): {
  purchaseVat: number;
  salesVat: number;
  vatPayable: number;
  vatRefundable: number;
  prevBalance: number;
  netVat: number;
  period: { start: string; end: string };
} {
  const purInvoices = invoices.filter(
    (inv) =>
      inv.type === VoucherType.PURCHASE_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate,
  );
  const purchaseVat = round2(purInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0));

  const salesInvoices = invoices.filter(
    (inv) =>
      inv.type === VoucherType.SALES_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate,
  );
  const salesVat = round2(salesInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0));

  const netVat = round2(salesVat - purchaseVat);
  const vatPayable = netVat > 0 ? netVat : 0;
  const vatRefundable = netVat < 0 ? Math.abs(netVat) : 0;

  const vatPayableAcc = accounts.find((a) => a.id === "acc-vat-payable");
  const vatReceivableAcc = accounts.find((a) => a.id === "acc-vat-receivable");

  let prevPayableBal = 0;
  let prevReceivableBal = 0;

  const pastVouchers = vouchers.filter(
    (v) => v.status === VoucherStatus.POSTED && v.date < startDate,
  );

  for (const v of pastVouchers) {
    for (const l of v.lines) {
      if (vatPayableAcc && l.accountId === vatPayableAcc.id) {
        prevPayableBal = round2(prevPayableBal + l.credit - l.debit);
      }
      if (vatReceivableAcc && l.accountId === vatReceivableAcc.id) {
        prevReceivableBal = round2(prevReceivableBal + l.debit - l.credit);
      }
    }
  }

  const prevBalance = round2(prevPayableBal - prevReceivableBal);

  return {
    purchaseVat,
    salesVat,
    vatPayable,
    vatRefundable,
    prevBalance,
    netVat,
    period: { start: startDate, end: endDate },
  };
}

// ==========================================
// 3. TDS COMPUTATION
// ==========================================

export function computeTDS(
  grossAmount: number,
  tdsType: TdsType,
): { tdsRate: number; tdsAmount: number; netAmount: number; section: string } {
  const rate = TDS_RATES[tdsType] !== undefined ? TDS_RATES[tdsType] : 0;
  const sec = TDS_SECTIONS[tdsType] || "N/A";
  const tdsAmt = Math.round(((grossAmount * rate) / 100) * 100) / 100;
  const netAmt = round2(grossAmount - tdsAmt);

  return {
    tdsRate: rate,
    tdsAmount: tdsAmt,
    netAmount: netAmt,
    section: sec,
  };
}

export function getTDSSummary(
  tdsEntries: TdsEntry[],
  startDate: string,
  endDate: string,
): {
  byType: Record<
    TdsType,
    { grossAmount: number; tdsAmount: number; netAmount: number; count: number }
  >;
  total: { grossAmount: number; tdsAmount: number; netAmount: number };
} {
  const filtered = tdsEntries.filter((e) => e.date >= startDate && e.date <= endDate);

  const byType = {} as Record<
    TdsType,
    { grossAmount: number; tdsAmount: number; netAmount: number; count: number }
  >;
  Object.values(TdsType).forEach((t) => {
    byType[t as TdsType] = { grossAmount: 0, tdsAmount: 0, netAmount: 0, count: 0 };
  });

  let totalGross = 0;
  let totalTds = 0;
  let totalNet = 0;

  for (const entry of filtered) {
    const t = entry.tdsType;
    if (byType[t]) {
      byType[t].grossAmount = round2(byType[t].grossAmount + entry.grossAmount);
      byType[t].tdsAmount = round2(byType[t].tdsAmount + entry.tdsAmount);
      byType[t].netAmount = round2(byType[t].netAmount + entry.netAmount);
      byType[t].count += 1;
    }

    totalGross = round2(totalGross + entry.grossAmount);
    totalTds = round2(totalTds + entry.tdsAmount);
    totalNet = round2(totalNet + entry.netAmount);
  }

  return {
    byType,
    total: {
      grossAmount: totalGross,
      tdsAmount: totalTds,
      netAmount: totalNet,
    },
  };
}

export function getTDSCertificateData(
  tdsEntry: TdsEntry,
  party: Party,
  company: CompanySettings,
): Record<string, string | number> {
  return {
    id: tdsEntry.id,
    companyName: company.name,
    companyAddress: company.address,
    companyPan: company.panNumber,
    partyName: party.name,
    partyPan: party.pan || "N/A",
    partyAddress: party.address || "N/A",
    date: tdsEntry.date,
    dateNepali: tdsEntry.dateNepali,
    grossAmount: tdsEntry.grossAmount,
    tdsRate: tdsEntry.tdsRate,
    tdsAmount: tdsEntry.tdsAmount,
    netAmount: tdsEntry.netAmount,
    section: tdsEntry.section || "88",
    status: tdsEntry.deposited ? "Deposited" : "Withheld",
    depositDate: tdsEntry.depositDate || "",
    challanNo: tdsEntry.depositChallanNo || "",
  };
}

// ==========================================
// 4. INVOICE TOTALS HELPER
// ==========================================

export function calculateInvoiceTotals(
  lines: InvoiceLine[],
  tdsType?: TdsType,
  tdsApplicable?: boolean,
): {
  subTotal: number;
  taxableAmount: number;
  exemptAmount: number;
  vatAmount: number;
  tdsAmount: number;
  tdsRate: number;
  grandTotal: number;
  roundOff: number;
} {
  const formattedLines = lines.map((l) => ({
    itemName: l.itemName,
    qty: l.qty,
    rate: l.rate,
    discount:
      l.discount !== undefined
        ? l.discount
        : l.discountPercent !== undefined
          ? l.discountPercent
          : 0,
    isTaxable: !!l.isTaxable,
    vatRate: l.vatRate,
  }));

  const vatComp = computeVAT(formattedLines);

  let tdsAmount = 0;
  let tdsRate = 0;

  if (tdsApplicable && tdsType && tdsType !== TdsType.NONE) {
    const tdsVal = computeTDS(round2(vatComp.taxableTotal + vatComp.exemptTotal), tdsType);
    tdsAmount = tdsVal.tdsAmount;
    tdsRate = tdsVal.tdsRate;
  }

  const exactGrand = round2(vatComp.grandTotal - tdsAmount);
  const roundedGrand = Math.round(exactGrand);
  const roundOff = round2(roundedGrand - exactGrand);

  return {
    subTotal: vatComp.subTotal,
    taxableAmount: vatComp.taxableTotal,
    exemptAmount: vatComp.exemptTotal,
    vatAmount: vatComp.vatAmount,
    tdsAmount,
    tdsRate,
    grandTotal: roundedGrand,
    roundOff,
  };
}

// ==========================================
// 5. TAX VALIDATION UTILITIES
// ==========================================

export function validateVatNumber(vat: string): boolean {
  if (!vat) return false;
  const clean = vat.replace(/[-\s]/g, "");
  return /^3\d{8}$/.test(clean);
}

export function validatePanNumber(pan: string): boolean {
  if (!pan) return false;
  const clean = pan.replace(/[-\s]/g, "");
  return /^\d{9}$/.test(clean);
}

export function isPanRequired(amount: number): boolean {
  return amount > 10000;
}

export function generateVatAnnex8(invoices: Invoice[]) {
  return (invoices || [])
    .filter((inv) => inv.type === VoucherType.SALES_INVOICE && inv.status === VoucherStatus.POSTED)
    .map((inv) => ({
      invoiceNo: inv.invoiceNo,
      partyName: inv.partyName,
      taxableAmount: inv.taxableAmount || 0,
      vatAmount: inv.vatAmount || 0,
    }));
}

export function generateVatAnnex5(invoices: Invoice[]) {
  return (invoices || [])
    .filter(
      (inv) => inv.type === VoucherType.PURCHASE_INVOICE && inv.status === VoucherStatus.POSTED,
    )
    .map((inv) => ({
      invoiceNo: inv.invoiceNo,
      partyName: inv.partyName,
      taxableAmount: inv.taxableAmount || 0,
      vatAmount: inv.vatAmount || 0,
    }));
}

/**
 * Computes annual TDS on salary based on Nepal Income Tax Act 2058 slabs (FY 2081-82)
 * @param annualGross Annual gross salary in NPR
 * @param maritalStatus 'single' | 'married' (married gets higher exemption)
 */
export function computeSalaryTDS(
  employee: Employee,
  grossSalary: number,
  currentMonth: number,
  accumulatedTDS: number,
): {
  grossSalary: number;
  totalDeductions: number;
  taxableIncome: number;
  annualTax: number;
  monthlyTDS: number;
  netSalary: number;
} {
  const remainingMonths = 12 - currentMonth + 1;

  // 1. Annualize gross salary
  const annualSalary = grossSalary * 12;

  // 2. Compute deductions
  // PF deduction
  const pfEmployee = employee.pfEnabled ? employee.basicSalary * (employee.pfRate / 100) : 0;
  // CIT deduction
  const citEmployee = employee.citEnabled ? employee.basicSalary * (employee.citRate / 100) : 0;
  // SSF deduction
  let ssfEmployee = 0;
  if (employee.ssfEnabled) {
    if (employee.ssfContributionType === "basic") {
      ssfEmployee = employee.basicSalary * 0.11;
    } else if (employee.ssfContributionType === "premium") {
      ssfEmployee = grossSalary * 0.01;
    }
  }

  const monthlyDeductions = pfEmployee + citEmployee + ssfEmployee;
  const annualDeductions = monthlyDeductions * 12;

  // 3. Compute exemptions
  const rentExemption = Math.min(employee.rentAllowance || 0, 3000);
  const medicalExemption = Math.min(employee.medicalAllowance || 0, 750);
  const transportExemption = Math.min(employee.transportAllowance || 0, 2500);

  const monthlyExemptions = rentExemption + medicalExemption + transportExemption;
  const annualExemptions = monthlyExemptions * 12;

  // 4. Calculate Taxable Income
  const taxableAnnualIncome = Math.max(0, annualSalary - annualDeductions - annualExemptions);

  // 5. Calculate progressive tax
  const slabs = employee.maritalStatus === "married" ? [
    { limit: 550000, rate: 0.01 },
    { limit: 220000, rate: 0.10 }, // 770,000 - 550,000 = 220,000
    { limit: 330000, rate: 0.20 }, // 1,100,000 - 770,000 = 330,000
    { limit: 1100000, rate: 0.30 }, // 2,200,000 - 1,100,000 = 1,100,000
    { limit: Infinity, rate: 0.36 },
  ] : [
    { limit: 500000, rate: 0.01 },
    { limit: 200000, rate: 0.10 }, // 700,000 - 500,000 = 200,000
    { limit: 300000, rate: 0.20 }, // 1,000,000 - 700,000 = 300,000
    { limit: 1000000, rate: 0.30 }, // 2,000,000 - 1,000,000 = 1,000,000
    { limit: Infinity, rate: 0.36 },
  ];

  let tempIncome = taxableAnnualIncome;
  let annualTax = 0;
  for (const slab of slabs) {
    if (tempIncome <= 0) break;
    const taxableInSlab = Math.min(tempIncome, slab.limit);
    annualTax += taxableInSlab * slab.rate;
    tempIncome -= taxableInSlab;
  }

  // Round tax to 2 decimal places
  annualTax = Math.round(annualTax * 100) / 100;

  // 6. Calculate monthly TDS
  const remainingTax = Math.max(0, annualTax - accumulatedTDS);
  const monthlyTDS = Math.round((remainingTax / remainingMonths) * 100) / 100;

  // Calculate Net Salary
  // Other deductions (from employee profile deductions list)
  const otherDeductions = (employee.deductions || []).reduce((sum, d) => sum + d.amount, 0);

  const netSalary = Math.round((grossSalary - monthlyDeductions - monthlyTDS - otherDeductions) * 100) / 100;

  return {
    grossSalary,
    totalDeductions: monthlyDeductions,
    taxableIncome: Math.round((taxableAnnualIncome / 12) * 100) / 100,
    annualTax,
    monthlyTDS,
    netSalary,
  };
}

export function computePFContribution(basicSalary: number, pfEnabled: boolean): { employee: number; employer: number } {
  if (!pfEnabled) return { employee: 0, employer: 0 };
  return { employee: basicSalary * 0.1, employer: basicSalary * 0.1 };
}

export function computeCITContribution(basicSalary: number, citRate: number, citEnabled: boolean): {
  employee: number;
  employer: number;
} {
  if (!citEnabled) return { employee: 0, employer: 0 };
  return { employee: basicSalary * (citRate / 100), employer: 0 };
}

export function computeSSFContribution(employee: Employee, grossSalary: number): {
  employee: number;
  employer: number;
} {
  if (!employee.ssfEnabled) return { employee: 0, employer: 0 };
  if (employee.ssfContributionType === "basic") {
    return {
      employee: employee.basicSalary * 0.11,
      employer: employee.basicSalary * 0.20,
    };
  } else if (employee.ssfContributionType === "premium") {
    return {
      employee: grossSalary * 0.01,
      employer: grossSalary * 0.0333,
    };
  }
  return { employee: 0, employer: 0 };
}
