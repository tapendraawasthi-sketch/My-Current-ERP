// src/lib/bankUtils.ts

export interface BankTransaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
}

export function parseCSVBankStatement(csvText: string): BankTransaction[] {
  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const transactions: BankTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    if (cols.length < 4) continue;
    transactions.push({
      date: cols[0] || "",
      description: cols[1] || "",
      debit: parseFloat(cols[2]) || 0,
      credit: parseFloat(cols[3]) || 0,
      balance: parseFloat(cols[4]) || 0,
      reference: cols[5] || undefined,
    });
  }
  return transactions;
}

export function matchBankTransactions(
  bankTransactions: BankTransaction[],
  voucherLines: any[]
): { matched: any[]; unmatched: any[] } {
  const matched: any[] = [];
  const unmatched: any[] = [];

  for (const bt of bankTransactions) {
    const amount = bt.credit || bt.debit;
    const match = voucherLines.find(
      (vl) => Math.abs((vl.debit || vl.credit) - amount) < 0.01 &&
        vl.date === bt.date
    );
    if (match) {
      matched.push({ bankTx: bt, voucher: match });
    } else {
      unmatched.push(bt);
    }
  }

  return { matched, unmatched };
}

export const autoMatchStatements = () => ({});
