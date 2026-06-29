import { create } from "zustand";
import {
  AppState,
  AuthStage,
  DEFAULT_ACCOUNTS,
  DEFAULT_WAREHOUSES,
  DEFAULT_UNITS,
  DEFAULT_FISCAL_YEAR,
  DEFAULT_CURRENCY,
  DEFAULT_SHORTCUTS,
  DEFAULT_TDS_RATES,
  StoreUser,
  CompanySettings,
  FiscalYear,
  hashPassword,
  verifyPassword,
  Notification,
  validateVoucherBalance,
} from "./store.types";

import { createAccountSlice } from "./slices/accountSlice";
import { createInventorySlice } from "./slices/inventorySlice";
import { createVoucherSlice } from "./slices/voucherSlice";
import { createSettingsSlice } from "./slices/settingsSlice";

// Re-export all types and helpers so external files don't break
export * from "./store.types";

import { getDB, generateId, DBCurrency, DBExchangeRate, DBFXGainLossEntry, DBCostCentre, DBCostCentreAllocation, DBApprovalPolicy, DBApprovalRequest, DBApprovalAction, DBRecurringTemplate, DBRecurringPosting } from "../lib/db";
import { computeNepalTDS } from "../lib/nepalTax";
import { startCbmsQueueWorker } from "../lib/cbmsService";
import { migrateWorkflowFields } from "../lib/workflowMigration";
import { computeNextDueDate } from "../lib/recurringUtils";

export const useStore = create<AppState>()((...a) => {
  const [set, get] = a;
  return {
    isDbReady: false,
    isAuthenticated: false,
    authStage: "checking" as AuthStage,
    selectedCompanyId: null as string | null,
    lastLoginInfo: null as { username: string; loginAt: string } | null,
    loginFailedAttempts: 0,
    currentUser: null,
    accounts: [],
    parties: [],
    items: [],
    vouchers: [],
    invoices: [],
    stockMovements: [],
    warehouses: [],
    fixedAssets: [],
    depreciationLedger: [],
    stockTransfers: [],
    units: [],
    costCenters: [],
    fiscalYears: [],
    currentFiscalYear: null,
    salesPersons: [],
    loadWarehouses: async () => {},
    addWarehouse: async (w) => w as any,
    updateWarehouse: async () => {},
    getNextTransferNo: async () => "",
    saveStockTransfer: async (t) => t as any,
    deliveryChallans: [],
    goodsReceiptNotes: [],
    salesOrders: [],
    purchaseOrders: [],
    users: [],
    notifications: [],
    budgets: [],
    recurringVouchers: [],
    customFieldDefs: [],
    currencies: [],
    employees: [] as any[],
    salaryStructures: [] as any[],
    payrollRuns: [] as any[],
    payrollEntries: [] as any[],
    tdsChallans: [],
    stockCategories: [],
    voucherTypeMasters: [],
    voucherAuditLogs: [],
    scenarios: [],
    costCategories: [],
    costCentreClasses: [],
    reorderLevels: [],
    priceLevels: [],
    priceLists: [],
    hsCodes: [],
    batches: [],
    serialNumbers: [],
    vatClassifications: [],
    tdsNatureOfPayment: [],
    employeeGroups: [],
    payHeads: [],
    salaryDetails: [],
    payrollUnits: [],
    attendanceTypes: [],
    ledgerExtensions: [],
    tdsEntries: [],
    tdsRates: DEFAULT_TDS_RATES,

    // Banking Module State
    chequeBooks: [],
    cheques: [],
    auditLogs: [],
    depositSlips: [],
    pdCheques: [],
    pdcRegister: [],
    ePaymentBatches: [],
    paymentAdvices: [],

    branches: [],
    salespersons: [],
    currencies: [] as DBCurrency[],
    exchangeRates: [] as DBExchangeRate[],
    fxGainLossEntries: [] as DBFXGainLossEntry[],
    costCentres: [] as DBCostCentre[],
    costCentreAllocations: [] as DBCostCentreAllocation[],
    approvalPolicies: [] as DBApprovalPolicy[],
    approvalRequests: [] as DBApprovalRequest[],
    approvalActions:  [] as DBApprovalAction[],
    recurringTemplates: [] as DBRecurringTemplate[],
    recurringPostings:  [] as DBRecurringPosting[],
    followUpNotes: [],
    jobWorkOrders: [],
    reportSchedules: [],
    priceFloorPolicies: [],
    chequeBounceLogs: [],

    stockJournals: [],
    productions: [],
    unassembles: [],
    materialIssued: [],
    materialReceived: [],
    physicalStocks: [],
    bankStatements: [],
    journalEntries: [],
    unitConversions: [],
    standardNarrations: [],
    billSundryMasters: [],
    saleTypes: [],
    purchaseTypes: [],
    taxCategories: [],
    discountStructures: [],
    itemGroups: [],
    holidays: [],
    companySettings: null,
    currentPage: "gateway",
    activeVoucherDate: new Date().toISOString().split("T")[0],
    reportFilters: {},
    showHelp: false,

    initializeApp: async () => {
      const { isInitializing, isDbReady } = get();
      if (isInitializing || isDbReady) return;
      set({ isInitializing: true, authStage: "checking" as AuthStage });

      try {
        startCbmsQueueWorker();
        const db = getDB();

        // ── Seed default data if tables are empty ──────────────────────────────
        const accountCount = await db.accounts.count();
        if (accountCount === 0) {
          try {
            const { seedNepalNASChartOfAccounts } =
              await import("../lib/seeders/nepalNasCoaSeeder");
            await seedNepalNASChartOfAccounts(db as any);
          } catch (err) {
            console.error("Error seeding Nepal NAS Chart of Accounts:", err);
            await db.accounts.bulkAdd(DEFAULT_ACCOUNTS as any);
          }
        }

        const warehouseCount = await db.warehouses.count();
        if (warehouseCount === 0) await db.warehouses.bulkAdd(DEFAULT_WAREHOUSES as any);

        const unitCount = await db.units.count();
        if (unitCount === 0) await db.units.bulkAdd(DEFAULT_UNITS as any);

        const fyCount = await db.fiscalYears.count();
        if (fyCount === 0) await db.fiscalYears.add(DEFAULT_FISCAL_YEAR as any);

        const currencyCount = await db.currencies.count();
        if (currencyCount === 0) await db.currencies.add(DEFAULT_CURRENCY as any);

        const shortcutCount = await db.shortcuts.count();
        if (shortcutCount === 0) await db.shortcuts.bulkAdd(DEFAULT_SHORTCUTS as any);

        const userCount = await db.users.count();
        if (userCount === 0) {
          const hash = await hashPassword("admin123");
          await db.users.add({
            id: "user-admin",
            username: "admin",
            name: "Administrator",
            email: "admin@company.com",
            role: "admin",
            passwordHash: hash,
            isActive: true,
          } as any);
        } else {
          try {
            const adminUser = (await db.users.where("username").equals("admin").first()) as any;
            if (!adminUser) {
              const hash = await hashPassword("admin123");
              await db.users.put({
                id: "user-admin",
                username: "admin",
                name: "Administrator",
                email: "admin@company.com",
                role: "admin",
                passwordHash: hash,
                isActive: true,
              } as any);
            } else if (
              adminUser.passwordHash?.startsWith("fallback_") ||
              (!adminUser.passwordHash?.startsWith("pbkdf2v2_") &&
                !adminUser.passwordHash?.startsWith("sha256v1_"))
            ) {
              await db.users.update(adminUser.id, { passwordHash: await hashPassword("admin123") });
            }
          } catch {
            /* non-critical */
          }
        }

        await migrateWorkflowFields();

        // ── Stage gate: check if any company exists ────────────────────────────
        const companyCount = await db.companySettings.count();

        if (companyCount === 0) {
          // Seed placeholder company then send to wizard
          await db.companySettings.add({
            id: "main",
            name: "My Company",
            companyNameEn: "My Company",
            panNumber: "000000000",
            currencySymbol: "Rs.",
            address: "Kathmandu, Nepal",
            phone: "",
            email: "",
            enableCostCenter: false,
            enableBillWiseTracking: false,
            enableBillWise: false,
            enableBatchTracking: false,
            tdsEnabled: false,
            enableMultiCurrency: false,
            cbmsEnabled: false,
          } as any);
          set({ isDbReady: true, isInitializing: false, authStage: "no-company" as AuthStage });
          return;
        }

        // ── Check for a valid existing session ────────────────────────────────
        const sessionUserId = sessionStorage.getItem("sutra_user_id");
        const sessionCompanyId = sessionStorage.getItem("sutra_company_id");

        if (sessionUserId && sessionCompanyId) {
          try {
            const sessionUser = (await db.users.get(sessionUserId)) as any;
            const sessionCompany = (await db.companySettings.get(sessionCompanyId)) as any;
            if (sessionUser && sessionUser.isActive && sessionCompany) {
              await get()._loadAllData();
              set({
                isDbReady: true,
                isInitializing: false,
                isAuthenticated: true,
                currentUser: sessionUser as StoreUser,
                selectedCompanyId: sessionCompanyId,
                authStage: "authenticated" as AuthStage,
              });
              return;
            }
          } catch {
            /* session validation failed */
          }
          sessionStorage.removeItem("sutra_user_id");
          sessionStorage.removeItem("sutra_company_id");
        }

        // ── No valid session → show Gateway (load ONLY companySettings) ────────
        const settingsArr = await db.companySettings.toArray();
        const company = settingsArr[0] as any;
        const lastLoginInfo =
          company?.lastLoginBy && company?.lastLoginAt
            ? { username: company.lastLoginBy, loginAt: company.lastLoginAt }
            : null;

        set({
          isDbReady: true,
          isInitializing: false,
          companySettings: (settingsArr[0] as CompanySettings) || null,
          lastLoginInfo,
          authStage: "gateway" as AuthStage,
        });
      } catch (err) {
        console.error("initializeApp failed:", err);
        set({ isInitializing: false, isDbReady: true, authStage: "gateway" as AuthStage });
      }
    },

    // ── Internal helper: load ALL data tables after login ─────────────────────
    _loadAllData: async () => {
      const db = getDB();
      const [
        accounts,
        parties,
        items,
        vouchers,
        invoices,
        stockMovements,
        warehouses,
        units,
        costCenters,
        fiscalYears,
        deliveryChallans,
        goodsReceiptNotes,
        salesOrders,
        purchaseOrders,
        users,
        notifications,
        budgets,
        recurringVouchers,
        customFieldDefs,
        currencies,
        settingsArr,
        unitConversions,
        standardNarrations,
        billSundryMasters,
        saleTypes,
        purchaseTypes,
        taxCategories,
        discountStructures,
        itemGroups,
        holidays,
        employees,
        bankStatements,
        tdsEntries,
        tdsChallans,
        stockJournals,
        productions,
        unassembles,
        materialIssued,
        materialReceived,
        physicalStocks,
        stockCategories,
        voucherTypeMasters,
        scenarios,
        costCategories,
        costCentreClasses,
        reorderLevels,
        priceLevels,
        priceLists,
        hsCodes,
        batches,
        vatClassifications,
        tdsNatureOfPayment,
        employeeGroups,
        payHeads,
        salaryDetails,
        payrollUnits,
        attendanceTypes,
        ledgerExtensions,
        chequeBooks,
        cheques,
        depositSlips,
        pdCheques,
        ePaymentBatches,
        paymentAdvices,
        branches,
        salesPersons,
        exchangeRates,
        followUpNotes,
        jobWorkOrders,
        reportSchedules,
        priceFloorPolicies,
        chequeBounceLogs,
      ] = await Promise.all([
        db.accounts.toArray().catch(() => []),
        db.parties.toArray().catch(() => []),
        db.items.toArray().catch(() => []),
        db.vouchers
          .orderBy("date")
          .reverse()
          .toArray()
          .catch(() => []),
        db.invoices
          .orderBy("date")
          .reverse()
          .toArray()
          .catch(() => []),
        db.stockMovements.toArray().catch(() => []),
        db.warehouses.toArray().catch(() => []),
        db.units.toArray().catch(() => []),
        db.costCenters.toArray().catch(() => []),
        db.fiscalYears.toArray().catch(() => []),
        db.deliveryChallans.toArray().catch(() => []),
        db.goodsReceiptNotes.toArray().catch(() => []),
        db.salesOrders.toArray().catch(() => []),
        db.purchaseOrders.toArray().catch(() => []),
        db.users.toArray().catch(() => []),
        db.notifications
          .orderBy("createdAt")
          .reverse()
          .limit(50)
          .toArray()
          .catch(() => []),
        db.budgets.toArray().catch(() => []),
        db.recurringVouchers.toArray().catch(() => []),
        db.customFieldDefs.toArray().catch(() => []),
        db.currencies.toArray().catch(() => []),
        db.companySettings.toArray().catch(() => []),
        db.unitConversions.toArray().catch(() => []),
        db.standardNarrations.toArray().catch(() => []),
        db.billSundryMasters.toArray().catch(() => []),
        db.saleTypes.toArray().catch(() => []),
        db.purchaseTypes.toArray().catch(() => []),
        db.taxCategories.toArray().catch(() => []),
        db.discountStructures.toArray().catch(() => []),
        db.itemGroups.toArray().catch(() => []),
        db.holidays.toArray().catch(() => []),
        db.employees.toArray().catch(() => []),
        db.bankStatements.toArray().catch(() => []),
        db.tdsEntries.toArray().catch(() => []),
        db.tdsChallans.toArray().catch(() => []),
        db.stockJournals.toArray().catch(() => []),
        db.productions.toArray().catch(() => []),
        db.unassembles.toArray().catch(() => []),
        db.materialIssued.toArray().catch(() => []),
        db.materialReceived.toArray().catch(() => []),
        db.physicalStocks.toArray().catch(() => []),
        db.stockCategories.toArray().catch(() => []),
        db.voucherTypeMasters.toArray().catch(() => []),
        db.scenarios.toArray().catch(() => []),
        db.costCategories.toArray().catch(() => []),
        db.costCentreClasses.toArray().catch(() => []),
        db.reorderLevels.toArray().catch(() => []),
        db.priceLevels.toArray().catch(() => []),
        db.priceLists.toArray().catch(() => []),
        db.hsCodes.toArray().catch(() => []),
        db.batches.toArray().catch(() => []),
        db.vatClassifications.toArray().catch(() => []),
        db.tdsNatureOfPayment.toArray().catch(() => []),
        db.employeeGroups.toArray().catch(() => []),
        db.payHeads.toArray().catch(() => []),
        db.salaryDetails.toArray().catch(() => []),
        db.payrollUnits.toArray().catch(() => []),
        db.attendanceTypes.toArray().catch(() => []),
        db.ledgerExtensions.toArray().catch(() => []),
        db.chequeBooks.toArray().catch(() => []),
        db.cheques.toArray().catch(() => []),
        db.depositSlips.toArray().catch(() => []),
        db.pdCheques.toArray().catch(() => []),
        db.ePaymentBatches.toArray().catch(() => []),
        db.paymentAdvices.toArray().catch(() => []),
        db.branches.toArray().catch(() => []),
        db.salesPersons.toArray().catch(() => []),
        db.exchangeRates.toArray().catch(() => []),
        db.followUpNotes.toArray().catch(() => []),
        db.jobWorkOrders.toArray().catch(() => []),
        db.reportSchedules.toArray().catch(() => []),
        db.priceFloorPolicies.toArray().catch(() => []),
        db.chequeBounceLogs.toArray().catch(() => []),
      ]);

      const currentFiscalYear = (fiscalYears.find((fy: any) => fy.isCurrent || fy.isDefault) ||
        fiscalYears[0]) as unknown as FiscalYear | undefined;

      const balanceMap: Record<string, number> = {};
      for (const v of vouchers) {
        if (v.status === "posted" && v.lines) {
          for (const l of v.lines) {
            if (l.accountId) {
              balanceMap[l.accountId] =
                (balanceMap[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0);
            }
          }
        }
      }
      const accountsWithBalance = accounts.map((a) => ({
        ...a,
        balance: (balanceMap[a.id] || 0) + (a.openingBalanceDr || 0) - (a.openingBalanceCr || 0),
      }));

      set({
        accounts: accountsWithBalance,
        parties,
        items,
        vouchers,
        invoices,
        stockMovements,
        warehouses,
        units,
        costCenters,
        fiscalYears: fiscalYears as unknown as FiscalYear[],
        currentFiscalYear: (currentFiscalYear as unknown as FiscalYear) || null,
        deliveryChallans,
        goodsReceiptNotes,
        salesOrders,
        purchaseOrders,
        users: users as StoreUser[],
        notifications: notifications as unknown as Notification[],
        budgets,
        recurringVouchers,
        customFieldDefs,
        currencies,
        companySettings: (settingsArr[0] as CompanySettings) || null,
        unitConversions,
        standardNarrations,
        billSundryMasters,
        saleTypes,
        purchaseTypes,
        taxCategories,
        discountStructures,
        itemGroups,
        holidays,
        employees,
        bankStatements,
        tdsEntries: tdsEntries as any[],
        tdsChallans: tdsChallans as any[],
        stockJournals: stockJournals as any[],
        productions: productions as any[],
        unassembles: unassembles as any[],
        materialIssued: materialIssued as any[],
        materialReceived: materialReceived as any[],
        physicalStocks: physicalStocks as any[],
        stockCategories: stockCategories as any[],
        voucherTypeMasters: voucherTypeMasters as any[],
        scenarios: scenarios as any[],
        costCategories: costCategories as any[],
        costCentreClasses: costCentreClasses as any[],
        reorderLevels: reorderLevels as any[],
        priceLevels: priceLevels as any[],
        priceLists: priceLists as any[],
        hsCodes: hsCodes as any[],
        batches: batches as any[],
        vatClassifications: vatClassifications as any[],
        tdsNatureOfPayment: tdsNatureOfPayment as any[],
        employeeGroups: employeeGroups as any[],
        payHeads: payHeads as any[],
        salaryDetails: salaryDetails as any[],
        payrollUnits: payrollUnits as any[],
        attendanceTypes: attendanceTypes as any[],
        ledgerExtensions: ledgerExtensions as any[],
        chequeBooks: chequeBooks as any[],
        cheques: cheques as any[],
        depositSlips: depositSlips as any[],
        pdCheques: pdCheques as any[],
        ePaymentBatches: ePaymentBatches as any[],
        paymentAdvices: paymentAdvices as any[],
        branches: branches as any[],
        salespersons: salesPersons as any[],
        exchangeRates: exchangeRates as any[],
        followUpNotes: followUpNotes as any[],
        jobWorkOrders: jobWorkOrders as any[],
        reportSchedules: reportSchedules as any[],
        priceFloorPolicies: priceFloorPolicies as any[],
        chequeBounceLogs: chequeBounceLogs as any[],
        journalEntries: vouchers,
      });

      // Stock reorder notifications
      for (const item of items) {
        if (item.reorderLevel) {
          const movements = stockMovements.filter((m: any) => m.itemId === item.id);
          const totalIn = movements.reduce((s: number, m: any) => s + (m.qty > 0 ? m.qty : 0), 0);
          const totalOut = movements.reduce(
            (s: number, m: any) => s + (m.qty < 0 ? Math.abs(m.qty) : 0),
            0,
          );
          const stock = (item.openingStock || 0) + totalIn - totalOut;
          if (stock <= item.reorderLevel) {
            const existingNote = notifications.find(
              (n: any) => n.message && n.message.includes(item.name) && !n.read,
            );
            if (!existingNote) {
              get().addNotification(
                `Low stock alert: ${item.name} (${stock} ${item.unit || "units"} remaining, reorder at ${item.reorderLevel})`,
                "warning",
              );
            }
          }
        }
      }

      try {
        await get().loadVoucherTypeMasters();
      } catch (e) {
        console.warn("loadVoucherTypeMasters skipped:", e);
      }
      try {
        await get().loadSalesPersons();
      } catch (e) {
        console.warn("loadSalesPersons skipped:", e);
      }
      try {
        await get().loadPriceLists();
      } catch (e) {
        console.warn("loadPriceLists skipped:", e);
      }
    },

    login: async (username: string, password: string): Promise<boolean> => {
      const db = getDB();
      const { selectedCompanyId } = get();
      const companyId = selectedCompanyId || "main";

      const user = (await db.users.where("username").equals(username.trim()).first()) as any;
      if (!user || !user.isActive) {
        set((s) => ({ loginFailedAttempts: s.loginFailedAttempts + 1 }));
        try {
          await (db as any).loginHistory.add({
            companyId,
            userId: user?.id || null,
            username: username.trim(),
            loginAt: new Date().toISOString(),
            success: false,
            userAgent: navigator.userAgent,
          });
        } catch {
          /* non-critical */
        }
        return false;
      }

      const storedHash: string = user.passwordHash || "";
      const valid = await verifyPassword(password, storedHash);
      if (!valid) {
        set((s) => ({ loginFailedAttempts: s.loginFailedAttempts + 1 }));
        try {
          await (db as any).loginHistory.add({
            companyId,
            userId: user.id,
            username: user.username,
            loginAt: new Date().toISOString(),
            success: false,
            userAgent: navigator.userAgent,
          });
        } catch {
          /* non-critical */
        }
        return false;
      }

      // Upgrade legacy hash when crypto.subtle is available
      const needsUpgrade = !storedHash || storedHash.startsWith("fallback_");
      if (needsUpgrade && crypto?.subtle) {
        try {
          await db.users.update(user.id, { passwordHash: await hashPassword(password) });
        } catch {
          /* ok */
        }
      }

      const loginAt = new Date().toISOString();

      // Record successful login
      try {
        await (db as any).loginHistory.add({
          companyId,
          userId: user.id,
          username: user.username,
          loginAt,
          success: true,
          userAgent: navigator.userAgent,
        });
      } catch {
        /* non-critical */
      }

      // Update lastLoginBy / lastLoginAt on the company settings row
      try {
        await db.companySettings.update(companyId, {
          lastLoginBy: user.username,
          lastLoginAt: loginAt,
        } as any);
      } catch {
        /* non-critical */
      }

      // Persist session
      sessionStorage.setItem("sutra_user_id", user.id);
      sessionStorage.setItem("sutra_company_id", companyId);

      // Load ALL data (deferred from initializeApp — only runs after authentication)
      // Wrapped in try-catch: data loading failure must NEVER block a successful login
      try {
        await get()._loadAllData();
      } catch (e) {
        console.error("[login] _loadAllData failed (non-fatal, user still logged in):", e);
      }

      set({
        isAuthenticated: true,
        currentUser: user as StoreUser,
        currentPage: "dashboard",
        authStage: "authenticated" as AuthStage,
        loginFailedAttempts: 0,
        lastLoginInfo: { username: user.username, loginAt },
      });

      return true;
    },

    logout: () => {
      sessionStorage.removeItem("sutra_user_id");
      sessionStorage.removeItem("sutra_company_id");
      set({
        isAuthenticated: false,
        currentUser: null,
        selectedCompanyId: null,
        loginFailedAttempts: 0,
        authStage: "gateway" as AuthStage,
        // Clear heavy data to free memory (data reloads on next login)
        accounts: [],
        parties: [],
        items: [],
        vouchers: [],
        invoices: [],
        stockMovements: [],
        deliveryChallans: [],
        goodsReceiptNotes: [],
        salesOrders: [],
        purchaseOrders: [],
        users: [],
        budgets: [],
        recurringVouchers: [],
        journalEntries: [],
      });
    },

    createCompanyAndAdmin: async ({ company, adminUser }) => {
      const db = getDB();
      await db.companySettings.put({ id: "main", ...company } as any);
      const hash = await hashPassword((adminUser as any).password || "admin123");
      await db.users.put({
        id: adminUser.id || generateId(),
        username: adminUser.username || "admin",
        name: adminUser.name || "Administrator",
        role: adminUser.role || "admin",
        passwordHash: hash,
        isActive: true,
      } as any);
      const settings = await db.companySettings.get("main");
      set({
        companySettings: settings as CompanySettings,
        authStage: "gateway" as AuthStage,
      });
    },

    selectCompanyForLogin: (companyId: string) => {
      set({
        selectedCompanyId: companyId,
        authStage: "company-login" as AuthStage,
        loginFailedAttempts: 0,
      });
    },

    backToGateway: () => {
      set({ selectedCompanyId: null, authStage: "gateway" as AuthStage, loginFailedAttempts: 0 });
    },

    setAuthStage: (stage: AuthStage) => {
      set({ authStage: stage });
    },

    setCurrentPage: (page) => set({ currentPage: page }),
    setActiveVoucherDate: (date) => set({ activeVoucherDate: date }),
    setReportFilters: (filters) => set({ reportFilters: filters }),

    addStockJournal: async (entry) => {
      const db = getDB();
      await db.stockJournals.put(entry);
      set((state) => ({ stockJournals: [entry, ...state.stockJournals] }));
    },
    addProduction: async (entry) => {
      const db = getDB();
      await db.productions.put(entry);
      set((state) => ({ productions: [entry, ...state.productions] }));
    },
    addUnassemble: async (entry) => {
      const db = getDB();
      await db.unassembles.put(entry);
      set((state) => ({ unassembles: [entry, ...state.unassembles] }));
    },
    addMaterialIssued: async (entry) => {
      const db = getDB();
      await db.materialIssued.put(entry);
      set((state) => ({ materialIssued: [entry, ...state.materialIssued] }));
    },
    addMaterialReceived: async (entry) => {
      const db = getDB();
      await db.materialReceived.put(entry);
      set((state) => ({ materialReceived: [entry, ...state.materialReceived] }));
    },
    addPhysicalStock: async (entry) => {
      const db = getDB();
      await db.physicalStocks.put(entry);
      set((state) => ({ physicalStocks: [entry, ...state.physicalStocks] }));
    },

    ...createAccountSlice(...a),
    ...createInventorySlice(...a),
    ...createVoucherSlice(...a),
    ...createSettingsSlice(...a),
    // ─── Fixed Asset Actions ──────────────────────────────────────────────────────
    addFixedAsset: async (asset: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const row = { ...asset, id, createdAt: now, updatedAt: now };
        if (db.fixedAssets) await db.fixedAssets.put(row);
        set((state: any) => ({
          fixedAssets: [...(state.fixedAssets || []), row],
        }));
        return row;
      } catch (err) {
        console.warn("addFixedAsset failed", err);
        throw err;
      }
    },

    updateFixedAsset: async (id: string, updates: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        if (db.fixedAssets) await db.fixedAssets.update(id, { ...updates, updatedAt: now });
        set((state: any) => ({
          fixedAssets: (state.fixedAssets || []).map((a: any) =>
            a.id === id ? { ...a, ...updates, updatedAt: now } : a
          ),
        }));
      } catch (err) {
        console.warn("updateFixedAsset failed", err);
        throw err;
      }
    },

    deleteFixedAsset: async (id: string) => {
      try {
        const db = getDB();
        if (db.fixedAssets) await db.fixedAssets.delete(id);
        set((state: any) => ({
          fixedAssets: (state.fixedAssets || []).filter((a: any) => a.id !== id),
        }));
      } catch (err) {
        console.warn("deleteFixedAsset failed", err);
      }
    },

    loadFixedAssets: async () => {
      try {
        const db = getDB();
        if (!db.fixedAssets) return;
        const assets = await db.fixedAssets.toArray();
        set({ fixedAssets: assets || [] });
      } catch (err) {
        console.warn("loadFixedAssets failed", err);
      }
    },

    saveDepreciationEntry: async (entry: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const row = { ...entry, id, createdAt: now };
        if (db.depreciationLedger) await db.depreciationLedger.put(row);
        set((state: any) => ({
          depreciationLedger: [...(state.depreciationLedger || []), row],
        }));
        return row;
      } catch (err) {
        console.warn("saveDepreciationEntry failed", err);
        throw err;
      }
    },

    // ─── Batch Actions ────────────────────────────────────────────────────────────
    addBatch: async (batch: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const row = { ...batch, id, createdAt: now, updatedAt: now };
        if (db.batches) await db.batches.put(row);
        set((s: any) => ({ batches: [...(s.batches || []), row] }));
        return row;
      } catch (err) { console.warn("addBatch failed", err); throw err; }
    },
    updateBatch: async (id: string, updates: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        if (db.batches) await db.batches.update(id, { ...updates, updatedAt: now });
        set((s: any) => ({
          batches: (s.batches || []).map((b: any) =>
            b.id === id ? { ...b, ...updates, updatedAt: now } : b
          ),
        }));
      } catch (err) { console.warn("updateBatch failed", err); }
    },
    deleteBatch: async (id: string) => {
      try {
        const db = getDB();
        if (db.batches) await db.batches.delete(id);
        set((s: any) => ({ batches: (s.batches || []).filter((b: any) => b.id !== id) }));
      } catch (err) { console.warn("deleteBatch failed", err); }
    },
    loadBatches: async () => {
      try {
        const db = getDB();
        if (!db.batches) return;
        const batches = await db.batches.toArray();
        set({ batches: batches || [] });
      } catch (err) { console.warn("loadBatches failed", err); }
    },

    // ─── Serial Number Actions ────────────────────────────────────────────────────
    addSerialNumber: async (sn: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const row = { ...sn, id, createdAt: now, updatedAt: now };
        if (db.serialNumbers) await db.serialNumbers.put(row);
        set((s: any) => ({ serialNumbers: [...(s.serialNumbers || []), row] }));
        return row;
      } catch (err) { console.warn("addSerialNumber failed", err); throw err; }
    },
    updateSerialNumber: async (id: string, updates: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        if (db.serialNumbers) await db.serialNumbers.update(id, { ...updates, updatedAt: now });
        set((s: any) => ({
          serialNumbers: (s.serialNumbers || []).map((sn: any) =>
            sn.id === id ? { ...sn, ...updates, updatedAt: now } : sn
          ),
        }));
      } catch (err) { console.warn("updateSerialNumber failed", err); }
    },
    deleteSerialNumber: async (id: string) => {
      try {
        const db = getDB();
        if (db.serialNumbers) await db.serialNumbers.delete(id);
        set((s: any) => ({
          serialNumbers: (s.serialNumbers || []).filter((sn: any) => sn.id !== id),
        }));
      } catch (err) { console.warn("deleteSerialNumber failed", err); }
    },
    loadSerialNumbers: async () => {
      try {
        const db = getDB();
        if (!db.serialNumbers) return;
        const sns = await db.serialNumbers.toArray();
        set({ serialNumbers: sns || [] });
      } catch (err) { console.warn("loadSerialNumbers failed", err); }
    },
    // ─── PDC Actions ──────────────────────────────────────────────────────────────
    addPDC: async (pdc: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        const row = { ...pdc, id, createdAt: now, updatedAt: now };
        if (db.pdcRegister) await db.pdcRegister.put(row);
        set((s: any) => ({ pdcRegister: [...(s.pdcRegister || []), row] }));
        return row;
      } catch (err) { console.warn("addPDC failed", err); throw err; }
    },
    updatePDC: async (id: string, updates: any) => {
      try {
        const db = getDB();
        const now = new Date().toISOString();
        if (db.pdcRegister) await db.pdcRegister.update(id, { ...updates, updatedAt: now });
        set((s: any) => ({
          pdcRegister: (s.pdcRegister || []).map((p: any) =>
            p.id === id ? { ...p, ...updates, updatedAt: now } : p
          ),
        }));
      } catch (err) { console.warn("updatePDC failed", err); }
    },
    deletePDC: async (id: string) => {
      try {
        const db = getDB();
        if (db.pdcRegister) await db.pdcRegister.delete(id);
        set((s: any) => ({ pdcRegister: (s.pdcRegister || []).filter((p: any) => p.id !== id) }));
      } catch (err) { console.warn("deletePDC failed", err); }
    },
    loadPDCRegister: async () => {
      try {
        const db = getDB();
        if (!db.pdcRegister) return;
        const records = await db.pdcRegister.toArray();
        set({ pdcRegister: records || [] });
      } catch (err) { console.warn("loadPDCRegister failed", err); }
    },
    // ── PAYROLL ACTIONS ─────────────────────────────────────────────────────
    loadPayrollData: async () => {
      const [employees, salaryStructures, payrollRuns, payrollEntries] =
        await Promise.all([
          db.employees.toArray(),
          db.salaryStructures.toArray(),
          db.payrollRuns.toArray(),
          db.payrollEntries.toArray(),
        ]);
      set({ employees, salaryStructures, payrollRuns, payrollEntries });
    },

    addEmployee: async (emp: any) => {
      const id = await db.employees.add({ ...emp, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const employees = await db.employees.toArray();
      set({ employees });
      return id;
    },

    updateEmployee: async (id: number, changes: any) => {
      await db.employees.update(id, { ...changes, updatedAt: new Date().toISOString() });
      const employees = await db.employees.toArray();
      set({ employees });
    },

    deleteEmployee: async (id: number) => {
      await db.employees.delete(id);
      const employees = await db.employees.toArray();
      set({ employees });
    },

    addSalaryStructure: async (s: any) => {
      const id = await db.salaryStructures.add({ ...s, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const salaryStructures = await db.salaryStructures.toArray();
      set({ salaryStructures });
      return id;
    },

    processPayroll: async (month: number, year: number, fiscalYear: string) => {
      const { employees, salaryStructures } = get();
      const activeEmps = employees.filter((e: any) => e.isActive);

      const entries: any[] = activeEmps.map((emp: any) => {
        // Get latest salary structure
        const structs = salaryStructures
          .filter((s: any) => s.employeeId === emp.id)
          .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom));
        const sal = structs[0] || { basicSalary: 0, houseRentAllowance: 0, medicalAllowance: 0, transportAllowance: 0, otherAllowances: 0, epfRate: 10, citRate: 10, ssfRate: 1, epfApplicable: emp.epfApplicable, citApplicable: emp.citApplicable, ssfApplicable: emp.ssfApplicable };

        const grossSalary = sal.basicSalary + sal.houseRentAllowance + sal.medicalAllowance + sal.transportAllowance + sal.otherAllowances;

        // EPF: 10% of basic (employee + employer)
        const epfEmployee = emp.epfApplicable ? sal.basicSalary * (sal.epfRate / 100) : 0;
        const epfEmployer = emp.epfApplicable ? sal.basicSalary * (sal.epfRate / 100) : 0;

        // CIT: 10% of basic (optional, employee only, reduces taxable income)
        const citEmployee = emp.citApplicable ? sal.basicSalary * (sal.citRate / 100) : 0;

        // SSF: 1% employee, 3.33% employer
        const ssfEmployee = emp.ssfApplicable ? grossSalary * (sal.ssfRate / 100) : 0;
        const ssfEmployer = emp.ssfApplicable ? grossSalary * 0.0333 : 0;

        // Annualised gross for TDS calculation
        const annualisedGross = grossSalary * 12;

        // Deductions allowed from taxable income
        const deductionsFromTax = (epfEmployee + citEmployee) * 12;

        // Taxable income (married couples get NPR 500k exemption, single NPR 400k)
        const personalExemption = emp.maritalStatus === "married" ? 500000 : 400000;
        const taxableIncome = Math.max(0, annualisedGross - deductionsFromTax - personalExemption);

        // Nepal IRD progressive TDS slabs (FY 2081/82)
        const annualTax = computeNepalTDS(taxableIncome);
        const tdsAmount = Math.round(annualTax / 12);

        const totalDeductions = epfEmployee + citEmployee + ssfEmployee + tdsAmount;
        const netPay = grossSalary - totalDeductions;

        return {
          payrollRunId: 0, // set after run is created
          employeeId: emp.id!,
          employeeName: emp.name,
          department: emp.department,
          month,
          year,
          basicSalary: sal.basicSalary,
          houseRentAllowance: sal.houseRentAllowance,
          medicalAllowance: sal.medicalAllowance,
          transportAllowance: sal.transportAllowance,
          otherAllowances: sal.otherAllowances,
          overtimePay: 0,
          grossSalary,
          epfEmployee,
          citEmployee,
          ssfEmployee,
          tdsAmount,
          otherDeductions: 0,
          totalDeductions,
          netPay,
          epfEmployer,
          ssfEmployer,
          annualisedGross,
          taxableIncome,
          annualTax,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      // Create payroll run
      const totalGross = entries.reduce((s: number, e: any) => s + e.grossSalary, 0);
      const totalDeductions = entries.reduce((s: number, e: any) => s + e.totalDeductions, 0);
      const totalNetPay = entries.reduce((s: number, e: any) => s + e.netPay, 0);
      const totalEmployerContribution = entries.reduce((s: number, e: any) => s + e.epfEmployer + e.ssfEmployer, 0);

      const runId = await db.payrollRuns.add({
        month, year, fiscalYear,
        status: "processed",
        totalGross, totalDeductions, totalNetPay, totalEmployerContribution,
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const finalEntries = entries.map((e: any) => ({ ...e, payrollRunId: runId as number }));
      await db.payrollEntries.bulkAdd(finalEntries as any[]);

      const [payrollRuns, payrollEntries] = await Promise.all([
        db.payrollRuns.toArray(),
        db.payrollEntries.toArray(),
      ]);
      set({ payrollRuns, payrollEntries });
    },

    // ── MULTI-CURRENCY ACTIONS ───────────────────────────────────────────────
    loadCurrencyData: async () => {
      const db = getDB();
      const [currencies, exchangeRates, fxGainLossEntries] = await Promise.all([
        db.currencies.toArray(),
        db.exchangeRates.toArray(),
        db.fxGainLossEntries.toArray(),
      ]);
      set({ currencies, exchangeRates, fxGainLossEntries });
    },

    addCurrency: async (c: Omit<DBCurrency, "id">) => {
      const db = getDB();
      await db.currencies.add({ ...c, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const currencies = await db.currencies.toArray();
      set({ currencies });
    },

    updateCurrency: async (id: number, changes: Partial<DBCurrency>) => {
      const db = getDB();
      await db.currencies.update(id, { ...changes, updatedAt: new Date().toISOString() });
      const currencies = await db.currencies.toArray();
      set({ currencies });
    },

    addExchangeRate: async (r: Omit<DBExchangeRate, "id">) => {
      const db = getDB();
      await db.exchangeRates.add({ ...r, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const exchangeRates = await db.exchangeRates.toArray();
      set({ exchangeRates });
    },

    updateExchangeRate: async (id: number, changes: Partial<DBExchangeRate>) => {
      const db = getDB();
      await db.exchangeRates.update(id, { ...changes, updatedAt: new Date().toISOString() });
      const exchangeRates = await db.exchangeRates.toArray();
      set({ exchangeRates });
    },

    deleteExchangeRate: async (id: number) => {
      const db = getDB();
      await db.exchangeRates.delete(id);
      const exchangeRates = await db.exchangeRates.toArray();
      set({ exchangeRates });
    },

    addFXGainLoss: async (entry: Omit<DBFXGainLossEntry, "id">) => {
      const db = getDB();
      await db.fxGainLossEntries.add({ ...entry, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const fxGainLossEntries = await db.fxGainLossEntries.toArray();
      set({ fxGainLossEntries });
    },

    // ── COST CENTRE ACTIONS ──────────────────────────────────────────────────
    loadCostCentreData: async () => {
      const db = getDB();
      const [costCentres, costCentreAllocations] = await Promise.all([
        db.costCentres.toArray(),
        db.costCentreAllocations.toArray(),
      ]);
      set({ costCentres, costCentreAllocations });
    },

    addCostCentre: async (cc: Omit<DBCostCentre, "id">) => {
      const db = getDB();
      await db.costCentres.add({ ...cc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const costCentres = await db.costCentres.toArray();
      set({ costCentres });
    },

    updateCostCentre: async (id: number, changes: Partial<DBCostCentre>) => {
      const db = getDB();
      await db.costCentres.update(id, { ...changes, updatedAt: new Date().toISOString() });
      const costCentres = await db.costCentres.toArray();
      set({ costCentres });
    },

    deleteCostCentre: async (id: number) => {
      const db = getDB();
      await db.costCentres.delete(id);
      const costCentres = await db.costCentres.toArray();
      set({ costCentres });
    },

    addCostCentreAllocation: async (a: Omit<DBCostCentreAllocation, "id">) => {
      const db = getDB();
      await db.costCentreAllocations.add({ ...a, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const costCentreAllocations = await db.costCentreAllocations.toArray();
      set({ costCentreAllocations });
    },

    deleteCostCentreAllocation: async (id: number) => {
      const db = getDB();
      await db.costCentreAllocations.delete(id);
      const costCentreAllocations = await db.costCentreAllocations.toArray();
      set({ costCentreAllocations });
    },

    // ── APPROVAL WORKFLOW ACTIONS ────────────────────────────────────────────
    loadApprovalData: async () => {
      const db = getDB();
      const [approvalPolicies, approvalRequests, approvalActions] = await Promise.all([
        db.approvalPolicies.toArray(),
        db.approvalRequests.toArray(),
        db.approvalActions.toArray(),
      ]);
      // Parse JSON levels field
      const parsed = approvalPolicies.map(p => ({
        ...p,
        levels: typeof p.levels === "string" ? JSON.parse(p.levels) : p.levels,
      }));
      set({ approvalPolicies: parsed, approvalRequests, approvalActions });
    },

    addApprovalPolicy: async (policy: Omit<DBApprovalPolicy, "id">) => {
      const db = getDB();
      const toStore = { ...policy, levels: JSON.stringify(policy.levels), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await db.approvalPolicies.add(toStore);
      const raw = await db.approvalPolicies.toArray();
      const approvalPolicies = raw.map(p => ({ ...p, levels: typeof p.levels === "string" ? JSON.parse(p.levels) : p.levels }));
      set({ approvalPolicies });
    },

    updateApprovalPolicy: async (id: number, changes: Partial<DBApprovalPolicy>) => {
      const db = getDB();
      const toStore: any = { ...changes, updatedAt: new Date().toISOString() };
      if (changes.levels) toStore.levels = JSON.stringify(changes.levels);
      await db.approvalPolicies.update(id, toStore);
      const raw = await db.approvalPolicies.toArray();
      const approvalPolicies = raw.map(p => ({ ...p, levels: typeof p.levels === "string" ? JSON.parse(p.levels) : p.levels }));
      set({ approvalPolicies });
    },

    deleteApprovalPolicy: async (id: number) => {
      const db = getDB();
      await db.approvalPolicies.delete(id);
      const raw = await db.approvalPolicies.toArray();
      const approvalPolicies = raw.map(p => ({ ...p, levels: typeof p.levels === "string" ? JSON.parse(p.levels) : p.levels }));
      set({ approvalPolicies });
    },

    submitForApproval: async (request: Omit<DBApprovalRequest, "id">) => {
      const db = getDB();
      const id = await db.approvalRequests.add({ ...request, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const approvalRequests = await db.approvalRequests.toArray();
      set({ approvalRequests });
      return id;
    },

    takeApprovalAction: async (
      requestId: number,
      action: "approved" | "rejected" | "returned",
      actionByUserId: string,
      actionByName: string,
      comments: string
    ) => {
      const db = getDB();
      const now = new Date().toISOString();
      // Record the action
      await db.approvalActions.add({
        requestId,
        level: 0, // will be set below
        action,
        actionByUserId,
        actionByName,
        comments,
        actionAt: now,
        createdAt: now,
      });

      // Update request status
      const req = await db.approvalRequests.get(requestId);
      if (!req) return;

      let newStatus: ApprovalStatus = req.status;
      let newLevel = req.currentLevel;

      if (action === "approved") {
        if (req.currentLevel >= req.totalLevels) {
          newStatus = "approved";
        } else {
          newLevel = req.currentLevel + 1;
        }
      } else if (action === "rejected") {
        newStatus = "rejected";
      } else if (action === "returned") {
        newLevel = Math.max(1, req.currentLevel - 1);
      }

      // Update the action level
      const actions = await db.approvalActions.where("requestId").equals(requestId).toArray();
      const lastAction = actions[actions.length - 1];
      if (lastAction?.id) await db.approvalActions.update(lastAction.id, { level: req.currentLevel });

      await db.approvalRequests.update(requestId, {
        status: newStatus,
        currentLevel: newLevel,
        updatedAt: now,
        ...(action === "rejected" ? { rejectionReason: comments } : {}),
      });

      const [approvalRequests, approvalActions] = await Promise.all([
        db.approvalRequests.toArray(),
        db.approvalActions.toArray(),
      ]);
      set({ approvalRequests, approvalActions });
    },

    // ── RECURRING VOUCHER ACTIONS ────────────────────────────────────────────
    loadRecurringData: async () => {
      const db = getDB();
      const [recurringTemplates, recurringPostings] = await Promise.all([
        db.recurringTemplates.toArray(),
        db.recurringPostings.toArray(),
      ]);
      const parsed = recurringTemplates.map(t => ({
        ...t,
        lines: typeof t.lines === "string" ? JSON.parse(t.lines) : (t.lines || []),
      }));
      set({ recurringTemplates: parsed, recurringPostings });
    },

    addRecurringTemplate: async (t: Omit<DBRecurringTemplate, "id">) => {
      const db = getDB();
      const toStore = { ...t, lines: JSON.stringify(t.lines), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await db.recurringTemplates.add(toStore);
      const raw = await db.recurringTemplates.toArray();
      const recurringTemplates = raw.map(r => ({ ...r, lines: typeof r.lines === "string" ? JSON.parse(r.lines) : (r.lines || []) }));
      set({ recurringTemplates });
    },

    updateRecurringTemplate: async (id: number, changes: Partial<DBRecurringTemplate>) => {
      const db = getDB();
      const toStore: any = { ...changes, updatedAt: new Date().toISOString() };
      if (changes.lines) toStore.lines = JSON.stringify(changes.lines);
      await db.recurringTemplates.update(id, toStore);
      const raw = await db.recurringTemplates.toArray();
      const recurringTemplates = raw.map(r => ({ ...r, lines: typeof r.lines === "string" ? JSON.parse(r.lines) : (r.lines || []) }));
      set({ recurringTemplates });
    },

    deleteRecurringTemplate: async (id: number) => {
      const db = getDB();
      await db.recurringTemplates.delete(id);
      const raw = await db.recurringTemplates.toArray();
      const recurringTemplates = raw.map(r => ({ ...r, lines: typeof r.lines === "string" ? JSON.parse(r.lines) : (r.lines || []) }));
      set({ recurringTemplates });
    },

    postRecurringTemplate: async (templateId: number, postDate: string, notes = "") => {
      const db = getDB();
      const template = (await db.recurringTemplates.get(templateId)) as any;
      if (!template) return;
      const lines = typeof template.lines === "string" ? JSON.parse(template.lines) : (template.lines || []);

      // Compute next due date after posting
      const nextDue = computeNextDueDate(postDate, template.frequency);

      // Record posting
      await db.recurringPostings.add({
        templateId,
        templateName: template.name,
        postedDate: postDate,
        status: "posted",
        notes,
        createdAt: new Date().toISOString(),
      });

      // Update template
      await db.recurringTemplates.update(templateId, {
        lastPostedDate: postDate,
        nextDueDate: nextDue,
        postingCount: (template.postingCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      const [raw, recurringPostings] = await Promise.all([
        db.recurringTemplates.toArray(),
        db.recurringPostings.toArray(),
      ]);
      const recurringTemplates = raw.map(r => ({ ...r, lines: typeof r.lines === "string" ? JSON.parse(r.lines) : (r.lines || []) }));
      set({ recurringTemplates, recurringPostings });
    },

  };
});

// ─── Private helpers (not on store) ───────────────────────────────────────────
export async function generateNextVoucherNo(
  type: string,
  db: ReturnType<typeof getDB>,
): Promise<string> {
  const prefixes: Record<string, string> = {
    journal: "JV",
    payment: "PV",
    receipt: "RV",
    contra: "CV",
    "sales-invoice": "SI",
    "purchase-invoice": "PI",
    "sales-return": "SR",
    "purchase-return": "PR",
  };
  const prefix = prefixes[type] || "VCH";
  const count = await db.vouchers.where("type").equals(type).count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateNextInvoiceNo(
  type: string,
  db: ReturnType<typeof getDB>,
): Promise<string> {
  const prefixes: Record<string, string> = {
    "sales-invoice": "SI",
    "purchase-invoice": "PI",
    "sales-return": "SR",
    "purchase-return": "PR",
  };
  const prefix = prefixes[type] || "INV";
  const count = await db.invoices.where("type").equals(type).count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function reloadAccounts(db: ReturnType<typeof getDB>, set: any) {
  const accounts = await db.accounts.toArray();
  set({ accounts });
}

export async function postInvoiceJournal(
  invoice: any,
  db: ReturnType<typeof getDB>,
  get: any,
  set: any,
) {
  // Build journal lines for the invoice
  const lines: any[] = [];
  const partyAccountId =
    invoice.partyAccountId ||
    (invoice.type === "sales-invoice" || invoice.type === "sales-return"
      ? "acc-sundry-debtors"
      : "acc-sundry-creditors");

  const taxable = Number(invoice.taxableAmount || 0);
  const exempt = Number(invoice.exemptAmount || 0);
  const vat = Number(invoice.vatAmount || 0);
  const tds = Number(invoice.tdsAmount || 0);
  const grandTotal = Number(invoice.grandTotal || 0);

  if (invoice.type === "sales-invoice") {
    lines.push({
      accountId: partyAccountId,
      accountName: invoice.partyName,
      debit: grandTotal,
      credit: 0,
    });
    if (taxable > 0)
      lines.push({ accountId: "acc-sales", accountName: "Sales", debit: 0, credit: taxable });
    if (exempt > 0)
      lines.push({
        accountId: "acc-sales",
        accountName: "Sales (Exempt)",
        debit: 0,
        credit: exempt,
      });
    if (vat > 0)
      lines.push({
        accountId: "acc-vat-payable",
        accountName: "VAT Payable",
        debit: 0,
        credit: vat,
      });
  } else if (invoice.type === "purchase-invoice") {
    if (taxable > 0)
      lines.push({
        accountId: "acc-purchase",
        accountName: "Purchases",
        debit: taxable,
        credit: 0,
      });
    if (exempt > 0)
      lines.push({
        accountId: "acc-purchase",
        accountName: "Purchases (Exempt)",
        debit: exempt,
        credit: 0,
      });
    if (vat > 0)
      lines.push({
        accountId: "acc-vat-payable",
        accountName: "VAT Receivable",
        debit: vat,
        credit: 0,
      });
    lines.push({
      accountId: partyAccountId,
      accountName: invoice.partyName,
      debit: 0,
      credit: grandTotal,
    });
  }

  if (lines.length === 0) return;

  validateVoucherBalance(lines);

  const id = `jnl-${invoice.id}`;
  const voucherNo = `AUTO-${invoice.invoiceNo}`;
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  await db.vouchers.add({
    id,
    voucherNo,
    date: invoice.date,
    dateNepali: invoice.dateNepali,
    type: "journal",
    narration: `Auto-journal for ${invoice.invoiceNo}`,
    lines,
    status: "posted",
    totalDebit,
    totalCredit,
    grandTotal: totalDebit,
  } as any);

  // Update account balances
  for (const line of lines) {
    if (line.accountId) {
      const acc = await db.accounts.get(line.accountId);
      if (acc) {
        await db.accounts.update(line.accountId, {
          balance: (acc.balance || 0) + (line.debit || 0) - (line.credit || 0),
        });
      }
    }
  }
}

export async function postInvoiceStock(
  invoice: any,
  db: ReturnType<typeof getDB>,
  get: any,
  set: any,
) {
  const lines = invoice.lines || [];
  const warehouseId = get().warehouses.find((w: any) => w.isDefault)?.id || "wh-main";
  const warehouseName = get().warehouses.find((w: any) => w.isDefault)?.name || "Main Warehouse";

  for (const line of lines) {
    if (!line.itemId) continue;
    const item = get().items.find((i: any) => i.id === line.itemId);
    if (!item || item.type === "service") continue;

    const qty =
      invoice.type === "sales-invoice" || invoice.type === "purchase-return"
        ? -(line.qty || 0)
        : line.qty || 0;

    const movId = `mov-${invoice.id}-${line.itemId}`;
    const movement = {
      id: movId,
      date: invoice.date,
      dateNepali: invoice.dateNepali || "",
      type: invoice.type,
      itemId: line.itemId,
      itemName: line.itemName || item.name,
      warehouseId: line.warehouseId || warehouseId,
      warehouseName,
      qty,
      rate: line.rate || 0,
      amount: (line.qty || 0) * (line.rate || 0),
      referenceId: invoice.id,
      referenceNo: invoice.invoiceNo,
      referenceType: invoice.type,
      narration: `Stock movement for ${invoice.invoiceNo}`,
    };
    await db.stockMovements.put(movement as any);
  }
  const updatedMovements = await db.stockMovements.toArray();
  set({ stockMovements: updatedMovements });
}
