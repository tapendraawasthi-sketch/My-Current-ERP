/** Shared invoice journal/stock writers — importable without full store bootstrap. */
import { getDB, generateId } from "../lib/db";
import { validateVoucherBalance } from "./store.types";
import { enforcePostingPeriodLock } from "../lib/ledger/postingPeriodGuard";
import { stampMovementBranch } from "../lib/activeBranch";

function maxSerialFromNumbers(numbers: Array<string | undefined>, pad = 4): string {
  let max = 0;
  for (const no of numbers) {
    const match = no?.match(/-(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return String(max + 1).padStart(pad, "0");
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
    "credit-note": "CN",
    "debit-note": "DN",
  };
  const prefix = prefixes[type] || "INV";
  const existing = await db.invoices.where("type").equals(type).toArray();
  return `${prefix}-${maxSerialFromNumbers(existing.map((i) => i.invoiceNo))}`;
}

export async function postInvoiceJournal(
  invoice: any,
  db: ReturnType<typeof getDB>,
  get: any,
  set: any,
) {
  await enforcePostingPeriodLock(invoice.date, db);

  const lines: any[] = [];
  const partyAccountId =
    invoice.partyAccountId ||
    (invoice.type === "sales-invoice" ||
    invoice.type === "sales-return" ||
    invoice.type === "credit-note"
      ? "acc-sundry-debtors"
      : "acc-sundry-creditors");

  const taxable = Number(invoice.taxableAmount || 0);
  const exempt = Number(invoice.exemptAmount || 0);
  const vat = Number(invoice.vatAmount || 0);
  const tds = Number(invoice.tdsAmount || 0);
  const grandTotal = Number(invoice.grandTotal || 0);
  const roundOff = Number(invoice.roundOff || 0);
  const sundryNet = (invoice.billSundries || []).reduce((acc: number, s: any) => {
    const amt = Number(s.amount || 0);
    return s.type === "deductive" ? acc - amt : acc + amt;
  }, 0);

  const pushSundryLines = (invert: boolean) => {
    if (sundryNet > 0) {
      lines.push({
        accountId: "acc-sales",
        accountName: "Bill Sundries",
        debit: invert ? sundryNet : 0,
        credit: invert ? 0 : sundryNet,
      });
    } else if (sundryNet < 0) {
      const amt = Math.abs(sundryNet);
      lines.push({
        accountId: "acc-sales",
        accountName: "Bill Sundries",
        debit: invert ? 0 : amt,
        credit: invert ? amt : 0,
      });
    }
  };

  const pushRoundOff = () => {
    if (Math.abs(roundOff) < 0.005) return;
    if (roundOff > 0) {
      lines.push({
        accountId: "acc-indirect-expenses",
        accountName: "Round Off",
        debit: 0,
        credit: roundOff,
      });
    } else {
      lines.push({
        accountId: "acc-indirect-expenses",
        accountName: "Round Off",
        debit: -roundOff,
        credit: 0,
      });
    }
  };

  if (invoice.type === "sales-invoice") {
    const partyDebit = grandTotal;
    lines.push({
      accountId: partyAccountId,
      accountName: invoice.partyName,
      debit: partyDebit,
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
    if (tds > 0) {
      lines.push({
        accountId: "acc-tds-receivable",
        accountName: "TDS Receivable",
        debit: tds,
        credit: 0,
      });
    }
    pushSundryLines(false);
    pushRoundOff();
  } else if (invoice.type === "sales-return" || invoice.type === "credit-note") {
    lines.push({
      accountId: partyAccountId,
      accountName: invoice.partyName,
      debit: 0,
      credit: grandTotal,
    });
    if (taxable > 0)
      lines.push({
        accountId: "acc-sales",
        accountName: invoice.type === "credit-note" ? "Credit Note" : "Sales Return",
        debit: taxable,
        credit: 0,
      });
    if (exempt > 0)
      lines.push({
        accountId: "acc-sales",
        accountName:
          invoice.type === "credit-note" ? "Credit Note (Exempt)" : "Sales Return (Exempt)",
        debit: exempt,
        credit: 0,
      });
    if (vat > 0)
      lines.push({
        accountId: "acc-vat-payable",
        accountName: "VAT Payable",
        debit: vat,
        credit: 0,
      });
    pushSundryLines(true);
    pushRoundOff();
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
        accountId: "acc-vat-receivable",
        accountName: "VAT Receivable (Input Tax)",
        debit: vat,
        credit: 0,
      });
    const partyCredit = Math.max(0, grandTotal - tds);
    lines.push({
      accountId: partyAccountId,
      accountName: invoice.partyName,
      debit: 0,
      credit: partyCredit,
    });
    if (tds > 0) {
      lines.push({
        accountId: "acc-tds-payable",
        accountName: "TDS Payable",
        debit: 0,
        credit: tds,
      });
    }
    pushSundryLines(true);
    pushRoundOff();
  } else if (invoice.type === "purchase-return" || invoice.type === "debit-note") {
    if (taxable > 0)
      lines.push({
        accountId: "acc-purchase",
        accountName: invoice.type === "debit-note" ? "Debit Note" : "Purchase Return",
        debit: 0,
        credit: taxable,
      });
    if (exempt > 0)
      lines.push({
        accountId: "acc-purchase",
        accountName:
          invoice.type === "debit-note" ? "Debit Note (Exempt)" : "Purchase Return (Exempt)",
        debit: 0,
        credit: exempt,
      });
    if (vat > 0)
      lines.push({
        accountId: "acc-vat-receivable",
        accountName: "VAT Receivable",
        debit: 0,
        credit: vat,
      });
    lines.push({
      accountId: partyAccountId,
      accountName: invoice.partyName,
      debit: grandTotal,
      credit: 0,
    });
    pushSundryLines(false);
    pushRoundOff();
  }

  if (lines.length === 0) {
    throw new Error(
      `Invoice ${invoice.invoiceNo} has no accountable amounts (taxable/exempt/total are all zero). Cannot post.`,
    );
  }

  // Auto-balance minor rounding residual (excludes explicit roundOff line).
  let debitSum = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  let creditSum = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const residual = Math.round((debitSum - creditSum) * 100) / 100;
  if (Math.abs(residual) >= 0.01) {
    if (residual > 0) {
      lines.push({
        accountId: "acc-indirect-expenses",
        accountName: "Rounding Difference",
        debit: 0,
        credit: residual,
      });
    } else {
      lines.push({
        accountId: "acc-indirect-expenses",
        accountName: "Rounding Difference",
        debit: -residual,
        credit: 0,
      });
    }
  }

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

  // Update account balances â€” round to 2 decimal places to prevent float drift.
  for (const line of lines) {
    if (line.accountId) {
      const acc = await db.accounts.get(line.accountId);
      if (acc) {
        const newBal =
          Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) / 100;
        await db.accounts.update(line.accountId, { balance: newBal });
      }
    }
  }

  // NIOS Event Bus — must NOT await non-IDB work inside an IndexedDB transaction
  // (await import() would auto-commit the ambient Dexie transaction).
  void import("../nios/events/eventBus")
    .then(({ emitNiosEvent }) => {
      const eventPayload = {
        voucherId: id,
        voucherNo,
        voucherType: "journal",
        referenceId: invoice.id,
        referenceNo: invoice.invoiceNo,
        grandTotal: totalDebit,
        partyName: invoice.partyName,
      };
      emitNiosEvent("voucher.posted", eventPayload);
      emitNiosEvent("invoice.created", {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceType: invoice.type || invoice.invoiceType,
        partyName: invoice.partyName,
        grandTotal: totalDebit,
        voucherId: id,
      });
    })
    .catch(() => {
      /* NIOS optional during rollout */
    });
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

    // Use line.id (or a fallback index) in the movement ID so two lines
    // for the same item do NOT share an ID and overwrite each other.
    const lineUniqueKey = line.id || line.itemId + "-" + Math.random().toString(36).slice(2, 8);
    const movId = `mov-${invoice.id}-${lineUniqueKey}`;
    const unitCost =
      line.unitCost != null
        ? Number(line.unitCost)
        : item.costPrice != null
          ? Number(item.costPrice)
          : Number(line.rate || 0);
    const costAmount =
      line.costAmount != null ? Number(line.costAmount) : (line.qty || 0) * unitCost;
    const movement = stampMovementBranch(
      {
        id: movId,
        date: invoice.date,
        dateNepali: invoice.dateNepali || "",
        type: invoice.type,
        itemId: line.itemId,
        itemName: line.itemName || item.name,
        warehouseId: line.warehouseId || warehouseId,
        warehouseName,
        qty,
        rate: unitCost,
        amount: costAmount,
        referenceId: invoice.id,
        referenceNo: invoice.invoiceNo,
        referenceType: invoice.type,
        narration: `Stock movement for ${invoice.invoiceNo}`,
        valuationMethod: line.valuationMethod || undefined,
        costAllocationId: line.costAllocationId || undefined,
        branchId: invoice.branchId,
      },
      get().warehouses || [],
    );
    // Use add() not put() so each line creates a separate record.
    await db.stockMovements.add(movement as any).catch(async () => {
      await db.stockMovements.add({ ...movement, id: `mov-${invoice.id}-${generateId()}` } as any);
    });
  }
  const updatedMovements = await db.stockMovements.toArray();
  set({ stockMovements: updatedMovements });
}

/**
 * Perpetual inventory COGS journal (Phase 6.5).
 * Dr COGS / Cr Inventory for exact allocated cost. Linked voucher id: jnl-cogs-{invoiceId}
 */
export async function postSalesCogsJournal(
  invoice: {
    id: string;
    invoiceNo: string;
    date: string;
    dateNepali?: string;
  },
  cogsAmount: number,
  db: ReturnType<typeof getDB>,
  accountIds: { cogsAccountId: string; inventoryAccountId: string },
): Promise<string | null> {
  if (!(cogsAmount > 0)) return null;

  const lines = [
    {
      accountId: accountIds.cogsAccountId,
      accountName: "Cost of Goods Sold",
      debit: cogsAmount,
      credit: 0,
    },
    {
      accountId: accountIds.inventoryAccountId,
      accountName: "Inventory",
      debit: 0,
      credit: cogsAmount,
    },
  ];
  validateVoucherBalance(lines);

  const id = `jnl-cogs-${invoice.id}`;
  const voucherNo = `COGS-${invoice.invoiceNo}`;
  await db.vouchers.add({
    id,
    voucherNo,
    date: invoice.date,
    dateNepali: invoice.dateNepali,
    type: "journal",
    narration: `COGS for ${invoice.invoiceNo}`,
    lines,
    status: "posted",
    totalDebit: cogsAmount,
    totalCredit: cogsAmount,
    grandTotal: cogsAmount,
    journalType: "inventory_cost",
    linkedInvoiceId: invoice.id,
  } as any);

  for (const line of lines) {
    const acc = await db.accounts.get(line.accountId);
    if (acc) {
      const newBal =
        Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) / 100;
      await db.accounts.update(line.accountId, { balance: newBal });
    }
  }
  return id;
}

/**
 * Perpetual inventory COGS reversal for sales returns (Phase 7).
 * Dr Inventory / Cr COGS for historical cost. Linked voucher id: jnl-cogs-rev-{invoiceId}
 */
export async function postSalesCogsReversalJournal(
  invoice: {
    id: string;
    invoiceNo: string;
    date: string;
    dateNepali?: string;
  },
  cogsAmount: number,
  db: ReturnType<typeof getDB>,
  accountIds: { cogsAccountId: string; inventoryAccountId: string },
): Promise<string | null> {
  if (!(cogsAmount > 0)) return null;

  const lines = [
    {
      accountId: accountIds.inventoryAccountId,
      accountName: "Inventory",
      debit: cogsAmount,
      credit: 0,
    },
    {
      accountId: accountIds.cogsAccountId,
      accountName: "Cost of Goods Sold",
      debit: 0,
      credit: cogsAmount,
    },
  ];
  validateVoucherBalance(lines);

  const id = `jnl-cogs-rev-${invoice.id}`;
  const voucherNo = `COGS-REV-${invoice.invoiceNo}`;
  await db.vouchers.add({
    id,
    voucherNo,
    date: invoice.date,
    dateNepali: invoice.dateNepali,
    type: "journal",
    narration: `COGS reversal for ${invoice.invoiceNo}`,
    lines,
    status: "posted",
    totalDebit: cogsAmount,
    totalCredit: cogsAmount,
    grandTotal: cogsAmount,
    journalType: "inventory_cost_reversal",
    linkedInvoiceId: invoice.id,
  } as any);

  for (const line of lines) {
    const acc = await db.accounts.get(line.accountId);
    if (acc) {
      const newBal =
        Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) / 100;
      await db.accounts.update(line.accountId, { balance: newBal });
    }
  }
  return id;
}

/**
 * Perpetual inventory removal for purchase returns (Phase 8).
 * Dr Purchases / Cr Inventory for historical purchase cost. Linked voucher id: jnl-inv-rev-{invoiceId}
 * Combined with the purchase-return journal (Cr Purchases), the net purchase effect nets to zero
 * and inventory is credited by the carrying amount.
 */
export async function postPurchaseInventoryRemovalJournal(
  invoice: {
    id: string;
    invoiceNo: string;
    date: string;
    dateNepali?: string;
  },
  costAmount: number,
  db: ReturnType<typeof getDB>,
  accountIds: { inventoryAccountId: string; purchaseAccountId: string },
): Promise<string | null> {
  if (!(costAmount > 0)) return null;

  const lines = [
    {
      accountId: accountIds.purchaseAccountId,
      accountName: "Purchases",
      debit: costAmount,
      credit: 0,
    },
    {
      accountId: accountIds.inventoryAccountId,
      accountName: "Inventory",
      debit: 0,
      credit: costAmount,
    },
  ];
  validateVoucherBalance(lines);

  const id = `jnl-inv-rev-${invoice.id}`;
  const voucherNo = `INV-REV-${invoice.invoiceNo}`;
  await db.vouchers.add({
    id,
    voucherNo,
    date: invoice.date,
    dateNepali: invoice.dateNepali,
    type: "journal",
    narration: `Inventory removal for ${invoice.invoiceNo}`,
    lines,
    status: "posted",
    totalDebit: costAmount,
    totalCredit: costAmount,
    grandTotal: costAmount,
    journalType: "inventory_cost_reversal",
    linkedInvoiceId: invoice.id,
  } as any);

  for (const line of lines) {
    const acc = await db.accounts.get(line.accountId);
    if (acc) {
      const newBal =
        Math.round(((acc.balance || 0) + (line.debit || 0) - (line.credit || 0)) * 100) / 100;
      await db.accounts.update(line.accountId, { balance: newBal });
    }
  }
  return id;
}
