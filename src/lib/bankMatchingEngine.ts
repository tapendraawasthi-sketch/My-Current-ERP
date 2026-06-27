// src/lib/bankMatchingEngine.ts
// Pure matching engine — no side effects, no Dexie/store imports.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookEntry {
  id: string;          // "{voucherId}-{lineIndex}"
  date: string;        // YYYY-MM-DD (AD)
  amount: number;
  description: string; // voucher narration
  voucherId: string;
  voucherNo: string;
  type: 'debit' | 'credit'; // debit = money IN to bank acct, credit = money OUT
  refNo?: string;      // cheque number / reference
  partyName?: string;
}

export interface StatementEntry {
  id: string;
  date: string;        // YYYY-MM-DD (AD)
  description: string;
  refNo?: string;
  debit: number;       // money going OUT of account (withdrawal)
  credit: number;      // money coming IN (deposit)
  balance: number;
  bankFormat?: string;
}

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type MatchStatus = 'matched' | 'unmatched' | 'partial';

export interface MatchPair {
  bookEntry: BookEntry;
  statementEntry: StatementEntry;
  confidence: MatchConfidence;
  matchReason: string;
  status: MatchStatus;
}

export interface MatchingResult {
  matched: MatchPair[];
  unmatchedBook: BookEntry[];
  unmatchedStatement: StatementEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysDiff(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

function amountNear(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

function containsWord(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 3) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Extract a likely cheque/ref number from a string (3–12 digits or alphanums) */
function extractRef(text: string): string {
  const m = text.match(/\b([A-Z]{0,3}\d{3,12})\b/i);
  return m ? m[1].toUpperCase() : '';
}

function getStatementAmount(stmt: StatementEntry): { amount: number; type: 'debit' | 'credit' } {
  if (stmt.credit > 0) return { amount: stmt.credit, type: 'credit' };
  return { amount: stmt.debit, type: 'debit' };
}

// ─── Matching Engine ──────────────────────────────────────────────────────────

/**
 * Match book entries against statement entries using 5-tier priority rules.
 *
 * Rule 1 (HIGH):   Amount within Rs.0.01 + same date
 * Rule 2 (MEDIUM): Amount within Rs.0.01 + date within ±2 days
 * Rule 3 (HIGH):   Amount match + cheque/ref number appears in narration
 * Rule 4 (MEDIUM): Amount match + party name appears in bank description
 * Rule 5:          No match → UNMATCHED
 *
 * Note: "book debit" = money received into bank account = "statement credit"
 *       "book credit" = money paid from bank account   = "statement debit"
 */
export function runMatchingEngine(
  bookEntries: BookEntry[],
  statementEntries: StatementEntry[]
): MatchingResult {
  const usedBookIds = new Set<string>();
  const usedStmtIds = new Set<string>();
  const matched: MatchPair[] = [];

  // ── Rule 1: Exact amount + exact date ──────────────────────────────────────
  for (const stmt of statementEntries) {
    if (usedStmtIds.has(stmt.id)) continue;
    const { amount: stmtAmt, type: stmtType } = getStatementAmount(stmt);
    // Book type opposite to statement type (book debit ↔ stmt credit)
    const bookType = stmtType === 'credit' ? 'debit' : 'credit';

    for (const book of bookEntries) {
      if (usedBookIds.has(book.id)) continue;
      if (book.type !== bookType) continue;
      if (!amountNear(book.amount, stmtAmt)) continue;
      if (book.date !== stmt.date) continue;

      matched.push({
        bookEntry: book,
        statementEntry: stmt,
        confidence: 'HIGH',
        matchReason: 'Exact amount + exact date',
        status: 'matched',
      });
      usedBookIds.add(book.id);
      usedStmtIds.add(stmt.id);
      break;
    }
  }

  // ── Rule 3: Amount match + cheque/ref number match ─────────────────────────
  // (before Rule 2 — ref match is more reliable than ±2 day date window)
  for (const stmt of statementEntries) {
    if (usedStmtIds.has(stmt.id)) continue;
    const { amount: stmtAmt, type: stmtType } = getStatementAmount(stmt);
    const bookType = stmtType === 'credit' ? 'debit' : 'credit';
    const stmtRef = extractRef(stmt.refNo || stmt.description);

    if (!stmtRef) continue;

    for (const book of bookEntries) {
      if (usedBookIds.has(book.id)) continue;
      if (book.type !== bookType) continue;
      if (!amountNear(book.amount, stmtAmt)) continue;

      const bookRef = extractRef(book.refNo || book.description);
      const refMatch =
        (bookRef && stmtRef && bookRef === stmtRef) ||
        containsWord(stmt.description, bookRef) ||
        containsWord(book.description, stmtRef);

      if (!refMatch) continue;

      matched.push({
        bookEntry: book,
        statementEntry: stmt,
        confidence: 'HIGH',
        matchReason: `Amount + ref/cheque match (${stmtRef})`,
        status: 'matched',
      });
      usedBookIds.add(book.id);
      usedStmtIds.add(stmt.id);
      break;
    }
  }

  // ── Rule 2: Amount match + date within ±2 days ─────────────────────────────
  for (const stmt of statementEntries) {
    if (usedStmtIds.has(stmt.id)) continue;
    const { amount: stmtAmt, type: stmtType } = getStatementAmount(stmt);
    const bookType = stmtType === 'credit' ? 'debit' : 'credit';

    for (const book of bookEntries) {
      if (usedBookIds.has(book.id)) continue;
      if (book.type !== bookType) continue;
      if (!amountNear(book.amount, stmtAmt)) continue;
      if (daysDiff(book.date, stmt.date) > 2) continue;

      matched.push({
        bookEntry: book,
        statementEntry: stmt,
        confidence: 'MEDIUM',
        matchReason: `Amount match + date within ±2 days (book: ${book.date}, stmt: ${stmt.date})`,
        status: 'partial',
      });
      usedBookIds.add(book.id);
      usedStmtIds.add(stmt.id);
      break;
    }
  }

  // ── Rule 4: Amount match + party name in bank description ──────────────────
  for (const stmt of statementEntries) {
    if (usedStmtIds.has(stmt.id)) continue;
    const { amount: stmtAmt, type: stmtType } = getStatementAmount(stmt);
    const bookType = stmtType === 'credit' ? 'debit' : 'credit';

    for (const book of bookEntries) {
      if (usedBookIds.has(book.id)) continue;
      if (book.type !== bookType) continue;
      if (!amountNear(book.amount, stmtAmt)) continue;

      const nameMatch =
        (book.partyName && containsWord(stmt.description, book.partyName)) ||
        containsWord(stmt.description, book.description) ||
        containsWord(book.description, stmt.description);

      if (!nameMatch) continue;

      matched.push({
        bookEntry: book,
        statementEntry: stmt,
        confidence: 'MEDIUM',
        matchReason: 'Amount match + party/narration in bank description',
        status: 'partial',
      });
      usedBookIds.add(book.id);
      usedStmtIds.add(stmt.id);
      break;
    }
  }

  // ── Collect unmatched ──────────────────────────────────────────────────────
  const unmatchedBook = bookEntries.filter(b => !usedBookIds.has(b.id));
  const unmatchedStatement = statementEntries.filter(s => !usedStmtIds.has(s.id));

  return { matched, unmatchedBook, unmatchedStatement };
}

// ─── Manual Match Helper ──────────────────────────────────────────────────────

export function createManualMatch(
  book: BookEntry,
  stmt: StatementEntry
): MatchPair {
  return {
    bookEntry: book,
    statementEntry: stmt,
    confidence: 'HIGH',
    matchReason: 'Manually matched by user',
    status: 'matched',
  };
}

// ─── Reconciliation Summary ───────────────────────────────────────────────────

export interface ReconciliationSummary {
  statementClosingBalance: number;
  unclearedCheques: { entry: BookEntry; amount: number }[];
  depositsInTransit: { entry: BookEntry; amount: number }[];
  adjustedStatementBalance: number;
  bookBalance: number;
  difference: number;
  isReconciled: boolean;
}

export function computeReconciliationSummary(
  bookEntries: BookEntry[],
  unmatchedBook: BookEntry[],
  statementEntries: StatementEntry[],
  bookRunningBalance: number
): ReconciliationSummary {
  // Statement closing balance = last entry's balance field (if available)
  const sorted = [...statementEntries].sort((a, b) => a.date.localeCompare(b.date));
  const lastStmt = sorted[sorted.length - 1];
  const statementClosingBalance = lastStmt?.balance ?? 0;

  // Uncleared cheques = book credit entries (payments) not yet in statement
  const unclearedCheques = unmatchedBook
    .filter(b => b.type === 'credit')
    .map(b => ({ entry: b, amount: b.amount }));

  // Deposits in transit = book debit entries (receipts) not yet in statement
  const depositsInTransit = unmatchedBook
    .filter(b => b.type === 'debit')
    .map(b => ({ entry: b, amount: b.amount }));

  const totalUncleared = unclearedCheques.reduce((s, x) => s + x.amount, 0);
  const totalTransit   = depositsInTransit.reduce((s, x) => s + x.amount, 0);

  // Standard bank reconciliation formula:
  // Adjusted Bank Balance = Statement Balance - Uncleared Cheques + Deposits in Transit
  const adjustedStatementBalance = statementClosingBalance - totalUncleared + totalTransit;
  const difference = Math.round((bookRunningBalance - adjustedStatementBalance) * 100) / 100;

  return {
    statementClosingBalance,
    unclearedCheques,
    depositsInTransit,
    adjustedStatementBalance,
    bookBalance: bookRunningBalance,
    difference,
    isReconciled: Math.abs(difference) < 0.01,
  };
}
