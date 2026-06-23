/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import toast from "react-hot-toast";
import { getDB, generateId } from "../../lib/db";
import {
  User,
  CompanySettings,
  UserRole,
  VoucherStatus,
  VoucherType,
  ReportPeriodPreset,
} from "../../lib/types";
import { sha256Fallback } from "../../lib/utils";
import { recalculateAccountBalances } from "../../lib/accounting";
import { StoreState, StoreSet, StoreGet } from "../useStore";

export type AuthSlice = {
  users: User[];
  currentUser: User | null;
  isAuthenticated: boolean;
  isDbReady: boolean;
  loginAttempts: number;
  lockedUntil: string | null;

  initializeApp: () => Promise<void>;
  login: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
  createCompanyAndAdmin: (data: {
    company: Partial<CompanySettings>;
    adminUser: Omit<User, "id">;
  }) => Promise<boolean>;
  addUser: (user: Omit<User, "id">) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  changePassword: (userId: string, newPassword: string) => Promise<void>;
};

export const createAuthSlice = (set: StoreSet, get: StoreGet): AuthSlice => ({
  users: [],
  currentUser: null,
  isAuthenticated: false,
  isDbReady: false,
  loginAttempts: 0,
  lockedUntil: null,

  initializeApp: async () => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      console.warn("[SSR] initializeApp() skipped: not a browser environment.");
      return;
    }
    try {
      const db = getDB();
      if (!db.isOpen()) {
        await db.open();
      }

      const userCount = await db.users.count();
      if (userCount === 0) {
        const { initializeDB } = await import("../../lib/db");
        await initializeDB();
      }

      const [
        accountsRaw,
        vouchers,
        invoices,
        parties,
        items,
        warehouses,
        units,
        stockMovements,
        salesOrders,
        purchaseOrders,
        deliveryChallans,
        goodsReceiptNotes,
        costCenters,
        tdsEntries,
        bankAccounts,
        bankStatements,
        auditLogs,
        companySettingsArr,
        fiscalYears,
        users,
        notifications,
        stockJournals,
        billAllocations,
        currencies,
        exchangeRates,
        recurringVouchers,
        employees,
        payrollRuns,
        customFieldDefs,
      ] = await Promise.all([
        db.accounts.toArray(),
        db.vouchers.toArray(),
        db.invoices.toArray(),
        db.parties.toArray(),
        db.items.toArray(),
        db.warehouses.toArray(),
        db.units.toArray(),
        db.stockMovements.toArray(),
        db.salesOrders.toArray(),
        db.purchaseOrders.toArray(),
        db.deliveryChallans.toArray(),
        db.goodsReceiptNotes.toArray(),
        db.costCenters.toArray(),
        db.tdsEntries.toArray(),
        db.bankAccounts.toArray(),
        db.bankStatements.toArray(),
        db.auditLogs.toArray(),
        db.companySettings.toArray(),
        db.fiscalYears.toArray(),
        db.users.toArray(),
        db.notifications.toArray(),
        db.stockJournals.toArray(),
        db.billAllocations.toArray(),
        db.currencies.toArray(),
        db.exchangeRates.toArray(),
        db.recurringVouchers.toArray(),
        db.employees.toArray(),
        db.payrollRuns.toArray(),
        db.customFieldDefs.toArray(),
      ]);

      const companySettings = companySettingsArr[0] || get().companySettings;
      const currentFiscalYear = fiscalYears.find((fy) => fy.isCurrent) || null;

      const accounts = recalculateAccountBalances(accountsRaw, vouchers);

      set({
        accounts,
        vouchers,
        invoices,
        parties,
        items,
        warehouses,
        units,
        stockMovements,
        salesOrders,
        purchaseOrders,
        deliveryChallans,
        goodsReceiptNotes,
        costCenters,
        tdsEntries,
        bankAccounts,
        bankStatements,
        auditLogs,
        companySettings,
        fiscalYears,
        currentFiscalYear,
        users,
        notifications,
        stockJournals,
        billAllocations,
        currencies,
        exchangeRates,
        recurringVouchers,
        employees,
        payrollRuns,
        customFieldDefs,
        isDbReady: true,
      });

      const activeFY = fiscalYears.find((fy) => fy.isCurrent) || null;
      if (activeFY) {
        set({
          reportFilters: {
            startDate: activeFY.startDate,
            endDate: activeFY.endDate,
            preset: ReportPeriodPreset.FY,
          },
        });
      }

      if (accounts.length === 0 && currentFiscalYear) {
        const { seedNepalChartOfAccounts } = await import("../../lib/accounting");
        await seedNepalChartOfAccounts(get().addAccount, accounts, () => {
          const state = get();
          set({ accounts: recalculateAccountBalances(state.accounts, state.vouchers) });
        });
      }

      // Auto-process due recurring vouchers
      const today = new Date().toISOString().split("T")[0];
      const loadedRecurring = recurringVouchers;
      const dueVouchers = loadedRecurring.filter(
        (rv) =>
          rv.isActive &&
          rv.nextDueDate <= today &&
          (!rv.endDate || rv.nextDueDate <= rv.endDate) &&
          (!rv.totalOccurrences || (rv.completedOccurrences || 0) < rv.totalOccurrences),
      );

      const autoPostDue = dueVouchers.filter((rv) => rv.autoPost);
      const manualDue = dueVouchers.filter((rv) => !rv.autoPost);

      // Notify about manual-review ones
      if (manualDue.length > 0) {
        const notifId = generateId("notif");
        await db.notifications.add({
          id: notifId,
          type: "warning",
          message: `${manualDue.length} recurring voucher(s) need manual processing`,
          read: false,
          timestamp: new Date().toISOString(),
          link: "recurring-vouchers",
        });
      }

      // Auto-post the ones with autoPost: true
      for (const rv of autoPostDue) {
        try {
          await get().runRecurringVoucher(rv.id);
        } catch (e) {
          console.error("Auto-post recurring voucher failed:", rv.id, e);
        }
      }

      console.log("Sutra ERP Store State successfully synchronized with IndexedDB local storage.");
    } catch (error) {
      console.error("Fatal: Failed to initialize ERP Store:", error);
      toast.error("Fatal initialization database error.");
    }
  },

  login: async (username, password) => {
    const state = get();

    if (state.lockedUntil && new Date(state.lockedUntil) > new Date()) {
      const waitMins = Math.ceil((new Date(state.lockedUntil).getTime() - Date.now()) / 60000);
      toast.error(`Security Lock: Locked out. Try again in ${waitMins} minute(s).`);
      return false;
    }

    try {
      const db = getDB();
      const cleanUsername = username.trim().toLowerCase();
      const matchedUser = await db.users.where("username").equals(cleanUsername).first();

      if (!matchedUser || !matchedUser.isActive) {
        toast.error("Invalid username or account is deactivated.");
        return false;
      }

      let passwordMatch = false;
      if (password) {
        const hashedInput = await sha256Fallback(password);
        passwordMatch = matchedUser.password === hashedInput || matchedUser.password === password;
      }

      if (!passwordMatch) {
        const attempts = state.loginAttempts + 1;
        if (attempts >= 5) {
          const lockedUntilStr = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          set({ loginAttempts: attempts, lockedUntil: lockedUntilStr });
          toast.error("Too many failed attempts. Account locked out for 15 minutes.");
        } else {
          set({ loginAttempts: attempts });
          toast.error(`Invalid password. Attempt ${attempts} of 5.`);
        }
        return false;
      }

      const lastLoginStr = new Date().toISOString();
      await db.users.update(matchedUser.id, { lastLogin: lastLoginStr });

      set((prev) => ({
        currentUser: { ...matchedUser, lastLogin: lastLoginStr },
        isAuthenticated: true,
        loginAttempts: 0,
        lockedUntil: null,
        users: prev.users.map((u) =>
          u.id === matchedUser.id ? { ...u, lastLogin: lastLoginStr } : u,
        ),
      }));

      await db.auditLogs.add({
        id: generateId("audit"),
        timestamp: lastLoginStr,
        userId: matchedUser.id,
        userName: matchedUser.name,
        action: "login",
        module: "auth",
        recordId: matchedUser.id,
        recordType: "user",
      });

      toast.success(`Access Granted: Welcome ${matchedUser.name}.`);
      return true;
    } catch (error) {
      console.error("Error authenticating user:", error);
      toast.error("Failed to log in securely.");
      return false;
    }
  },

  logout: () => {
    set({
      currentUser: null,
      isAuthenticated: false,
    });
    toast.success("Logged out from Sutra ERP.");
  },

  createCompanyAndAdmin: async (payload) => {
    try {
      const db = getDB();
      const companyId = generateId("company");
      const finalCompany: CompanySettings & { id: string } = {
        ...payload.company,
        id: companyId,
      } as any;

      const adminId = generateId("usr");
      const hashedPass = await sha256Fallback(payload.adminUser.password || "admin123");
      const finalAdmin: User & { id: string } = {
        ...payload.adminUser,
        id: adminId,
        password: hashedPass,
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      await db.transaction("rw", [db.companySettings, db.users], async () => {
        await db.companySettings.clear();
        await db.companySettings.add(finalCompany);
        await db.users.add(finalAdmin);
      });

      await get().initializeApp();

      set({
        currentUser: finalAdmin,
        isAuthenticated: true,
      });

      toast.success("Sutra ERP Initial Setup Complete!");
      return true;
    } catch (error) {
      console.error("Error creating company & Admin:", error);
      toast.error("Failed to provision initial workspace setup.");
      return false;
    }
  },

  addUser: async (userData) => {
    const db = getDB();
    const cleanId = generateId("usr");
    const hashed = await sha256Fallback(userData.password || "admin123");
    const fullUser: User = {
      ...userData,
      id: cleanId,
      password: hashed,
      createdAt: new Date().toISOString(),
    };

    await db.users.add(fullUser);
    await get().initializeApp();
  },

  updateUser: async (id, updates) => {
    const db = getDB();
    if (updates.password) {
      updates.password = await sha256Fallback(updates.password);
    }
    await db.users.update(id, updates);
    await get().initializeApp();
  },

  deleteUser: async (id) => {
    const db = getDB();
    if (get().currentUser?.id === id) {
      toast.error("Identity Conflict: Self-deletion is strictly blocked.");
      return;
    }
    await db.users.delete(id);
    await get().initializeApp();
  },

  changePassword: async (userId, newPassword) => {
    const db = getDB();
    const hashed = await sha256Fallback(newPassword);
    await db.users.update(userId, { password: hashed });
    toast.success("Password update applied successfully.");
  },
});
