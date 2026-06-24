import React, { useState, useMemo } from "react";
import { ActionToolbar } from "../components/ui";
import { useStore } from "../store/useStore";
import { ArrowLeft, FileText, CheckCircle2, AlertTriangle, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { formatNumber, parseFlexibleDate } from "../lib/utils";

interface CSVRow {
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number;
  chequeNo?: string;
  isDuplicate?: boolean;
}

const BANK_PRESETS = [
  { value: "", label: "Auto-detect (default)" },
  { value: "nabil", label: "Nabil Bank" },
  { value: "nic", label: "NIC Asia Bank" },
  { value: "everest", label: "Everest Bank" },
  { value: "sbi", label: "SBI Nepal" },
];

const BankStatementImport: React.FC = () => {
  const { bankAccounts, accounts, bankStatements, setCurrentPage, importBankStatements } =
    useStore();

  const [selectedBankAccountId, setSelectedBankAccountId] = useState(bankAccounts[0]?.id || "");
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [bankPreset, setBankPreset] = useState("");

  function detectColumns(headers: string[]): {
    dateIdx: number;
    narrationIdx: number;
    debitIdx: number;
    creditIdx: number;
    balanceIdx: number;
    chequeIdx: number;
  } {
    const h = headers.map((x) => x.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const find = (...patterns: string[]) =>
      h.findIndex((col) => patterns.some((p) => col.includes(p)));
    return {
      dateIdx: find("date", "txndate", "transactiondate", "valuedate"),
      narrationIdx: find("narration", "description", "particulars", "remarks", "details"),
      debitIdx: find("debit", "dr", "withdrawal", "paid", "amount debit"),
      creditIdx: find("credit", "cr", "deposit", "received", "amount credit"),
      balanceIdx: find("balance", "closingbalance", "runningbalance"),
      chequeIdx: find("chequeno", "cheque", "checkno", "refno", "reference"),
    };
  }

  // Handle bank account label
  const getAccountLabel = (ba: any) => {
    const matchedAccount = accounts.find((a) => a.id === ba.accountId);
    return matchedAccount ? matchedAccount.name : ba.bankName;
  };

  // Handle CSV file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCsvContent(event.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV content
  const handleParse = () => {
    if (!csvContent) {
      toast.error("Please select a valid CSV file first.");
      return;
    }

    try {
      const lines = csvContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length < 2) {
        toast.error("CSV file must contain a header row and at least one data row.");
        return;
      }

      // Read headers
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const {
        dateIdx,
        narrationIdx,
        debitIdx,
        creditIdx,
        balanceIdx,
        chequeIdx: chequeNoIdx,
      } = detectColumns(headers);

      if (dateIdx === -1 || narrationIdx === -1) {
        toast.error(
          "Could not auto-detect columns. Expected columns: date, narration, debit, credit",
        );
        return;
      }

      const rows: CSVRow[] = [];
      const newCheckedIndices = new Set<number>();

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV splitter that ignores commas within quotes if possible, or basic comma split
        // For standard simple CSV, a regex split works
        const parts = lines[i]
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map((p) => p.replace(/^"|"$/g, "").trim());

        if (parts.length < headers.length) continue;

        const date = parseFlexibleDate(parts[dateIdx]) || "";
        const narration = parts[narrationIdx] || "";
        const debit = debitIdx !== -1 ? parseFloat(parts[debitIdx]) || 0 : 0;
        const credit = creditIdx !== -1 ? parseFloat(parts[creditIdx]) || 0 : 0;
        const balance = balanceIdx !== -1 ? parseFloat(parts[balanceIdx]) || 0 : 0;
        const chequeNo = chequeNoIdx !== -1 ? parts[chequeNoIdx] : "";

        if (!date || (debit === 0 && credit === 0)) continue;

        // Check for duplicates in store
        const isDuplicate = bankStatements.some(
          (bst) =>
            bst.bankAccountId === selectedBankAccountId &&
            bst.date === date &&
            ((debit > 0 && bst.debit === debit) || (credit > 0 && bst.credit === credit)),
        );

        rows.push({
          date,
          narration,
          debit,
          credit,
          balance,
          chequeNo,
          isDuplicate,
        });

        // Default all checked
        newCheckedIndices.add(rows.length - 1);
      }

      if (rows.length === 0) {
        toast.error("No valid transaction rows found in CSV.");
        return;
      }

      setParsedRows(rows);
      setCheckedIndices(newCheckedIndices);
      toast.success(`Successfully parsed ${rows.length} rows.`);
    } catch (e: any) {
      toast.error("Failed to parse CSV: " + e.message);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    if (select) {
      setCheckedIndices(new Set(parsedRows.map((_, idx) => idx)));
    } else {
      setCheckedIndices(new Set());
    }
  };

  const handleToggleRow = (index: number) => {
    const next = new Set(checkedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setCheckedIndices(next);
  };

  const handleImport = async () => {
    if (!selectedBankAccountId) {
      toast.error("Please select a target bank account.");
      return;
    }
    if (checkedIndices.size === 0) {
      toast.error("No rows selected for import.");
      return;
    }

    const rowsToImport = parsedRows
      .filter((_, idx) => checkedIndices.has(idx))
      .map(({ isDuplicate, ...cleanRow }) => cleanRow);

    try {
      const count = await importBankStatements(selectedBankAccountId, rowsToImport);
      setParsedRows([]);
      setCheckedIndices(new Set());
      setFileName("");
      setCsvContent("");
      setCurrentPage("bank-reconciliation");
    } catch (e: any) {
      toast.error("Failed to import entries: " + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 select-none animate-fadeIn text-xs max-w-5xl mx-auto pb-16">
      <ActionToolbar
        title="Bank Statement Import"
        subtitle="Import bank statements for reconciliation"
      />
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#9DC07A] pb-5">
        <button
          onClick={() => setCurrentPage("bank-reconciliation")}
          className="p-2 rounded-lg hover:bg-[#EBF5E2] text-[#000000] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-[#000000] tracking-tight">Import Bank Statement</h2>
          <p className="text-[11px] text-[#000000] font-extrabold uppercase tracking-wider mt-0.5">
            Load transactions from CSV to match with general ledger
          </p>
        </div>
      </div>

      {/* Selector & Guide Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Bank select & Upload */}
        <div className="bg-white border border-[#9DC07A] rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-[#000000]">
              Target Bank Account
            </span>
            <select
              value={selectedBankAccountId}
              onChange={(e) => setSelectedBankAccountId(e.target.value)}
              className="w-full border border-[#9DC07A] rounded-lg p-2 text-xs font-bold text-[#000000] bg-white focus:outline-none focus:border-indigo-500"
            >
              {bankAccounts.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.accountNo} · {getAccountLabel(ba)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-[#000000]">
              Bank Format Preset
            </span>
            <select
              value={bankPreset}
              onChange={(e) => setBankPreset(e.target.value)}
              className="w-full border border-[#9DC07A] rounded-lg p-2 text-xs font-bold text-[#000000] bg-white focus:outline-none focus:border-indigo-500"
            >
              {BANK_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {bankPreset && (
              <span className="text-[10px] text-[#1557b0] font-semibold mt-1">
                Preset active: Column configuration guidelines loaded. Auto-detect parses values.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-[#000000]">Select CSV file</span>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-between border border-[#9DC07A] rounded-lg px-3 py-2 bg-[#EBF5E2] text-[#000000] hover:bg-[#EBF5E2] cursor-pointer transition-colors font-medium">
                <span className="truncate">{fileName || "Choose File..."}</span>
                <Upload className="h-3.5 w-3.5 text-[#000000] shrink-0 ml-2" />
                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </label>
              <button
                onClick={handleParse}
                className="bg-[#3D6B25] hover:bg-indigo-500 text-white font-extrabold px-4 py-2 rounded-lg transition-colors shrink-0 uppercase tracking-wider"
              >
                Parse CSV
              </button>
            </div>
          </div>
        </div>

        {/* Guide info */}
        <div className="bg-[#EBF5E2] border border-[#9DC07A] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-[18px] w-[18px] text-[#000000]" />
            <h3 className="text-xs font-bold text-[#000000] uppercase tracking-wider">
              CSV Format Guide
            </h3>
          </div>
          <ul className="list-disc pl-4 text-[#000000] space-y-1 font-medium mb-3">
            <li>
              Required columns:{" "}
              <code className="bg-[#EBF5E2] text-[#000000] px-1 py-0.5 rounded font-mono font-bold text-[10px]">
                date
              </code>{" "}
              (YYYY-MM-DD),{" "}
              <code className="bg-[#EBF5E2] text-[#000000] px-1 py-0.5 rounded font-mono font-bold text-[10px]">
                narration
              </code>
              ,{" "}
              <code className="bg-[#EBF5E2] text-[#000000] px-1 py-0.5 rounded font-mono font-bold text-[10px]">
                debit
              </code>
              ,{" "}
              <code className="bg-[#EBF5E2] text-[#000000] px-1 py-0.5 rounded font-mono font-bold text-[10px]">
                credit
              </code>
            </li>
            <li>
              Optional columns:{" "}
              <code className="bg-[#EBF5E2] text-[#000000] px-1 py-0.5 rounded font-mono font-bold text-[10px]">
                balance
              </code>
              ,{" "}
              <code className="bg-[#EBF5E2] text-[#000000] px-1 py-0.5 rounded font-mono font-bold text-[10px]">
                cheque_no
              </code>
            </li>
          </ul>
          <div className="bg-[#EBF5E2] text-[#000000] font-mono p-3 rounded-lg text-[10.5px] overflow-x-auto whitespace-pre leading-relaxed border border-[#9DC07A]">
            {`date,narration,debit,credit,balance,cheque_no\n2026-06-18,Party Payment,0.00,12500.00,12500.00,CHQ8890\n2026-06-19,Bank Charges,350.00,0.00,12150.00,`}
          </div>
        </div>
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white border border-[#9DC07A] rounded-xl p-5 shadow-sm flex flex-col gap-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#9DC07A] pb-3">
            <h3 className="text-sm font-bold text-[#000000] uppercase tracking-wider">
              Statement Preview
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleSelectAll(true)}
                className="text-[10px] font-bold text-[#1557b0] hover:text-[#000000] hover:underline uppercase"
              >
                Select All
              </button>
              <span className="text-[#000000]">|</span>
              <button
                onClick={() => toggleSelectAll(false)}
                className="text-[10px] font-bold text-[#1557b0] hover:text-[#000000] hover:underline uppercase"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#9DC07A] rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-[#EBF5E2] text-[10px] font-bold text-[#000000] uppercase tracking-wider border-b border-[#9DC07A]">
                <tr>
                  <th className="py-2 px-3 text-center w-10"></th>
                  <th className="py-2 px-2 text-left w-24">Date</th>
                  <th className="py-2 px-2 text-left">Narration</th>
                  <th className="py-2 px-2 text-right w-24">Debit</th>
                  <th className="py-2 px-2 text-right w-24">Credit</th>
                  <th className="py-2 px-2 text-right w-24">Balance</th>
                  <th className="py-2 px-3 text-center w-28">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-[#EBF5E2]/50 ${checkedIndices.has(idx) ? "" : "opacity-60 bg-[#EBF5E2]/20"}`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={checkedIndices.has(idx)}
                        onChange={() => handleToggleRow(idx)}
                        className="h-3.5 w-3.5 rounded border-[#9DC07A] text-[#1557b0] focus:ring-indigo-500"
                      />
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-[#000000]">{row.date}</td>
                    <td className="py-2.5 px-2 text-[#000000] font-semibold">{row.narration}</td>
                    <td className="py-2.5 px-2 text-right text-red-600 font-mono font-bold">
                      {row.debit > 0 ? formatNumber(row.debit) : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right text-emerald-600 font-mono font-bold">
                      {row.credit > 0 ? formatNumber(row.credit) : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right text-[#000000] font-mono font-semibold">
                      {row.balance !== 0 ? formatNumber(row.balance) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {row.isDuplicate && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" /> Duplicate?
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#9DC07A] pt-3">
            <span className="text-[#000000] font-bold">
              {checkedIndices.size} of {parsedRows.length} rows selected
            </span>
            <button
              onClick={handleImport}
              className="bg-emerald-600 hover:bg-emerald-500 text-[#000000] font-bold px-5 py-2.5 rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-1.5 uppercase tracking-wide"
            >
              <CheckCircle2 className="h-4 w-4" /> Import Selected ({checkedIndices.size} rows)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankStatementImport;
