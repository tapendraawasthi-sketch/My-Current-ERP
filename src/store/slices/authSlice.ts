/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import toast from "react-hot-toast";
import { getDB, generateId, seedAccountingDefaults } from "../../lib/db";
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

interface UserWithSalt extends User {
  passwordSalt?: string;
}

const generateSalt = (): string => {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

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

      // One-time password migration: plaintext to salted SHA-256
      const allDbUsersForMigration = await db.users.toArray();
      const isSha256 = (str: string) => /^[a-fA-F0-9]{32}$/.test(str);
      for (const u of allDbUsersForMigration) {
        const userWithSalt = u as UserWithSalt;
        const currentPass = userWithSalt.password || "";
        if (!isSha256(currentPass)) {
          const salt = generateSalt();
          const hashed = await sha256Fallback(currentPass + salt);
          await db.users.update(userWithSalt.id, {
            password: hashed,
            passwordSalt: salt,
          } as any);
          console.log(`Migrated user ${userWithSalt.username} to salted password`);
        }
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
        billSundries,
        standardNarrations,
        billWiseEntries,
        interestSlabs,
        fixedAssets,
        depreciationBlocks,
        billsOfMaterial,
        productionVouchers,
        physicalStockVouchers,
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
        db.billSundries.toArray(),
        db.standardNarrations.toArray(),
        db.billWiseEntries.toArray(),
        db.interestSlabs.toArray(),
        db.fixedAssets.toArray(),
        db.depreciationBlocks.toArray(),
        db.billsOfMaterial.toArray(),
        db.productionVouchers.toArray(),
        db.physicalStockVouchers.toArray(),
      ]);

      const companySettings = companySettingsArr[0] || get().companySettings;
      let activeFiscalYears = fiscalYears;
      if (activeFiscalYears.length < 20) {
        const fiscalYearsToSeed: any[] = [];
        for (let bsYear = 2070; bsYear <= 2090; bsYear++) {
          const adYear = bsYear - 57;
          const fyId = `fy-${bsYear}-${(bsYear + 1).toString().slice(-2)}`;
          const existing = activeFiscalYears.find((f) => f.id === fyId);
          if (!existing) {
            fiscalYearsToSeed.push({
              id: fyId,
              name: `${bsYear}/${(bsYear + 1).toString().slice(-2)}`,
              startDate: `${adYear}-07-16`,
              endDate: `${adYear + 1}-07-15`,
              isCurrent: false,
              status: "ACTIVE",
            });
          }
        }
        if (fiscalYearsToSeed.length > 0) {
          await db.fiscalYears.bulkPut(fiscalYearsToSeed);
          activeFiscalYears = await db.fiscalYears.toArray();
        }
      }

      const currentFiscalYear = activeFiscalYears.find((fy) => fy.isCurrent) || null;

      // Seed default Interest Slab if none exists
      let loadedInterestSlabs = interestSlabs;
      if (loadedInterestSlabs.length === 0) {
        const seedSlab = {
          id: generateId("islab"),
          name: "Standard Interest",
          basisType: "day" as const,
          isDefault: true,
          isActive: true,
          slabs: [
            { fromDays: 0, toDays: 30, ratePercent: 12 },
            { fromDays: 31, toDays: 60, ratePercent: 15 },
            { fromDays: 61, toDays: 180, ratePercent: 18 },
            { fromDays: 181, ratePercent: 24 },
          ],
        };
        await db.interestSlabs.add(seedSlab as any);
        loadedInterestSlabs = await db.interestSlabs.toArray();
      }

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
        fiscalYears: activeFiscalYears,
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
        billSundries,
        standardNarrations,
        billWiseEntries,
        interestSlabs: loadedInterestSlabs,
        fixedAssets,
        depreciationBlocks,
        billsOfMaterial,
        productionVouchers,
        physicalStockVouchers,
        isDbReady: true,
      });

      const activeFY = activeFiscalYears.find((fy) => fy.isCurrent) || null;
      if (activeFY) {
        set({
          reportFilters: {
            startDate: activeFY.startDate,
            endDate: activeFY.endDate,
            preset: ReportPeriodPreset.FY,
          },
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

      // Check backup frequency for reminder
      const frequency = localStorage.getItem("sutra_auto_backup_frequency") || "never";
      if (frequency !== "never") {
        const lastBackupStr = localStorage.getItem("sutra_last_backup_date");
        const lastBackup = lastBackupStr ? new Date(lastBackupStr).getTime() : 0;
        const now = Date.now();
        const diffMs = now - lastBackup;
        const oneDay = 24 * 60 * 60 * 1000;
        let isOverdue = false;
        let periodName = "day";
        if (frequency === "daily" && diffMs > oneDay) {
          isOverdue = true;
          periodName = "day";
        } else if (frequency === "weekly" && diffMs > 7 * oneDay) {
          isOverdue = true;
          periodName = "week";
        }

        if (isOverdue) {
          const sessionKey = "sutra_backup_reminder_shown";
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, "true");
            setTimeout(async () => {
              try {
                const React = (await import("react")).default;
                toast(
                  (t) =>
                    React.createElement(
                      "div",
                      { className: "flex flex-col gap-2 p-1" },
                      React.createElement(
                        "p",
                        { className: "text-xs font-medium" },
                        `It's been over a ${periodName === "day" ? "day" : "week"} since your last backup — consider downloading one now.`,
                      ),
                      React.createElement(
                        "button",
                        {
                          className:
                            "self-end px-2 py-1 bg-[#1557b0] text-white rounded text-[11px] font-semibold hover:bg-[#0f4a96]",
                          onClick: async () => {
                            toast.dismiss(t.id);
                            try {
                              const { ADToBSString } = await import("../../lib/nepaliDate");
                              const dataStr = await get().exportBackup();
                              const blob = new Blob([dataStr], { type: "application/json" });
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              const today = new Date().toISOString().split("T")[0];
                              const nepaliDateStr = ADToBSString(today);
                              a.download = `sutra_backup_${nepaliDateStr}.json`;
                              a.click();
                              window.URL.revokeObjectURL(url);
                              const nowStr = new Date().toISOString();
                              localStorage.setItem("sutra_last_backup_date", nowStr);
                              toast.success("Backup downloaded successfully");
                            } catch (err: any) {
                              toast.error("Failed to create backup");
                            }
                          },
                        },
                        "Backup Now",
                      ),
                    ),
                  { duration: 15000 },
                );
              } catch (err) {
                console.error("Failed to show backup reminder toast:", err);
              }
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error("Fatal: Failed to initialize ERP Store:", error);
      toast.error("Fatal initialization database error.");
      set({ isDbReady: false });
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
      const allUsers = await db.users.toArray();
      const matchedUser = allUsers.find((u) => u.username.toLowerCase() === cleanUsername);

      if (!matchedUser || !matchedUser.isActive) {
        toast.error("Invalid username or account is deactivated.");
        return false;
      }

      let passwordMatch = false;
      if (password) {
        const u = matchedUser as UserWithSalt;
        if (u.passwordSalt) {
          const hashedInput = await sha256Fallback(password + u.passwordSalt);
          passwordMatch = u.password === hashedInput;
        } else {
          const hashedInput = await sha256Fallback(password);
          passwordMatch = u.password === hashedInput;
        }
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
      const salt = generateSalt();
      const hashedPass = await sha256Fallback((payload.adminUser.password || "admin123") + salt);
      const finalAdmin: User & { id: string } = {
        ...payload.adminUser,
        username: payload.adminUser.username.trim().toLowerCase(),
        id: adminId,
        password: hashedPass,
        passwordSalt: salt,
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date().toISOString(),
      } as any;

      await db.transaction(
        "rw",
        [
          db.companySettings,
          db.users,
          db.accounts,
          db.fiscalYears,
          db.warehouses,
          db.units,
          db.bankAccounts,
          db.currencies,
          db.exchangeRates,
          db.auditLogs,
        ],
        async () => {
          await db.companySettings.clear();
          await db.companySettings.add(finalCompany);
          await db.users.add(finalAdmin);
          await seedAccountingDefaults();
        },
      );

      await get().initializeApp();

      if (get().accounts && get().accounts.length > 0) {
        set({
          currentUser: finalAdmin,
          isAuthenticated: true,
        });
        toast.success("Sutra ERP Initial Setup Complete!");
        return true;
      } else {
        console.error("Initialization failed: No accounts loaded.");
        toast.error("Database initialization failed. Please try again.");
        return false;
      }
    } catch (error) {
      console.error("Error creating company & Admin:", error);
      toast.error("Failed to provision initial workspace setup.");
      return false;
    }
  },

  addUser: async (userData) => {
    const db = getDB();
    const cleanId = generateId("usr");
    const salt = generateSalt();
    const hashed = await sha256Fallback((userData.password || "admin123") + salt);
    const fullUser: User = {
      ...userData,
      username: userData.username.trim().toLowerCase(),
      id: cleanId,
      password: hashed,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    } as any;

    await db.users.add(fullUser);
    await get().initializeApp();
  },

  updateUser: async (id, updates) => {
    const db = getDB();
    if (updates.password) {
      const salt = generateSalt();
      updates.password = await sha256Fallback(updates.password + salt);
      (updates as any).passwordSalt = salt;
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
    const salt = generateSalt();
    const hashed = await sha256Fallback(newPassword + salt);
    await db.users.update(userId, { password: hashed, passwordSalt: salt } as any);
    toast.success("Password update applied successfully.");
  },
});
