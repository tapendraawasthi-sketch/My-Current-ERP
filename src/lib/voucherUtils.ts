import { format, parseISO } from "date-fns";

export function getVoucherGroupForType(voucherType: string): string {
  const accountingTypes = [
    "contra",
    "payment",
    "receipt",
    "journal",
    "journal-voucher",
    "sales-invoice",
    "purchase-invoice",
    "credit-note",
    "debit-note",
  ];
  const inventoryTypes = [
    "stock-journal",
    "physical-stock",
    "delivery-note",
    "receipt-note",
    "rejection-in",
    "rejection-out",
    "material-in",
    "material-out",
    "production",
    "unassemble",
    "material-issued",
    "material-received",
  ];
  const orderTypes = ["sales-order", "purchase-order", "job-work-out-order", "job-work-in-order"];
  const payrollTypes = ["payroll", "attendance"];

  if (accountingTypes.includes(voucherType)) return "accounting";
  if (inventoryTypes.includes(voucherType)) return "inventory";
  if (orderTypes.includes(voucherType)) return "order";
  if (payrollTypes.includes(voucherType)) return "payroll";
  return "other";
}

export function getVoucherTypeShortcut(voucherType: string): string {
  const shortcuts: Record<string, string> = {
    contra: "F4",
    payment: "F5",
    receipt: "F6",
    journal: "F7",
    "journal-voucher": "F7",
    "sales-invoice": "F8",
    "purchase-invoice": "F9",
    "credit-note": "Alt+F6",
    "debit-note": "Alt+F5",
    "stock-journal": "Alt+F7",
    "physical-stock": "Ctrl+F7",
    "delivery-note": "Alt+F8",
    "receipt-note": "Alt+F9",
    "rejection-in": "Ctrl+F6",
    "rejection-out": "Ctrl+F5",
    "sales-order": "Ctrl+F8",
    "purchase-order": "Ctrl+F9",
    payroll: "Ctrl+F4",
    memorandum: "Ctrl+F10",
  };

  return shortcuts[voucherType] || "F10";
}

export function getDefaultVoucherMode(voucherType: string): string {
  const itemInvoiceTypes = [
    "sales-invoice",
    "purchase-invoice",
    "delivery-note",
    "receipt-note",
    "rejection-in",
    "rejection-out",
    "material-in",
    "material-out",
    "sales-order",
    "purchase-order",
    "job-work-out-order",
    "job-work-in-order",
  ];

  const singleEntryTypes = ["contra", "payment", "receipt"];
  const doubleEntryTypes = ["journal", "journal-voucher", "credit-note", "debit-note"];

  if (itemInvoiceTypes.includes(voucherType)) return "item-invoice";
  if (singleEntryTypes.includes(voucherType)) return "single-entry";
  if (doubleEntryTypes.includes(voucherType)) return "double-entry";
  return "accounting-invoice";
}

export function isAccountingVoucher(voucherType: string): boolean {
  return [
    "contra",
    "payment",
    "receipt",
    "journal",
    "journal-voucher",
    "sales-invoice",
    "purchase-invoice",
    "credit-note",
    "debit-note",
  ].includes(voucherType);
}

export function isInventoryVoucher(voucherType: string): boolean {
  return [
    "stock-journal",
    "physical-stock",
    "delivery-note",
    "receipt-note",
    "rejection-in",
    "rejection-out",
    "material-in",
    "material-out",
    "production",
    "unassemble",
    "material-issued",
    "material-received",
  ].includes(voucherType);
}

export function isOrderVoucher(voucherType: string): boolean {
  return ["sales-order", "purchase-order", "job-work-out-order", "job-work-in-order"].includes(
    voucherType,
  );
}

export function requiresPartyLedger(voucherType: string): boolean {
  return [
    "sales-invoice",
    "purchase-invoice",
    "credit-note",
    "debit-note",
    "payment",
    "receipt",
    "delivery-note",
    "receipt-note",
    "rejection-in",
    "rejection-out",
    "sales-order",
    "purchase-order",
    "job-work-out-order",
    "job-work-in-order",
  ].includes(voucherType);
}

export function requiresCashBankLedger(voucherType: string): boolean {
  return ["contra", "payment", "receipt"].includes(voucherType);
}

export function calculateVoucherTotals(
  lines: Array<{ debit?: number; credit?: number; amount?: number; taxAmount?: number }>,
) {
  let totalDebit = 0;
  let totalCredit = 0;
  let totalAmount = 0;
  let taxAmount = 0;

  for (const line of lines) {
    totalDebit += line.debit || 0;
    totalCredit += line.credit || 0;
    taxAmount += line.taxAmount || 0;
  }

  totalAmount = Math.max(totalDebit, totalCredit);
  const roundOff = Number((Math.round(totalAmount) - totalAmount).toFixed(2));
  const difference = Number(Math.abs(totalDebit - totalCredit).toFixed(2));
  const isBalanced = difference < 0.01;

  return {
    totalDebit: Number(totalDebit.toFixed(2)),
    totalCredit: Number(totalCredit.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    roundOff,
    difference,
    isBalanced,
  };
}

export function validateVoucherDate(
  date: string,
  fiscalYear?: { startDate: string; endDate: string },
) {
  if (!date || typeof date !== "string") {
    return { valid: false, error: "Date is required" };
  }

  try {
    const parsedDate = parseISO(date);
    if (isNaN(parsedDate.getTime())) {
      return { valid: false, error: "Invalid date format" };
    }

    if (fiscalYear) {
      const startDate = parseISO(fiscalYear.startDate);
      const endDate = parseISO(fiscalYear.endDate);

      if (parsedDate < startDate) {
        return { valid: false, error: "Date is before fiscal year start" };
      }

      if (parsedDate > endDate) {
        return { valid: false, error: "Date is after fiscal year end" };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid date format" };
  }
}

export function formatVoucherDisplayDate(isoDate: string): string {
  try {
    const date = parseISO(isoDate);
    return format(date, "dd-MMM-yyyy");
  } catch (error) {
    return isoDate;
  }
}

export function getVoucherStatusColor(status: string): string {
  const colors: Record<string, string> = {
    posted: "bg-green-100 text-green-700",
    draft: "bg-yellow-100 text-yellow-700",
    cancelled: "bg-red-100 text-red-700",
    held: "bg-gray-100 text-gray-600",
    optional: "bg-blue-100 text-blue-700",
    "post-dated": "bg-purple-100 text-purple-700",
  };

  return colors[status] || "bg-gray-100 text-gray-600";
}

export function getVoucherTypeIcon(voucherType: string): string {
  const icons: Record<string, string> = {
    contra: "ArrowLeftRight",
    payment: "ArrowUpFromLine",
    receipt: "ArrowDownToLine",
    journal: "BookOpen",
    "journal-voucher": "BookOpen",
    "sales-invoice": "FileText",
    "purchase-invoice": "ShoppingCart",
    "credit-note": "FileMinus",
    "debit-note": "FilePlus",
    "stock-journal": "PackageSearch",
    "physical-stock": "ClipboardList",
    "delivery-note": "Truck",
    "receipt-note": "Package",
    "sales-order": "ClipboardCheck",
    "purchase-order": "ClipboardEdit",
    payroll: "Users",
    attendance: "Calendar",
    memorandum: "StickyNote",
    "reversing-journal": "RefreshCw",
  };

  return icons[voucherType] || "FileText";
}

export function generateVoucherSummaryLine(voucher: {
  voucherTypeName?: string;
  voucherNumber?: string;
  narration?: string;
  partyName?: string;
  totalAmount?: number;
  totalDebit?: number;
}): string {
  const parts = [];

  if (voucher.voucherTypeName) {
    parts.push(voucher.voucherTypeName);
  }

  if (voucher.voucherNumber) {
    parts.push(voucher.voucherNumber);
  }

  if (parts.length > 0 && (voucher.partyName || voucher.narration)) {
    parts.push("|");
  }

  if (voucher.partyName) {
    parts.push(voucher.partyName);
  }

  if (voucher.narration) {
    parts.push(voucher.narration);
  }

  if (voucher.totalAmount || voucher.totalDebit) {
    const amount = voucher.totalAmount || voucher.totalDebit || 0;
    parts.push(`| Rs. ${amount.toLocaleString()}`);
  }

  return parts.join(" ");
}

export const VOUCHER_TYPE_LABELS: Record<string, string> = {
  contra: "Contra",
  payment: "Payment",
  receipt: "Receipt",
  journal: "Journal",
  "journal-voucher": "Journal",
  "sales-invoice": "Sales Invoice",
  "purchase-invoice": "Purchase Invoice",
  "credit-note": "Credit Note",
  "debit-note": "Debit Note",
  "stock-journal": "Stock Journal",
  "physical-stock": "Physical Stock",
  "delivery-note": "Delivery Note",
  "receipt-note": "Receipt Note",
  "rejection-in": "Rejection In",
  "rejection-out": "Rejection Out",
  "material-in": "Material In",
  "material-out": "Material Out",
  "sales-order": "Sales Order",
  "purchase-order": "Purchase Order",
  "job-work-out-order": "Job Work Out Order",
  "job-work-in-order": "Job Work In Order",
  payroll: "Payroll",
  attendance: "Attendance",
  memorandum: "Memorandum",
  "reversing-journal": "Reversing Journal",
  production: "Production",
  unassemble: "Unassemble",
  "material-issued": "Material Issued",
  "material-received": "Material Received",
};
