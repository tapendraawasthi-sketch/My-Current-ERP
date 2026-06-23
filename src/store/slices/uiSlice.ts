/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDB, generateId } from "@/lib/db";
import { ReportFilters, AppNotification, ReportPeriodPreset } from "@/lib/types";
import { StoreState, StoreSet, StoreGet } from "../useStore";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  accounts: "Chart of Accounts",
  parties: "Parties Directory",
  items: "Stock Book",
  "sales-invoice": "Sales Invoice",
  "purchase-invoice": "Purchase Invoice",
  "sales-return": "Sales Return",
  "purchase-return": "Purchase Return",
  receipt: "Receipt Voucher",
  payment: "Payment Voucher",
  journal: "Journal Voucher",
  contra: "Contra Voucher",
  "debit-note": "Debit Note",
  "credit-note": "Credit Note",
  "sales-order": "Sales Orders",
  "purchase-order": "Purchase Orders",
  "delivery-challan": "Delivery Challans",
  grn: "Goods Receipt Notes",
  "stock-journal": "Stock Journals",
  pos: "POS Billing",
  "day-book": "Day Book",
  "cash-book": "Cash Book",
  "bank-book": "Bank Book",
  ledger: "General Ledger",
  "party-statement": "Party Ledger Statement",
  vouchers: "Vouchers Register",
  "bank-reconciliation": "Bank Reconciliation",
  "trial-balance": "Trial Balance",
  "profit-loss": "Profit & Loss Statement",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow Statement",
  "sales-register": "Sales Register",
  "purchase-register": "Purchase Register",
  "stock-summary": "Stock Summary",
  "inventory-report": "Inventory Report",
  "aging-report": "Aging Report",
  "bill-pending": "Bill-wise Pending",
  "vat-reports": "VAT Reports",
  "tds-report": "TDS Report",
  "cost-center-report": "Cost Center Report",
  "budget-vs-actual": "Budget vs Actual",
  settings: "System Settings",
  "fiscal-year": "Fiscal Year",
  users: "Users & Roles",
  budget: "Budget Master",
  "recurring-vouchers": "Recurring Vouchers",
  "audit-log": "Audit Log",
  backup: "Backup & Restore",
  warehouses: "Warehouses",
  units: "Units of Measure",
  "cost-centers": "Cost Centers",
  "bank-accounts": "Bank Accounts",
};

export type UiSlice = {
  currentPage: string;
  editingVoucherId: string | null;
  editingInvoiceId: string | null;
  reportFilters: ReportFilters;
  notifications: AppNotification[];

  setCurrentPage: (page: string) => void;
  setEditingVoucherId: (id: string | null) => void;
  setEditingInvoiceId: (id: string | null) => void;
  setReportFilters: (filters: Partial<ReportFilters>) => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp">) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
};

export const createUiSlice = (set: StoreSet, get: StoreGet): UiSlice => ({
  currentPage: "dashboard",
  editingVoucherId: null,
  editingInvoiceId: null,
  reportFilters: {
    startDate: "",
    endDate: "",
    preset: ReportPeriodPreset.FY,
  },
  notifications: [],

  setCurrentPage: (page) => {
    set({ currentPage: page });
    if (typeof document !== "undefined") {
      const title =
        PAGE_TITLES[page] || page.charAt(0).toUpperCase() + page.slice(1).replace("-", " ");
      document.title = `${title} — Sutra ERP`;
    }
  },

  setEditingVoucherId: (id) => set({ editingVoucherId: id }),

  setEditingInvoiceId: (id) => set({ editingInvoiceId: id }),

  setReportFilters: (filters) =>
    set((prev) => ({
      reportFilters: { ...prev.reportFilters, ...filters },
    })),

  addNotification: (notif) => {
  if (typeof window === "undefined") {
    // SSR: skip DB operations
    return;
  }
  const db = getDB();
  const cleanId = generateId("notif");
  const fullNotif = {
    ...notif,
    id: cleanId,
    timestamp: new Date().toISOString(),
  };
  db.notifications.add(fullNotif);
  set((prev) => ({ notifications: [...prev.notifications, fullNotif] }));
},

  markNotificationRead: (id) => {
    if (typeof window === "undefined") {
    // SSR: no operation
    return;
  }
  const db = getDB();
  db.notifications.update(id, { read: true });
  set((prev) => ({
    notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
  }));
  },

  clearNotifications: () => {
  if (typeof window === "undefined") {
    // SSR: no operation
    return;
  }
  const db = getDB();
  db.notifications.clear();
  set({ notifications: [] });
},
});
