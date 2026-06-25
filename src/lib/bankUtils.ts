// src/lib/bankUtils.ts

export interface BankTransaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
}

// BookEntry = one side of a journal entry line for a bank account
export interface BookEntry {
  id: string;
  date: string;
  amount: number;
  description: string;
  ledgerId: string;
  type: "debit" | "credit";
}

// MatchResult = one bank statement row paired with a matching book entry (or unmatched)
export interface MatchResult {
  statementId: string;
  bookEntryId?: string;
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  matched: boolean;
  confidence?: number; // 0–1, how confident the auto-match is
}

export function parseCSVBankStatement(
  csvText: string,
  colMapping?: { date: number; description: number; debit: number; credit: number; balance: number }
): BankTransaction[] {
  const mapping = colMapping || { date: 0, description: 1, debit: 2, credit: 3, balance: 4 };
  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const transactions: BankTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    if (cols.length < 4) continue;
    transactions.push({
      date: cols[mapping.date] || "",
      description: cols[mapping.description] || "",
      debit: parseFloat(cols[mapping.debit]) || 0,
      credit: parseFloat(cols[mapping.credit]) || 0,
      balance: parseFloat(cols[mapping.balance]) || 0,
    });
  }
  return transactions;
}

/**
 * Auto-matches bank statement rows to book entries.
 * Matching strategy:
 *   1. Exact amount + exact date → high confidence (0.95)
 *   2. Exact amount + date within 3 days → medium confidence (0.75)
 *   3. Amount within 1% + exact date → low confidence (0.50)
 */
export interface BankStmtLine {
  id: string;
  date: string;
  description: string;
  amount: number; // + deposit, - withdrawal
}

export interface LedgerLine {
  id: string;
  date: string;
  amount: number;
  reconciled?: boolean;
}

export interface MatchSuggestion {
  bankLineId: string;
  ledgerLineIds: string[];
  confidence: "exact" | "many-to-one";
}

/** Exact auto-match: same date + same amount => single-click confirm. */
export function autoMatchStatements(
  bankLines: BankStmtLine[],
  ledgerLines: LedgerLine[],
): { suggestions: MatchSuggestion[]; matchedBankIds: Set<string> } {
  const suggestions: MatchSuggestion[] = [];
  const matchedBankIds = new Set<string>();
  const usedLedger = new Set<string>();

  for (const bank of bankLines) {
    const exact = ledgerLines.find(
      (l) =>
        !usedLedger.has(l.id) &&
        !l.reconciled &&
        l.date === bank.date &&
        Math.abs(l.amount - bank.amount) < 0.01,
    );
    if (exact) {
      suggestions.push({
        bankLineId: bank.id,
        ledgerLineIds: [exact.id],
        confidence: "exact",
      });
      matchedBankIds.add(bank.id);
      usedLedger.add(exact.id);
    }
  }
  return { suggestions, matchedBankIds };
}

/**
 * Many-to-one: validate that a set of selected ledger receipts sums exactly
 * to one consolidated bank deposit line (PDF lump-sum deposit scenario).
 */
export function validateManyToOne(
  bankAmount: number,
  selectedLedgerAmounts: number[],
): { isValid: boolean; runningTotal: number; difference: number } {
  const runningTotal = selectedLedgerAmounts.reduce((s, a) => s + a, 0);
  const difference = Math.round((bankAmount - runningTotal) * 100) / 100;
  return { isValid: Math.abs(difference) < 0.01, runningTotal, difference };
}

// Legacy helper — kept for backward compatibility
export function matchBankTransactions(
  bankTransactions: BankTransaction[],
  voucherLines: any[]
): { matched: any[]; unmatched: any[] } {
  const matched: any[] = [];
  const unmatched: any[] = [];
  for (const bt of bankTransactions) {
    const amount = bt.credit || bt.debit;
    const match = voucherLines.find(
      (vl) => Math.abs((vl.debit || vl.credit) - amount) < 0.01 && vl.date === bt.date
    );
    if (match) matched.push({ bankTx: bt, voucher: match });
    else unmatched.push(bt);
  }
  return { matched, unmatched };
}
