import React, { useState, useMemo, useEffect } from "react";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  Link,
  Unlink,
} from "lucide-react";
import { ActionToolbar, Card } from "../components/ui";
import { useStore } from "../store/useStore";
import { getDB } from "../lib/db";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";
import { isDebitNature } from "../lib/accounting";

interface BookEntry {
  id: string;
  date: string;
  voucherNo: string;
  description: string;
  debit: number;
  credit: number;
  reconciled: boolean;
}

interface StatementEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  reference: string;
  reconciled: boolean;
  matchedVoucherId?: string;
  reconciledVoucherId?: string;
  balance?: number;
}

interface Match {
  bookId: string;
  statementId: string;
}

export default function BankReconciliation() {
  const { vouchers, bankStatements, bankAccounts, accounts, currentUser, setCurrentPage } =
    useStore();

  const [selectedAccount, setSelectedAccount] = useState(bankAccounts[0]?.id || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedStmtId, setSelectedStmtId] = useState<string | null>(null);

  const handleSelectBook = (id: string) => {
    setSelectedBookId(selectedBookId === id ? null : id);
  };

  const handleSelectStmt = (id: string) => {
    setSelectedStmtId(selectedStmtId === id ? null : id);
  };

  const selectedBankAccount = useMemo(() => {
    return bankAccounts.find((ba) => ba.id === selectedAccount);
  }, [bankAccounts, selectedAccount]);

  const bankLedgerAccountId = selectedBankAccount?.accountId;

  const statementEntries = useMemo(() => {
    if (!selectedAccount) return [];
    return (bankStatements as any[])
      .filter(
        (s) =>
          s.bankAccountId === selectedAccount &&
          (!startDate || s.date >= startDate) &&
          (!endDate || s.date <= endDate),
      )
      .map((s) => ({
        ...s,
        description: s.narration || "",
        reference: (s as any).reference || "",
      })) as StatementEntry[];
  }, [bankStatements, selectedAccount, startDate, endDate]);

  // Load book entries (posted vouchers affecting this bank ledger)
  const bookEntries = useMemo(() => {
    if (!selectedAccount || !bankLedgerAccountId) return [];

    const entries: BookEntry[] = [];
    vouchers
      .filter((v) => {
        if (v.status !== "posted") return false;
        if (startDate && v.date < startDate) return false;
        if (endDate && v.date > endDate) return false;
        return v.lines.some((line) => line.accountId === bankLedgerAccountId);
      })
      .forEach((v) => {
        const bankLines = v.lines.filter((l) => l.accountId === bankLedgerAccountId);
        const totalDebit = bankLines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = bankLines.reduce((sum, l) => sum + (l.credit || 0), 0);

        const isReconciled = bankStatements.some(
          (s) => (s.reconciledVoucherId === v.id || s.matchedVoucherId === v.id) && s.reconciled,
        );

        entries.push({
          id: v.id,
          date: v.date,
          voucherNo: v.voucherNo,
          description: v.narration || "Bank Transaction",
          debit: totalDebit,
          credit: totalCredit,
          reconciled: isReconciled,
        });
      });
    return entries;
  }, [vouchers, bankStatements, selectedAccount, bankLedgerAccountId, startDate, endDate]);

  // Combine matches from IndexedDB and local matching state
  const currentMatches = useMemo(() => {
    const dbMatches: Match[] = [];
    statementEntries.forEach((stmt) => {
      const mvId = stmt.matchedVoucherId || stmt.reconciledVoucherId;
      if (mvId) {
        dbMatches.push({ bookId: mvId, statementId: stmt.id });
      }
    });

    const allMatches = [...dbMatches];
    matches.forEach((m) => {
      if (!allMatches.some((am) => am.bookId === m.bookId && am.statementId === m.statementId)) {
        allMatches.push(m);
      }
    });
    return allMatches;
  }, [statementEntries, matches]);

  // Lock status check
  const isPeriodLocked = useMemo(() => {
    const hasReconciled = statementEntries.some((s) => s.reconciled);
    const isAdmin = currentUser?.role === "admin";
    return hasReconciled && !isAdmin;
  }, [statementEntries, currentUser]);

  // Automatic Matching algorithm
  const autoReconcile = () => {
    if (isPeriodLocked) {
      toast.error("This period is reconciled and locked.");
      return;
    }
    const newMatches: Match[] = [];
    const unmatchedBook = bookEntries.filter(
      (b) => !b.reconciled && !currentMatches.some((m) => m.bookId === b.id),
    );
    const unmatchedStmt = statementEntries.filter(
      (s) => !s.reconciled && !currentMatches.some((m) => m.statementId === s.id),
    );

    unmatchedBook.forEach((book) => {
      unmatchedStmt.forEach((stmt) => {
        if (newMatches.some((m) => m.bookId === book.id || m.statementId === stmt.id)) return;

        const dateDiff =
          Math.abs(new Date(book.date).getTime() - new Date(stmt.date).getTime()) /
          (1000 * 60 * 60 * 24);

        const bookAmt = book.debit || book.credit;
        const stmtAmt = stmt.debit || stmt.credit;
        const amountMatch = bookAmt === stmtAmt;

        if (amountMatch && dateDiff <= 3) {
          newMatches.push({ bookId: book.id, statementId: stmt.id });
        }
      });
    });

    if (newMatches.length > 0) {
      setMatches([...matches, ...newMatches]);
      toast.success(`${newMatches.length} entries auto-matched`);
    } else {
      toast("No matching entries found");
    }
  };

  const manualMatch = () => {
    if (isPeriodLocked) {
      toast.error("Locked: Cannot modify reconciled period.");
      return;
    }
    if (selectedBookId && selectedStmtId) {
      setMatches([...matches, { bookId: selectedBookId, statementId: selectedStmtId }]);
      setSelectedBookId(null);
      setSelectedStmtId(null);
      toast.success("Matched entries manually");
    }
  };

  const handleUnmatch = async (bookId: string, stmtId: string) => {
    if (isPeriodLocked) {
      toast.error("Locked: Cannot modify reconciled period.");
      return;
    }
    // Remove local state match
    setMatches(matches.filter((m) => !(m.bookId === bookId && m.statementId === stmtId)));

    // Remove DB saved match
    const stmt = bankStatements.find((s) => s.id === stmtId);
    if (stmt) {
      const db = getDB();
      await db.bankStatements.update(stmtId, {
        reconciled: false,
        reconciledVoucherId: undefined,
        matchedVoucherId: undefined,
        reconciledDate: undefined,
      });
      await useStore.getState().initializeApp();
      toast.success("Unmatched entries");
    }
  };

  const completeReconciliation = async () => {
    if (isPeriodLocked) {
      toast.error("This period is reconciled and locked.");
      return;
    }
    if (confirm("Mark matched entries as reconciled? Reconciled periods will be locked.")) {
      const db = getDB();
      const store = useStore.getState();

      for (const m of currentMatches) {
        await db.bankStatements.update(m.statementId, {
          reconciled: true,
          reconciledVoucherId: m.bookId,
          matchedVoucherId: m.bookId,
          reconciledDate: new Date().toISOString().split("T")[0],
        });
      }

      setMatches([]);
      await store.initializeApp();
      toast.success("Reconciliation marked and locked!");
    }
  };

  const handleImportNavigation = () => {
    if (!selectedAccount) {
      toast.error("Please select a bank account first.");
      return;
    }
    // Rearrange bankAccounts so selected bank account is at index 0 for pre-selection on BankStatementImport
    const store = useStore.getState();
    const matchedIdx = store.bankAccounts.findIndex((ba) => ba.id === selectedAccount);
    if (matchedIdx > 0) {
      const newBankAccounts = [...store.bankAccounts];
      const [selectedItem] = newBankAccounts.splice(matchedIdx, 1);
      newBankAccounts.unshift(selectedItem);
      useStore.setState({ bankAccounts: newBankAccounts });
    }
    store.setCurrentPage("bank-import");
  };

  // Align matched and unmatched rows chronologically
  const alignedRows = useMemo(() => {
    const rows: {
      id: string;
      book?: BookEntry;
      statement?: StatementEntry;
      isMatched: boolean;
    }[] = [];

    const matchedBookIds = new Set(currentMatches.map((m) => m.bookId));
    const matchedStmtIds = new Set(currentMatches.map((m) => m.statementId));

    // Matched pairs
    currentMatches.forEach((m) => {
      const book = bookEntries.find((b) => b.id === m.bookId);
      const statement = statementEntries.find((s) => s.id === m.statementId);
      if (book || statement) {
        rows.push({
          id: `match-${m.bookId}-${m.statementId}`,
          book,
          statement,
          isMatched: true,
        });
      }
    });

    // Unmatched books
    bookEntries.forEach((b) => {
      if (!matchedBookIds.has(b.id)) {
        rows.push({
          id: `book-${b.id}`,
          book: b,
          isMatched: false,
        });
      }
    });

    // Unmatched statements
    statementEntries.forEach((s) => {
      if (!matchedStmtIds.has(s.id)) {
        rows.push({
          id: `stmt-${s.id}`,
          statement: s,
          isMatched: false,
        });
      }
    });

    return rows.sort((a, b) => {
      const dateA = a.book?.date || a.statement?.date || "";
      const dateB = b.book?.date || b.statement?.date || "";
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [bookEntries, statementEntries, currentMatches]);

  // Reconciliation summary calculations
  const statementBalance = useMemo(() => {
    if (statementEntries.length === 0) return 0;
    const sorted = [...statementEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    return sorted[sorted.length - 1].balance || 0;
  }, [statementEntries]);

  const depositsInTransit = useMemo(() => {
    return bookEntries
      .filter((b) => !b.reconciled && !currentMatches.some((m) => m.bookId === b.id) && b.debit > 0)
      .reduce((sum, e) => sum + e.debit, 0);
  }, [bookEntries, currentMatches]);

  const outstandingCheques = useMemo(() => {
    return statementEntries
      .filter(
        (s) => !s.reconciled && !currentMatches.some((m) => m.statementId === s.id) && s.debit > 0,
      )
      .reduce((sum, e) => sum + e.debit, 0);
  }, [statementEntries, currentMatches]);

  const adjustedBalance = statementBalance + depositsInTransit - outstandingCheques;

  const bookBalance = useMemo(() => {
    if (!bankLedgerAccountId) return 0;
    const account = accounts.find((a) => a.id === bankLedgerAccountId);
    const opening = account?.openingBalance || 0;
    const openingType = account && isDebitNature(account.type) ? "Dr" : "Cr";
    let bal = openingType === "Dr" ? opening : -opening;

    vouchers
      .filter((v) => v.status === "posted")
      .forEach((v) => {
        v.lines.forEach((line) => {
          if (line.accountId === bankLedgerAccountId) {
            bal += (line.debit || 0) - (line.credit || 0);
          }
        });
      });
    return bal;
  }, [vouchers, accounts, bankLedgerAccountId]);

  const difference = adjustedBalance - bookBalance;

  return (
    <div className="space-y-6 page-wrapper">
      <ActionToolbar
        title="Bank Reconciliation"
        subtitle="Match bank statement with book entries"
        secondaryActions={[
          {
            label: "Auto Reconcile",
            onClick: autoReconcile,
            icon: <RefreshCw className="w-4 h-4" />,
          },
          {
            label: "Mark as Reconciled",
            onClick: completeReconciliation,
            icon: <CheckCircle className="w-4 h-4" />,
          },
        ]}
      />

      {isPeriodLocked && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md text-[12px] flex items-center gap-2 animate-fadeIn">
          <Lock className="h-4 w-4 text-red-600" />
          <span className="font-bold">Reconciled & Locked:</span>
          <span>
            This period has been reconciled. Only Admin accounts can make changes or un-reconcile
            entries.
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 border border-gray-200 rounded-md">
          <div className="text-[10px] uppercase font-bold text-gray-500">
            Bank Statement Balance
          </div>
          <div className="mt-1 text-lg font-bold text-gray-800 font-mono">
            Rs. {formatNumber(statementBalance)}
          </div>
        </div>
        <div className="bg-white p-4 border border-gray-200 rounded-md">
          <div className="text-[10px] uppercase font-bold text-gray-500">Book Balance</div>
          <div className="mt-1 text-lg font-bold text-gray-800 font-mono">
            Rs. {formatNumber(bookBalance)}
          </div>
        </div>
        {Math.abs(difference) < 0.01 ? (
          <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-md">
            <div className="text-[10px] uppercase font-bold text-green-600">Difference</div>
            <div className="mt-1 text-lg font-bold font-mono">
              Rs. {formatNumber(Math.abs(difference))}
            </div>
            <div className="text-xs mt-1 font-semibold flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Reconciled
            </div>
          </div>
        ) : (
          <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-md">
            <div className="text-[10px] uppercase font-bold text-red-600">Difference</div>
            <div className="mt-1 text-lg font-bold font-mono">
              Rs. {formatNumber(Math.abs(difference))}
            </div>
            <div className="text-xs mt-1 font-semibold flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Unreconciled
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-md border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Bank Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">Select Bank Account</option>
              {bankAccounts.map((ba) => {
                const acc = accounts.find((a) => a.id === ba.accountId);
                return (
                  <option key={ba.id} value={ba.id}>
                    {ba.bankName} - {ba.accountNo} ({acc?.name || ""})
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none"
            />
          </div>
          <div>
            <button
              onClick={handleImportNavigation}
              className="h-8 w-full bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Import Statement</span>
            </button>
          </div>
        </div>
      </div>

      {selectedBookId && selectedStmtId && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md flex items-center justify-between animate-fadeIn">
          <span className="text-[12px] text-blue-900 font-semibold">
            Ready to match selected book and statement entries.
          </span>
          <button
            onClick={manualMatch}
            className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md cursor-pointer"
          >
            Match Entries
          </button>
        </div>
      )}

      {/* Aligned Side-by-Side Reconciliation Table */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
              <tr>
                <th
                  colSpan={5}
                  className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center border-r border-[#c5cad8]"
                >
                  Book Entries (Vouchers)
                </th>
                <th
                  colSpan={5}
                  className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-center"
                >
                  Bank Statement Entries
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  Actions
                </th>
              </tr>
              <tr className="bg-[#f7f9fc] border-t border-gray-200">
                {/* Book cols */}
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-left">
                  Date
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-left">
                  Voucher
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-left">
                  Description
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-right">
                  Debit
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-right border-r border-gray-200">
                  Credit
                </th>
                {/* Statement cols */}
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-left">
                  Date
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-left">
                  Description
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-right">
                  Debit
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-right">
                  Credit
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-left">
                  Ref
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {alignedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-gray-500 text-[12px]">
                    No entries to display. Please select a bank account and date range.
                  </td>
                </tr>
              ) : (
                alignedRows.map((row) => {
                  const isRowMatched = row.isMatched;
                  const rowClass = isRowMatched
                    ? "bg-green-50/70 hover:bg-green-100/70"
                    : "bg-white hover:bg-gray-50";

                  const bookSelected = selectedBookId === row.book?.id;
                  const stmtSelected = selectedStmtId === row.statement?.id;

                  return (
                    <tr key={row.id} className={`${rowClass} border-b border-gray-150`}>
                      {/* Book columns */}
                      {row.book ? (
                        <>
                          <td
                            className={`px-3 py-[7px] text-[12px] text-gray-700 cursor-pointer ${
                              !isRowMatched ? "bg-yellow-50/50" : ""
                            } ${bookSelected ? "ring-2 ring-[#1557b0]" : ""}`}
                            onClick={() => !isRowMatched && handleSelectBook(row.book!.id)}
                          >
                            {row.book.date}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-semibold">
                            {row.book.voucherNo}
                          </td>
                          <td
                            className="px-3 py-[7px] text-[12px] text-gray-700 truncate max-w-[150px]"
                            title={row.book.description}
                          >
                            {row.book.description}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            {row.book.debit > 0 ? `Rs. ${formatNumber(row.book.debit)}` : "-"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt border-r border-gray-200">
                            {row.book.credit > 0 ? `Rs. ${formatNumber(row.book.credit)}` : "-"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50 border-r border-gray-200"></td>
                        </>
                      )}

                      {/* Statement columns */}
                      {row.statement ? (
                        <>
                          <td
                            className={`px-3 py-[7px] text-[12px] text-gray-700 cursor-pointer ${
                              !isRowMatched ? "bg-yellow-50/50" : ""
                            } ${stmtSelected ? "ring-2 ring-[#1557b0]" : ""}`}
                            onClick={() => !isRowMatched && handleSelectStmt(row.statement!.id)}
                          >
                            {row.statement.date}
                          </td>
                          <td
                            className="px-3 py-[7px] text-[12px] text-gray-700 truncate max-w-[150px]"
                            title={row.statement.description}
                          >
                            {row.statement.description}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            {row.statement.debit > 0
                              ? `Rs. ${formatNumber(row.statement.debit)}`
                              : "-"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                            {row.statement.credit > 0
                              ? `Rs. ${formatNumber(row.statement.credit)}`
                              : "-"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-500 font-mono">
                            {row.statement.reference || "-"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                          <td className="px-3 py-[7px] bg-gray-100/50"></td>
                        </>
                      )}

                      {/* Actions */}
                      <td className="px-3 py-[7px] text-[12px] text-right whitespace-nowrap">
                        {isRowMatched ? (
                          <button
                            onClick={() => handleUnmatch(row.book!.id, row.statement!.id)}
                            disabled={isPeriodLocked}
                            className="text-red-600 hover:text-red-800 font-semibold cursor-pointer disabled:opacity-50"
                            title="Unmatch Entries"
                          >
                            <Unlink className="h-3.5 w-3.5 inline" /> Unmatch
                          </button>
                        ) : (
                          <span className="text-gray-400 font-mono text-[10px] uppercase">
                            Unmatched
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-md border border-gray-200">
        <h3 className="text-[12px] font-bold text-gray-700 mb-4 uppercase tracking-wide">
          Reconciliation Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-600">Balance as per Bank Statement:</span>
              <span className="font-semibold text-gray-800 font-mono">
                Rs. {formatNumber(statementBalance)}
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-[#059669]">
              <span>Add: Deposits in Transit:</span>
              <span className="font-semibold font-mono">Rs. {formatNumber(depositsInTransit)}</span>
            </div>
            <div className="flex justify-between text-[12px] text-[#dc2626]">
              <span>Less: Outstanding Cheques:</span>
              <span className="font-semibold font-mono">
                Rs. {formatNumber(outstandingCheques)}
              </span>
            </div>
            <div className="flex justify-between text-[12px] font-bold border-t pt-2">
              <span>Adjusted Bank Balance:</span>
              <span className="font-mono">Rs. {formatNumber(adjustedBalance)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-600">Balance as per Books:</span>
              <span className="font-semibold text-gray-800 font-mono">
                Rs. {formatNumber(bookBalance)}
              </span>
            </div>
            <div
              className={`flex justify-between text-[12px] font-bold border-t pt-2 ${
                Math.abs(difference) < 0.01 ? "text-[#059669]" : "text-[#dc2626]"
              }`}
            >
              <span>Difference:</span>
              <span className="font-mono">Rs. {formatNumber(Math.abs(difference))}</span>
            </div>
            {Math.abs(difference) < 0.01 ? (
              <div className="flex items-center space-x-2 text-[#059669] text-[12px] font-bold mt-2">
                <CheckCircle className="w-4 h-4" />
                <span>Reconciliation Balanced!</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-amber-600 text-[12px] font-bold mt-2">
                <AlertCircle className="w-4 h-4" />
                <span>Reconciliation not balanced</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
