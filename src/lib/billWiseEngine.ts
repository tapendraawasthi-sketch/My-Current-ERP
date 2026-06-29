/**
 * src/lib/billWiseEngine.ts
 *
 * Pure, side-effect-free bill-wise outstanding engine for Nepal ERP.
 * Mirrors Tally Prime's bill-wise tracking with against-ref allocations.
 *
 * All date arithmetic uses JavaScript Date objects (AD) for correctness.
 * BS dates are formatted at the UI layer using nepaliDate utilities.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgingBucket =
  | "not-due"
  | "0-30"
  | "31-60"
  | "61-90"
  | "91-180"
  | "181-365"
  | "above-365";

export interface BillAllocation {
  billRefNo: string;
  billRefType: "new-ref" | "against-ref" | "advance" | "on-account";
  amount: number;
  dueDate?: string; // ISO date string (AD)
}

/**
 * Minimal shape we need from an invoice/voucher record.
 * Map your Dexie records to this before calling computeBillWiseOutstanding.
 */
export interface VoucherRecord {
  id: string;
  type: string; // VoucherType enum value
  partyId: string;
  date: string; // ISO date string (AD)
  totalAmount?: number;
  billAllocations?: BillAllocation[];
}

/** A resolved bill with full outstanding information. */
export interface BillRecord {
  billNo: string;
  voucherId: string;
  voucherType: string;
  partyId: string;
  invoiceDate: Date;
  dueDate: Date | null;
  originalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  daysOverdue: number;
  agingBucket: AgingBucket;
  /** Credits (advance / on-account) that remain unallocated, keyed by their source ref */
  isAdvanceCredit?: boolean;
}

/** Party-level summary aggregating all bills */
export interface PartySummary {
  partyId: string;
  totalBills: number;
  totalOutstanding: number;
  oldestBillDate: Date | null;
  overdueAmount: number;
  agingBreakdown: Record<AgingBucket, number>;
  bills: BillRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Invoice voucher types that create receivable bills */
const SALES_TYPES = new Set(["sales_invoice", "SALES_INVOICE", "sales-invoice"]);

/** Invoice voucher types that create payable bills */
const PURCHASE_TYPES = new Set(["purchase_invoice", "PURCHASE_INVOICE", "purchase-invoice"]);

/** Payment voucher types that reduce outstanding (from customer = receipt; to supplier = payment) */
const RECEIPT_TYPES = new Set(["receipt", "RECEIPT", "receipt_voucher", "RECEIPT_VOUCHER"]);

const PAYMENT_TYPES = new Set(["payment", "PAYMENT", "payment_voucher", "PAYMENT_VOUCHER"]);

export const AGING_BUCKETS: AgingBucket[] = [
  "not-due",
  "0-30",
  "31-60",
  "61-90",
  "91-180",
  "181-365",
  "above-365",
];

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  "not-due": "Not Due",
  "0-30": "0–30 Days",
  "31-60": "31–60 Days",
  "61-90": "61–90 Days",
  "91-180": "91–180 Days",
  "181-365": "181–365 Days",
  "above-365": "Above 365 Days",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(isoStr: string | undefined | null): Date {
  if (!isoStr) return new Date(0);
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

export function getAgingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "not-due";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  if (daysOverdue <= 180) return "91-180";
  if (daysOverdue <= 365) return "181-365";
  return "above-365";
}

export function emptyAgingBreakdown(): Record<AgingBucket, number> {
  return {
    "not-due": 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "91-180": 0,
    "181-365": 0,
    "above-365": 0,
  };
}

// ─── Core Engine ──────────────────────────────────────────────────────────────

/**
 * computeBillWiseOutstanding
 *
 * @param partyId       Filter to a single party, or pass "" / null to compute all parties.
 * @param allInvoices   All invoice-type vouchers from Dexie (sales + purchase).
 * @param allVouchers   All receipt/payment vouchers from Dexie.
 * @param asAtDate      Compute outstanding AS AT this date (defaults to today).
 * @param direction     "receivable" (sales) | "payable" (purchase) | "both"
 *
 * Returns a flat array of BillRecord. The caller can then group by partyId.
 */
export function computeBillWiseOutstanding(
  partyId: string | null,
  allInvoices: VoucherRecord[],
  allVouchers: VoucherRecord[],
  asAtDate: Date = new Date(),
  direction: "receivable" | "payable" | "both" = "receivable",
): BillRecord[] {
  // ── Step 1: Determine which invoice types are relevant ──────────────────────
  const relevantInvoiceTypes =
    direction === "receivable"
      ? SALES_TYPES
      : direction === "payable"
        ? PURCHASE_TYPES
        : new Set([...SALES_TYPES, ...PURCHASE_TYPES]);

  const relevantPaymentTypes =
    direction === "receivable"
      ? RECEIPT_TYPES
      : direction === "payable"
        ? PAYMENT_TYPES
        : new Set([...RECEIPT_TYPES, ...PAYMENT_TYPES]);

  // ── Step 2: Filter records by party and date ────────────────────────────────
  const filterParty = (v: VoucherRecord) => !partyId || v.partyId === partyId;

  const filterDate = (v: VoucherRecord) => toDate(v.date).getTime() <= asAtDate.getTime();

  const invoices = allInvoices.filter(
    (v) => relevantInvoiceTypes.has(v.type) && filterParty(v) && filterDate(v),
  );

  const paymentVouchers = allVouchers.filter(
    (v) => relevantPaymentTypes.has(v.type) && filterParty(v) && filterDate(v),
  );

  // ── Step 3: Build bill ledger from "new-ref" allocations in invoices ─────────
  // Map: billRefNo → mutable bill object
  const billLedger = new Map<
    string,
    {
      billNo: string;
      voucherId: string;
      voucherType: string;
      partyId: string;
      invoiceDate: Date;
      dueDate: Date | null;
      originalAmount: number;
      paidAmount: number;
    }
  >();

  for (const inv of invoices) {
    const allocations = inv.billAllocations ?? [];
    for (const alloc of allocations) {
      if (alloc.billRefType !== "new-ref") continue;
      if (alloc.amount <= 0) continue;

      const existing = billLedger.get(alloc.billRefNo);
      if (existing) {
        // Should not happen in clean data, but handle gracefully
        existing.originalAmount += alloc.amount;
      } else {
        billLedger.set(alloc.billRefNo, {
          billNo: alloc.billRefNo,
          voucherId: inv.id,
          voucherType: inv.type,
          partyId: inv.partyId,
          invoiceDate: toDate(inv.date),
          dueDate: alloc.dueDate ? toDate(alloc.dueDate) : null,
          originalAmount: alloc.amount,
          paidAmount: 0,
        });
      }
    }

    // Fallback: if invoice has no billAllocations at all, treat the whole
    // invoice amount as a single "new-ref" bill using the invoice number.
    if (allocations.length === 0 && inv.totalAmount && inv.totalAmount > 0) {
      const fallbackRef = inv.id;
      if (!billLedger.has(fallbackRef)) {
        billLedger.set(fallbackRef, {
          billNo: fallbackRef,
          voucherId: inv.id,
          voucherType: inv.type,
          partyId: inv.partyId,
          invoiceDate: toDate(inv.date),
          dueDate: null,
          originalAmount: inv.totalAmount,
          paidAmount: 0,
        });
      }
    }
  }

  // ── Step 4: Pool of unallocated advance / on-account credits ───────────────
  // Map: partyId → total credit available
  const advancePool = new Map<string, number>();
  const advanceBillRecords: BillRecord[] = [];

  // ── Step 5: Apply receipts/payments to bills ────────────────────────────────
  for (const pv of paymentVouchers) {
    const allocations = pv.billAllocations ?? [];

    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;

      if (alloc.billRefType === "against-ref") {
        // Reduce the referenced bill
        const bill = billLedger.get(alloc.billRefNo);
        if (bill) {
          bill.paidAmount = Math.min(bill.paidAmount + alloc.amount, bill.originalAmount);
        }
        // If the bill isn't found (race/data issue), the amount is silently ignored.
      } else if (alloc.billRefType === "advance" || alloc.billRefType === "on-account") {
        // Accumulate into the party's credit pool
        const pid = pv.partyId;
        advancePool.set(pid, (advancePool.get(pid) ?? 0) + alloc.amount);

        // Create a visible "advance credit" record for display purposes
        advanceBillRecords.push({
          billNo: alloc.billRefNo || `ADV-${pv.id}`,
          voucherId: pv.id,
          voucherType: pv.type,
          partyId: pv.partyId,
          invoiceDate: toDate(pv.date),
          dueDate: null,
          originalAmount: 0,
          paidAmount: 0,
          balanceAmount: -alloc.amount, // negative = credit
          daysOverdue: 0,
          agingBucket: "not-due",
          isAdvanceCredit: true,
        });
      }
    }

    // Fallback: receipt with no bill allocations → treat as on-account
    if (allocations.length === 0 && pv.totalAmount && pv.totalAmount > 0) {
      const pid = pv.partyId;
      advancePool.set(pid, (advancePool.get(pid) ?? 0) + pv.totalAmount);
    }
  }

  // ── Step 6: Apply advance pool to oldest bills (FIFO auto-allocation) ──────
  // Group bills by party and sort oldest first
  const billsByParty = new Map<
    string,
    typeof billLedger extends Map<any, infer V> ? V[] : never[]
  >();

  for (const bill of billLedger.values()) {
    const arr = billsByParty.get(bill.partyId) ?? [];
    arr.push(bill);
    billsByParty.set(bill.partyId, arr);
  }

  for (const [pid, bills] of billsByParty) {
    let credit = advancePool.get(pid) ?? 0;
    if (credit <= 0) continue;

    // Sort by invoice date ascending (oldest first = FIFO)
    bills.sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime());

    for (const bill of bills) {
      if (credit <= 0) break;
      const balance = bill.originalAmount - bill.paidAmount;
      if (balance <= 0) continue;
      const apply = Math.min(credit, balance);
      bill.paidAmount += apply;
      credit -= apply;
    }

    advancePool.set(pid, credit); // remaining unallocated credit
  }

  // ── Step 7: Build final BillRecord array ───────────────────────────────────
  const results: BillRecord[] = [];

  for (const bill of billLedger.values()) {
    const balance = Math.max(0, bill.originalAmount - bill.paidAmount);
    if (balance < 0.005) continue; // fully paid, skip (handle float noise)

    const effectiveDueDate = bill.dueDate;
    const daysOverdue = effectiveDueDate ? daysBetween(effectiveDueDate, asAtDate) : 0;
    const agingBucket = getAgingBucket(daysOverdue);

    results.push({
      ...bill,
      balanceAmount: balance,
      daysOverdue: Math.max(0, daysOverdue),
      agingBucket,
    });
  }

  // Include advance credits (as negative-balance rows)
  results.push(...advanceBillRecords);

  // Sort: oldest overdue first, then by amount descending
  results.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.balanceAmount - a.balanceAmount;
  });

  return results;
}

// ─── Party-wise Summary ───────────────────────────────────────────────────────

/** Aggregate bill records into a per-party summary. */
export function buildPartySummaries(
  bills: BillRecord[],
  partiesMap: Map<string, { name: string; creditDays?: number }>,
): PartySummary[] {
  const summaryMap = new Map<string, PartySummary>();

  for (const bill of bills) {
    if (bill.isAdvanceCredit) continue; // exclude credit rows from summary totals

    let s = summaryMap.get(bill.partyId);
    if (!s) {
      s = {
        partyId: bill.partyId,
        totalBills: 0,
        totalOutstanding: 0,
        oldestBillDate: null,
        overdueAmount: 0,
        agingBreakdown: emptyAgingBreakdown(),
        bills: [],
      };
      summaryMap.set(bill.partyId, s);
    }

    s.totalBills += 1;
    s.totalOutstanding += bill.balanceAmount;
    s.agingBreakdown[bill.agingBucket] += bill.balanceAmount;
    s.bills.push(bill);

    if (bill.agingBucket !== "not-due") {
      s.overdueAmount += bill.balanceAmount;
    }

    if (s.oldestBillDate === null || bill.invoiceDate.getTime() < s.oldestBillDate.getTime()) {
      s.oldestBillDate = bill.invoiceDate;
    }
  }

  return Array.from(summaryMap.values()).sort((a, b) => b.overdueAmount - a.overdueAmount);
}

// ─── Interest Calculation ─────────────────────────────────────────────────────

export interface InterestRecord {
  bill: BillRecord;
  annualRate: number; // %
  daysOverdue: number;
  interestAmount: number;
  totalDue: number;
}

/**
 * Compute simple interest on overdue bills.
 * @param bills         Array of BillRecord (already filtered as needed).
 * @param defaultRate   Annual interest rate in % (e.g. 18 for 18%).
 * @param partyRates    Optional per-party rate overrides: Map<partyId, rate%>
 * @param compound      If true, uses compound interest (monthly compounding).
 */
export function computeInterestOnOverdue(
  bills: BillRecord[],
  defaultRate: number,
  partyRates: Map<string, number> = new Map(),
  compound = false,
): InterestRecord[] {
  return bills
    .filter((b) => b.daysOverdue > 0 && b.balanceAmount > 0)
    .map((bill) => {
      const rate = partyRates.get(bill.partyId) ?? defaultRate;
      const years = bill.daysOverdue / 365;
      let interest: number;

      if (compound) {
        // Monthly compounding: A = P(1 + r/12)^(months) - P
        const months = bill.daysOverdue / 30.4375;
        interest = bill.balanceAmount * (Math.pow(1 + rate / 100 / 12, months) - 1);
      } else {
        // Simple interest: I = P × R × T
        interest = bill.balanceAmount * (rate / 100) * years;
      }

      return {
        bill,
        annualRate: rate,
        daysOverdue: bill.daysOverdue,
        interestAmount: Math.round(interest * 100) / 100,
        totalDue: Math.round((bill.balanceAmount + interest) * 100) / 100,
      };
    });
}

// ─── FIFO Allocation Helper (for receipt UI) ──────────────────────────────────

export interface AllocationSuggestion {
  billNo: string;
  billRecord: BillRecord;
  suggestedAllocation: number;
}

/**
 * Given an amount received, suggest FIFO allocations across outstanding bills.
 * Returns allocation suggestions; remaining goes as advance.
 */
export function suggestFIFOAllocation(
  amountReceived: number,
  outstandingBills: BillRecord[],
): {
  allocations: AllocationSuggestion[];
  unallocated: number;
} {
  const sorted = [...outstandingBills]
    .filter((b) => b.balanceAmount > 0 && !b.isAdvanceCredit)
    .sort((a, b) => {
      // Sort by overdue days descending (oldest bill first)
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return a.invoiceDate.getTime() - b.invoiceDate.getTime();
    });

  let remaining = amountReceived;
  const allocations: AllocationSuggestion[] = [];

  for (const bill of sorted) {
    if (remaining <= 0) break;
    const alloc = Math.min(remaining, bill.balanceAmount);
    allocations.push({
      billNo: bill.billNo,
      billRecord: bill,
      suggestedAllocation: alloc,
    });
    remaining -= alloc;
  }

  return { allocations, unallocated: Math.max(0, remaining) };
}

// ─── Aging Report Aggregator ──────────────────────────────────────────────────

export interface AgingReportRow {
  partyId: string;
  partyName: string;
  buckets: Record<AgingBucket, number>;
  total: number;
}

export interface AgingReportSummary {
  rows: AgingReportRow[];
  totals: Record<AgingBucket, number>;
  grandTotal: number;
}

export function buildAgingReport(
  bills: BillRecord[],
  partiesMap: Map<string, { name: string }>,
): AgingReportSummary {
  const rowMap = new Map<string, AgingReportRow>();

  for (const bill of bills) {
    if (bill.isAdvanceCredit || bill.balanceAmount <= 0) continue;

    let row = rowMap.get(bill.partyId);
    if (!row) {
      row = {
        partyId: bill.partyId,
        partyName: partiesMap.get(bill.partyId)?.name ?? bill.partyId,
        buckets: emptyAgingBreakdown(),
        total: 0,
      };
      rowMap.set(bill.partyId, row);
    }
    row.buckets[bill.agingBucket] += bill.balanceAmount;
    row.total += bill.balanceAmount;
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => b.total - a.total);

  const totals = emptyAgingBreakdown();
  let grandTotal = 0;
  for (const row of rows) {
    for (const b of AGING_BUCKETS) {
      totals[b] += row.buckets[b];
    }
    grandTotal += row.total;
  }

  return { rows, totals, grandTotal };
}
