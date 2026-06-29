// @ts-nocheck
import type { RecurringFrequency } from "./db";

/**
 * Compute the next due date after a given date for a given frequency.
 */
export function computeNextDueDate(fromDate: string, frequency: RecurringFrequency): string {
  const d = new Date(fromDate);
  switch (frequency) {
    case "daily":        d.setDate(d.getDate() + 1);       break;
    case "weekly":       d.setDate(d.getDate() + 7);       break;
    case "fortnightly":  d.setDate(d.getDate() + 14);      break;
    case "monthly":      d.setMonth(d.getMonth() + 1);     break;
    case "quarterly":    d.setMonth(d.getMonth() + 3);     break;
    case "half-yearly":  d.setMonth(d.getMonth() + 6);     break;
    case "yearly":       d.setFullYear(d.getFullYear()+1); break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Returns how many days until / since the due date.
 * Negative = overdue, 0 = today, positive = future.
 */
export function daysUntilDue(nextDueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/**
 * Human-readable frequency label.
 */
export function frequencyLabel(f: RecurringFrequency): string {
  const map: Record<RecurringFrequency, string> = {
    daily:        "Daily",
    weekly:       "Weekly",
    fortnightly:  "Fortnightly",
    monthly:      "Monthly",
    quarterly:    "Quarterly",
    "half-yearly":"Half-Yearly",
    yearly:       "Yearly",
  };
  return map[f] || f;
}

export const FREQUENCY_OPTIONS: RecurringFrequency[] = [
  "daily","weekly","fortnightly","monthly","quarterly","half-yearly","yearly"
];

/** Common recurring template presets */
export const TEMPLATE_PRESETS = [
  {
    name: "Monthly Rent Expense",
    voucherType: "journal",
    frequency: "monthly" as RecurringFrequency,
    description: "Post monthly office/shop rent expense",
  },
  {
    name: "Monthly Depreciation",
    voucherType: "journal",
    frequency: "monthly" as RecurringFrequency,
    description: "Auto-post depreciation for fixed assets",
  },
  {
    name: "Quarterly Insurance Premium",
    voucherType: "payment",
    frequency: "quarterly" as RecurringFrequency,
    description: "Insurance premium payment every quarter",
  },
  {
    name: "Monthly Salary Payable",
    voucherType: "journal",
    frequency: "monthly" as RecurringFrequency,
    description: "Accrue salary payable at month-end",
  },
  {
    name: "Annual Subscription Amortisation",
    voucherType: "journal",
    frequency: "monthly" as RecurringFrequency,
    description: "Amortise prepaid annual subscriptions monthly",
  },
];
