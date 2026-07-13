/**
 * Settlement E2E seed helpers (Phase 9) — development only.
 */

import { getDB, generateId, type DBInvoice } from "@/lib/db";
import { E2E_COMPANY_ID, E2E_COMPANY_NAME } from "@/domains/purchase/postPurchaseTransaction";
import {
  E2E_FY_ID,
  E2E_USER_AUTHORIZED,
  E2E_USER_RESTRICTED,
  seedOrbixE2ECompany,
} from "@/domains/purchase/e2eSeed";

export { E2E_COMPANY_ID, E2E_COMPANY_NAME, E2E_FY_ID, E2E_USER_AUTHORIZED, E2E_USER_RESTRICTED };

export const E2E_CUSTOMER_ID = "party-e2e-customer";
export const E2E_CUSTOMER_NAME = "Ram Traders";
export const E2E_SUPPLIER_ID = "party-e2e-supplier";
export const E2E_SUPPLIER_NAME = "ABC Suppliers";

const SETTLEMENT_ACCOUNTS = [
  { id: "acc-sundry-debtors", code: "1201", name: "Sundry Debtors", type: "asset", balance: 0 },
  { id: "acc-customer-advance", code: "2201", name: "Customer Advances", type: "liability", balance: 0 },
  { id: "acc-supplier-advance", code: "1301", name: "Supplier Advances", type: "asset", balance: 0 },
  { id: "acc-bank-a", code: "1403", name: "Bank A", type: "asset", balance: 0 },
  { id: "acc-bank-b", code: "1404", name: "Bank B", type: "asset", balance: 0 },
  { id: "acc-bank-charges", code: "5201", name: "Bank Charges", type: "expense", balance: 0 },
  { id: "acc-tds-receivable", code: "1501", name: "TDS Receivable", type: "asset", balance: 0 },
  { id: "acc-tds-payable", code: "2301", name: "TDS Payable", type: "liability", balance: 0 },
  { id: "acc-settlement-discount", code: "5301", name: "Settlement Discount", type: "expense", balance: 0 },
  { id: "acc-writeoff", code: "5401", name: "Bad Debts / Write-off", type: "expense", balance: 0 },
  { id: "acc-rent-expense", code: "5501", name: "Rent Expense", type: "expense", balance: 0 },
  { id: "acc-outstanding-expense", code: "2401", name: "Outstanding Expenses", type: "liability", balance: 0 },
];

export async function seedSettlementE2ECompany(): Promise<{
  companyId: string;
  customerId: string;
  supplierId: string;
  authorizedUserId: string;
}> {
  await seedOrbixE2ECompany();
  const db = getDB();
  const now = new Date().toISOString();

  for (const acc of SETTLEMENT_ACCOUNTS) {
    const found = await db.accounts.get(acc.id);
    if (!found) {
      await db.accounts.add({
        ...acc,
        level: 1,
        isGroup: false,
        isActive: true,
        createdAt: now,
      } as any);
    }
  }

  const ensureParty = async (
    id: string,
    name: string,
    type: "customer" | "supplier",
  ) => {
    const existing = await db.parties.get(id);
    if (existing) {
      await db.parties.update(id, { name, type, isActive: true });
      return;
    }
    await db.parties.add({
      id,
      code: id,
      name,
      type,
      isActive: true,
      createdAt: now,
    } as any);
  };

  await ensureParty(E2E_CUSTOMER_ID, E2E_CUSTOMER_NAME, "customer");
  await ensureParty(E2E_SUPPLIER_ID, E2E_SUPPLIER_NAME, "supplier");

  return {
    companyId: E2E_COMPANY_ID,
    customerId: E2E_CUSTOMER_ID,
    supplierId: E2E_SUPPLIER_ID,
    authorizedUserId: E2E_USER_AUTHORIZED,
  };
}

export async function seedE2ESalesInvoice(opts?: {
  id?: string;
  invoiceNo?: string;
  grandTotal?: number;
  partyId?: string;
  partyName?: string;
  date?: string;
}): Promise<DBInvoice> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = opts?.id || generateId();
  const grandTotal = opts?.grandTotal ?? 11300;
  const invoice: DBInvoice = {
    id,
    invoiceNo: opts?.invoiceNo || `E2E-SI-${id.slice(0, 6)}`,
    date: opts?.date || now.slice(0, 10),
    type: "sales-invoice",
    status: "posted",
    partyId: opts?.partyId || E2E_CUSTOMER_ID,
    partyName: opts?.partyName || E2E_CUSTOMER_NAME,
    paymentMode: "credit",
    paymentStatus: "unpaid",
    paidAmount: 0,
    subTotal: Math.round((grandTotal / 1.13) * 100) / 100,
    taxableAmount: Math.round((grandTotal / 1.13) * 100) / 100,
    exemptAmount: 0,
    vatAmount: Math.round((grandTotal - grandTotal / 1.13) * 100) / 100,
    vatApplicable: true,
    discountAmount: 0,
    grandTotal,
    total: grandTotal,
    currencyCode: "NPR",
    narration: "E2E settlement sales invoice",
    createdBy: E2E_USER_AUTHORIZED,
    companyId: E2E_COMPANY_ID,
    lines: [
      {
        id: `line-${id}-0`,
        itemId: "item-e2e-settlement",
        itemName: "E2E Settlement Item",
        qty: 1,
        unit: "pcs",
        rate: Math.round((grandTotal / 1.13) * 100) / 100,
        netAmount: Math.round((grandTotal / 1.13) * 100) / 100,
        totalAmount: grandTotal,
        lineTotal: grandTotal,
        isTaxable: true,
        taxableAmount: Math.round((grandTotal / 1.13) * 100) / 100,
        vatAmount: Math.round((grandTotal - grandTotal / 1.13) * 100) / 100,
      },
    ],
  } as DBInvoice;

  await db.invoices.put(invoice as any);
  return invoice;
}

export async function seedE2EPurchaseInvoice(opts?: {
  id?: string;
  invoiceNo?: string;
  grandTotal?: number;
  partyId?: string;
  partyName?: string;
  date?: string;
}): Promise<DBInvoice> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = opts?.id || generateId();
  const grandTotal = opts?.grandTotal ?? 11300;
  const invoice: DBInvoice = {
    id,
    invoiceNo: opts?.invoiceNo || `E2E-PI-${id.slice(0, 6)}`,
    date: opts?.date || now.slice(0, 10),
    type: "purchase-invoice",
    status: "posted",
    partyId: opts?.partyId || E2E_SUPPLIER_ID,
    partyName: opts?.partyName || E2E_SUPPLIER_NAME,
    paymentMode: "credit",
    paymentStatus: "unpaid",
    paidAmount: 0,
    subTotal: Math.round((grandTotal / 1.13) * 100) / 100,
    taxableAmount: Math.round((grandTotal / 1.13) * 100) / 100,
    exemptAmount: 0,
    vatAmount: Math.round((grandTotal - grandTotal / 1.13) * 100) / 100,
    vatApplicable: true,
    discountAmount: 0,
    grandTotal,
    total: grandTotal,
    currencyCode: "NPR",
    narration: "E2E settlement purchase invoice",
    createdBy: E2E_USER_AUTHORIZED,
    companyId: E2E_COMPANY_ID,
    lines: [
      {
        id: `line-${id}-0`,
        itemId: "item-e2e-settlement",
        itemName: "E2E Settlement Item",
        qty: 1,
        unit: "pcs",
        rate: Math.round((grandTotal / 1.13) * 100) / 100,
        netAmount: Math.round((grandTotal / 1.13) * 100) / 100,
        totalAmount: grandTotal,
        lineTotal: grandTotal,
        isTaxable: true,
        taxableAmount: Math.round((grandTotal / 1.13) * 100) / 100,
        vatAmount: Math.round((grandTotal - grandTotal / 1.13) * 100) / 100,
      },
    ],
  } as DBInvoice;

  await db.invoices.put(invoice as any);
  return invoice;
}