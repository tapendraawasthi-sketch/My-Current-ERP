export type VoucherType = 'Journal' | 'Payment' | 'Receipt' | 'Contra';

export type BankMode = 'Cheque/DD' | 'EFT' | 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'Others';

export interface BankAllocation {
  id: string;
  transactionType: BankMode;
  instrumentNumber?: string;
  instrumentDate?: string; // YYYY-MM-DD
  bankName?: string;
  branchName?: string;
  ifscCode?: string;
  amount: number;
}

export interface BillWiseAllocation {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number; // original amount
  pending: number; // remaining
  allocated: number; // what user is paying/receiving now
  narration?: string;
}

export interface CashDenomination {
  denomination: number;
  count: number;
}

export interface VoucherLine {
  id: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
  bankAllocation?: BankAllocation;
  billWiseAllocations?: BillWiseAllocation[];
  isCasH?: boolean;
  cashDenominations?: CashDenomination[];
  // contra only
  isBank?: boolean;
}

export interface VoucherMeta {
  id: string;
  voucherType: VoucherType;
  voucherNumber: string;
  date: string; // YYYY-MM-DD
  reference?: string;
  narration?: string;
  totalDebit: number;
  totalCredit: number;
  isSingleEntry: boolean;
  createdAt: string;
  updatedAt: string;
  fiscalYearId?: string;
  companyId?: string;
}

export interface Voucher extends VoucherMeta {
  lines: VoucherLine[];
}

export const blankLine = (): VoucherLine => ({
  id: cryptoRandomId(),
  accountId: '',
  accountName: '',
  debit: 0,
  credit: 0,
  narration: '',
});

export const blankVoucher = (type: VoucherType): Voucher => ({
  id: cryptoRandomId(),
  voucherType: type,
  voucherNumber: '',
  date: todayAD(),
  reference: '',
  narration: '',
  totalDebit: 0,
  totalCredit: 0,
  isSingleEntry: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [blankLine(), blankLine()],
});

export const cryptoRandomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const todayAD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const recalcTotals = (lines: VoucherLine[]) => {
  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  return { totalDebit, totalCredit, diff: totalDebit - totalCredit };
};

export const isBalanced = (lines: VoucherLine[]) => {
  const { diff } = recalcTotals(lines);
  return Math.abs(diff) < 0.001;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const voucherTypeShortcut: Record<string, VoucherType> = {
  F4: 'Contra',
  F5: 'Payment',
  F6: 'Receipt',
  F7: 'Journal',
};

export const voucherTypeLabel: Record<VoucherType, string> = {
  Journal: 'Journal Voucher (F7)',
  Payment: 'Payment Voucher (F5)',
  Receipt: 'Receipt Voucher (F6)',
  Contra: 'Contra Voucher (F4)',
};
