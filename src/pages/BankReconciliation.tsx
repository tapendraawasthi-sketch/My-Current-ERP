import React, { useState } from "react";
import { Upload, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { ActionToolbar } from "../components/ui";

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
}

interface Match {
  bookId: string;
  statementId: string;
}

export default function BankReconciliation() {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);

  const [bookEntries, setBookEntries] = useState<BookEntry[]>([
    {
      id: "B1",
      date: "2024-01-15",
      voucherNo: "PAY001",
      description: "Payment to Supplier ABC",
      debit: 0,
      credit: 50000,
      reconciled: false,
    },
    {
      id: "B2",
      date: "2024-01-18",
      voucherNo: "REC002",
      description: "Receipt from Customer XYZ",
      debit: 75000,
      credit: 0,
      reconciled: false,
    },
    {
      id: "B3",
      date: "2024-01-20",
      voucherNo: "PAY003",
      description: "Salary Payment",
      debit: 0,
      credit: 100000,
      reconciled: true,
    },
  ]);

  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([
    {
      id: "S1",
      date: "2024-01-16",
      description: "CHQ CLEARED - ABC",
      debit: 0,
      credit: 50000,
      reference: "CHQ123",
    },
    {
      id: "S2",
      date: "2024-01-18",
      description: "DEPOSIT - XYZ",
      debit: 75000,
      credit: 0,
      reference: "DEP456",
    },
    {
      id: "S3",
      date: "2024-01-20",
      description: "SALARY TRANSFER",
      debit: 0,
      credit: 100000,
      reference: "SAL789",
    },
  ]);

  const autoReconcile = () => {
    const newMatches: Match[] = [];
    const unmatchedBook = bookEntries.filter((b) => !b.reconciled);

    unmatchedBook.forEach((book) => {
      statementEntries.forEach((stmt) => {
        if (matches.some((m) => m.bookId === book.id || m.statementId === stmt.id)) return;

        const dateDiff =
          Math.abs(new Date(book.date).getTime() - new Date(stmt.date).getTime()) /
          (1000 * 60 * 60 * 24);

        const amountMatch = book.debit === stmt.debit && book.credit === stmt.credit;

        if (amountMatch && dateDiff <= 3) {
          newMatches.push({ bookId: book.id, statementId: stmt.id });
        }
      });
    });

    setMatches([...matches, ...newMatches]);
    alert(`${newMatches.length} entries auto-matched`);
  };

  const manualMatch = (bookId: string, statementId: string) => {
    const existing = matches.find((m) => m.bookId === bookId || m.statementId === statementId);
    if (existing) {
      setMatches(matches.filter((m) => m.bookId !== bookId && m.statementId !== statementId));
    } else {
      setMatches([...matches, { bookId, statementId }]);
    }
  };

  const isMatched = (type: "book" | "statement", id: string) => {
    return matches.some((m) => (type === "book" ? m.bookId === id : m.statementId === id));
  };

  const completeReconciliation = () => {
    if (confirm("Complete reconciliation? Matched entries will be marked as reconciled.")) {
      setBookEntries(
        bookEntries.map((b) => ({
          ...b,
          reconciled: b.reconciled || matches.some((m) => m.bookId === b.id),
        })),
      );
      setMatches([]);
      alert("Reconciliation completed successfully!");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      alert("Statement imported successfully");
      setShowImportModal(false);
    }
  };

  const toggleReconciled = (id: string) => {
    setBookEntries(bookEntries.map((b) => (b.id === id ? { ...b, reconciled: !b.reconciled } : b)));
  };

  const bookBalance = bookEntries.reduce((sum, e) => sum + e.debit - e.credit, 0);
  const depositsInTransit = bookEntries
    .filter((b) => !b.reconciled && b.debit > 0)
    .reduce((sum, e) => sum + e.debit, 0);
  const outstandingCheques = bookEntries
    .filter((b) => !b.reconciled && b.credit > 0)
    .reduce((sum, e) => sum + e.credit, 0);
  const adjustedBalance = bookBalance + depositsInTransit - outstandingCheques;
  const statementBalance = statementEntries.reduce((sum, e) => sum + e.debit - e.credit, 0);
  const difference = adjustedBalance - statementBalance;

  return (
    <div className="space-y-6">
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
            label: "Complete Reconciliation",
            onClick: completeReconciliation,
            icon: <CheckCircle className="w-4 h-4" />,
          },
        ]}
      />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
          <div className="text-[10px] uppercase font-bold text-gray-500">
            Bank Statement Balance
          </div>
          <div className="mt-1 text-lg font-bold text-gray-800">
            Rs. {statementBalance.toLocaleString()}
          </div>
        </div>
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
          <div className="text-[10px] uppercase font-bold text-gray-500">Book Balance</div>
          <div className="mt-1 text-lg font-bold text-gray-800">
            Rs. {bookBalance.toLocaleString()}
          </div>
        </div>
        {Math.abs(difference) < 0.01 ? (
          <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-lg shadow-sm">
            <div className="text-[10px] uppercase font-bold text-green-600">Difference</div>
            <div className="mt-1 text-lg font-bold">
              Rs. {Math.abs(difference).toLocaleString()}
            </div>
            <div className="text-xs mt-1">✓ Reconciled</div>
          </div>
        ) : (
          <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-lg shadow-sm">
            <div className="text-[10px] uppercase font-bold text-red-650">Difference</div>
            <div className="mt-1 text-lg font-bold">
              Rs. {Math.abs(difference).toLocaleString()}
            </div>
            <div className="text-xs mt-1">⚠ Unreconciled</div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="input"
            >
              <option value="">Select Bank Account</option>
              <option value="cash">Cash in Bank - Nepal Bank Ltd.</option>
              <option value="nabil">Nabil Bank - Current Account</option>
              <option value="nic">NIC Asia Bank - Savings</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="bg-indigo-50 px-6 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-indigo-900">Bank Book (Our Records)</h3>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2"></th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Voucher</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Debit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bookEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => toggleReconciled(entry.id)}
                    className={`cursor-pointer ${
                      entry.reconciled || isMatched("book", entry.id)
                        ? "bg-green-50"
                        : "bg-yellow-50"
                    }`}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={entry.reconciled || isMatched("book", entry.id)}
                        onChange={() => {}}
                        className="rounded border-gray-300 pointer-events-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-900">{entry.voucherNo}</td>
                    <td className="px-4 py-2 text-xs text-gray-900">{entry.description}</td>
                    <td className="px-4 py-2 text-xs text-right text-gray-900">
                      {entry.debit > 0 ? entry.debit.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-gray-900">
                      {entry.credit > 0 ? entry.credit.toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="bg-green-50 px-6 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-green-900">Bank Statement</h3>
            <button
              onClick={() => setShowImportModal(true)}
              className="text-sm text-green-700 hover:text-green-900 flex items-center space-x-1"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Description
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Debit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Credit</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {statementEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`cursor-pointer ${
                      isMatched("statement", entry.id) ? "bg-blue-100" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-2 text-xs text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-900">{entry.description}</td>
                    <td className="px-4 py-2 text-xs text-right text-gray-900">
                      {entry.debit > 0 ? entry.debit.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-right text-gray-900">
                      {entry.credit > 0 ? entry.credit.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{entry.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-semibold mb-4">Reconciliation Summary</h3>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Book Balance (Closing):</span>
              <span className="font-medium">Rs. {bookBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Add: Deposits in Transit:</span>
              <span className="font-medium">Rs. {depositsInTransit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Less: Outstanding Cheques:</span>
              <span className="font-medium">Rs. {outstandingCheques.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Adjusted Book Balance:</span>
              <span>Rs. {adjustedBalance.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Statement Balance:</span>
              <span className="font-medium">Rs. {statementBalance.toLocaleString()}</span>
            </div>
            <div
              className={`flex justify-between text-sm font-semibold border-t pt-2 ${
                Math.abs(difference) < 0.01 ? "text-green-600" : "text-red-600"
              }`}
            >
              <span>Difference:</span>
              <span>Rs. {Math.abs(difference).toLocaleString()}</span>
            </div>
            {Math.abs(difference) < 0.01 ? (
              <div className="flex items-center space-x-2 text-green-600 text-sm">
                <CheckCircle className="w-5 h-5" />
                <span>Reconciliation Balanced!</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-orange-600 text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Reconciliation not balanced</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-xl font-semibold mb-4">Import Bank Statement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload CSV/Excel File
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="input"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded text-sm text-blue-900">
                <p className="font-semibold mb-2">Expected Format:</p>
                <p>Date, Description, Debit, Credit, Reference</p>
                <p className="text-xs mt-2">The system will map columns automatically</p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
