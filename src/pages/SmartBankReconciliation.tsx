// src/pages/SmartBankReconciliation.tsx
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { ActionToolbar, Button, Input, Select, Badge } from "../components/ui";
import { Upload, Download, Eye, Trash2, Link, Unlink, Printer } from "lucide-react";

// Define interfaces
interface BankStatement {
  id: string;
  bankAccountId: string;
  bankAccountName: string;
  period: string; // "YYYY-MM" BS
  openingBalance: number; // from bank statement
  closingBalance: number; // from bank statement
  entries: BankStatementEntry[];
  companyId?: string;
  importedAt: string;
  importedBy: string;
}

interface BankStatementEntry {
  id: string;
  date: string; // ISO date
  description: string;
  reference: string; // cheque no or ref
  debitAmount: number; // money leaving bank
  creditAmount: number; // money entering bank
  balance: number; // running balance in bank statement
  matchedLedgerEntryId: string; // empty if unmatched
  isMatched: boolean;
  isException: boolean; // bank charge / interest auto-post needed
  exceptionType: "bank_charge" | "bank_interest" | "other" | "";
}

interface ReconciliationState {
  bankStatementBalance: number;
  ledgerBalance: number;
  adjustments: {
    outstandingCheques: number; // issued cheques not yet cleared
    depositInTransit: number; // deposits not yet shown in bank
    bankCharges: number; // bank charges to post
    bankInterest: number; // bank interest earned
  };
  reconciledBalance: number; // should equal bankStatementBalance
  difference: number; // reconciledBalance - bankStatementBalance (should be 0)
  isBalanced: boolean; // difference === 0
}

// Local storage helper functions
const loadStatements = (companyId: string): BankStatement[] => {
  if (typeof window === "undefined") return [];
  const key = `sutra_bank_statements_${companyId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
};

const saveStatement = (stmt: BankStatement, companyId: string): void => {
  if (typeof window === "undefined") return;
  const key = `sutra_bank_statements_${companyId}`;
  const existingStatements = loadStatements(companyId);
  const updatedStatements = existingStatements.filter((s) => s.id !== stmt.id);
  updatedStatements.push(stmt);
  localStorage.setItem(key, JSON.stringify(updatedStatements));
};

// CSV parsing function
const parseBankCSV = (csvText: string): BankStatementEntry[] => {
  if (!csvText) return [];
  const lines = csvText.split("\n");
  if (lines.length < 2) return [];

  // Find column indices (case-insensitive)
  const headers = lines[0]
    .toLowerCase()
    .split(",")
    .map((h) => h.trim());
  const dateIndex = headers.findIndex((h) => h.includes("date"));
  const descIndex = headers.findIndex((h) => h.includes("desc") || h.includes("particular"));
  const refIndex = headers.findIndex(
    (h) => h.includes("ref") || h.includes("chq") || h.includes("cheque"),
  );
  const debitIndex = headers.findIndex((h) => h.includes("debit") || h.includes("dr"));
  const creditIndex = headers.findIndex((h) => h.includes("credit") || h.includes("cr"));
  const balanceIndex = headers.findIndex((h) => h.includes("balance"));

  const entries: BankStatementEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");

    const entry: BankStatementEntry = {
      id: `entry-${Date.now()}-${i}`,
      date: (cols[dateIndex] || "").trim(),
      description: (cols[descIndex] || "").trim(),
      reference: (cols[refIndex] || "").trim(),
      debitAmount: parseFloat(cols[debitIndex]) || 0,
      creditAmount: parseFloat(cols[creditIndex]) || 0,
      balance: parseFloat(cols[balanceIndex]) || 0,
      matchedLedgerEntryId: "",
      isMatched: false,
      isException: false,
      exceptionType: "",
    };

    entries.push(entry);
  }

  return entries;
};

// Matching logic function
const autoMatchEntries = (
  ledgerEntries: any[],
  statementEntries: BankStatementEntry[],
): {
  matched: { ledgerId: string; statementId: string; matchScore: number }[];
  unmatched: string[];
} => {
  const matched: { ledgerId: string; statementId: string; matchScore: number }[] = [];
  const unmatchedStatementIds = new Set(statementEntries.map((se) => se.id));

  for (const stmtEntry of statementEntries) {
    let bestMatch: { ledgerId: string; matchScore: number } | null = null;

    for (const ledgerEntry of ledgerEntries) {
      // Skip if already matched
      if (matched.some((m) => m.ledgerId === ledgerEntry.id)) continue;

      let score = 0;
      const stmtAmount = stmtEntry.debitAmount || stmtEntry.creditAmount;
      const ledgerAmount = ledgerEntry.amount;

      // Exact amount match (crucial)
      if (Math.abs(stmtAmount - Math.abs(ledgerAmount)) < 0.01) {
        score += 50;

        // Date proximity bonus
        const stmtDate = new Date(stmtEntry.date).getTime();
        const ledgerDate = new Date(ledgerEntry.date).getTime();
        const diffDays = Math.abs((stmtDate - ledgerDate) / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) {
          if (diffDays === 0) score += 30;
          else if (diffDays <= 1) score += 20;
          else if (diffDays <= 2) score += 10;
          else if (diffDays <= 3) score += 5;
        }

        // Reference match bonus
        if (
          stmtEntry.reference &&
          ledgerEntry.chequeNo &&
          stmtEntry.reference.includes(ledgerEntry.chequeNo)
        ) {
          score += 50;
        }

        // Description keyword match bonus
        if (stmtEntry.description.toLowerCase().includes(ledgerEntry.description.toLowerCase())) {
          score += 20;
        }

        // Update best match if current score is higher
        if (!bestMatch || score > bestMatch.matchScore) {
          bestMatch = { ledgerId: ledgerEntry.id, matchScore: score };
        }
      }
    }

    // Consider matched if score is high enough
    if (bestMatch && bestMatch.matchScore >= 30) {
      matched.push({
        ledgerId: bestMatch.ledgerId,
        statementId: stmtEntry.id,
        matchScore: bestMatch.matchScore,
      });
      unmatchedStatementIds.delete(stmtEntry.id);
    }
  }

  return { matched, unmatched: Array.from(unmatchedStatementIds) };
};

// Compute reconciliation function
const computeReconciliation = (
  statementEntries: BankStatementEntry[],
  ledgerEntries: any[],
  manualMatches: Record<string, string>,
  openingBalance: number,
  closingBalance: number,
): ReconciliationState | null => {
  if (!statementEntries || !ledgerEntries) return null;

  // Calculate ledger balance based on matched and unmatched entries
  let ledgerBalance = openingBalance;
  ledgerEntries.forEach((le) => {
    if (le.type === "debit") ledgerBalance += le.amount;
    else if (le.type === "credit") ledgerBalance -= le.amount;
  });

  // Identify unmatched ledger entries
  const matchedLedgerIds = new Set([
    ...(manualMatches ? Object.values(manualMatches) : []),
    ...statementEntries.filter((se) => se.isMatched).map((se) => se.matchedLedgerEntryId),
  ]);

  const unmatchedLedgerEntries = ledgerEntries.filter((le) => !matchedLedgerIds.has(le.id));

  // Calculate adjustments
  const outstandingCheques = unmatchedLedgerEntries
    .filter((ue) => ue.type === "credit")
    .reduce((sum, ue) => sum + Math.abs(ue.amount), 0);

  const depositInTransit = unmatchedLedgerEntries
    .filter((ue) => ue.type === "debit")
    .reduce((sum, ue) => sum + Math.abs(ue.amount), 0);

  const bankCharges = statementEntries
    .filter((se) => se.isException && se.exceptionType === "bank_charge")
    .reduce((sum, se) => sum + se.debitAmount, 0);

  const bankInterest = statementEntries
    .filter((se) => se.isException && se.exceptionType === "bank_interest")
    .reduce((sum, se) => sum + se.creditAmount, 0);

  // Calculate adjusted balances
  const reconciledBalance =
    ledgerBalance - outstandingCheques + depositInTransit + bankCharges - bankInterest;
  const difference = reconciledBalance - closingBalance;
  const isBalanced = Math.abs(difference) < 0.01;

  return {
    bankStatementBalance: closingBalance,
    ledgerBalance,
    adjustments: {
      outstandingCheques,
      depositInTransit,
      bankCharges,
      bankInterest,
    },
    reconciledBalance,
    difference,
    isBalanced,
  };
};

const SmartBankReconciliation: React.FC = () => {
  const { companySettings, accounts, vouchers, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<"upload" | "match" | "reconcile" | "history">(
    "upload",
  );
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [csvError, setCsvError] = useState<string>("");
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [matchResults, setMatchResults] = useState<{ matched: any[]; unmatched: any[] }>({
    matched: [],
    unmatched: [],
  });
  const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
  const [reconciliation, setReconciliation] = useState<ReconciliationState | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);

  // Load statements and accounts on mount
  useEffect(() => {
    if (companySettings?.id) {
      const loadedStatements = loadStatements(companySettings.id);
      setStatements(loadedStatements);
    }
  }, [companySettings]);

  useEffect(() => {
    if (selectedStatement) {
      // Calculate balances from statement entries
      const sortedEntries = [...selectedStatement.entries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const calculatedOpening =
        sortedEntries[0]?.balance - sortedEntries[0].debitAmount + sortedEntries[0].creditAmount ||
        0;
      const calculatedClosing = sortedEntries[sortedEntries.length - 1]?.balance || 0;

      setOpeningBalance(calculatedOpening);
      setClosingBalance(calculatedClosing);
    }
  }, [selectedStatement]);

  useEffect(() => {
    if (selectedStatement && selectedBankAccount) {
      // Get ledger entries for the selected bank account from vouchers
      const ledger: any[] = [];
      vouchers.forEach((voucher) => {
        voucher.lines.forEach((line) => {
          if (line.accountId === selectedBankAccount) {
            ledger.push({
              id: `${voucher.id}-${line.id}`, // Unique identifier combining voucher and line ID
              voucherId: voucher.id,
              date: voucher.date,
              description: voucher.narration || `Voucher ${voucher.voucherNo}`,
              amount: line.debit || -line.credit || 0, // Positive for debit (inflow), negative for credit (outflow)
              type: line.debit ? "debit" : "credit",
              chequeNo: line.chequeNo || "", // Assuming voucher lines might have cheque numbers
            });
          }
        });
      });
      setLedgerEntries(ledger);
    }
  }, [selectedStatement, selectedBankAccount, vouchers]);

  useEffect(() => {
    if (selectedStatement && ledgerEntries.length > 0) {
      const computed = computeReconciliation(
        selectedStatement.entries,
        ledgerEntries,
        manualMatches,
        openingBalance,
        closingBalance,
      );
      setReconciliation(computed);
    }
  }, [selectedStatement, ledgerEntries, manualMatches, openingBalance, closingBalance]);

  // Helper to get bank accounts
  const bankAccounts = accounts.filter(
    (account) => account.group && account.group.toLowerCase().includes("bank"),
  );

  // Handle CSV Import
  const handleImportCSV = () => {
    try {
      const parsedEntries = parseBankCSV(csvText);
      if (parsedEntries.length === 0) {
        setCsvError("Could not parse any valid entries from the CSV.");
        return;
      }
      setCsvError("");

      const newStatement: BankStatement = {
        id: `stmt-${Date.now()}`,
        bankAccountId: selectedBankAccount,
        bankAccountName: bankAccounts.find((a) => a.id === selectedBankAccount)?.name || "Unknown",
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
        openingBalance: 0, // Calculated later
        closingBalance: 0, // Calculated later
        entries: parsedEntries,
        importedAt: new Date().toISOString(),
        importedBy: currentUser?.id || "system",
        companyId: companySettings?.id || "main",
      };

      setSelectedStatement(newStatement);
      setStatements((prev) => [...prev, newStatement]);
      saveStatement(newStatement, companySettings?.id || "main");
      setActiveTab("match"); // Switch to match tab after import
    } catch (error) {
      setCsvError("Failed to parse CSV: " + (error as Error).message);
    }
  };

  // Handle Auto-Matching
  const handleAutoMatch = () => {
    if (!selectedStatement || !ledgerEntries) return;

    const result = autoMatchEntries(ledgerEntries, selectedStatement.entries);

    // Update the statement entries with match results
    const updatedEntries = selectedStatement.entries.map((entry) => {
      const matchedResult = result.matched.find((m) => m.statementId === entry.id);
      if (matchedResult) {
        return {
          ...entry,
          isMatched: true,
          matchedLedgerEntryId: matchedResult.ledgerId,
        };
      }
      return entry;
    });

    const updatedStatement = {
      ...selectedStatement,
      entries: updatedEntries,
    };

    setSelectedStatement(updatedStatement);
    setStatements((prev) => prev.map((s) => (s.id === updatedStatement.id ? updatedStatement : s)));
    saveStatement(updatedStatement, companySettings?.id || "main");

    setMatchResults({
      matched: result.matched,
      unmatched: result.unmatched,
    });
  };

  // Handle Manual Match
  const handleManualMatch = (statementId: string, ledgerId: string) => {
    if (!selectedStatement) return;

    const updatedEntries = selectedStatement.entries.map((entry) =>
      entry.id === statementId
        ? { ...entry, isMatched: true, matchedLedgerEntryId: ledgerId }
        : entry,
    );

    const updatedStatement = {
      ...selectedStatement,
      entries: updatedEntries,
    };

    setSelectedStatement(updatedStatement);
    setStatements((prev) => prev.map((s) => (s.id === updatedStatement.id ? updatedStatement : s)));
    saveStatement(updatedStatement, companySettings?.id || "main");

    setManualMatches((prev) => ({ ...prev, [statementId]: ledgerId }));
  };

  // Mark as Exception
  const markAsException = (entryId: string, type: "bank_charge" | "bank_interest" | "other") => {
    if (!selectedStatement) return;

    const updatedEntries = selectedStatement.entries.map((entry) =>
      entry.id === entryId ? { ...entry, isException: true, exceptionType: type } : entry,
    );

    const updatedStatement = {
      ...selectedStatement,
      entries: updatedEntries,
    };

    setSelectedStatement(updatedStatement);
    setStatements((prev) => prev.map((s) => (s.id === updatedStatement.id ? updatedStatement : s)));
    saveStatement(updatedStatement, companySettings?.id || "main");
  };

  // Print Reconciliation
  const printReconciliation = () => {
    window.print();
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `NPR ${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // --- RENDER ---

  return (
    <div className="flex flex-col h-full bg-[#f5f6fa] pb-20">
      <ActionToolbar
        title="Smart Bank Reconciliation"
        subtitle="Upload bank statements, auto-match transactions, reconcile accounts"
      />

      {/* Bank Account Selector */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
            <Select
              value={selectedBankAccount}
              onChange={setSelectedBankAccount}
              options={bankAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
              placeholder="Select Bank Account"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
            <Input
              type="month"
              value={selectedStatement?.period || ""}
              onChange={(e) => {
                if (selectedStatement) {
                  const updated = { ...selectedStatement, period: e as unknown as string };
                  setSelectedStatement(updated);
                  setStatements((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
                  saveStatement(updated, companySettings?.id || "main");
                }
              }}
              disabled={!selectedStatement}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {(["upload", "match", "reconcile", "history"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? "text-[#1557b0] border-b-2 border-[#1557b0]"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Upload Statement Tab */}
        {activeTab === "upload" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Import Bank Statement</h2>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste your CSV data here..."
                rows={8}
                className="w-full font-mono text-sm border border-gray-300 rounded p-2"
              />
              {csvError && <p className="text-red-600 text-sm mt-1">{csvError}</p>}
              <div className="flex gap-2 mt-4">
                <Button onClick={handleImportCSV} disabled={!csvText.trim()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </div>

              {selectedStatement && (
                <div className="mt-6">
                  <h3 className="text-md font-semibold mb-2">Preview Entries</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#f5f6fa]">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Reference
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Debit
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Credit
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedStatement.entries.slice(0, 5).map((entry, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                              {entry.date}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.description}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {entry.reference}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : "-"}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : "-"}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {formatCurrency(entry.balance)}
                            </td>
                          </tr>
                        ))}
                        {selectedStatement.entries.length > 5 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-2 text-center text-[12px] text-gray-500"
                            >
                              ... and {selectedStatement.entries.length - 5} more entries
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        if (selectedStatement) {
                          saveStatement(selectedStatement, companySettings?.id || "main");
                          alert("Statement saved successfully!");
                        }
                      }}
                      variant="primary"
                    >
                      Save Statement
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Match Transactions Tab */}
        {activeTab === "match" && selectedStatement && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Match Transactions</h2>
                <Button onClick={handleAutoMatch}>
                  <Link className="h-4 w-4 mr-2" />
                  Auto-Match
                </Button>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                Matched: {selectedStatement.entries.filter((e) => e.isMatched).length}, Unmatched:{" "}
                {selectedStatement.entries.filter((e) => !e.isMatched).length}, Exceptions:{" "}
                {selectedStatement.entries.filter((e) => e.isException).length}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel: Statement Entries */}
                <div>
                  <h3 className="text-md font-semibold mb-2">Bank Statement Entries</h3>
                  <div className="overflow-y-auto max-h-[60vh] border rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#f5f6fa] sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedStatement.entries.map((entry) => {
                          const isMatched = entry.isMatched;
                          const isException = entry.isException;
                          const amount = entry.debitAmount || entry.creditAmount;
                          const type = entry.debitAmount > 0 ? "debit" : "credit";
                          return (
                            <tr
                              key={entry.id}
                              className={isMatched || isException ? "bg-green-50" : ""}
                            >
                              <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                                {entry.date}
                              </td>
                              <td className="px-4 py-2 text-[12px] text-gray-700">
                                {entry.description}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                                {type === "debit" ? "+" : "-"} {formatCurrency(amount)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {isException ? (
                                  <Badge variant="warning">Exception</Badge>
                                ) : isMatched ? (
                                  <Badge variant="success">Matched</Badge>
                                ) : (
                                  <Badge variant="default">Unmatched</Badge>
                                )}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {!isMatched && !isException && (
                                  <div className="flex justify-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        console.log("Manual match for", entry.id);
                                      }}
                                    >
                                      Match
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => markAsException(entry.id, "bank_charge")}
                                    >
                                      Bank Chg
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => markAsException(entry.id, "bank_interest")}
                                    >
                                      Int Earned
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Panel: Ledger Entries */}
                <div>
                  <h3 className="text-md font-semibold mb-2">Ledger Entries</h3>
                  <div className="overflow-y-auto max-h-[60vh] border rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-[#f5f6fa] sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {ledgerEntries.map((entry) => {
                          const type = entry.type;
                          return (
                            <tr key={entry.id}>
                              <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                                {entry.date}
                              </td>
                              <td className="px-4 py-2 text-[12px] text-gray-700">
                                {entry.description}
                              </td>
                              <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                                {type === "debit" ? "+" : "-"}{" "}
                                {formatCurrency(Math.abs(entry.amount))}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <Badge variant={type === "debit" ? "info" : "danger"}>
                                  {type.toUpperCase()}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reconciliation Tab */}
        {activeTab === "reconcile" && reconciliation && (
          <div className="space-y-6 print:space-y-2">
            <div className="bg-white p-6 rounded-lg shadow-sm print:shadow-none print:border">
              <div className="flex justify-between items-start mb-6 print:mb-4">
                <div>
                  <h2 className="text-xl font-bold print:text-lg">Bank Reconciliation Statement</h2>
                  <p className="text-gray-600 print:text-sm">
                    {selectedStatement?.bankAccountName || "Selected Account"} -{" "}
                    {selectedStatement?.period || "N/A"}
                  </p>
                </div>
                <Button onClick={printReconciliation} className="print:hidden">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Reconciliation
                </Button>
              </div>

              {/* Summary Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 print:hidden">
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-800">Balance as per Bank Statement</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatCurrency(reconciliation.bankStatementBalance)}
                  </p>
                </div>
                <div className="bg-gray-100 border border-gray-300 rounded p-4">
                  <p className="text-sm text-gray-800">Opening Balance</p>
                  <Input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(parseFloat(e as unknown as string) || 0)}
                    className="mt-1"
                    disabled
                  />
                </div>
                <div className="bg-gray-100 border border-gray-300 rounded p-4">
                  <p className="text-sm text-gray-800">Closing Balance</p>
                  <Input
                    type="number"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(parseFloat(e as unknown as string) || 0)}
                    className="mt-1"
                    disabled
                  />
                </div>
              </div>

              {/* Adjustment Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border rounded">
                  <thead className="bg-[#f5f6fa]">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Amount (NPR)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-700">
                        Balance as per Bank Statement
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-700 font-mono">
                        {formatCurrency(reconciliation.bankStatementBalance)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-700">
                        Add: Outstanding Deposits (Deposits in Transit)
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-700 font-mono">
                        + {formatCurrency(reconciliation.adjustments.depositInTransit)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-700">
                        Less: Outstanding Cheques
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-700 font-mono">
                        - {formatCurrency(reconciliation.adjustments.outstandingCheques)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-700">
                        Add: Bank Interest Earned
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-700 font-mono">
                        + {formatCurrency(reconciliation.adjustments.bankInterest)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-700">
                        Less: Bank Charges
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-700 font-mono">
                        - {formatCurrency(reconciliation.adjustments.bankCharges)}
                      </td>
                    </tr>
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-900">
                        Balance as per Books (Adjusted)
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-900 font-mono">
                        {formatCurrency(reconciliation.reconciledBalance)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-700">
                        Balance as per Ledger
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-700 font-mono">
                        {formatCurrency(reconciliation.ledgerBalance)}
                      </td>
                    </tr>
                    <tr
                      className={
                        Math.abs(reconciliation.difference) < 0.01
                          ? "bg-green-100 font-bold"
                          : "bg-red-100 font-bold"
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-gray-900">
                        DIFFERENCE
                      </td>
                      <td className="px-4 py-3 text-right text-[12px] text-gray-900 font-mono">
                        {formatCurrency(reconciliation.difference)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Status Message */}
              <div
                className={`mt-6 p-4 rounded-lg text-center ${
                  reconciliation.isBalanced
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : "bg-red-100 text-red-800 border border-red-300"
                }`}
              >
                {reconciliation.isBalanced ? (
                  <p className="font-bold">
                    ✓ RECONCILED — Balance as per Bank matches adjusted book balance
                  </p>
                ) : (
                  <p className="font-bold">
                    ✗ UNRECONCILED — Difference of {formatCurrency(reconciliation.difference)}.
                    Please review unmatched entries.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Reconciliation History</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#f5f6fa]">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Opening Balance
                      </th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Closing Balance
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Entries
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {statements
                      .filter((stmt) => stmt.bankAccountId === selectedBankAccount)
                      .map((stmt) => {
                        const rec = computeReconciliation(
                          stmt.entries,
                          ledgerEntries,
                          manualMatches,
                          stmt.openingBalance,
                          stmt.closingBalance,
                        );
                        const isBalanced = rec?.isBalanced || false;
                        return (
                          <tr key={stmt.id}>
                            <td className="px-4 py-2 whitespace-nowrap text-[12px] text-gray-700">
                              {stmt.period}
                            </td>
                            <td className="px-4 py-2 text-[12px] text-gray-700">
                              {stmt.bankAccountName}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {formatCurrency(stmt.openingBalance)}
                            </td>
                            <td className="px-4 py-2 text-right text-[12px] text-gray-700 font-mono">
                              {formatCurrency(stmt.closingBalance)}
                            </td>
                            <td className="px-4 py-2 text-center text-[12px] text-gray-700">
                              {stmt.entries.length}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Badge variant={isBalanced ? "success" : "danger"}>
                                {isBalanced ? "Reconciled" : "Pending"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedStatement(stmt);
                                    setActiveTab("reconcile");
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Are you sure you want to delete this statement?",
                                      )
                                    ) {
                                      const updated = statements.filter((s) => s.id !== stmt.id);
                                      setStatements(updated);
                                      if (selectedStatement?.id === stmt.id) {
                                        setSelectedStatement(null);
                                      }
                                      if (typeof window !== "undefined") {
                                        localStorage.setItem(
                                          `sutra_bank_statements_${companySettings?.id || "main"}`,
                                          JSON.stringify(updated),
                                        );
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartBankReconciliation;
