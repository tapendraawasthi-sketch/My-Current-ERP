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
export function autoMatchStatements(
  statementRows: BankTransaction[],
  bookEntries: BookEntry[]
): MatchResult[] {
  const usedBookIds = new Set<string>();

  return statementRows.map((stmt) => {
    const stmtAmount = stmt.credit > 0 ? stmt.credit : stmt.debit;
    const stmtType: "debit" | "credit" = stmt.credit > 0 ? "credit" : "debit";

    let bestMatch: BookEntry | null = null;
    let bestConfidence = 0;

    for (const entry of bookEntries) {
      if (usedBookIds.has(entry.id)) continue;
      if (entry.type !== stmtType) continue;

      const amountMatch = Math.abs(entry.amount - stmtAmount) < 0.01;
      const nearAmountMatch = Math.abs(entry.amount - stmtAmount) / Math.max(stmtAmount, 1) < 0.01;
      const exactDateMatch = entry.date === stmt.date;

      // Parse date difference in days
      const daysDiff = Math.abs(
        (new Date(entry.date).getTime() - new Date(stmt.date).getTime()) / 86_400_000
      );

      let confidence = 0;
      if (amountMatch && exactDateMatch) confidence = 0.95;
      else if (amountMatch && daysDiff <= 3) confidence = 0.75;
      else if (nearAmountMatch && exactDateMatch) confidence = 0.50;

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestConfidence >= 0.50) {
      usedBookIds.add(bestMatch.id);
      return {
        statementId: stmt.reference || `${stmt.date}-${stmtAmount}`,
        bookEntryId: bestMatch.id,
        date: stmt.date,
        description: stmt.description,
        amount: stmtAmount,
        type: stmtType,
        matched: true,
        confidence: bestConfidence,
      };
    }

    return {
      statementId: stmt.reference || `${stmt.date}-${stmtAmount}`,
      date: stmt.date,
      description: stmt.description,
      amount: stmtAmount,
      type: stmtType,
      matched: false,
      confidence: 0,
    };
  });
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
