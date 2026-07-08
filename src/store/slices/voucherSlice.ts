import {
  generateNextVoucherNo,
  reloadAccounts,
  generateNextInvoiceNo,
  postInvoiceJournal,
  postInvoiceStock,
  repostInvoiceJournalAndStock,
} from "../index";
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
import toast from "react-hot-toast";
import { migrateWorkflowFields } from "../../lib/workflowMigration";
import { createWorkflowActions } from "../workflowActions";
import { mergeSystemConfiguration } from "../../lib/systemConfiguration";

/** Checks IndexedDB periodLocks table and throws if the given date is locked. */
async function enforceperiodLock(date: string, db: ReturnType<typeof getDB>): Promise<void> {
  if (!db.tables.some((t) => t.name === "periodLocks")) return;
  const d = new Date(date);
  const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
  const locks: any[] = await db.table("periodLocks").toArray();
  if (locks.some((l: any) => l.periodKey === key)) {
    throw new Error(`Period is locked for date ${date}. Unlock the period before posting.`);
  }
}

/** Same guards as addVoucher for any path that posts journal lines. */
function guardPostedVoucher(
  voucher: { date?: string; lines?: Array<{ debit?: number; credit?: number }> },
  get: () => AppState,
  isDraft: boolean,
): { totalDebit: number; totalCredit: number } {
  const { currentFiscalYear } = get();
  if (voucher.date) assertDateInFiscalYear(voucher.date, currentFiscalYear);
  return validateVoucherBalance(voucher.lines || [], isDraft);
}

export const createVoucherSlice: StateCreator<AppState, [], [], any> = (set, get) => ({
  // ── Vouchers ─────────────────────────────────────────────────────────────
  addVoucher: async (voucher) => {
    const db = getDB();
    const { currentFiscalYear, companySettings } = get();
    assertDateInFiscalYear(voucher.date, currentFiscalYear);

    const maxLines = mergeSystemConfiguration(
      companySettings?.systemConfiguration,
    ).maxVoucherEntries;
    const lineCount = Math.max(
      voucher.lines?.length ?? 0,
      (voucher as { itemLines?: unknown[] }).itemLines?.length ?? 0,
    );
    if (lineCount > maxLines) {
      throw new Error(`Voucher exceeds maximum of ${maxLines} line items (System Configuration)`);
    }

    // Enforce period lock for posted vouchers.
    if ((voucher.status || "draft") === "posted") {
      await enforceperiodLock(voucher.date, db);
    }

    const isDraft = (voucher.status || "draft") === "draft";
    const { totalDebit, totalCredit } = validateVoucherBalance(voucher.lines, isDraft);

    const id = generateId();
    const type = voucher.type || "journal";

    return db.transaction("rw", [db.vouchers, db.accounts, db.auditLogs], async () => {
      const voucherNo =
        typeof voucher.voucherNo === "string" && voucher.voucherNo.trim()
          ? voucher.voucherNo.trim()
          : await generateNextVoucherNo(type, db);

      const newVoucher = {
        status: voucher.status || "draft",
        lines: voucher.lines || [],
        ...voucher,
        id,
        voucherNo,
        totalDebit,
        totalCredit,
        grandTotal: totalDebit,
      };

      await db.vouchers.add(newVoucher as any);

      if ((newVoucher as any).status === "posted" && (newVoucher as any).lines) {
        for (const line of (newVoucher as any).lines) {
          if (line.accountId) {
            const acc = await db.accounts.get(line.accountId);
            if (acc) {
              const newBal =
                Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) /
                100;
              await db.accounts.update(line.accountId, { balance: newBal });
            }
          }
        }
      }

      await reloadAccounts(db, set);

      // Audit log for every posted voucher.
      if ((newVoucher as any).status === "posted") {
        try {
          const user = get().currentUser;
          await db.auditLogs.add({
            id: generateId(),
            timestamp: new Date().toISOString(),
            userId: user?.id || "system",
            userName: user?.name || "system",
            action: "VOUCHER_POSTED",
            module: "vouchers",
            recordId: id,
            recordType: (newVoucher as any).type || "journal",
            after: { voucherNo: (newVoucher as any).voucherNo, totalDebit, totalCredit },
          });
        } catch {
          /* audit failure must never block a voucher post */
        }
      }

      set((s) => ({ vouchers: [newVoucher, ...s.vouchers] }));
      return newVoucher;
    });
  },

  updateVoucher: async (id, updates) => {
    const db = getDB();
    return db.transaction("rw", [db.vouchers, db.accounts, db.auditLogs], async () => {
      const original = await db.vouchers.get(id);

      // 1. Reverse impact of the original posted voucher on account balances.
      if (original && original.status === "posted") {
        for (const line of original.lines || []) {
          if (line.accountId) {
            const acc = await db.accounts.get(line.accountId);
            if (acc) {
              const reversed =
                Math.round(((acc.balance || 0) - (line.debit || 0) + (line.credit || 0)) * 100) /
                100;
              await db.accounts.update(line.accountId, { balance: reversed });
            }
          }
        }
      }

      const newLines: any[] = updates.lines ?? original?.lines ?? [];
      const newStatus: string = updates.status ?? original?.status ?? "draft";
      const postDate = updates.date ?? original?.date;

      if (newStatus === "posted") {
        await enforceperiodLock(postDate, db);
        guardPostedVoucher({ date: postDate, lines: newLines }, get, false);
      }

      // 2. Persist the updates.
      await db.vouchers.update(id, updates);

      // 3. Apply new balance impact if the resulting voucher is posted.
      if (newStatus === "posted") {
        for (const line of newLines) {
          if (line.accountId) {
            const acc = await db.accounts.get(line.accountId);
            if (acc) {
              const newBal =
                Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) /
                100;
              await db.accounts.update(line.accountId, { balance: newBal });
            }
          }
        }
      }

      await reloadAccounts(db, set);
      set((s) => ({
        vouchers: s.vouchers.map((v) => (v.id === id ? { ...v, ...updates } : v)),
      }));
    });
  },

  cancelVoucher: async (id, reason) => {
    const db = getDB();
    const { currentFiscalYear } = get();

    return db.transaction("rw", [db.vouchers, db.accounts], async () => {
      const original = await db.vouchers.get(id);
      if (!original) throw new Error("Voucher not found");
      if (original.status === "cancelled") throw new Error("Voucher is already cancelled");

      const reversalVoucherId = generateId();

      if (original.lines && original.status === "posted") {
        const reversalLines = original.lines.map((line: any) => ({
          ...line,
          id: generateId(),
          debit: Number(line.credit || 0),
          credit: Number(line.debit || 0),
        }));

        const reversalDate = new Date().toISOString().split("T")[0];
        const { currentFiscalYear } = get();
        assertDateInFiscalYear(reversalDate, currentFiscalYear);

        const reversalVoucher = {
          id: reversalVoucherId,
          voucherNo: await generateNextVoucherNo("reversal", db),
          date: reversalDate,
          type: "reversal",
          status: "posted",
          narration: `Reversal of ${original.voucherNo}: ${reason}`,
          lines: reversalLines,
          totalDebit: original.totalDebit,
          totalCredit: original.totalCredit,
          grandTotal: original.grandTotal,
        };

        await db.vouchers.add(reversalVoucher as any);

        for (const line of reversalLines) {
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

      await db.vouchers.update(id, {
        status: "cancelled",
        cancellationReason: reason,
        reversalVoucherId,
      });

      await reloadAccounts(db, set);

      // Audit log for cancellation.
      try {
        const user = get().currentUser;
        await db.auditLogs.add({
          id: generateId(),
          timestamp: new Date().toISOString(),
          userId: user?.id || "system",
          userName: user?.name || "system",
          action: "VOUCHER_CANCELLED",
          module: "vouchers",
          recordId: id,
          recordType: "journal",
          before: { voucherNo: original.voucherNo, status: original.status },
          after: { status: "cancelled", reason },
        });
      } catch {
        /* non-critical */
      }

      const allVouchers = await db.vouchers.toArray();
      set({
        vouchers: allVouchers.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
      });
    });
  },

  // ── Invoices ─────────────────────────────────────────────────────────────
  addInvoice: async (invoice) => {
    const db = getDB();
    const { currentFiscalYear } = get();
    assertDateInFiscalYear(invoice.date, currentFiscalYear);

    // Enforce period lock for posted invoices.
    if ((invoice.status || "draft") === "posted") {
      await enforceperiodLock(invoice.date, db);
    }

    const id = generateId();
    const type = invoice.type || "sales-invoice";

    return db.transaction(
      "rw",
      [db.invoices, db.vouchers, db.stockMovements, db.accounts],
      async () => {
        const invoiceNo = await generateNextInvoiceNo(type, db);
        const newInvoice = {
          status: invoice.status || "draft",
          lines: invoice.lines || [],
          ...invoice,
          id,
          invoiceNo,
        };

        await db.invoices.add(newInvoice as any);

        if ((newInvoice as any).status === "posted") {
          await postInvoiceJournal(newInvoice as any, db, get, set);
          await postInvoiceStock(newInvoice as any, db, get, set);
        }

        const allInvoices = await db.invoices.toArray();
        set({
          invoices: allInvoices.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        });

        return newInvoice;
      },
    );
  },

  updateInvoice: async (id, updates) => {
    const db = getDB();
    const existing = await db.invoices.get(id);
    const wasPosted = existing?.status === "posted";
    const willBePosted = (updates.status ?? existing?.status) === "posted";

    return db.transaction(
      "rw",
      [db.invoices, db.vouchers, db.stockMovements, db.accounts],
      async () => {
        await db.invoices.update(id, updates);
        const merged = { ...(existing ?? {}), ...updates, id };

        if (willBePosted && !wasPosted) {
          const jnlExists = await db.vouchers.get(`jnl-${id}`);
          if (!jnlExists) {
            await postInvoiceJournal(merged as any, db, get, set);
            await postInvoiceStock(merged as any, db, get, set);
          }
        } else if (willBePosted && wasPosted) {
          await repostInvoiceJournalAndStock(merged as any, db, get, set);
        }

        const allInvoices = await db.invoices.toArray();
        const allVouchers = await db.vouchers.toArray();
        set({
          invoices: allInvoices.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          vouchers: allVouchers.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        });
      },
    );
  },

  cancelInvoice: async (id, reason) => {
    const db = getDB();

    return db.transaction(
      "rw",
      [db.invoices, db.vouchers, db.stockMovements, db.accounts],
      async () => {
        const invoice = await db.invoices.get(id);
        if (!invoice) throw new Error("Invoice not found");
        if (invoice.status === "cancelled") throw new Error("Invoice is already cancelled");

        // Store original status BEFORE updating so the "posted" check below uses the real value.
        const wasPosted = invoice.status === "posted";

        await db.invoices.update(id, {
          status: "cancelled",
          cancellationReason: reason,
          paymentStatus: "cancelled",
        });

        // Reverse stock movements only if invoice was actually posted.
        const movements = wasPosted
          ? await db.stockMovements.where("referenceId").equals(id).toArray()
          : [];
        for (const mov of movements) {
          const reversalMovement = {
            ...mov,
            id: generateId(),
            qty: -(mov.qty || 0),
            amount: -(mov.amount || 0),
            narration: `Reversal of ${mov.referenceNo}: ${reason}`,
            referenceType: "reversal",
          };
          await db.stockMovements.add(reversalMovement as any);
        }

        // Reverse journal entry if invoice was posted at time of cancellation.
        if (wasPosted) {
          const jnlId = `jnl-${invoice.id}`;
          const originalVoucher = await db.vouchers.get(jnlId);
          if (originalVoucher && originalVoucher.status === "posted") {
            const reversalLines = (originalVoucher.lines || []).map((line: any) => ({
              ...line,
              id: generateId(),
              debit: Number(line.credit || 0),
              credit: Number(line.debit || 0),
            }));

            const reversalDate = new Date().toISOString().split("T")[0];
            assertDateInFiscalYear(reversalDate, get().currentFiscalYear);

            const reversalVoucher = {
              id: generateId(),
              voucherNo: await generateNextVoucherNo("reversal", db),
              date: new Date().toISOString().split("T")[0],
              type: "reversal",
              status: "posted",
              narration: `Reversal of ${originalVoucher.voucherNo}: ${reason}`,
              lines: reversalLines,
              totalDebit: originalVoucher.totalDebit,
              totalCredit: originalVoucher.totalCredit,
              grandTotal: originalVoucher.grandTotal,
            };

            await db.vouchers.add(reversalVoucher as any);
            await db.vouchers.update(jnlId, {
              status: "cancelled",
              cancellationReason: reason,
              reversalVoucherId: reversalVoucher.id,
            });

            for (const line of reversalLines) {
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
        }

        await reloadAccounts(db, set);

        const updatedInvoices = await db.invoices.toArray();
        const updatedMovements = await db.stockMovements.toArray();
        const updatedVouchers = await db.vouchers.toArray();

        set({
          invoices: updatedInvoices.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
          stockMovements: updatedMovements,
          vouchers: updatedVouchers.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        });
      },
    );
  },

  // ── Recurring Vouchers ─────────────────────────────────────────────────────
  addRecurringVoucher: async (data) => {
    const { currentFiscalYear } = get();
    assertDateInFiscalYear(data.startDate, currentFiscalYear);

    const db = getDB();
    const record = {
      ...data,
      id: data.id || `rv-${generateId()}`,
      completedOccurrences: 0,
      generatedVoucherIds: [],
      isActive: true,
    };
    await db.recurringVouchers.add(record as any);
    set((s) => ({ recurringVouchers: [...s.recurringVouchers, record] }));
    return record;
  },

  updateRecurringVoucher: async (id, data) => {
    const db = getDB();
    await db.recurringVouchers.update(id, data);
    set((s) => ({
      recurringVouchers: s.recurringVouchers.map((r) => (r.id === id ? { ...r, ...data } : r)),
    }));
  },

  deleteRecurringVoucher: async (id) => {
    const db = getDB();
    await db.recurringVouchers.delete(id);
    set((s) => ({ recurringVouchers: s.recurringVouchers.filter((r) => r.id !== id) }));
  },

  runRecurringVoucher: async (id) => {
    const { recurringVouchers, addVoucher } = get();
    const rv = recurringVouchers.find((r) => r.id === id);
    if (!rv || !rv.isActive) return;

    // Clone the template voucher
    const db = getDB();
    const template = await db.vouchers.get(rv.templateVoucherId);
    if (!template) {
      console.warn("[RecurringVoucher] Template not found:", rv.templateVoucherId);
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const { currentFiscalYear } = get();
    assertDateInFiscalYear(today, currentFiscalYear);
    const newVoucher = await addVoucher({
      ...template,
      id: undefined,
      voucherNo: undefined,
      date: today,
      status: rv.autoPost ? "posted" : "draft",
      narration: `[Auto] ${template.narration || rv.name}`,
    } as any);

    await get().updateRecurringVoucher(id, {
      lastGeneratedDate: today,
      completedOccurrences: (rv.completedOccurrences || 0) + 1,
      generatedVoucherIds: [...(rv.generatedVoucherIds || []), newVoucher?.id].filter(Boolean),
    });
  },

  // ── Bank Reconciliation ────────────────────────────────────────────────────
  importBankStatements: async (bankAccountId, rows) => {
    const db = getDB();
    const records = rows.map((row: any) => ({
      id: row.id || `bs-${generateId()}`,
      bankAccountId,
      date: row.date || "",
      description: row.description || "",
      debit: row.debit || 0,
      credit: row.credit || 0,
      balance: row.balance || 0,
      reference: row.reference,
      reconciled: false,
    }));
    await db.bankStatements.bulkAdd(records as any);
    set((s) => ({ bankStatements: [...s.bankStatements, ...records] }));
  },

  updateBankStatements: async (updates) => {
    const db = getDB();
    for (const upd of updates) {
      if (upd.id) {
        await db.bankStatements.update(upd.id, upd);
      }
    }
    set((s) => ({
      bankStatements: s.bankStatements.map((bs) => {
        const upd = updates.find((u: any) => u.id === bs.id);
        return upd ? { ...bs, ...upd } : bs;
      }),
    }));
  },

  // ── Banking Module Actions ──────────────────────────────────────────────────
  loadBankingData: async () => {
    const db = getDB();
    const [chequeBooks, cheques, depositSlips, pdCheques, ePaymentBatches, paymentAdvices] =
      await Promise.all([
        db.chequeBooks.toArray(),
        db.cheques.toArray(),
        db.depositSlips.toArray(),
        db.pdCheques.toArray(),
        db.ePaymentBatches.toArray(),
        db.paymentAdvices.toArray(),
      ]);
    set({ chequeBooks, cheques, depositSlips, pdCheques, ePaymentBatches, paymentAdvices });
  },

  saveChequeBook: async (data) => {
    const db = getDB();
    const id = data.id || generateId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await db.chequeBooks.put(record as any);
    const all = await db.chequeBooks.toArray();
    set({ chequeBooks: all });
    return id;
  },

  updateChequeBook: async (id, data) => {
    const db = getDB();
    await db.chequeBooks.update(id, data);
    const all = await db.chequeBooks.toArray();
    set({ chequeBooks: all });
  },

  saveCheque: async (data) => {
    const db = getDB();
    const id = data.id || generateId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await db.cheques.put(record as any);
    const all = await db.cheques.toArray();
    set({ cheques: all });
    return id;
  },

  updateCheque: async (id, data) => {
    const db = getDB();
    await db.cheques.update(id, data);
    const all = await db.cheques.toArray();
    set({ cheques: all });
  },

  markChequePrinted: async (chequeIds, userId) => {
    const db = getDB();
    const now = new Date().toISOString();
    await Promise.all(
      chequeIds.map((id) =>
        db.cheques.update(id, { isPrinted: true, printedAt: now, printedBy: userId || "system" }),
      ),
    );
    await Promise.all(
      chequeIds.map((id) =>
        db.auditLogs.add({
          id: generateId(),
          timestamp: now,
          userId: userId || "system",
          action: "CHEQUE_PRINTED",
          module: "banking",
          recordId: id,
          recordType: "cheque",
        }),
      ),
    );
    const all = await db.cheques.toArray();
    set({ cheques: all });
  },

  saveDepositSlip: async (data) => {
    const db = getDB();
    const id = data.id || generateId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await db.depositSlips.put(record as any);
    const all = await db.depositSlips.toArray();
    set({ depositSlips: all });
    return id;
  },

  updateDepositSlip: async (id, data) => {
    const db = getDB();
    await db.depositSlips.update(id, data);
    const all = await db.depositSlips.toArray();
    set({ depositSlips: all });
  },

  markDepositConfirmed: async (slipId) => {
    const db = getDB();
    const now = new Date().toISOString();
    await db.depositSlips.update(slipId, { status: "deposited", depositedAt: now });
    await db.auditLogs.add({
      id: generateId(),
      timestamp: now,
      userId: "system",
      action: "DEPOSIT_CONFIRMED",
      module: "banking",
      recordId: slipId,
      recordType: "depositSlip",
    });
    const all = await db.depositSlips.toArray();
    set({ depositSlips: all });
  },

  savePDCheque: async (data) => {
    const db = getDB();
    const id = data.id || generateId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await db.pdCheques.put(record as any);
    const all = await db.pdCheques.toArray();
    set({ pdCheques: all });
    return id;
  },

  updatePDCheque: async (id, data) => {
    const db = getDB();
    await db.pdCheques.update(id, data);
    const all = await db.pdCheques.toArray();
    set({ pdCheques: all });
  },

  convertPDCToBank: async (pdcId, journalData) => {
    const db = getDB();
    const now = new Date().toISOString();
    const vId = generateId();
    const voucherToAdd = { ...journalData, id: vId, createdAt: now };

    if ((voucherToAdd as any).status === "posted") {
      await enforceperiodLock((voucherToAdd as any).date, db);
      guardPostedVoucher(voucherToAdd as any, get, false);
    }

    await db.vouchers.add(voucherToAdd as any);

    // Update account balances for the conversion journal — mirrors addVoucher logic.
    if ((voucherToAdd as any).status === "posted") {
      for (const line of (voucherToAdd as any).lines || []) {
        if (line.accountId) {
          const acc = await db.accounts.get(line.accountId);
          if (acc) {
            const newBal =
              Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) / 100;
            await db.accounts.update(line.accountId, { balance: newBal });
          }
        }
      }
    }

    await db.pdCheques.update(pdcId, {
      status: "presented",
      convertedAt: now,
      convertedVoucherId: vId,
    });
    await db.auditLogs.add({
      id: generateId(),
      timestamp: now,
      userId: "system",
      action: "PDC_CONVERTED",
      module: "banking",
      recordId: pdcId,
      recordType: "pdCheque",
    });
    const [allPDC, allVouchers] = await Promise.all([
      db.pdCheques.toArray(),
      db.vouchers.toArray(),
    ]);
    set({ pdCheques: allPDC, vouchers: allVouchers });
  },

  addAuditLog: async ({ action, resourceType, resourceId, before, after }) => {
    const user = get().currentUser;
    const db = getDB(); // getDB() is synchronous — no await needed.
    await db.auditLogs.add({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: user?.id,
      userName: user?.name,
      action,
      resourceType,
      resourceId,
      before,
      after,
    });
    const logs = await db.auditLogs.toArray();
    set({ auditLogs: logs });
  },

  saveEPaymentBatch: async (data) => {
    const db = getDB();
    const id = data.id || generateId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await db.ePaymentBatches.put(record as any);
    const all = await db.ePaymentBatches.toArray();
    set({ ePaymentBatches: all });
    return id;
  },

  updateEPaymentBatch: async (id, data) => {
    const db = getDB();
    await db.ePaymentBatches.update(id, data);
    const all = await db.ePaymentBatches.toArray();
    set({ ePaymentBatches: all });
  },

  savePaymentAdvice: async (data) => {
    const db = getDB();
    const id = data.id || generateId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await db.paymentAdvices.put(record as any);
    const all = await db.paymentAdvices.toArray();
    set({ paymentAdvices: all });
    return id;
  },

  updatePaymentAdvice: async (id, data) => {
    const db = getDB();
    await db.paymentAdvices.update(id, data);
    const all = await db.paymentAdvices.toArray();
    set({ paymentAdvices: all });
  },

  getBaseCurrency: () => {
    const { currencies } = get();
    return currencies.find((c) => c.isBase) || currencies[0] || DEFAULT_CURRENCY;
  },

  // NEW ACTIONS FOR VERSION 13
  addBranch: async (branch: any) => {
    const db = getDB();
    const newBranch = { id: generateId(), ...branch, createdAt: new Date().toISOString() };
    await db.branches.put(newBranch);
    set((s: any) => ({ branches: [...s.branches, newBranch] }));
    return newBranch;
  },
  updateBranch: async (id: string, data: any) => {
    const db = getDB();
    await db.branches.update(id, data);
    set((s: any) => ({
      branches: s.branches.map((b: any) => (b.id === id ? { ...b, ...data } : b)),
    }));
  },
  deleteBranch: async (id: string) => {
    const db = getDB();
    await db.branches.delete(id);
    set((s: any) => ({ branches: s.branches.filter((b: any) => b.id !== id) }));
  },

  addSalesperson: async (sp: any) => {
    const db = getDB();
    const newSp = { id: generateId(), ...sp, createdAt: new Date().toISOString() };
    await db.salesPersons.put(newSp);
    set((s: any) => ({ salespersons: [...s.salespersons, newSp] }));
    return newSp;
  },
  updateSalesperson: async (id: string, data: any) => {
    const db = getDB();
    await db.salesPersons.update(id, data);
    set((s: any) => ({
      salespersons: s.salespersons.map((x: any) => (x.id === id ? { ...x, ...data } : x)),
    }));
  },
  deleteSalesperson: async (id: string) => {
    const db = getDB();
    await db.salesPersons.delete(id);
    set((s: any) => ({ salespersons: s.salespersons.filter((x: any) => x.id !== id) }));
  },

  addExchangeRate: async (rate: any) => {
    const db = getDB();
    const newRate = { id: generateId(), ...rate, createdAt: new Date().toISOString() };
    await db.exchangeRates.put(newRate);
    set((s: any) => ({ exchangeRates: [...s.exchangeRates, newRate] }));
    return newRate;
  },
  updateExchangeRate: async (id: string, data: any) => {
    const db = getDB();
    await db.exchangeRates.update(id, data);
    set((s: any) => ({
      exchangeRates: s.exchangeRates.map((x: any) => (x.id === id ? { ...x, ...data } : x)),
    }));
  },
  deleteExchangeRate: async (id: string) => {
    const db = getDB();
    await db.exchangeRates.delete(id);
    set((s: any) => ({ exchangeRates: s.exchangeRates.filter((x: any) => x.id !== id) }));
  },
});
