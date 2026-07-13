import { getDB, generateId } from "../db";
import { validateDoubleEntry } from "../accounting";
import { CA_CHART_OF_ACCOUNTS } from "./caAccountClassification";
import type { KhataConfirmationCard, KhataIntent, JournalLineDraft } from "./types";
import { buildJournalLines, getEntryTemplate } from "./caEntryTemplates";

/** Legacy 2-line mapping kept for reference; CA engine uses journalLines */
const LEGACY_KHATA_ACCOUNTS: Record<KhataIntent, { debit: string; credit: string } | null> = {
  khata_credit_sale: { debit: "KH-DEBT", credit: "KH-SALE" },
  khata_cash_sale: { debit: "KH-CASH", credit: "KH-SALE" },
  khata_payment_in: { debit: "KH-CASH", credit: "KH-DEBT" },
  khata_purchase: { debit: "KH-PUR", credit: "KH-CASH" },
  khata_payment_out: { debit: "KH-CRED", credit: "KH-CASH" },
  khata_expense: { debit: "KH-EXP", credit: "KH-CASH" },
  khata_credit_purchase: { debit: "KH-PUR", credit: "KH-CRED" },
  khata_outstanding_expense: { debit: "KH-EXP", credit: "KH-OUT-EXP" },
  khata_prepaid_expense: { debit: "KH-PREPAID", credit: "KH-CASH" },
  khata_bad_debt_writeoff: { debit: "KH-BD-EXP", credit: "KH-DEBT" },
  khata_bad_debt_recovery: { debit: "KH-CASH", credit: "KH-BD-REC" },
  khata_provision_bad_debt: { debit: "KH-BD-EXP", credit: "KH-BD-PROV" },
  khata_salary_payment: { debit: "KH-SAL-PAY", credit: "KH-BANK" },
  khata_salary_accrual: { debit: "KH-SAL", credit: "KH-SAL-PAY" },
  khata_ssf_employee: null,
  khata_ssf_employer: null,
  khata_gratuity_provision: { debit: "KH-GRAT-EXP", credit: "KH-GRAT-PROV" },
  khata_gratuity_payment: { debit: "KH-GRAT-PROV", credit: "KH-BANK" },
  khata_vat_sales: null,
  khata_vat_purchase: null,
  khata_vat_payment: { debit: "KH-VAT-OUT", credit: "KH-BANK" },
  khata_tds_deducted: null,
  khata_tds_paid: { debit: "KH-TDS-PAY", credit: "KH-BANK" },
  khata_other_income: { debit: "KH-BANK", credit: "KH-OTH-INC" },
  khata_depreciation: { debit: "KH-DEPR", credit: "KH-ACC-DEP" },
  khata_bank_charges: { debit: "KH-BANK-CHG", credit: "KH-BANK" },
  khata_discount_allowed: { debit: "KH-DISC-ALL", credit: "KH-DEBT" },
  khata_discount_received: { debit: "KH-CRED", credit: "KH-DISC-REC" },
  khata_capital_introduced: { debit: "KH-BANK", credit: "KH-CAP" },
  khata_drawings: { debit: "KH-DRAW", credit: "KH-CASH" },
  khata_loan_received: { debit: "KH-BANK", credit: "KH-LOAN" },
  khata_loan_repayment: { debit: "KH-LOAN", credit: "KH-BANK" },
  khata_stock_purchase: { debit: "KH-STOCK", credit: "KH-CASH" },
  khata_stock_sale_cogs: { debit: "KH-PUR", credit: "KH-STOCK" },
  khata_contra_cash_bank: { debit: "KH-BANK", credit: "KH-CASH" },
  // Authoritative returns use postSalesAdjustmentTransaction; legacy map unused.
  khata_sales_return: null,
  khata_purchase_return: null,
  khata_customer_advance: { debit: "KH-BANK", credit: "KH-DEBT" },
  khata_employee_advance: { debit: "KH-DEBT", credit: "KH-CASH" },
  khata_opening_balance: null,
  khata_asset_disposal: null,
  khata_inventory_write_down: { debit: "KH-EXP", credit: "KH-STOCK" },
  khata_commission_income: { debit: "KH-CASH", credit: "KH-OTH-INC" },
  khata_rent_expense: { debit: "KH-EXP", credit: "KH-CASH" },
};

async function ensureKhataAccounts(): Promise<Map<string, string>> {
  const db = getDB();
  const codeToId = new Map<string, string>();

  for (const def of CA_CHART_OF_ACCOUNTS) {
    const existing = await db.accounts.filter((a) => a.code === def.code).first();
    if (existing) {
      codeToId.set(def.code, existing.id);
      continue;
    }

    const id = generateId();
    await db.accounts.add({
      id,
      code: def.code,
      name: def.name,
      type: def.class === "stock" ? "asset" : def.class === "gain" ? "income" : def.class === "loss" ? "expense" : def.class,
      level: "ledger",
      isGroup: false,
      isActive: true,
      isSystemAccount: true,
      balance: 0,
      createdAt: new Date().toISOString(),
    } as never);
    codeToId.set(def.code, id);
  }

  return codeToId;
}

async function resolveParty(
  partyName: string | null | undefined,
  intent: KhataIntent,
): Promise<{ partyId?: string; partyName?: string }> {
  if (!partyName) return {};

  const db = getDB();
  const allParties = await db.parties.toArray();
  const existing = allParties.find((p) => p.name.toLowerCase() === partyName.toLowerCase());
  if (existing) {
    return { partyId: existing.id, partyName: existing.name };
  }

  const supplierIntents: KhataIntent[] = [
    "khata_purchase", "khata_payment_out", "khata_credit_purchase", "khata_discount_received",
  ];
  const partyType = supplierIntents.includes(intent) ? "supplier" : "customer";
  const id = generateId();
  const code = `KH-${partyName.slice(0, 3).toUpperCase()}-${Date.now().toString(36).slice(-4)}`;

  await db.parties.add({
    id,
    code,
    name: partyName,
    type: partyType,
    isActive: true,
    balance: 0,
    createdAt: new Date().toISOString(),
  } as never);

  return { partyId: id, partyName };
}

async function nextKhataVoucherNo(): Promise<string> {
  const db = getDB();
  const khataVouchers = await db.vouchers
    .filter((v) => v.type.startsWith("khata_"))
    .toArray();
  let max = 0;
  for (const voucher of khataVouchers) {
    const match = voucher.voucherNo?.match(/KH-(\d+)/i);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `KH-${String(max + 1).padStart(5, "0")}`;
}

function resolveJournalDraft(card: KhataConfirmationCard): JournalLineDraft[] {
  if (card.journalLines && card.journalLines.length > 0) {
    return card.journalLines;
  }
  return buildJournalLines(card.intent, {
    amount: card.amount,
    secondaryAmount: card.secondaryAmount ?? undefined,
    party: card.party,
    item: card.item,
    narration: card.raw_text,
  });
}

export interface ConfirmKhataDeps {
  addVoucher: (voucher: Record<string, unknown>) => Promise<unknown>;
}

export async function confirmKhataEntry(
  card: KhataConfirmationCard,
  deps: ConfirmKhataDeps,
): Promise<{ voucherNo: string }> {
  const db = getDB();

  return db.transaction("rw", [db.accounts, db.parties, db.vouchers, db.auditLogs], async () => {
    const accountIds = await ensureKhataAccounts();
    const { partyId, partyName } = await resolveParty(card.party, card.intent);
    const journalDraft = resolveJournalDraft(card);
    const narration = card.item ? `${card.raw_text} (${card.item})` : card.raw_text;

    const lines = journalDraft.map((draft) => {
      const accountId = accountIds.get(draft.accountCode);
      if (!accountId) {
        throw new Error(`Account ${draft.accountCode} could not be initialized`);
      }
      return {
        id: generateId(),
        accountId,
        accountName: draft.accountName,
        debit: draft.debit,
        credit: draft.credit,
        narration: draft.narration ?? narration,
        partyId,
        partyName,
      };
    });

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    const validation = validateDoubleEntry(lines);
    if (!validation.isValid) {
      throw new Error(
        `Journal entry not balanced: Dr ${validation.totalDebit} ≠ Cr ${validation.totalCredit} (diff ${validation.difference})`,
      );
    }

    const voucherNo = await nextKhataVoucherNo();
    const template = getEntryTemplate(card.intent);

    await deps.addVoucher({
      type: card.intent,
      status: "posted",
      date: card.date,
      narration,
      partyId,
      partyName,
      voucherNo,
      lines,
      grandTotal: Math.max(totalDebit, totalCredit),
      totalDebit,
      totalCredit,
      referenceNo: card.raw_text,
      caExplanation: card.caExplanation ?? template?.explanation,
      tags: card.tags ?? template?.tags,
    });

    return { voucherNo };
  });
}

export { LEGACY_KHATA_ACCOUNTS, CA_CHART_OF_ACCOUNTS };
