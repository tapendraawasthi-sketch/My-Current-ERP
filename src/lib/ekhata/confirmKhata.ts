import { getDB, generateId } from "../db";
import type { KhataConfirmationCard, KhataIntent } from "./types";

const KHATA_ACCOUNTS: Record<KhataIntent, { debit: string; credit: string }> = {
  khata_credit_sale: { debit: "KH-DEBT", credit: "KH-SALE" },
  khata_cash_sale: { debit: "KH-CASH", credit: "KH-SALE" },
  khata_payment_in: { debit: "KH-CASH", credit: "KH-DEBT" },
  khata_purchase: { debit: "KH-PUR", credit: "KH-CASH" },
  khata_payment_out: { debit: "KH-CRED", credit: "KH-CASH" },
  khata_expense: { debit: "KH-EXP", credit: "KH-CASH" },
};

const ACCOUNT_DEFS = [
  { code: "KH-DEBT", name: "Khata Debtors", type: "asset" },
  { code: "KH-CRED", name: "Khata Creditors", type: "liability" },
  { code: "KH-SALE", name: "Khata Sales", type: "income" },
  { code: "KH-PUR", name: "Khata Purchases", type: "expense" },
  { code: "KH-EXP", name: "Khata Expenses", type: "expense" },
  { code: "KH-CASH", name: "Khata Cash", type: "asset" },
] as const;

async function ensureKhataAccounts(): Promise<Map<string, string>> {
  const db = getDB();
  const codeToId = new Map<string, string>();

  for (const def of ACCOUNT_DEFS) {
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
      type: def.type,
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

  const partyType =
    intent === "khata_purchase" || intent === "khata_payment_out" ? "supplier" : "customer";
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

export interface ConfirmKhataDeps {
  addVoucher: (voucher: Record<string, unknown>) => Promise<unknown>;
}

export async function confirmKhataEntry(
  card: KhataConfirmationCard,
  deps: ConfirmKhataDeps,
): Promise<{ voucherNo: string }> {
  const mapping = KHATA_ACCOUNTS[card.intent];
  const accountIds = await ensureKhataAccounts();
  const debitAccountId = accountIds.get(mapping.debit);
  const creditAccountId = accountIds.get(mapping.credit);

  if (!debitAccountId || !creditAccountId) {
    throw new Error("Khata accounts could not be initialized");
  }

  const { partyId, partyName } = await resolveParty(card.party, card.intent);
  const amount = card.amount;
  const narration = card.item
    ? `${card.raw_text} (${card.item})`
    : card.raw_text;

  const voucherNo = await nextKhataVoucherNo();
  const lines = [
    {
      id: generateId(),
      accountId: debitAccountId,
      accountName: ACCOUNT_DEFS.find((a) => a.code === mapping.debit)?.name,
      debit: amount,
      credit: 0,
      narration,
      partyId,
      partyName,
    },
    {
      id: generateId(),
      accountId: creditAccountId,
      accountName: ACCOUNT_DEFS.find((a) => a.code === mapping.credit)?.name,
      debit: 0,
      credit: amount,
      narration,
      partyId,
      partyName,
    },
  ];

  await deps.addVoucher({
    type: card.intent,
    status: "posted",
    date: card.date,
    narration,
    partyId,
    partyName,
    voucherNo,
    lines,
    grandTotal: amount,
    totalDebit: amount,
    totalCredit: amount,
    referenceNo: card.raw_text,
  });

  return { voucherNo };
}
