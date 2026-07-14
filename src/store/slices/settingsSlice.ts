import {
  StoreUser,
  CompanySettings,
  Notification,
  FiscalYear,
  DEFAULT_CURRENCY,
  DEFAULT_TDS_RATES,
  hashPassword,
  verifyPassword,
} from "../store.types";
import { StateCreator } from "zustand";
import type { AppState } from "../store.types";
import { getDB, generateId } from "../../lib/db";
import { generateNextNumber } from "../../lib/accounting";
import { startCbmsQueueWorker } from "../../lib/cbmsService";
import { validateVoucherBalance, assertDateInFiscalYear } from "../store.types";
import toast from "@/lib/appToast";
import { migrateWorkflowFields } from "../../lib/workflowMigration";
import { createWorkflowActions } from "../workflowActions";

export const createSettingsSlice: StateCreator<AppState, [], [], any> = (set, get) => ({
  // ── Employees ─────────────────────────────────────────────────────────────
  addEmployee: async (data) => {
    const db = getDB();
    const record = {
      ...data,
      id: data.id || `emp-${generateId()}`,
      status: data.status || "active",
      ssf: data.ssf ?? false,
      basicSalary: data.basicSalary || 0,
      allowances: data.allowances || { houseRent: 0, transport: 0, medical: 0, dashain: 0 },
    };
    await db.employees.add(record as any);
    set((s) => ({ employees: [...s.employees, record] }));
    return record;
  },
  updateEmployee: async (id, data) => {
    const db = getDB();
    await db.employees.update(id, data);
    set((s) => ({ employees: s.employees.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteEmployee: async (id) => {
    const db = getDB();
    await db.employees.delete(id);
    set((s) => ({ employees: s.employees.filter((r) => r.id !== id) }));
  },

  // ── Company ───────────────────────────────────────────────────────────────
  updateCompanySettings: async (settings) => {
    const db = getDB();
    const existing = await db.companySettings.get("main");
    const updated = { ...(existing || {}), ...settings, id: "main" };
    await db.companySettings.put(updated as any);
    set({ companySettings: updated as CompanySettings });
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  addUser: async (user) => {
    const db = getDB();
    const id = user.id || generateId();
    const hash = await hashPassword((user as any).password || "changeme");
    const newUser = { ...user, id, passwordHash: hash, isActive: true };
    await db.users.add(newUser as any);
    set((s) => ({ users: [...s.users, newUser as StoreUser] }));
    return newUser;
  },

  updateUser: async (id, updates) => {
    const db = getDB();
    if ((updates as any).password) {
      (updates as any).passwordHash = await hashPassword((updates as any).password);
      delete (updates as any).password;
    }
    await db.users.update(id, updates);
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    }));
  },

  deleteUser: async (id) => {
    const db = getDB();
    await db.users.delete(id);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
  },

  checkPermission: (permission) => {
    const { currentUser } = get();
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    const perms: string[] = (currentUser as any).permissions || [];
    return perms.includes(permission);
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  markNotificationRead: (id) => {
    const db = getDB();
    db.notifications.update(id, { read: true }).catch(() => {});
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  clearNotifications: () => {
    const db = getDB();
    db.notifications.clear().catch(() => {});
    set({ notifications: [] });
  },

  addNotification: (message, type = "info") => {
    const db = getDB();
    const id = generateId();
    const notification: Notification = {
      id,
      message,
      read: false,
      timestamp: new Date().toISOString(),
      type,
    };
    db.notifications.add(notification as any).catch(() => {});
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 50),
    }));
  },

  setCurrentFiscalYear: (fy) => set({ currentFiscalYear: fy }),

  resetAllData: async () => {
    const db = getDB();
    await Promise.all([
      db.accounts.clear(),
      db.parties.clear(),
      db.items.clear(),
      db.vouchers.clear(),
      db.invoices.clear(),
      db.stockMovements.clear(),
      db.warehouses.clear(),
      db.units.clear(),
      db.costCenters.clear(),
      db.fiscalYears.clear(),
      db.deliveryChallans.clear(),
      db.goodsReceiptNotes.clear(),
      db.salesOrders.clear(),
      db.purchaseOrders.clear(),
      db.notifications.clear(),
      db.budgets.clear(),
      db.recurringVouchers.clear(),
      db.companySettings.clear(),
    ]);
    set({
      accounts: [],
      parties: [],
      items: [],
      vouchers: [],
      invoices: [],
      stockMovements: [],
      warehouses: [],
      stockTransfers: [],
      units: [],
      costCenters: [],
      fiscalYears: [],
      currentFiscalYear: null,
      deliveryChallans: [],
      goodsReceiptNotes: [],
      salesOrders: [],
      purchaseOrders: [],
      notifications: [],
      budgets: [],
      recurringVouchers: [],
      companySettings: null,
      isDbReady: false,
    });
    await get().initializeApp();
  },
});
