import { BankStatement } from "./types";
import { generateId } from "./utils";

export interface ColumnMapping {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance: number;
}

export function parseCSVBankStatement(
  csvText: string,
  columnMapping: ColumnMapping,
  bankAccountId: string
): BankStatement[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return []; // At least header + 1 row

  const statements: BankStatement[] = [];

  // Skip the first row (header)
  for (let i = 1; i < lines.length; i++) {
    // Basic CSV splitting, considering quotes
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    // Alternative simpler split if standard comma separation (for MVP)
    const row = lines[i].split(',').map(s => s.replace(/^"(.*)"$/, '$1').trim());

    if (row.length < Object.values(columnMapping).filter(v => v >= 0).length) continue;

    const dateStr = row[columnMapping.date] || "";
    const description = row[columnMapping.description] || "";
    const debitStr = columnMapping.debit >= 0 ? row[columnMapping.debit] : "";
    const creditStr = columnMapping.credit >= 0 ? row[columnMapping.credit] : "";
    const balanceStr = columnMapping.balance >= 0 ? row[columnMapping.balance] : "";

    // Parse date (DD/MM/YYYY or YYYY-MM-DD)
    let parsedDate = dateStr;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) { // DD/MM/YYYY
          parsedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }

    const parseAmount = (str: string): number => {
      if (!str) return 0;
      let cleanStr = str.replace(/,/g, '');
      const isDr = cleanStr.toLowerCase().endsWith('dr');
      const isCr = cleanStr.toLowerCase().endsWith('cr');
      cleanStr = cleanStr.replace(/dr|cr/ig, '').trim();
      let val = parseFloat(cleanStr);
      if (isNaN(val)) return 0;
      return val;
    };

    let debit = parseAmount(debitStr);
    let credit = parseAmount(creditStr);
    const balance = parseAmount(balanceStr);

    // Some bank statements put both debit and credit in one column with Dr/Cr suffix
    if (columnMapping.debit === columnMapping.credit) {
      const combinedStr = debitStr; // same as creditStr
      const cleanCombined = combinedStr.replace(/,/g, '').toLowerCase();
      if (cleanCombined.endsWith('dr')) {
        debit = parseAmount(combinedStr);
        credit = 0;
      } else if (cleanCombined.endsWith('cr')) {
        credit = parseAmount(combinedStr);
        debit = 0;
      } else {
        // Fallback: If amount is negative, consider it debit, else credit (or vice versa, but usually bank statement credit is positive balance for customer)
        const val = parseFloat(cleanCombined);
        if (val < 0) {
          debit = Math.abs(val);
          credit = 0;
        } else {
          credit = val;
          debit = 0;
        }
      }
    }

    if (debit === 0 && credit === 0) continue; // Skip lines with no amount

    statements.push({
      id: generateId("bst"),
      bankAccountId,
      date: parsedDate,
      narration: description,
      debit,
      credit,
      balance,
      reconciled: false
    });
  }

  return statements;
}

export interface BookEntry {
  id: string; // This should be JournalLine ID or JournalEntry ID
  date: string;
  amount: number;
  description: string;
  ledgerId: string;
  type: 'debit' | 'credit';
}

export interface MatchResult {
  bookId: string;
  statementId: string;
  matchType: 'exact' | 'amount-match' | 'unmatched-book' | 'unmatched-statement';
}

export function autoMatchStatements(
  bookEntries: BookEntry[],
  statementEntries: BankStatement[],
  toleranceDays: number = 3
): MatchResult[] {
  const matches: MatchResult[] = [];
  const matchedBookIds = new Set<string>();
  const matchedStatementIds = new Set<string>();

  // Helper to parse date to ms
  const getTime = (d: string) => new Date(d).getTime();

  // 1. Exact Matches (Same Amount & Same Date within tolerance)
  for (const book of bookEntries) {
    if (matchedBookIds.has(book.id)) continue;

    for (const stmt of statementEntries) {
      if (matchedStatementIds.has(stmt.id)) continue;

      // In a bank statement:
      // A company's "Debit" to bank ledger means money went IN (Bank owes company). So bank statement should show "Credit" (Deposit).
      // However, usually we reconcile by matching Book Debit == Statement Credit, and Book Credit == Statement Debit.
      // Or we just match raw amounts if they align directly depending on how the CSV was parsed.
      // Let's assume standard reconciliation: Book Debit (Receipt) matches Statement Credit (Deposit).
      // Book Credit (Payment) matches Statement Debit (Withdrawal).
      
      const bookAmount = book.amount;
      const stmtAmount = book.type === 'debit' ? stmt.credit : stmt.debit;

      if (bookAmount > 0 && bookAmount === stmtAmount) {
        const daysDiff = Math.abs(getTime(book.date) - getTime(stmt.date)) / (1000 * 60 * 60 * 24);
        if (daysDiff <= toleranceDays) {
          matches.push({
            bookId: book.id,
            statementId: stmt.id,
            matchType: 'exact'
          });
          matchedBookIds.add(book.id);
          matchedStatementIds.add(stmt.id);
          break; // Found match for this book entry
        }
      }
    }
  }

  // 2. Amount Matches (Same Amount but date > tolerance)
  for (const book of bookEntries) {
    if (matchedBookIds.has(book.id)) continue;

    for (const stmt of statementEntries) {
      if (matchedStatementIds.has(stmt.id)) continue;

      const bookAmount = book.amount;
      const stmtAmount = book.type === 'debit' ? stmt.credit : stmt.debit;

      if (bookAmount > 0 && bookAmount === stmtAmount) {
        matches.push({
          bookId: book.id,
          statementId: stmt.id,
          matchType: 'amount-match'
        });
        matchedBookIds.add(book.id);
        matchedStatementIds.add(stmt.id);
        break;
      }
    }
  }

  // 3. Unmatched Book
  for (const book of bookEntries) {
    if (!matchedBookIds.has(book.id)) {
      matches.push({
        bookId: book.id,
        statementId: "",
        matchType: 'unmatched-book'
      });
    }
  }

  // 4. Unmatched Statement
  for (const stmt of statementEntries) {
    if (!matchedStatementIds.has(stmt.id)) {
      matches.push({
        bookId: "",
        statementId: stmt.id,
        matchType: 'unmatched-statement'
      });
    }
  }

  return matches;
}
