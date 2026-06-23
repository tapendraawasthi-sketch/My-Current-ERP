import React, { useState, useMemo, useRef } from "react";
import { Upload, CheckCircle, RefreshCw, Plus, Link as LinkIcon, Unlink } from "lucide-react";
import { ActionToolbar, Select, NepaliDatePicker, Button } from "../components/ui";
import { useStore } from "../store/useStore";
import { parseCSVBankStatement, autoMatchStatements, BookEntry, MatchResult } from "../lib/bankUtils";
import { formatNumber, generateId } from "../lib/utils";
import toast from "react-hot-toast";
import { BankStatement, VoucherType, VoucherStatus, JournalEntryLine } from "../lib/types";
import { formatADToBS } from "../lib/nepaliDate";

export default function BankReconciliation() {
  const { 
    accounts, 
    journalEntries, 
    bankStatements, 
    importBankStatements, 
    updateBankStatement, 
    addVoucher 
  } = useStore();

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state
  const [colMapping, setColMapping] = useState({
    date: 0,
    description: 1,
    debit: 2,
    credit: 3,
    balance: 4
  });

  const [localMatches, setLocalMatches] = useState<MatchResult[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  const bankAccounts = useMemo(() => 
    accounts.filter(a => a.group === "Bank Accounts" || a.name.toLowerCase().includes("bank")),
  [accounts]);

  // Extract Book Entries
  const bookEntries = useMemo(() => {
    if (!selectedAccountId) return [];
    
    const entries: BookEntry[] = [];
    journalEntries.forEach(jv => {
      // Date filter (assuming JV date is AD and matches range, simplified for now if range provided)
      if (startDate && jv.date < startDate) return;
      if (endDate && jv.date > endDate) return;

      jv.lines.forEach(line => {
        if (line.accountId === selectedAccountId) {
          // Check if already reconciled in our local state memory or DB?
          // The bank statement 'reconciledVoucherId' points to the book entry ID.
          // For now, we extract all, and later flag if they are reconciled.
          const isReconciled = bankStatements.some(bs => bs.reconciledVoucherId === line.id && bs.reconciled);
          if (!isReconciled) {
             entries.push({
               id: line.id || jv.id + "-" + line.accountId,
               date: jv.date,
               amount: line.debit > 0 ? line.debit : line.credit,
               description: line.narration || jv.narration || "",
               ledgerId: line.accountId,
               type: line.debit > 0 ? 'debit' : 'credit'
             });
          }
        }
      });
    });
    return entries;
  }, [journalEntries, selectedAccountId, startDate, endDate, bankStatements]);

  // Extract Unreconciled Statement Entries
  const statementEntries = useMemo(() => {
    if (!selectedAccountId) return [];
    return bankStatements.filter(bs => bs.bankAccountId === selectedAccountId && !bs.reconciled);
  }, [bankStatements, selectedAccountId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseCSVBankStatement(text, colMapping, selectedAccountId);
        if (parsed.length === 0) {
          toast.error("No valid data found in CSV or mapping is incorrect.");
          return;
        }
        await importBankStatements(selectedAccountId, parsed as any);
        setShowImportModal(false);
      } catch (err) {
        toast.error("Failed to parse CSV");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const runAutoMatch = () => {
    if (!selectedAccountId) {
      toast.error("Select a Bank Account first");
      return;
    }
    const matches = autoMatchStatements(bookEntries, statementEntries, 3);
    const actualMatches = matches.filter(m => m.matchType === 'exact' || m.matchType === 'amount-match');
    
    // Merge into local matches avoiding duplicates
    const newMatches = [...localMatches];
    let added = 0;
    actualMatches.forEach(am => {
      if (!newMatches.some(nm => nm.bookId === am.bookId || nm.statementId === am.statementId)) {
        newMatches.push(am);
        added++;
      }
    });
    setLocalMatches(newMatches);
    toast.success(`${added} entries auto-matched!`);
  };

  const handleBookClick = (bookId: string) => {
    if (localMatches.some(m => m.bookId === bookId)) return; // Already matched
    setSelectedBookId(selectedBookId === bookId ? null : bookId);
  };

  const handleStatementClick = (stmtId: string) => {
    if (localMatches.some(m => m.statementId === stmtId)) return; // Already matched
    if (selectedBookId) {
      // Link them manually
      setLocalMatches([...localMatches, {
        bookId: selectedBookId,
        statementId: stmtId,
        matchType: 'exact' // Manual overrides treated as exact
      }]);
      setSelectedBookId(null);
    } else {
      toast("Select a book entry first to link manually", { icon: "👆" });
    }
  };

  const removeMatch = (bookId: string) => {
    setLocalMatches(localMatches.filter(m => m.bookId !== bookId));
  };

  const saveReconciliation = async () => {
    if (localMatches.length === 0) {
      toast.error("No matches to save");
      return;
    }
    try {
      for (const match of localMatches) {
        await updateBankStatement(match.statementId, {
          reconciled: true,
          reconciledVoucherId: match.bookId,
          reconciledDate: new Date().toISOString().split('T')[0]
        });
      }
      toast.success("Reconciliation saved successfully!");
      setLocalMatches([]);
    } catch (e) {
      toast.error("Failed to save reconciliation");
    }
  };

  const postUnmatchedStatements = async () => {
    // Get unmatched statements
    const unmatchedStmts = statementEntries.filter(
      stmt => !localMatches.some(m => m.statementId === stmt.id)
    );

    if (unmatchedStmts.length === 0) {
      toast.success("No unmatched statements to post");
      return;
    }

    // Default Bank Charges Account
    const bankChargesAcc = accounts.find(a => a.name.toLowerCase().includes("bank charge")) 
                           || accounts.find(a => a.type === "IndirectExpense");
    
    if (!bankChargesAcc) {
      toast.error("Could not find a 'Bank Charges' or expense ledger.");
      return;
    }

    try {
      let created = 0;
      for (const stmt of unmatchedStmts) {
        // If bank statement debit > 0, it means money left the bank (Payment). Book should credit bank.
        // If bank statement credit > 0, money entered bank (Receipt). Book should debit bank.
        const isBankDebit = stmt.debit > 0;
        
        const lines: JournalEntryLine[] = [
          {
            accountId: selectedAccountId,
            debit: isBankDebit ? 0 : stmt.credit,
            credit: isBankDebit ? stmt.debit : 0,
            narration: stmt.narration
          },
          {
            accountId: bankChargesAcc.id,
            debit: isBankDebit ? stmt.debit : 0,
            credit: isBankDebit ? 0 : stmt.credit,
            narration: stmt.narration
          }
        ];

        const vId = generateId("jv");
        await addVoucher({
          id: vId,
          date: stmt.date,
          dateNepali: formatADToBS(stmt.date),
          voucherNo: `AUTO-${Date.now().toString().slice(-5)}`,
          type: VoucherType.JOURNAL_VOUCHER,
          status: VoucherStatus.POSTED,
          narration: `Auto-posted from bank statement: ${stmt.narration}`,
          lines: lines,
          totalDebit: stmt.debit > 0 ? stmt.debit : stmt.credit,
          totalCredit: stmt.debit > 0 ? stmt.debit : stmt.credit
        } as any);

        // Mark as reconciled
        await updateBankStatement(stmt.id, {
          reconciled: true,
          reconciledVoucherId: lines[0].id || vId,
          reconciledDate: new Date().toISOString().split('T')[0]
        });
        created++;
      }
      toast.success(`${created} unmatched statements posted as Journal Vouchers.`);
      setLocalMatches([]); // Refresh
    } catch (e) {
      toast.error("Failed to post unmatched statements");
    }
  };

  // Compute Balances
  // We need opening balance of the bank account + sum of all journal lines.
  const bookBalance = journalEntries.reduce((sum, jv) => {
    const line = jv.lines.find(l => l.accountId === selectedAccountId);
    if (line) return sum + line.debit - line.credit;
    return sum;
  }, 0);

  // Statement balance (last statement's balance)
  const allStmts = bankStatements.filter(bs => bs.bankAccountId === selectedAccountId);
  // Sort by date to get latest
  const sortedStmts = [...allStmts].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const statementBalance = sortedStmts.length > 0 ? sortedStmts[sortedStmts.length - 1].balance : 0;

  const unreconciledItemsAmount = statementEntries.reduce((sum, s) => sum + s.credit - s.debit, 0); // Simplified diff
  const difference = bookBalance - statementBalance;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-20">
      <ActionToolbar
        title="Bank Reconciliation"
        subtitle="Match book entries with bank statements seamlessly."
        secondaryActions={[
          {
            label: "Auto Reconcile",
            onClick: runAutoMatch,
            icon: <RefreshCw className="w-4 h-4" />,
          },
          {
            label: "Post Unmatched Statements",
            onClick: postUnmatchedStatements,
            icon: <Plus className="w-4 h-4" />,
          },
          {
            label: "Save Reconciliation",
            onClick: saveReconciliation,
            icon: <CheckCircle className="w-4 h-4" />,
            variant: "primary"
          },
        ]}
      />

      {/* Top Filters */}
      <div className="bg-white p-4 border border-gray-200 rounded-md shadow-sm flex items-end gap-4">
        <div className="w-64">
          <Select 
            label="Bank Account"
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            options={bankAccounts.map(a => ({value: a.id, label: a.name}))}
          />
        </div>
        <div className="w-48">
          <NepaliDatePicker label="From Date" value={startDate} onChange={setStartDate} />
        </div>
        <div className="w-48">
          <NepaliDatePicker label="To Date" value={endDate} onChange={setEndDate} />
        </div>
        <div>
          <button 
            onClick={() => setShowImportModal(true)}
            disabled={!selectedAccountId}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Main Reconciliation Area */}
      <div className="grid grid-cols-2 gap-6 relative">
        
        {/* LEFT PANEL - BOOK ENTRIES */}
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="bg-[#1e2433] px-3 py-2 border-b border-gray-200">
            <h3 className="text-[13px] font-bold text-white">Book Entries (Company Ledger)</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#f5f6fa]">
            {bookEntries.length === 0 && <p className="text-center text-xs text-gray-500 mt-4">No unreconciled book entries found.</p>}
            {bookEntries.map(book => {
              const match = localMatches.find(m => m.bookId === book.id);
              const isSelected = selectedBookId === book.id;
              
              let borderClass = "border-gray-200";
              if (match) borderClass = "border-green-400 bg-green-50";
              else if (isSelected) borderClass = "border-blue-400 bg-blue-50 ring-2 ring-blue-200";
              else borderClass = "border-amber-300 bg-white hover:bg-amber-50";

              return (
                <div 
                  key={book.id} 
                  onClick={() => handleBookClick(book.id)}
                  className={`p-2 rounded border cursor-pointer transition-colors flex justify-between items-center ${borderClass}`}
                >
                  <div>
                    <div className="text-[11px] font-semibold text-gray-600">{book.date}</div>
                    <div className="text-[12px] text-gray-800 line-clamp-1">{book.description || 'No Description'}</div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className={`text-[13px] font-bold font-mono ${book.type === 'debit' ? 'text-green-700' : 'text-red-700'}`}>
                      {book.type === 'debit' ? '+ ' : '- '}Rs.{formatNumber(book.amount)}
                    </div>
                    {match && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeMatch(book.id); }}
                        className="text-gray-400 hover:text-red-500"
                        title="Unlink"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL - STATEMENT ENTRIES */}
        <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col h-[500px]">
           <div className="bg-[#1e2433] px-3 py-2 border-b border-gray-200">
            <h3 className="text-[13px] font-bold text-white">Bank Statement (Imported)</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-[#f5f6fa]">
            {statementEntries.length === 0 && <p className="text-center text-xs text-gray-500 mt-4">No unreconciled statement entries found.</p>}
            {statementEntries.map(stmt => {
              const match = localMatches.find(m => m.statementId === stmt.id);
              const isMatchable = !!selectedBookId && !match;

              let borderClass = "border-gray-200 bg-white";
              if (match) borderClass = "border-green-400 bg-green-50 opacity-70";
              else if (isMatchable) borderClass = "border-blue-300 bg-white hover:bg-blue-100 ring-1 ring-blue-300 border-dashed cursor-pointer";
              else borderClass = "border-blue-200 bg-white opacity-90";

              return (
                <div 
                  key={stmt.id} 
                  onClick={() => isMatchable && handleStatementClick(stmt.id)}
                  className={`p-2 rounded border transition-all flex justify-between items-center ${borderClass}`}
                >
                  <div className="flex items-center gap-2">
                    {isMatchable && <LinkIcon className="w-3 h-3 text-blue-500" />}
                    <div>
                      <div className="text-[11px] font-semibold text-gray-600">{stmt.date}</div>
                      <div className="text-[12px] text-gray-800 line-clamp-1">{stmt.narration}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {stmt.debit > 0 ? (
                      <div className="text-[13px] font-bold font-mono text-red-700">- Rs.{formatNumber(stmt.debit)}</div>
                    ) : (
                      <div className="text-[13px] font-bold font-mono text-green-700">+ Rs.{formatNumber(stmt.credit)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Summary Footer */}
      <div className="grid grid-cols-4 gap-4 mt-6 border-t border-gray-200 pt-4">
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <div className="text-[10px] uppercase font-bold text-gray-500">Book Balance</div>
          <div className="text-[16px] font-bold text-gray-800">Rs. {formatNumber(bookBalance)}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <div className="text-[10px] uppercase font-bold text-gray-500">Statement Balance</div>
          <div className="text-[16px] font-bold text-gray-800">Rs. {formatNumber(statementBalance)}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <div className="text-[10px] uppercase font-bold text-gray-500">Unreconciled Difference</div>
          <div className={`text-[16px] font-bold ${difference !== 0 ? 'text-red-600' : 'text-green-600'}`}>
            Rs. {formatNumber(difference)}
          </div>
        </div>
        <div className="bg-gray-50 p-3 rounded border border-gray-200">
          <div className="text-[10px] uppercase font-bold text-gray-500">Auto-Matched Session</div>
          <div className="text-[16px] font-bold text-blue-700">{localMatches.length} Pairs</div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="bg-[#1e2433] px-4 py-3 flex justify-between items-center">
              <h2 className="text-white text-[14px] font-semibold">Import Bank Statement (CSV)</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[11px] font-medium text-gray-600 block mb-1">Select CSV File</label>
                <input 
                  type="file" 
                  accept=".csv"
                  ref={fileInputRef}
                  className="block w-full text-[12px] text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-[12px] file:font-semibold file:bg-[#1557b0] file:text-white hover:file:bg-[#0f4a96]"
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-[12px] font-semibold text-gray-800 mb-2">Column Mapping (0-indexed)</h4>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(colMapping).map(key => (
                    <div key={key}>
                      <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{key}</label>
                      <input 
                        type="number" 
                        value={(colMapping as any)[key]} 
                        onChange={e => setColMapping({...colMapping, [key]: parseInt(e.target.value) || 0})}
                        className="h-7 w-full px-2 text-[12px] border border-gray-300 rounded-md"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                  Provide the 0-based index of the columns in your CSV. If debit and credit are in the same column, assign both to that index.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="h-8 px-3 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleFileUpload({target: {files: fileInputRef.current?.files}} as any)}
                  className="h-8 px-3 text-[12px] font-medium text-white bg-[#1557b0] rounded-md hover:bg-[#0f4a96]"
                >
                  Import Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
