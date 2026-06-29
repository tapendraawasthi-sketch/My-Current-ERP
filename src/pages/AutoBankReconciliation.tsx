// @ts-nocheck
import React, { useState, useMemo } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "react-hot-toast";
import {
  FileText,
  Upload,
  RefreshCw,
  CheckCircle,
  Plus,
  Link,
  Unlink,
  Printer,
} from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

// Types
type ImportFormat =
  | "csv-standard"
  | "csv-nepal-bank"
  | "csv-himalayan"
  | "csv-nic-asia"
  | "csv-custom"
  | "ofx"
  | "qif";
type MatchConfidence = "HIGH" | "MEDIUM" | "LOW";
type MatchStatus = "Auto-Matched" | "Cheque Match" | "Suggested" | "Unmatched";

interface StatementRow {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface BookEntry {
  id: string;
  date: string;
  amount: number;
  description: string;
  voucherId: string;
  voucherNo: string;
  type: "debit" | "credit";
}

interface MatchResult {
  statementId: string;
  bookEntryId?: string;
  confidence: MatchConfidence;
  status: MatchStatus;
  matchedDate?: string;
  matchedAmount?: number;
}

interface VoucherFormData {
  type: "journal" | "payment" | "receipt";
  date: string;
  narration: string;
  amount: number;
  counterAccountId: string;
}

export default function AutoBankReconciliation() {
  const {
    accounts,
    vouchers,
    cheques,
    bankStatements,
    companySettings,
    currentUser,
    addVoucher,
    updateBankStatements,
    saveAuditLog,
  } = useStore();

  // Step 1: Setup
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [importFormat, setImportFormat] = useState<ImportFormat>("csv-standard");
  const [columnMapping, setColumnMapping] = useState({
    date: 0,
    description: 1,
    debit: 2,
    credit: 3,
    balance: 4,
  });
  const [parsedRows, setParsedRows] = useState<StatementRow[]>([]);
  const [file, setFile] = useState<File | null>(null);

  // Step 2: Auto-Match
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [activeTab, setActiveTab] = useState<"auto-matched" | "suggested" | "unmatched">(
    "auto-matched",
  );
  const [creatingVoucher, setCreatingVoucher] = useState<string | null>(null);
  const [voucherFormData, setVoucherFormData] = useState<VoucherFormData>({
    type: "journal",
    date: "",
    narration: "",
    amount: 0,
    counterAccountId: "",
  });

  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  const filteredVouchers = useMemo(() => {
    if (!selectedAccountId || !dateFrom || !dateTo) return [];
    return vouchers.filter(
      (v) =>
        v.lines.some((l) => l.accountId === selectedAccountId) &&
        v.date >= dateFrom &&
        v.date <= dateTo,
    );
  }, [vouchers, selectedAccountId, dateFrom, dateTo]);

  const unreconciledBookEntries = useMemo(() => {
    if (!selectedAccountId || !dateFrom || !dateTo) return [];

    const entries: BookEntry[] = [];

    filteredVouchers.forEach((v) => {
      v.lines.forEach((line) => {
        if (line.accountId === selectedAccountId) {
          const amount = line.drAmount > 0 ? line.drAmount : line.crAmount;
          const type = line.drAmount > 0 ? "debit" : "credit";

          entries.push({
            id: `${v.id}-${line.id}`,
            date: v.date,
            amount,
            description: v.narration || v.voucherNo,
            voucherId: v.id,
            voucherNo: v.voucherNo,
            type,
          });
        }
      });
    });

    return entries;
  }, [filteredVouchers, selectedAccountId]);

  const parseCSV = (text: string): StatementRow[] => {
    const lines = text.split("\n").filter((line) => line.trim() !== "");
    if (lines.length < 2) return [];

    const rows: StatementRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((col) => col.trim());

      const date = cols[columnMapping.date] || "";
      const description = cols[columnMapping.description] || "";
      const debit = parseFloat(cols[columnMapping.debit]) || 0;
      const credit = parseFloat(cols[columnMapping.credit]) || 0;
      const balance = parseFloat(cols[columnMapping.balance]) || 0;

      if (!date || (debit === 0 && credit === 0)) continue;

      rows.push({
        id: generateId(),
        date,
        description,
        debit,
        credit,
        balance,
      });
    }

    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedRows(parsed);
      toast.success(`Parsed ${parsed.length} rows from CSV`);
    };
    reader.readAsText(selectedFile);
  };

  const runAutoMatch = () => {
    if (parsedRows.length === 0) {
      toast.error("No statement rows to match");
      return;
    }

    const newMatches: MatchResult[] = [];

    parsedRows.forEach((stmt) => {
      const stmtAmount = stmt.debit || stmt.credit;
      const stmtDate = new Date(stmt.date);

      // Try to find exact match
      let matched = false;

      // 1. Exact amount + date match
      const exactMatch = unreconciledBookEntries.find((entry) => {
        const entryDate = new Date(entry.date);
        const dateDiff = Math.abs(entryDate.getTime() - stmtDate.getTime()) / (1000 * 60 * 60 * 24);
        return entry.amount === stmtAmount && dateDiff <= 3;
      });

      if (exactMatch) {
        newMatches.push({
          statementId: stmt.id,
          bookEntryId: exactMatch.id,
          confidence: "HIGH",
          status: "Auto-Matched",
        });
        matched = true;
      }

      // 2. Cheque number match
      if (!matched) {
        const chequeMatch = cheques.find(
          (c) => stmt.description.includes(c.chequeNo) && c.bankAccountId === selectedAccountId,
        );

        if (chequeMatch) {
          const bookEntry = unreconciledBookEntries.find(
            (be) => be.voucherId === chequeMatch.voucherId,
          );
          if (bookEntry) {
            newMatches.push({
              statementId: stmt.id,
              bookEntryId: bookEntry.id,
              confidence: "HIGH",
              status: "Cheque Match",
            });
            matched = true;
          }
        }
      }

      // 3. Amount-only match (date differs)
      if (!matched) {
        const amountMatch = unreconciledBookEntries.find((entry) => entry.amount === stmtAmount);

        if (amountMatch) {
          newMatches.push({
            statementId: stmt.id,
            bookEntryId: amountMatch.id,
            confidence: "MEDIUM",
            status: "Suggested",
          });
          matched = true;
        }
      }

      // 4. Keyword match
      if (!matched) {
        const keywords = ["NEFT", "RTGS", "IMPS", "CHG", "INT", "TAX"];
        const hasKeyword = keywords.some((kw) => stmt.description.toUpperCase().includes(kw));

        if (hasKeyword) {
          newMatches.push({
            statementId: stmt.id,
            confidence: "MEDIUM",
            status: "Suggested",
          });
          matched = true;
        }
      }

      // 5. No match
      if (!matched) {
        newMatches.push({
          statementId: stmt.id,
          confidence: "LOW",
          status: "Unmatched",
        });
      }
    });

    setMatches(newMatches);
    setStep(2);
    toast.success("Auto-match completed");
  };

  const handleRejectMatch = (statementId: string) => {
    setMatches((prev) =>
      prev.map((match) =>
        match.statementId === statementId
          ? { ...match, bookEntryId: undefined, confidence: "LOW", status: "Unmatched" }
          : match,
      ),
    );
  };

  const handleConfirmMatch = (statementId: string, bookEntryId: string) => {
    setMatches((prev) =>
      prev.map((match) =>
        match.statementId === statementId
          ? { ...match, bookEntryId, confidence: "HIGH", status: "Auto-Matched" }
          : match,
      ),
    );
  };

  const handleCreateVoucher = (statementId: string) => {
    const statement = parsedRows.find((r) => r.id === statementId);
    if (!statement) return;

    setCreatingVoucher(statementId);
    setVoucherFormData({
      type: "journal",
      date: statement.date,
      narration: statement.description,
      amount: statement.debit || statement.credit,
      counterAccountId: "",
    });
  };

  const handleSaveVoucher = async () => {
    if (!creatingVoucher || !selectedAccountId) return;

    const statement = parsedRows.find((r) => r.id === creatingVoucher);
    if (!statement) return;

    try {
      const newVoucher = {
        id: generateId(),
        voucherNo: `AUTO-${Date.now()}`,
        date: statement.date,
        dateNepali: formatADToBS(statement.date),
        type: voucherFormData.type,
        status: "posted",
        partyId: null,
        partyName: "",
        lines: [
          {
            id: generateId(),
            accountId: selectedAccountId,
            accountName: bankAccounts.find((a) => a.id === selectedAccountId)?.name || "",
            drAmount: statement.debit,
            crAmount: statement.credit,
            particulars: statement.description,
          },
          {
            id: generateId(),
            accountId: voucherFormData.counterAccountId,
            accountName:
              accounts.find((a) => a.id === voucherFormData.counterAccountId)?.name || "",
            drAmount: statement.credit,
            crAmount: statement.debit,
            particulars: statement.description,
          },
        ],
        paymentMode: undefined,
        chequeNo: undefined,
        bankName: undefined,
        bankBranch: undefined,
        grandTotal: statement.debit || statement.credit,
        narration: voucherFormData.narration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        postedBy: currentUser?.id,
      };

      await addVoucher(newVoucher);

      // Link the voucher to the statement row
      setMatches((prev) =>
        prev.map((match) =>
          match.statementId === creatingVoucher
            ? {
                ...match,
                bookEntryId: `${newVoucher.id}-${newVoucher.lines[0].id}`,
                confidence: "HIGH",
                status: "Auto-Matched",
              }
            : match,
        ),
      );

      setCreatingVoucher(null);
      toast.success("Voucher created and linked");
    } catch (error) {
      toast.error("Failed to create voucher");
    }
  };

  const completeReconciliation = async () => {
    // Check if all rows are matched
    const unmatchedCount = matches.filter((m) => m.status === "Unmatched").length;
    if (unmatchedCount > 0) {
      toast.error(`Cannot complete reconciliation: ${unmatchedCount} rows still unmatched`);
      return;
    }

    try {
      // Prepare updates for bank statements
      const updates = matches
        .map((match) => {
          const statement = parsedRows.find((r) => r.id === match.statementId);
          if (!statement) return null;

          return {
            id: match.statementId,
            reconciled: true,
            reconciledVoucherId: match.bookEntryId?.split("-")[0], // Extract voucher ID from book entry ID
            reconciledAt: new Date().toISOString(),
          };
        })
        .filter(Boolean) as any[];

      await updateBankStatements(updates);

      // Log audit event
      await saveAuditLog({
        id: generateId(),
        timestamp: new Date().toISOString(),
        userId: currentUser?.id || "system",
        action: "BANK_RECONCILIATION_COMPLETED",
        module: "banking",
        recordId: selectedAccountId,
        recordType: "bank-account",
        details: JSON.stringify({
          statementPeriod: `${dateFrom} to ${dateTo}`,
          matchedCount: matches.length - unmatchedCount,
          unmatchedCount,
        }),
      });

      toast.success("Bank reconciliation completed successfully");
      setStep(4);
    } catch (error) {
      toast.error("Failed to complete reconciliation");
    }
  };

  const getReconciliationSummary = () => {
    // Calculate balances
    const bookBalance = unreconciledBookEntries
      .filter((entry) => matches.some((m) => m.bookEntryId === entry.id && m.confidence === "HIGH"))
      .reduce((sum, entry) => {
        return entry.type === "debit" ? sum + entry.amount : sum - entry.amount;
      }, 0);

    const depositsInTransit = unreconciledBookEntries
      .filter((entry) => !matches.some((m) => m.bookEntryId === entry.id) && entry.type === "debit")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const outstandingCheques = unreconciledBookEntries
      .filter(
        (entry) => !matches.some((m) => m.bookEntryId === entry.id) && entry.type === "credit",
      )
      .reduce((sum, entry) => sum + entry.amount, 0);

    const adjustedBookBalance = bookBalance + depositsInTransit - outstandingCheques;

    const statementBalance = parsedRows.length > 0 ? parsedRows[parsedRows.length - 1].balance : 0;

    const difference = adjustedBookBalance - statementBalance;

    return {
      bookBalance,
      depositsInTransit,
      outstandingCheques,
      adjustedBookBalance,
      statementBalance,
      difference,
    };
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <FormPanel title="Statement Information">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Select
              label="Bank Account"
              options={bankAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
            />
          </div>

          <div>
            <NepaliDatePicker label="From Date" value={dateFrom} onChange={setDateFrom} />
          </div>

          <div>
            <NepaliDatePicker label="To Date" value={dateTo} onChange={setDateTo} />
          </div>
        </div>
      </FormPanel>

      <FormPanel title="Import Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select
              label="Import Format"
              options={[
                { value: "csv-standard", label: "CSV (Standard)" },
                { value: "csv-nepal-bank", label: "CSV (Nepal Bank)" },
                { value: "csv-himalayan", label: "CSV (Himalayan Bank)" },
                { value: "csv-nic-asia", label: "CSV (NIC Asia)" },
                { value: "csv-custom", label: "CSV (Custom)" },
                { value: "ofx", label: "OFX" },
                { value: "qif", label: "QIF" },
              ]}
              value={importFormat}
              onChange={(val) => setImportFormat(val as ImportFormat)}
            />
          </div>

          {importFormat.startsWith("csv") && (
            <div>
              <label className="block text-sm font-medium mb-1">Column Mapping</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Select
                    label="Date"
                    options={Array.from({ length: 10 }, (_, i) => ({
                      value: i.toString(),
                      label: `Column ${i + 1}`,
                    }))}
                    value={columnMapping.date.toString()}
                    onChange={(val) =>
                      setColumnMapping((prev) => ({ ...prev, date: parseInt(val) }))
                    }
                  />
                </div>
                <div>
                  <Select
                    label="Description"
                    options={Array.from({ length: 10 }, (_, i) => ({
                      value: i.toString(),
                      label: `Column ${i + 1}`,
                    }))}
                    value={columnMapping.description.toString()}
                    onChange={(val) =>
                      setColumnMapping((prev) => ({ ...prev, description: parseInt(val) }))
                    }
                  />
                </div>
                <div>
                  <Select
                    label="Debit"
                    options={Array.from({ length: 10 }, (_, i) => ({
                      value: i.toString(),
                      label: `Column ${i + 1}`,
                    }))}
                    value={columnMapping.debit.toString()}
                    onChange={(val) =>
                      setColumnMapping((prev) => ({ ...prev, debit: parseInt(val) }))
                    }
                  />
                </div>
                <div>
                  <Select
                    label="Credit"
                    options={Array.from({ length: 10 }, (_, i) => ({
                      value: i.toString(),
                      label: `Column ${i + 1}`,
                    }))}
                    value={columnMapping.credit.toString()}
                    onChange={(val) =>
                      setColumnMapping((prev) => ({ ...prev, credit: parseInt(val) }))
                    }
                  />
                </div>
                <div>
                  <Select
                    label="Balance"
                    options={Array.from({ length: 10 }, (_, i) => ({
                      value: i.toString(),
                      label: `Column ${i + 1}`,
                    }))}
                    value={columnMapping.balance.toString()}
                    onChange={(val) =>
                      setColumnMapping((prev) => ({ ...prev, balance: parseInt(val) }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </FormPanel>

      <FormPanel title="Upload Statement">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">Upload your bank statement file</p>
          <p className="text-xs text-gray-500 mb-4">(Supports CSV, OFX, QIF)</p>
          <input
            type="file"
            accept=".csv,.ofx,.qif"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            Select File
          </label>
          {file && <p className="mt-2 text-sm text-gray-600">Selected: {file.name}</p>}
        </div>
      </FormPanel>

      {parsedRows.length > 0 && (
        <FormPanel title="Statement Preview">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {parsedRows.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.date}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.description}</td>
                    <td className="px-6 py-4 text-right text-sm text-red-600">
                      {row.debit ? formatNumber(row.debit) : ""}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-green-600">
                      {row.credit ? formatNumber(row.credit) : ""}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatNumber(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm text-gray-600">
              Showing first 5 rows of {parsedRows.length} total rows
            </p>
          </div>
        </FormPanel>
      )}

      <div className="flex justify-end">
        <Button disabled={!selectedAccountId || parsedRows.length === 0} onClick={runAutoMatch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Run Auto-Match
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const autoMatched = matches.filter((m) => m.status === "Auto-Matched");
    const suggested = matches.filter((m) => m.status === "Suggested");
    const unmatched = matches.filter((m) => m.status === "Unmatched");

    return (
      <div className="space-y-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("auto-matched")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "auto-matched"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Auto-Matched ({autoMatched.length})
            </button>
            <button
              onClick={() => setActiveTab("suggested")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "suggested"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Suggested ({suggested.length})
            </button>
            <button
              onClick={() => setActiveTab("unmatched")}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "unmatched"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Unmatched ({unmatched.length})
            </button>
          </nav>
        </div>

        {activeTab === "auto-matched" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {autoMatched.map((match) => {
                  const statement = parsedRows.find((r) => r.id === match.statementId);
                  const bookEntry = unreconciledBookEntries.find(
                    (be) => be.id === match.bookEntryId,
                  );

                  return (
                    <tr key={match.statementId}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{statement?.date}</div>
                        <div className="text-sm text-gray-500">{statement?.description}</div>
                        <div className="text-sm text-gray-500">
                          {statement?.debit
                            ? `Debit: ${formatNumber(statement.debit)}`
                            : `Credit: ${formatNumber(statement.credit)}`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {bookEntry?.voucherNo}
                        </div>
                        <div className="text-sm text-gray-500">{bookEntry?.description}</div>
                        <div className="text-sm text-gray-500">
                          {bookEntry?.type === "debit"
                            ? `Debit: ${formatNumber(bookEntry.amount)}`
                            : `Credit: ${formatNumber(bookEntry.amount)}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectMatch(match.statementId)}
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "suggested" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suggested Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suggested.map((match) => {
                  const statement = parsedRows.find((r) => r.id === match.statementId);
                  const bookEntry = unreconciledBookEntries.find(
                    (be) => be.id === match.bookEntryId,
                  );

                  return (
                    <tr key={match.statementId}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{statement?.date}</div>
                        <div className="text-sm text-gray-500">{statement?.description}</div>
                        <div className="text-sm text-gray-500">
                          {statement?.debit
                            ? `Debit: ${formatNumber(statement.debit)}`
                            : `Credit: ${formatNumber(statement.credit)}`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {bookEntry ? (
                          <>
                            <div className="text-sm font-medium text-gray-900">
                              {bookEntry.voucherNo}
                            </div>
                            <div className="text-sm text-gray-500">{bookEntry.description}</div>
                            <div className="text-sm text-gray-500">
                              {bookEntry.type === "debit"
                                ? `Debit: ${formatNumber(bookEntry.amount)}`
                                : `Credit: ${formatNumber(bookEntry.amount)}`}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-500">No match found</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {bookEntry && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmMatch(match.statementId, bookEntry.id)}
                          >
                            Confirm
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectMatch(match.statementId)}
                        >
                          Reject
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "unmatched" && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unmatched.map((match) => {
                  const statement = parsedRows.find((r) => r.id === match.statementId);

                  return (
                    <tr key={match.statementId}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{statement?.date}</div>
                        <div className="text-sm text-gray-500">{statement?.description}</div>
                        <div className="text-sm text-gray-500">
                          {statement?.debit
                            ? `Debit: ${formatNumber(statement.debit)}`
                            : `Credit: ${formatNumber(statement.credit)}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <Button size="sm" onClick={() => handleCreateVoucher(match.statementId)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Create Voucher
                        </Button>
                        <Select
                          options={[
                            { value: "", label: "Link to Entry..." },
                            ...unreconciledBookEntries.map((be) => ({
                              value: be.id,
                              label: `${be.voucherNo} - ${be.description}`,
                            })),
                          ]}
                          onChange={(val) => val && handleConfirmMatch(match.statementId, val)}
                          className="w-48"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(1)}>
            Back to Setup
          </Button>
          <Button
            disabled={matches.filter((m) => m.status === "Unmatched").length > 0}
            onClick={completeReconciliation}
          >
            Complete Reconciliation
          </Button>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    if (!creatingVoucher) return null;

    const statement = parsedRows.find((r) => r.id === creatingVoucher);
    if (!statement) return null;

    return (
      <div className="space-y-6">
        <FormPanel title="Create Voucher for Statement Entry">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-bold">Statement Entry:</span> {statement.description} on{" "}
                  {statement.date} for {formatNumber(statement.debit || statement.credit)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Voucher Type"
                options={[
                  { value: "journal", label: "Journal" },
                  { value: "payment", label: "Payment" },
                  { value: "receipt", label: "Receipt" },
                ]}
                value={voucherFormData.type}
                onChange={(val) => setVoucherFormData((prev) => ({ ...prev, type: val as any }))}
              />
            </div>

            <div>
              <input
                type="text"
                label="Date"
                value={voucherFormData.date}
                onChange={(e) => setVoucherFormData((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full p-2 border rounded text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <input
                type="text"
                label="Narration"
                value={voucherFormData.narration}
                onChange={(e) =>
                  setVoucherFormData((prev) => ({ ...prev, narration: e.target.value }))
                }
                className="w-full p-2 border rounded text-sm"
              />
            </div>

            <div>
              <input
                type="number"
                label="Amount"
                value={voucherFormData.amount}
                onChange={(e) =>
                  setVoucherFormData((prev) => ({ ...prev, amount: Number(e.target.value) }))
                }
                className="w-full p-2 border rounded text-sm"
              />
            </div>

            <div>
              <Select
                label="Counter Account"
                options={accounts
                  .filter((a) => a.id !== selectedAccountId)
                  .map((acc) => ({ value: acc.id, label: acc.name }))}
                value={voucherFormData.counterAccountId}
                onChange={(val) =>
                  setVoucherFormData((prev) => ({ ...prev, counterAccountId: val }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreatingVoucher(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVoucher}>Save & Link</Button>
          </div>
        </FormPanel>
      </div>
    );
  };

  const renderStep4 = () => {
    const summary = getReconciliationSummary();

    return (
      <div className="space-y-6">
        <FormPanel title="Reconciliation Summary">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Bank Reconciliation Statement
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Reconciliation for {bankAccounts.find((a) => a.id === selectedAccountId)?.name} from{" "}
                {dateFrom} to {dateTo}
              </p>
            </div>

            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Balance as per Books</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatNumber(summary.bookBalance)}
                  </dd>
                </div>

                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Add: Deposits in Transit</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatNumber(summary.depositsInTransit)}
                  </dd>
                </div>

                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Less: Outstanding Cheques</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatNumber(summary.outstandingCheques)}
                  </dd>
                </div>

                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 border-t border-gray-200">
                  <dt className="text-sm font-medium text-gray-900">Adjusted Book Balance</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatNumber(summary.adjustedBookBalance)}
                  </dd>
                </div>

                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-900">
                    Balance as per Bank Statement
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatNumber(summary.statementBalance)}
                  </dd>
                </div>

                <div
                  className={`px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 ${summary.difference === 0 ? "bg-green-50" : "bg-red-50"}`}
                >
                  <dt className="text-sm font-medium text-gray-900">Difference</dt>
                  <dd
                    className={`mt-1 text-sm font-medium sm:mt-0 sm:col-span-2 ${summary.difference === 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatNumber(summary.difference)}
                    {summary.difference === 0 && " (Perfectly Reconciled)"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </FormPanel>

        <div className="flex justify-end">
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print Reconciliation Statement
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar title="Auto Bank Reconciliation" icon={<FileText size={16} />}>
        <div className="flex items-center gap-2">
          <Badge variant={step === 1 ? "primary" : "secondary"}>1. Setup</Badge>
          <Badge variant={step === 2 ? "primary" : "secondary"}>2. Match</Badge>
          <Badge variant={step === 3 ? "primary" : "secondary"}>3. Create</Badge>
          <Badge variant={step === 4 ? "primary" : "secondary"}>4. Complete</Badge>
        </div>
      </ActionToolbar>

      <div className="flex-1 overflow-auto p-4">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}
