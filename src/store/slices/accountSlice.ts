import { DBSalesPerson, DBPriceList } from '../../lib/db';
import { StoreUser, CompanySettings, Notification, FiscalYear, DEFAULT_CURRENCY, DEFAULT_TDS_RATES, hashPassword, verifyPassword } from '../store.types';
import { StateCreator } from "zustand";
import type { AppState } from "../store.types";
import { getDB, generateId } from "../../lib/db";
import { generateNextNumber } from "../../lib/accounting";
import { startCbmsQueueWorker } from "../../lib/cbmsService";
import { validateVoucherBalance, assertDateInFiscalYear } from "../store.types";
import toast from "react-hot-toast";
import { migrateWorkflowFields } from "../../lib/workflowMigration";
import { createWorkflowActions } from "../workflowActions";


export const createAccountSlice: StateCreator<AppState, [], [], any> = (set, get) => ({
  // ── Accounts ──────────────────────────────────────────────────────────────
  addAccount: async (account) => {
    const db = getDB();
    // Bug 29 fix: prevent duplicate account names (case-insensitive)
    const existingAccounts = get().accounts;
    const nameLC = (account.name || '').toLowerCase().trim();
    if (nameLC && existingAccounts.some((a) => a.name?.toLowerCase().trim() === nameLC && !a.isGroup === !account.isGroup)) {
      throw new Error(`Account with name "${account.name}" already exists.`);
    }
    const id = account.id || `acc-${generateId()}`;
    const newAcc = { ...account, id, balance: 0, openingBalance: account.openingBalance || 0, openingBalanceDr: account.openingBalanceDr || 0, openingBalanceCr: account.openingBalanceCr || 0 };
    await db.accounts.add(newAcc as any);
    set((s) => ({ accounts: [...s.accounts, newAcc] }));
    return newAcc;
  },

  updateAccount: async (id, updates) => {
    const db = getDB();
    await db.accounts.update(id, updates);
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  },

  deleteAccount: async (id) => {
    const db = getDB();
    // Check no voucher lines use this account
    const voucherCount = await db.vouchers
      .filter((v) => v.lines?.some((l: any) => l.accountId === id))
      .count();
    if (voucherCount > 0) {
      throw new Error("Cannot delete: account has posted transactions.");
    }
    await db.accounts.delete(id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    return true;
  },

  // ── Parties ───────────────────────────────────────────────────────────────
  addParty: async (party) => {
    const db = getDB();
    const id = party.id || `party-${generateId()}`;
    const newParty = { ...party, id, balance: 0, isActive: party.isActive !== false };
    await db.parties.add(newParty as any);
    set((s) => ({ parties: [...s.parties, newParty] }));
    return newParty;
  },

  updateParty: async (id, updates) => {
    const db = getDB();
    await db.parties.update(id, updates);
    set((s) => ({
      parties: s.parties.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  },

  // ── Administration Module CRUD ─────────────────────────────────────────────

  // Unit Conversions
  addUnitConversion: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `uc-${generateId()}`, isActive: true };
    await db.unitConversions.add(record as any);
    set((s) => ({ unitConversions: [...s.unitConversions, record] }));
    return record;
  },
  updateUnitConversion: async (id, data) => {
    const db = getDB();
    await db.unitConversions.update(id, data);
    set((s) => ({ unitConversions: s.unitConversions.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteUnitConversion: async (id) => {
    const db = getDB();
    await db.unitConversions.delete(id);
    set((s) => ({ unitConversions: s.unitConversions.filter((r) => r.id !== id) }));
  },

  // Standard Narrations
  addStandardNarration: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `sn-${generateId()}`, isActive: true };
    await db.standardNarrations.add(record as any);
    set((s) => ({ standardNarrations: [...s.standardNarrations, record] }));
    return record;
  },
  updateStandardNarration: async (id, data) => {
    const db = getDB();
    await db.standardNarrations.update(id, data);
    set((s) => ({ standardNarrations: s.standardNarrations.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteStandardNarration: async (id) => {
    const db = getDB();
    await db.standardNarrations.delete(id);
    set((s) => ({ standardNarrations: s.standardNarrations.filter((r) => r.id !== id) }));
  },

  // Bill Sundry Masters
  addBillSundryMaster: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `bsm-${generateId()}`, isActive: true };
    await db.billSundryMasters.add(record as any);
    set((s) => ({ billSundryMasters: [...s.billSundryMasters, record] }));
    return record;
  },
  updateBillSundryMaster: async (id, data) => {
    const db = getDB();
    await db.billSundryMasters.update(id, data);
    set((s) => ({ billSundryMasters: s.billSundryMasters.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteBillSundryMaster: async (id) => {
    const db = getDB();
    await db.billSundryMasters.delete(id);
    set((s) => ({ billSundryMasters: s.billSundryMasters.filter((r) => r.id !== id) }));
  },

  // Sale Types
  addSaleType: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `st-${generateId()}`, isActive: true };
    await db.saleTypes.add(record as any);
    set((s) => ({ saleTypes: [...s.saleTypes, record] }));
    return record;
  },
  updateSaleType: async (id, data) => {
    const db = getDB();
    await db.saleTypes.update(id, data);
    set((s) => ({ saleTypes: s.saleTypes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteSaleType: async (id) => {
    const db = getDB();
    await db.saleTypes.delete(id);
    set((s) => ({ saleTypes: s.saleTypes.filter((r) => r.id !== id) }));
  },

  // Purchase Types
  addPurchaseType: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `pt-${generateId()}`, isActive: true };
    await db.purchaseTypes.add(record as any);
    set((s) => ({ purchaseTypes: [...s.purchaseTypes, record] }));
    return record;
  },
  updatePurchaseType: async (id, data) => {
    const db = getDB();
    await db.purchaseTypes.update(id, data);
    set((s) => ({ purchaseTypes: s.purchaseTypes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePurchaseType: async (id) => {
    const db = getDB();
    await db.purchaseTypes.delete(id);
    set((s) => ({ purchaseTypes: s.purchaseTypes.filter((r) => r.id !== id) }));
  },

  // Tax Categories
  addTaxCategory: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `tc-${generateId()}`, isActive: true };
    await db.taxCategories.add(record as any);
    set((s) => ({ taxCategories: [...s.taxCategories, record] }));
    return record;
  },
  updateTaxCategory: async (id, data) => {
    const db = getDB();
    await db.taxCategories.update(id, data);
    set((s) => ({ taxCategories: s.taxCategories.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteTaxCategory: async (id) => {
    const db = getDB();
    await db.taxCategories.delete(id);
    set((s) => ({ taxCategories: s.taxCategories.filter((r) => r.id !== id) }));
  },

  // Discount Structures
  addDiscountStructure: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ds-${generateId()}`, isActive: true };
    await db.discountStructures.add(record as any);
    set((s) => ({ discountStructures: [...s.discountStructures, record] }));
    return record;
  },
  updateDiscountStructure: async (id, data) => {
    const db = getDB();
    await db.discountStructures.update(id, data);
    set((s) => ({ discountStructures: s.discountStructures.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteDiscountStructure: async (id) => {
    const db = getDB();
    await db.discountStructures.delete(id);
    set((s) => ({ discountStructures: s.discountStructures.filter((r) => r.id !== id) }));
  },

  // Item Groups
  addItemGroup: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ig-${generateId()}`, isActive: true };
    await db.itemGroups.add(record as any);
    set((s) => ({ itemGroups: [...s.itemGroups, record] }));
    return record;
  },
  updateItemGroup: async (id, data) => {
    const db = getDB();
    await db.itemGroups.update(id, data);
    set((s) => ({ itemGroups: s.itemGroups.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteItemGroup: async (id) => {
    const db = getDB();
    await db.itemGroups.delete(id);
    set((s) => ({ itemGroups: s.itemGroups.filter((r) => r.id !== id) }));
  },

  // Holidays
  addHoliday: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `hol-${generateId()}`, isActive: true };
    await db.holidays.add(record as any);
    set((s) => ({ holidays: [...s.holidays, record] }));
    return record;
  },
  updateHoliday: async (id, data) => {
    const db = getDB();
    await db.holidays.update(id, data);
    set((s) => ({ holidays: s.holidays.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteHoliday: async (id) => {
    const db = getDB();
    await db.holidays.delete(id);
    set((s) => ({ holidays: s.holidays.filter((r) => r.id !== id) }));
  },

  // ── Masters Module v8 ────────────────────────────────────────────────────────
  // Stock Category
  addStockCategory: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `sc-${generateId()}`, isActive: true };
    await db.stockCategories.add(record as any);
    set((s) => ({ stockCategories: [...s.stockCategories, record] }));
    return record;
  },
  updateStockCategory: async (id, data) => {
    const db = getDB();
    await db.stockCategories.update(id, data);
    set((s) => ({ stockCategories: s.stockCategories.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteStockCategory: async (id) => {
    const db = getDB();
    await db.stockCategories.delete(id);
    set((s) => ({ stockCategories: s.stockCategories.filter((r) => r.id !== id) }));
  },

  // Voucher Type Master
  loadVoucherTypeMasters: async () => {
    try {
      const { seedPredefinedVoucherTypes, getDB } = await import("../../lib/db");
      await seedPredefinedVoucherTypes();
      
      const db = await getDB();
      const records = await db.voucherTypeMasters.toArray();
      
      // Sort: predefined types first, then user-defined, both sorted by name
      const sortedRecords = [...records].sort((a, b) => {
        if (a.isPredefined && !b.isPredefined) return -1;
        if (!a.isPredefined && b.isPredefined) return 1;
        return a.name.localeCompare(b.name);
      });
      
      set({ voucherTypeMasters: sortedRecords });
    } catch (error) {
      console.error("Error loading voucher type masters:", error);
    }
  },
  
  addVoucherTypeMaster: async (data: Partial<any>) => {
    if (!data.name) {
      throw new Error("Voucher type name is required");
    }
    
    if (!data.parentVoucherType) {
      throw new Error("Parent voucher type is required");
    }
    
    const state = get();
    const existingByName = state.voucherTypeMasters.find(
      vtm => vtm.name.toLowerCase() === data.name?.toLowerCase()
    );
    
    if (existingByName) {
      throw new Error(`Voucher type with name "${data.name}" already exists`);
    }
    
    const { getDB } = await import("../../lib/db");
    const db = await getDB();
    
    const newRecord: any = {
      ...data,
      id: `vtm-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    
    await db.voucherTypeMasters.add(newRecord);
    await get().loadVoucherTypeMasters();
    
    return newRecord;
  },
  
  updateVoucherTypeMaster: async (id: string, data: Partial<any>) => {
    const state = get();
    const existing = state.voucherTypeMasters.find(vtm => vtm.id === id);
    
    if (!existing) {
      throw new Error("Voucher type master not found");
    }
    
    const { getDB } = await import("../../lib/db");
    const db = await getDB();
    
    let updateData = { ...data };
    
    if (existing.isPredefined) {
      // For predefined types, only allow specific fields to be updated
      const allowedFields = [
        "isActive", 
        "printAfterSaving", 
        "useForPOS", 
        "defaultPrintTitle", 
        "defaultBankLedgerId", 
        "defaultJurisdiction", 
        "declarationText", 
        "allowCommonNarration", 
        "allowLedgerNarration", 
        "whatsAppAfterSaving"
      ];
      
      const filteredUpdateData: Partial<any> = {};
      allowedFields.forEach(field => {
        if (field in updateData) {
          filteredUpdateData[field] = updateData[field];
        }
      });
      
      updateData = filteredUpdateData;
    }
    
    const recordToUpdate = {
      ...existing,
      ...updateData,
      modifiedAt: new Date().toISOString(),
    };
    
    await db.voucherTypeMasters.update(id, recordToUpdate);
    await get().loadVoucherTypeMasters();
  },
  
  deleteVoucherTypeMaster: async (id: string) => {
    const state = get();
    const record = state.voucherTypeMasters.find(vtm => vtm.id === id);
    
    if (!record) {
      throw new Error("Voucher type master not found");
    }
    
    if (record.isPredefined) {
      throw new Error("Cannot delete predefined voucher types");
    }
    
    const { getDB } = await import("../../lib/db");
    const db = await getDB();
    
    // Check if any vouchers use this voucher type
    const voucherCount = await db.vouchers.where({ voucherTypeId: id }).count();
    if (voucherCount > 0) {
      throw new Error("Cannot delete: vouchers exist using this type");
    }
    
    await db.voucherTypeMasters.delete(id);
    await get().loadVoucherTypeMasters();
  },
  
  addVoucherAuditLog: async (log: Omit<any, "id">) => {
    const { getDB } = await import("../../lib/db");
    const db = await getDB();
    
    const newLog: any = {
      ...log,
      id: `al-${crypto.randomUUID()}`,
    };
    
    await db.voucherAuditLogs.add(newLog);
    
    const currentState = get();
    const updatedLogs = [...currentState.voucherAuditLogs, newLog];
    
    // Keep only the last 1000 logs in memory
    if (updatedLogs.length > 1000) {
      updatedLogs.splice(0, updatedLogs.length - 1000);
    }
    
    set({ voucherAuditLogs: updatedLogs });
  },
  
  loadVoucherAuditLogs: async (voucherId?: string) => {
    const { getDB } = await import("../../lib/db");
    const db = await getDB();
    
    let logs: any[];
    
    if (voucherId) {
      logs = await db.voucherAuditLogs.where({ voucherId }).sortBy("timestamp");
      logs.reverse(); // Sort descending by timestamp
    } else {
      logs = await db.voucherAuditLogs.orderBy("timestamp").reverse().limit(200).toArray();
    }
    
    set({ voucherAuditLogs: logs });
  },

  // Scenario
  addScenario: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `scen-${generateId()}`, isActive: true };
    await db.scenarios.add(record as any);
    set((s) => ({ scenarios: [...s.scenarios, record] }));
    return record;
  },
  updateScenario: async (id, data) => {
    const db = getDB();
    await db.scenarios.update(id, data);
    set((s) => ({ scenarios: s.scenarios.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteScenario: async (id) => {
    const db = getDB();
    await db.scenarios.delete(id);
    set((s) => ({ scenarios: s.scenarios.filter((r) => r.id !== id) }));
  },

  // Cost Category
  addCostCategory: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `cc-${generateId()}`, isActive: true };
    await db.costCategories.add(record as any);
    set((s) => ({ costCategories: [...s.costCategories, record] }));
    return record;
  },
  updateCostCategory: async (id, data) => {
    const db = getDB();
    await db.costCategories.update(id, data);
    set((s) => ({ costCategories: s.costCategories.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteCostCategory: async (id) => {
    const db = getDB();
    await db.costCategories.delete(id);
    set((s) => ({ costCategories: s.costCategories.filter((r) => r.id !== id) }));
  },

  // Cost Centre Class
  addCostCentreClass: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ccc-${generateId()}`, isActive: true };
    await db.costCentreClasses.add(record as any);
    set((s) => ({ costCentreClasses: [...s.costCentreClasses, record] }));
    return record;
  },
  updateCostCentreClass: async (id, data) => {
    const db = getDB();
    await db.costCentreClasses.update(id, data);
    set((s) => ({ costCentreClasses: s.costCentreClasses.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteCostCentreClass: async (id) => {
    const db = getDB();
    await db.costCentreClasses.delete(id);
    set((s) => ({ costCentreClasses: s.costCentreClasses.filter((r) => r.id !== id) }));
  },

  // Reorder Level
  addReorderLevel: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `rl-${generateId()}`, isActive: true };
    await db.reorderLevels.add(record as any);
    set((s) => ({ reorderLevels: [...s.reorderLevels, record] }));
    return record;
  },
  updateReorderLevel: async (id, data) => {
    const db = getDB();
    await db.reorderLevels.update(id, data);
    set((s) => ({ reorderLevels: s.reorderLevels.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteReorderLevel: async (id) => {
    const db = getDB();
    await db.reorderLevels.delete(id);
    set((s) => ({ reorderLevels: s.reorderLevels.filter((r) => r.id !== id) }));
  },

  // Price Level
  addPriceLevel: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `pl-${generateId()}`, isActive: true };
    await db.priceLevels.add(record as any);
    set((s) => ({ priceLevels: [...s.priceLevels, record] }));
    return record;
  },
  updatePriceLevel: async (id, data) => {
    const db = getDB();
    await db.priceLevels.update(id, data);
    set((s) => ({ priceLevels: s.priceLevels.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePriceLevel: async (id) => {
    const db = getDB();
    await db.priceLevels.delete(id);
    set((s) => ({ priceLevels: s.priceLevels.filter((r) => r.id !== id) }));
  },

  // ─── Sales Persons ────────────────────────────────────────────────────────────
  loadSalesPersons: async () => {
    try {
      const db = getDB();
      const rows = await db.salesPersons.toArray();
      set({ salesPersons: rows as DBSalesPerson[] });
    } catch (e) {
      console.error("loadSalesPersons:", e);
    }
  },
  addSalesPerson: async (data) => {
    try {
      const db = getDB();
      const record: DBSalesPerson = { ...data, id: (data as any).id || generateId() } as DBSalesPerson;
      await db.salesPersons.add(record as any);
      set((state) => ({ salesPersons: [...state.salesPersons, record] }));
    } catch (e) {
      console.error("addSalesPerson:", e);
      throw e;
    }
  },
  updateSalesPerson: async (data) => {
    try {
      const db = getDB();
      await db.salesPersons.put(data as any);
      set((state) => ({
        salesPersons: state.salesPersons.map((sp) =>
          sp.id === data.id ? data : sp
        ),
      }));
    } catch (e) {
      console.error("updateSalesPerson:", e);
      throw e;
    }
  },
  deleteSalesPerson: async (id) => {
    try {
      const db = getDB();
      await db.salesPersons.delete(id);
      set((state) => ({
        salesPersons: state.salesPersons.filter((sp) => sp.id !== id),
      }));
    } catch (e) {
      console.error("deleteSalesPerson:", e);
      throw e;
    }
  },

  // ─── Price Lists ──────────────────────────────────────────────────────────────
  loadPriceLists: async () => {
    try {
      const db = getDB();
      const rows = await db.priceLists.toArray();
      set({ priceLists: rows as DBPriceList[] });
    } catch (e) {
      console.error("loadPriceLists:", e);
    }
  },
  addPriceList: async (data) => {
    try {
      const db = getDB();
      const record: DBPriceList = { ...data, id: (data as any).id || generateId() } as DBPriceList;
      await db.priceLists.add(record as any);
      set((state) => ({ priceLists: [...state.priceLists, record] }));
    } catch (e) {
      console.error("addPriceList:", e);
      throw e;
    }
  },
  updatePriceList: async (data) => {
    try {
      const db = getDB();
      await db.priceLists.put(data as any);
      set((state) => ({
        priceLists: state.priceLists.map((pl) =>
          pl.id === data.id ? data : pl
        ),
      }));
    } catch (e) {
      console.error("updatePriceList:", e);
      throw e;
    }
  },
  deletePriceList: async (id) => {
    try {
      const db = getDB();
      await db.priceLists.delete(id);
      set((state) => ({
        priceLists: state.priceLists.filter((pl) => pl.id !== id),
      }));
    } catch (e) {
      console.error("deletePriceList:", e);
      throw e;
    }
  },

  // HS Code
  addHSCode: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `hsc-${generateId()}`, isActive: true };
    await db.hsCodes.add(record as any);
    set((s) => ({ hsCodes: [...s.hsCodes, record] }));
    return record;
  },
  updateHSCode: async (id, data) => {
    const db = getDB();
    await db.hsCodes.update(id, data);
    set((s) => ({ hsCodes: s.hsCodes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteHSCode: async (id) => {
    const db = getDB();
    await db.hsCodes.delete(id);
    set((s) => ({ hsCodes: s.hsCodes.filter((r) => r.id !== id) }));
  },

  // Batch
  addBatch: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `bat-${generateId()}`, isActive: true };
    await db.batches.add(record as any);
    set((s) => ({ batches: [...s.batches, record] }));
    return record;
  },
  updateBatch: async (id, data) => {
    const db = getDB();
    await db.batches.update(id, data);
    set((s) => ({ batches: s.batches.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteBatch: async (id) => {
    const db = getDB();
    await db.batches.delete(id);
    set((s) => ({ batches: s.batches.filter((r) => r.id !== id) }));
  },

  // VAT Classification
  addVATClassification: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `vc-${generateId()}`, isActive: true };
    await db.vatClassifications.add(record as any);
    set((s) => ({ vatClassifications: [...s.vatClassifications, record] }));
    return record;
  },
  updateVATClassification: async (id, data) => {
    const db = getDB();
    await db.vatClassifications.update(id, data);
    set((s) => ({ vatClassifications: s.vatClassifications.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteVATClassification: async (id) => {
    const db = getDB();
    await db.vatClassifications.delete(id);
    set((s) => ({ vatClassifications: s.vatClassifications.filter((r) => r.id !== id) }));
  },

  // TDS Nature of Payment
  addTDSNatureOfPayment: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `tds-${generateId()}`, isActive: true };
    await db.tdsNatureOfPayment.add(record as any);
    set((s) => ({ tdsNatureOfPayment: [...s.tdsNatureOfPayment, record] }));
    return record;
  },
  updateTDSNatureOfPayment: async (id, data) => {
    const db = getDB();
    await db.tdsNatureOfPayment.update(id, data);
    set((s) => ({ tdsNatureOfPayment: s.tdsNatureOfPayment.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteTDSNatureOfPayment: async (id) => {
    const db = getDB();
    await db.tdsNatureOfPayment.delete(id);
    set((s) => ({ tdsNatureOfPayment: s.tdsNatureOfPayment.filter((r) => r.id !== id) }));
  },

  // Employee Group
  addEmployeeGroup: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `eg-${generateId()}`, isActive: true };
    await db.employeeGroups.add(record as any);
    set((s) => ({ employeeGroups: [...s.employeeGroups, record] }));
    return record;
  },
  updateEmployeeGroup: async (id, data) => {
    const db = getDB();
    await db.employeeGroups.update(id, data);
    set((s) => ({ employeeGroups: s.employeeGroups.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteEmployeeGroup: async (id) => {
    const db = getDB();
    await db.employeeGroups.delete(id);
    set((s) => ({ employeeGroups: s.employeeGroups.filter((r) => r.id !== id) }));
  },

  // Pay Head
  addPayHead: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `ph-${generateId()}`, isActive: true };
    await db.payHeads.add(record as any);
    set((s) => ({ payHeads: [...s.payHeads, record] }));
    return record;
  },
  updatePayHead: async (id, data) => {
    const db = getDB();
    await db.payHeads.update(id, data);
    set((s) => ({ payHeads: s.payHeads.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePayHead: async (id) => {
    const db = getDB();
    await db.payHeads.delete(id);
    set((s) => ({ payHeads: s.payHeads.filter((r) => r.id !== id) }));
  },

  // Salary Detail
  addSalaryDetail: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `sd-${generateId()}`, isActive: true };
    await db.salaryDetails.add(record as any);
    set((s) => ({ salaryDetails: [...s.salaryDetails, record] }));
    return record;
  },
  updateSalaryDetail: async (id, data) => {
    const db = getDB();
    await db.salaryDetails.update(id, data);
    set((s) => ({ salaryDetails: s.salaryDetails.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteSalaryDetail: async (id) => {
    const db = getDB();
    await db.salaryDetails.delete(id);
    set((s) => ({ salaryDetails: s.salaryDetails.filter((r) => r.id !== id) }));
  },

  // Payroll Unit
  addPayrollUnit: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `pu-${generateId()}`, isActive: true };
    await db.payrollUnits.add(record as any);
    set((s) => ({ payrollUnits: [...s.payrollUnits, record] }));
    return record;
  },
  updatePayrollUnit: async (id, data) => {
    const db = getDB();
    await db.payrollUnits.update(id, data);
    set((s) => ({ payrollUnits: s.payrollUnits.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deletePayrollUnit: async (id) => {
    const db = getDB();
    await db.payrollUnits.delete(id);
    set((s) => ({ payrollUnits: s.payrollUnits.filter((r) => r.id !== id) }));
  },

  // Attendance Type
  addAttendanceType: async (data) => {
    const db = getDB();
    const record = { ...data, id: data.id || `at-${generateId()}`, isActive: true };
    await db.attendanceTypes.add(record as any);
    set((s) => ({ attendanceTypes: [...s.attendanceTypes, record] }));
    return record;
  },
  updateAttendanceType: async (id, data) => {
    const db = getDB();
    await db.attendanceTypes.update(id, data);
    set((s) => ({ attendanceTypes: s.attendanceTypes.map((r) => (r.id === id ? { ...r, ...data } : r)) }));
  },
  deleteAttendanceType: async (id) => {
    const db = getDB();
    await db.attendanceTypes.delete(id);
    set((s) => ({ attendanceTypes: s.attendanceTypes.filter((r) => r.id !== id) }));
  },

  // Ledger Extension
  upsertLedgerExtension: async (id, data) => {
    const db = getDB();
    const existing = await db.ledgerExtensions.get(id);
    if (existing) {
      await db.ledgerExtensions.update(id, data);
    } else {
      await db.ledgerExtensions.add({ id, ...data } as any);
    }
    set((s) => {
      const exists = s.ledgerExtensions.find((e: any) => e.id === id);
      if (exists) {
        return { ledgerExtensions: s.ledgerExtensions.map((e: any) => e.id === id ? { ...e, ...data } : e) };
      }
      return { ledgerExtensions: [...s.ledgerExtensions, { id, ...data }] };
    });
  },
  getLedgerExtension: async (id) => {
    const db = getDB();
    return await db.ledgerExtensions.get(id);
  },

  // ── TDS ──────────────────────────────────────────────────────────────────────
  addTdsEntry: async (entry) => {
    const db = getDB();
    const id = entry.id || generateId();
    const record = { ...entry, id };
    await db.tdsEntries.add(record as any);
    set((s) => ({ tdsEntries: [record, ...s.tdsEntries] }));
    return record;
  },

  updateTdsEntry: async (id, updates) => {
    const db = getDB();
    await db.tdsEntries.update(id, updates);
    set((s) => ({
      tdsEntries: s.tdsEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  },

  addTdsChallan: async (challan) => {
    const db = getDB();
    const id = challan.id || crypto.randomUUID();
    const newChallan = { ...challan, id };
    await db.tdsChallans.add(newChallan);
    set((s) => ({ tdsChallans: [...s.tdsChallans, newChallan] }));
  },
});
