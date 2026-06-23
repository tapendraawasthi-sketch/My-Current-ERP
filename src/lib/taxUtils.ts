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
  vouchers: JournalEntry[],
  accounts: Account[],
  startDate: string,
  endDate: string,
) {
  const filtered = invoices.filter(
    (inv) =>
      (inv.type === VoucherType.SALES_INVOICE || inv.type === VoucherType.SALES_RETURN) &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate,
  ).sort((a, b) => a.date.localeCompare(b.date));

  let totalTaxable = 0;
  let totalVat = 0;
  let totalExempt = 0;
  let totalDiscount = 0;

  const rows = filtered.map((inv, idx) => {
    const isReturn = inv.type === VoucherType.SALES_RETURN;
    const sign = isReturn ? -1 : 1;
    
    // Only include VAT-applicable lines in taxable, others in amount (exempt)
    let invTaxable = 0;
    let invExempt = 0;
    let invVat = 0;
    
    inv.lines.forEach(l => {
      const net = (l.netAmount || 0) * sign;
      const vat = (l.vatAmount || 0) * sign;
      if (l.isTaxable) {
        invTaxable += net;
        invVat += vat;
      } else {
        invExempt += net;
      }
    });

    const invTotal = invTaxable + invVat + invExempt;
    const discount = (inv.discountAmount || 0) * sign;

    totalTaxable = round2(totalTaxable + invTaxable);
    totalVat = round2(totalVat + invVat);
    totalExempt = round2(totalExempt + invExempt);
    totalDiscount = round2(totalDiscount + discount);

    return {
      sn: idx + 1,
      customerName: inv.partyName,
      customerPAN: inv.partyPan || "",
      billDate: inv.dateNepali || inv.date,
      billNumber: inv.invoiceNo,
      amount: round2(invTotal),
      discount: discount,
      taxableAmount: round2(invTaxable),
      vatAmount: round2(invVat),
      exemptAmount: round2(invExempt)
    };
  });

  return {
    rows,
    totals: {
      taxable: totalTaxable,
      vat: totalVat,
      exempt: totalExempt,
      discount: totalDiscount,
      total: round2(totalTaxable + totalVat + totalExempt),
    },
  };
}

export function computeVatAnnexB(
  invoices: Invoice[],
  vouchers: JournalEntry[],
  accounts: Account[],
  startDate: string,
  endDate: string,
) {
  const filtered = invoices.filter(
    (inv) =>
      (inv.type === VoucherType.PURCHASE_INVOICE || inv.type === VoucherType.PURCHASE_RETURN) &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate,
  ).sort((a, b) => a.date.localeCompare(b.date));

  let totalTaxable = 0;
  let totalVat = 0;
  let totalExempt = 0;
  let totalDiscount = 0;

  const rows = filtered.map((inv, idx) => {
    const isReturn = inv.type === VoucherType.PURCHASE_RETURN;
    const sign = isReturn ? -1 : 1;
    
    let invTaxable = 0;
    let invExempt = 0;
    let invVat = 0;
    
    inv.lines.forEach(l => {
      const net = (l.netAmount || 0) * sign;
      const vat = (l.vatAmount || 0) * sign;
      if (l.isTaxable) {
        invTaxable += net;
        invVat += vat;
      } else {
        invExempt += net;
      }
    });

    const invTotal = invTaxable + invVat + invExempt;
    const discount = (inv.discountAmount || 0) * sign;

    totalTaxable = round2(totalTaxable + invTaxable);
    totalVat = round2(totalVat + invVat);
    totalExempt = round2(totalExempt + invExempt);
    totalDiscount = round2(totalDiscount + discount);

    return {
      sn: idx + 1,
      supplierName: inv.partyName,
      supplierPAN: inv.partyPan || "",
      billDate: inv.dateNepali || inv.date,
      billNumber: inv.invoiceNo,
      amount: round2(invTotal),
      discount: discount,
      taxableAmount: round2(invTaxable),
      inputVat: round2(invVat),
      exemptAmount: round2(invExempt)
    };
  });

  return {
    rows,
    totals: {
      taxable: totalTaxable,
      vat: totalVat,
      exempt: totalExempt,
      discount: totalDiscount,
      total: round2(totalTaxable + totalVat + totalExempt),
    },
  };
}

export function computeVatAnnexC(
  invoices: Invoice[],
  startDate: string,
  endDate: string,
) {
  const filtered = invoices.filter(
    (inv) =>
      inv.type === VoucherType.PURCHASE_INVOICE &&
      inv.status === VoucherStatus.POSTED &&
      inv.date >= startDate &&
      inv.date <= endDate
  ).filter((inv) => {
    // If foreign supplier or lines have import HSN codes
    const isForeign = !inv.partyPan || inv.partyPan.trim() === "";
    const hasImportCode = inv.lines.some(l => l.hsnCode && (l.hsnCode.startsWith("8") || l.hsnCode.startsWith("9"))); // Simplification
    return isForeign || hasImportCode;
  }).sort((a, b) => a.date.localeCompare(b.date));

  let totalAssessable = 0;
  let totalVat = 0;

  const rows: any[] = [];
  let sn = 1;

  filtered.forEach((inv) => {
    inv.lines.forEach(l => {
      if (l.isTaxable) {
        const assessable = round2(l.netAmount || 0);
        const vat = round2(l.vatAmount || 0);
        totalAssessable += assessable;
        totalVat += vat;

        rows.push({
          sn: sn++,
          importerName: inv.partyName,
          customsDeclarationNumber: inv.referenceNo || "-",
          entryDate: inv.dateNepali || inv.date,
          countryOfOrigin: "Foreign",
          description: l.itemName,
          quantity: l.qty,
          assessableValue: assessable,
          vatAmount: vat
        });
      }
    });
  });

  return {
    rows,
    totals: {
      assessableValue: totalAssessable,
      vatAmount: totalVat,
    },
  };
}

export function computeVAT3Return(
  annexA: any,
  annexB: any,
  startDate: string,
  endDate: string,
) {
  const salesVat = annexA.totals.vat || 0;
  const purchaseVat = annexB.totals.vat || 0;

  const netVat = round2(salesVat - purchaseVat);
  const vatPayable = netVat > 0 ? netVat : 0;
  const vatRefundable = netVat < 0 ? Math.abs(netVat) : 0;

  // Compute 25th of next BS month (simplified simulation)
  // In reality, this requires BS calendar arithmetic.
  const dueDate = "25th of next BS month";

  return {
    purchaseVat,
    salesVat,
    vatPayable,
    vatRefundable,
    prevBalance: 0,
    netVat,
    dueDate,
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

export function validateVATNumber(vat: string): boolean {
  if (!vat) return false;
  const clean = vat.trim();
  return /^\d{9}$/.test(clean) || /^\d{9}[A-Z]{1}\d{3}$/.test(clean);
}

export function validatePAN(pan: string): boolean {
  if (!pan) return false;
  return /^\d{9}$/.test(pan.trim());
}

export function computeNepalVAT(taxableAmount: number, vatRate: number = 13, inclusive: boolean = false): { taxableValue: number, vatAmount: number, totalAmount: number } {
  if (!inclusive) {
    const taxableValue = Math.round(taxableAmount * 100) / 100;
    const vatAmount = Math.round((taxableValue * vatRate / 100) * 100) / 100;
    const totalAmount = Math.round((taxableValue + vatAmount) * 100) / 100;
    return { taxableValue, vatAmount, totalAmount };
  } else {
    const taxableValue = Math.round((taxableAmount / (1 + vatRate / 100)) * 100) / 100;
    const vatAmount = Math.round((taxableAmount - taxableValue) * 100) / 100;
    const totalAmount = Math.round(taxableAmount * 100) / 100;
    return { taxableValue, vatAmount, totalAmount };
  }
}

export function computeInvoiceVAT(lines: Array<{qty: number, rate: number, discount: number, vatExempt: boolean}>, vatRate: number = 13): { subtotal: number, totalDiscount: number, taxableAmount: number, vatAmount: number, grandTotal: number } {
  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  
  for (const line of lines) {
    const lineAmount = line.qty * line.rate;
    const lineDiscount = lineAmount * line.discount / 100;
    const lineNet = lineAmount - lineDiscount;
    
    subtotal += lineAmount;
    totalDiscount += lineDiscount;
    
    if (!line.vatExempt) {
      taxableAmount += lineNet;
    }
  }
  
  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  
  const vatAmount = Math.round((taxableAmount * vatRate / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal - totalDiscount + vatAmount) * 100) / 100;
  
  return { subtotal, totalDiscount, taxableAmount, vatAmount, grandTotal };
}

export function computeWithholdingTDS(amount: number, section: string, rate: number, threshold: number): { applicable: boolean, tdsAmount: number, netPayable: number } {
  if (amount <= threshold) {
    return { applicable: false, tdsAmount: 0, netPayable: amount };
  } else {
    const tdsAmount = Math.round((amount * rate / 100) * 100) / 100;
    const netPayable = Math.round((amount - tdsAmount) * 100) / 100;
    return { applicable: true, tdsAmount, netPayable };
  }
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
