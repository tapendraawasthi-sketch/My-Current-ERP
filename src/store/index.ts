import { create } from "zustand";
import { AppState, DEFAULT_ACCOUNTS, DEFAULT_WAREHOUSES, DEFAULT_UNITS, DEFAULT_FISCAL_YEAR, DEFAULT_CURRENCY, DEFAULT_SHORTCUTS, DEFAULT_TDS_RATES, StoreUser, CompanySettings, FiscalYear, hashPassword, verifyPassword, Notification, validateVoucherBalance } from "./store.types";

import { createAccountSlice } from "./slices/accountSlice";
import { createInventorySlice } from "./slices/inventorySlice";
import { createVoucherSlice } from "./slices/voucherSlice";
import { createSettingsSlice } from "./slices/settingsSlice";

// Re-export all types and helpers so external files don't break
export * from "./store.types";

import { getDB, generateId } from "../lib/db";
import { startCbmsQueueWorker } from "../lib/cbmsService";
import { migrateWorkflowFields } from "../lib/workflowMigration";

export const useStore = create<AppState>()((...a) => {
  const [set, get] = a;
  return {
  isDbReady: false,
  isAuthenticated: false,
  currentUser: null,
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
  salesPersons: [],
  loadWarehouses: async () => {},
  addWarehouse: async (w) => (w as any),
  updateWarehouse: async () => {},
  getNextTransferNo: async () => "",
  saveStockTransfer: async (t) => (t as any),
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
  employees: [],
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
  ePaymentBatches: [],
  paymentAdvices: [],

  branches: [],
  salespersons: [],
  exchangeRates: [],
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
    set({ isInitializing: true });

    try {
      startCbmsQueueWorker();
      const db = getDB();

    // Seed default data if empty
    const accountCount = await db.accounts.count();
    if (accountCount === 0) {
      try {
        const { seedNepalNASChartOfAccounts } = await import("../lib/seeders/nepalNasCoaSeeder");
        await seedNepalNASChartOfAccounts(db as any);
      } catch (err) {
        console.error("Error seeding Nepal NAS Chart of Accounts:", err);
        await db.accounts.bulkAdd(DEFAULT_ACCOUNTS as any); // Fallback
      }
    }

    const warehouseCount = await db.warehouses.count();
    if (warehouseCount === 0) {
      await db.warehouses.bulkAdd(DEFAULT_WAREHOUSES as any);
    }

    const unitCount = await db.units.count();
    if (unitCount === 0) {
      await db.units.bulkAdd(DEFAULT_UNITS as any);
    }

    const fyCount = await db.fiscalYears.count();
    if (fyCount === 0) {
      await db.fiscalYears.add(DEFAULT_FISCAL_YEAR as any);
    }

    const currencyCount = await db.currencies.count();
    if (currencyCount === 0) {
      await db.currencies.add(DEFAULT_CURRENCY as any);
    }

    const settingsCount = await db.companySettings.count();
    if (settingsCount === 0) {
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
    }

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
      // Repair any legacy hash format and ensure admin always exists
      try {
        const adminUser = await db.users.where("username").equals("admin").first() as any;
        if (!adminUser) {
          // Admin user missing — re-seed it
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
          (!adminUser.passwordHash?.startsWith("pbkdf2v2_") && !adminUser.passwordHash?.startsWith("sha256v1_"))
        ) {
          // Upgrade legacy hash (fallback_ or old PBKDF2 v1 64-char hex)
          await db.users.update(adminUser.id, { passwordHash: await hashPassword("admin123") });
        }
      } catch { /* non-critical */ }
    }

    const shortcutCount = await db.shortcuts.count();
    if (shortcutCount === 0) {
      await db.shortcuts.bulkAdd(DEFAULT_SHORTCUTS as any);
    }

    await migrateWorkflowFields();

    // Load all data
    const [ accounts, parties, items, vouchers, invoices, stockMovements,
      warehouses, units, costCenters, fiscalYears, deliveryChallans,
      goodsReceiptNotes, salesOrders, purchaseOrders, users, notifications,
      budgets, recurringVouchers, customFieldDefs, currencies,
      settingsArr,
      unitConversions, standardNarrations, billSundryMasters,
      saleTypes, purchaseTypes, taxCategories, discountStructures, itemGroups, holidays,
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
      // Banking module data
      chequeBooks, cheques, depositSlips, pdCheques, ePaymentBatches, paymentAdvices,
      // Version 13
      branches, salesPersons, exchangeRates, followUpNotes, jobWorkOrders, reportSchedules, priceFloorPolicies, chequeBounceLogs,
    ] = await Promise.all([
      db.accounts.toArray(),
      db.parties.toArray(),
      db.items.toArray(),
      db.vouchers.orderBy("date").reverse().toArray(),
      db.invoices.orderBy("date").reverse().toArray(),
      db.stockMovements.toArray(),
      db.warehouses.toArray(),
      db.units.toArray(),
      db.costCenters.toArray(),
      db.fiscalYears.toArray(),
      db.deliveryChallans.toArray(),
      db.goodsReceiptNotes.toArray(),
      db.salesOrders.toArray(),
      db.purchaseOrders.toArray(),
      db.users.toArray(),
      db.notifications.orderBy("createdAt").reverse().limit(50).toArray(),
      db.budgets.toArray(),
      db.recurringVouchers.toArray(),
      db.customFieldDefs.toArray(),
      db.currencies.toArray(),
      db.companySettings.toArray(),
      db.unitConversions.toArray(),
      db.standardNarrations.toArray(),
      db.billSundryMasters.toArray(),
      db.saleTypes.toArray(),
      db.purchaseTypes.toArray(),
      db.taxCategories.toArray(),
      db.discountStructures.toArray(),
      db.itemGroups.toArray(),
      db.holidays.toArray(),
      db.employees.toArray(),
      db.bankStatements.toArray(),
      db.tdsEntries.toArray(),
      db.tdsChallans.toArray(),
      db.stockJournals.toArray(),
      db.productions.toArray(),
      db.unassembles.toArray(),
      db.materialIssued.toArray(),
      db.materialReceived.toArray(),
      db.physicalStocks.toArray(),
      db.stockCategories.toArray(),
      db.voucherTypeMasters.toArray(),
      db.scenarios.toArray(),
      db.costCategories.toArray(),
      db.costCentreClasses.toArray(),
      db.reorderLevels.toArray(),
      db.priceLevels.toArray(),
      db.priceLists.toArray(),
      db.hsCodes.toArray(),
      db.batches.toArray(),
      db.vatClassifications.toArray(),
      db.tdsNatureOfPayment.toArray(),
      db.employeeGroups.toArray(),
      db.payHeads.toArray(),
      db.salaryDetails.toArray(),
      db.payrollUnits.toArray(),
      db.attendanceTypes.toArray(),
      db.ledgerExtensions.toArray(),
      // Banking module data
      db.chequeBooks.toArray(),
      db.cheques.toArray(),
      db.depositSlips.toArray(),
      db.pdCheques.toArray(),
      db.ePaymentBatches.toArray(),
      db.paymentAdvices.toArray(),
      db.branches.toArray().catch(() => []),
      db.salesPersons.toArray().catch(() => []),
      db.exchangeRates.toArray().catch(() => []),
      db.followUpNotes.toArray().catch(() => []),
      db.jobWorkOrders.toArray().catch(() => []),
      db.reportSchedules.toArray().catch(() => []),
      db.priceFloorPolicies.toArray().catch(() => []),
      db.chequeBounceLogs.toArray().catch(() => []),
    ]);

    const currentFiscalYear = (fiscalYears.find((fy: any) => fy.isCurrent || fy.isDefault) || fiscalYears[0]) as unknown as FiscalYear | undefined;

    // Compute account balances from voucher lines
    const balanceMap: Record<string, number> = {};
    for (const v of vouchers) {
      if (v.status === "posted" && v.lines) {
        for (const l of v.lines) {
          if (l.accountId) {
            balanceMap[l.accountId] = (balanceMap[l.accountId] || 0) + (l.debit || 0) - (l.credit || 0);
          }
        }
      }
    }

    const accountsWithBalance = accounts.map((a) => ({
      ...a,
      balance: (balanceMap[a.id] || 0) + (a.openingBalanceDr || 0) - (a.openingBalanceCr || 0),
    }));

    // Check session
    const sessionUserId = sessionStorage.getItem("sutra_user_id");
    let sessionUser: StoreUser | null = null;
    if (sessionUserId) {
      sessionUser = (users.find((u) => u.id === sessionUserId) as StoreUser) || null;
    }

    set({
      isDbReady: true,
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
      isAuthenticated: !!sessionUser,
      currentUser: sessionUser,
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
      // Banking module data
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
      
      journalEntries: vouchers, // vouchers array serves as journal entries for reconciliation
    });

    // Stock reorder notifications
    const updatedItems = items;
    for (const item of updatedItems) {
      if (item.reorderLevel) {
        const movements = stockMovements.filter((m) => m.itemId === item.id);
        const totalIn = movements.reduce((s: number, m: any) => s + (m.qty > 0 ? m.qty : 0), 0);
        const totalOut = movements.reduce((s: number, m: any) => s + (m.qty < 0 ? Math.abs(m.qty) : 0), 0);
        const stock = (item.openingStock || 0) + totalIn - totalOut;
        if (stock <= item.reorderLevel) {
          const existingNote = notifications.find(
            (n: any) => n.message && n.message.includes(item.name) && !n.read
          );
          if (!existingNote) {
            get().addNotification(
              `Low stock alert: ${item.name} (${stock} ${item.unit || "units"} remaining, reorder at ${item.reorderLevel})`,
              "warning"
            );
          }
        }
      }
    }

    await get().loadVoucherTypeMasters();
    try { await get().loadSalesPersons(); } catch (e) { console.warn("loadSalesPersons skipped:", e); }
    try { await get().loadPriceLists();   } catch (e) { console.warn("loadPriceLists skipped:",   e); }
    } catch (err) {
      console.error("initializeApp failed:", err);
    } finally {
      set({ isInitializing: false, isDbReady: true });
    }
  },

  login: async (username: string, password: string): Promise<boolean> => {
    const db = getDB();
    const user = await db.users.where("username").equals(username.trim()).first() as any;
    if (!user) return false;
    if (!user.isActive) return false;
    const storedHash: string = user.passwordHash || "";
    // verifyPassword is the single source of truth for all hash variants:
    // empty hash, fallback_ (HTTP env), plain-text legacy, PBKDF2
    const valid = await verifyPassword(password, storedHash);
    if (!valid) return false;
    // Upgrade hash to real PBKDF2 whenever crypto.subtle is now available
    // Covers: fallback_ (HTTP→HTTPS migration) and missing/empty hashes
    const needsUpgrade = !storedHash || storedHash.startsWith("fallback_");
    if (needsUpgrade && crypto?.subtle) {
      try { await db.users.update(user.id, { passwordHash: await hashPassword(password) }); } catch { /* ok */ }
    }
    sessionStorage.setItem("sutra_user_id", user.id);
    set({ isAuthenticated: true, currentUser: user as StoreUser, currentPage: "dashboard" });
    return true;
  },

  logout: () => {
    sessionStorage.removeItem("sutra_user_id");
    set({ isAuthenticated: false, currentUser: null, currentPage: "gateway" });
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
    set({ companySettings: settings as CompanySettings });
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
  };
});

// ─── Private helpers (not on store) ───────────────────────────────────────────
export async function generateNextVoucherNo(type: string, db: ReturnType<typeof getDB>): Promise<string> {
  const prefixes: Record<string, string> = {
    journal: "JV", payment: "PV", receipt: "RV", contra: "CV",
    "sales-invoice": "SI", "purchase-invoice": "PI",
    "sales-return": "SR", "purchase-return": "PR",
  };
  const prefix = prefixes[type] || "VCH";
  const count = await db.vouchers.where("type").equals(type).count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateNextInvoiceNo(type: string, db: ReturnType<typeof getDB>): Promise<string> {
  const prefixes: Record<string, string> = {
    "sales-invoice": "SI", "purchase-invoice": "PI",
    "sales-return": "SR", "purchase-return": "PR",
  };
  const prefix = prefixes[type] || "INV";
  const count = await db.invoices.where("type").equals(type).count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

export async function reloadAccounts(db: ReturnType<typeof getDB>, set: any) {
  const accounts = await db.accounts.toArray();
  set({ accounts });
}

export async function postInvoiceJournal(invoice: any, db: ReturnType<typeof getDB>, get: any, set: any) {
  // Build journal lines for the invoice
  const lines: any[] = [];
  const partyAccountId = invoice.partyAccountId || (invoice.type === "sales-invoice" || invoice.type === "sales-return"
    ? "acc-sundry-debtors"
    : "acc-sundry-creditors");

  const taxable = Number(invoice.taxableAmount || 0);
  const exempt = Number(invoice.exemptAmount || 0);
  const vat = Number(invoice.vatAmount || 0);
  const tds = Number(invoice.tdsAmount || 0);
  const grandTotal = Number(invoice.grandTotal || 0);

  if (invoice.type === "sales-invoice") {
    lines.push({ accountId: partyAccountId, accountName: invoice.partyName, debit: grandTotal, credit: 0 });
    if (taxable > 0) lines.push({ accountId: "acc-sales", accountName: "Sales", debit: 0, credit: taxable });
    if (exempt > 0) lines.push({ accountId: "acc-sales", accountName: "Sales (Exempt)", debit: 0, credit: exempt });
    if (vat > 0) lines.push({ accountId: "acc-vat-payable", accountName: "VAT Payable", debit: 0, credit: vat });
  } else if (invoice.type === "purchase-invoice") {
    if (taxable > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchases", debit: taxable, credit: 0 });
    if (exempt > 0) lines.push({ accountId: "acc-purchase", accountName: "Purchases (Exempt)", debit: exempt, credit: 0 });
    if (vat > 0) lines.push({ accountId: "acc-vat-payable", accountName: "VAT Receivable", debit: vat, credit: 0 });
    lines.push({ accountId: partyAccountId, accountName: invoice.partyName, debit: 0, credit: grandTotal });
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

export async function postInvoiceStock(invoice: any, db: ReturnType<typeof getDB>, get: any, set: any) {
  const lines = invoice.lines || [];
  const warehouseId = get().warehouses.find((w: any) => w.isDefault)?.id || "wh-main";
  const warehouseName = get().warehouses.find((w: any) => w.isDefault)?.name || "Main Warehouse";

  for (const line of lines) {
    if (!line.itemId) continue;
    const item = get().items.find((i: any) => i.id === line.itemId);
    if (!item || item.type === "service") continue;

    const qty = invoice.type === "sales-invoice" || invoice.type === "purchase-return"
      ? -(line.qty || 0)
      : (line.qty || 0);

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

