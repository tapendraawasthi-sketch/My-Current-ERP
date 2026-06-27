// src/pages/BankStatementImport.tsx
// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { ActionToolbar } from '../components/ui';
import {
  ArrowLeft, Upload, FileText, AlertTriangle,
  CheckCircle2, Eye, ChevronDown, Info, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatNumber } from '../lib/utils';
import {
  parseNepalBankStatement,
  detectBankFormat,
  BANK_FORMAT_LABELS,
  BankStatementEntry,
  NepalBankFormat,
} from '../lib/bankParsers';

// ─── Format help text ─────────────────────────────────────────────────────────

const FORMAT_HINTS: Record<NepalBankFormat, { cols: string; dateFormat: string; tip: string }> = {
  NMB:        { cols: 'Date, Description, Ref No., Withdrawal (Dr.), Deposit (Cr.), Balance', dateFormat: 'DD/MM/YYYY', tip: 'Download from NMB Online > Accounts > Statement > Export CSV' },
  NABIL:      { cols: 'Date, Narration, Cheque No., Debit, Credit, Balance', dateFormat: 'YYYY-MM-DD', tip: 'Nabil Smart Banking > Account > Statement > Download CSV' },
  EVEREST:    { cols: 'Date, Particulars, Cheque, Withdrawal, Deposit, Balance', dateFormat: 'DD/MM/YYYY or YYYY-MM-DD', tip: 'Everest NetBanking > e-Statement > Export' },
  SBL:        { cols: 'Date (BS), Description, Ref, Dr, Cr, Balance', dateFormat: 'DD-MonthName-YYYY (BS)', tip: 'SBL uses Bikram Sambat dates — we convert to AD automatically' },
  HIMALAYAN:  { cols: 'Date, Value Date, Particulars, Cheque, Withdrawal, Deposit, Balance', dateFormat: 'DD/MM/YYYY', tip: 'Himalayan Bank e-Banking > Statement > Download' },
  KUMARI:     { cols: 'Date, Narration, Ref, Dr, Cr, Balance', dateFormat: 'YYYY/MM/DD', tip: 'Kumari Bank Online > Account Statement > CSV Export' },
  NEPALSBI:   { cols: 'Txn Date, Value Date, Particulars, Ref No, Debit, Credit, Balance', dateFormat: 'DD-MMM-YYYY or YYYY-MM-DD', tip: 'SBI NetBanking statement may have 1–2 header rows — auto-skipped' },
  CONNECTIPS: { cols: 'Date, Transaction ID, Description, Type, Amount, Balance', dateFormat: 'YYYY-MM-DD', tip: 'ConnectIPS > Transaction History > Download CSV' },
  ESEWA:      { cols: 'Date, Transaction ID, Description, Amount, Type, Remarks', dateFormat: 'YYYY-MM-DD', tip: 'eSewa > Transaction History > Export CSV' },
  KHALTI:     { cols: 'Date, Transaction ID, Merchant, Amount, Status', dateFormat: 'YYYY-MM-DD', tip: 'Khalti > Transaction History > Export. Only "Completed" rows are imported.' },
  UNKNOWN:    { cols: 'Auto-detected from header row', dateFormat: 'Any standard format', tip: 'Generic fallback — verify imported data carefully.' },
};

// ─── Component ────────────────────────────────────────────────────────────────

const BankStatementImport: React.FC = () => {
  const { accounts, bankStatements, importBankStatements, setCurrentPage } = useStore();

  const bankAccounts = accounts.filter(
    (a: any) => !a.isGroup && (a.group === 'Bank Accounts' || a.group === 'Bank OD Accounts')
  );

  const [selectedAccountId, setSelectedAccountId] = useState<string>(bankAccounts[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [detectedFormat, setDetectedFormat] = useState<NepalBankFormat | null>(null);
  const [manualFormat, setManualFormat] = useState<NepalBankFormat | ''>('');
  const [parsedRows, setParsedRows] = useState<BankStatementEntry[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveFormat = (manualFormat || detectedFormat) as NepalBankFormat | null;

  // ── File handling ──────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
      // Auto-detect format on file load
      const fmt = detectBankFormat(text);
      setDetectedFormat(fmt);
      setParsedRows([]);
      setParseErrors([]);
      setCheckedIds(new Set());
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Parsing ────────────────────────────────────────────────────────────────

  const handleParse = () => {
    if (!csvContent) {
      toast.error('Please select a CSV file first.');
      return;
    }
    try {
      const result = parseNepalBankStatement(csvContent);
      setParseErrors(result.errors);

      if (result.entries.length === 0) {
        toast.error('No valid transaction rows found. Check the format guide below.');
        return;
      }

      // Mark duplicates
      const rows = result.entries.map((entry, idx) => {
        const isDuplicate = (bankStatements as any[]).some(
          (bs: any) =>
            bs.bankAccountId === selectedAccountId &&
            bs.date === entry.date &&
            ((entry.debit > 0 && Math.abs(bs.debit - entry.debit) < 0.01) ||
             (entry.credit > 0 && Math.abs(bs.credit - entry.credit) < 0.01))
        );
        return { ...entry, _isDuplicate: isDuplicate, _idx: idx };
      });

      setParsedRows(rows as any);
      // Default: select all non-duplicates
      const sel = new Set<number>(
        rows.filter((r: any) => !r._isDuplicate).map((_, i) => i)
      );
      setCheckedIds(sel);

      toast.success(
        `Parsed ${rows.length} rows (${result.format} format detected). ` +
        (result.errors.length ? `${result.errors.length} warning(s).` : '')
      );
    } catch (err: any) {
      toast.error('Parse error: ' + err.message);
    }
  };

  // ── Row selection ──────────────────────────────────────────────────────────

  const toggleRow = (i: number) => {
    const next = new Set(checkedIds);
    next.has(i) ? next.delete(i) : next.add(i);
    setCheckedIds(next);
  };

  const selectAll  = () => setCheckedIds(new Set(parsedRows.map((_, i) => i)));
  const selectNone = () => setCheckedIds(new Set());
  const selectNonDupe = () =>
    setCheckedIds(new Set(parsedRows.map((r: any, i) => ({ r, i })).filter(({ r }) => !r._isDuplicate).map(({ i }) => i)));

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!selectedAccountId) { toast.error('Please select a bank account.'); return; }
    if (checkedIds.size === 0) { toast.error('No rows selected.'); return; }

    const toImport = parsedRows
      .filter((_, i) => checkedIds.has(i))
      .map((r: any) => ({
        date: r.date,
        narration: r.description,
        debit: r.debit,
        credit: r.credit,
        balance: r.balance,
        chequeNo: r.refNo || '',
      }));

    try {
      await importBankStatements(selectedAccountId, toImport);
      toast.success(`Imported ${toImport.length} transactions.`);
      setCurrentPage('bank-reconciliation');
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const hint = effectiveFormat ? FORMAT_HINTS[effectiveFormat] : null;
  const fmtLabel = effectiveFormat ? BANK_FORMAT_LABELS[effectiveFormat] : '—';
  const totalDebit  = parsedRows.reduce((s: number, r: any) => s + r.debit,  0);
  const totalCredit = parsedRows.reduce((s: number, r: any) => s + r.credit, 0);

  return (
    <div className="flex flex-col gap-5 p-5 max-w-6xl mx-auto pb-20 text-xs">
      <ActionToolbar
        title="Bank Statement Import"
        subtitle="Import Nepal bank statement CSV for reconciliation"
      />

      {/* Back + title */}
      <div className="flex items-center gap-3 border-b border-[#9DC07A] pb-4">
        <button
          onClick={() => setCurrentPage('bank-reconciliation')}
          className="p-1.5 rounded hover:bg-[#EBF5E2] text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">Import Bank Statement</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Supports NMB, Nabil, Everest, SBL, Himalayan, Kumari, Nepal SBI, ConnectIPS, eSewa, Khalti
          </p>
        </div>
      </div>

      {/* ── Step 1: Setup ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Left: Account + file upload */}
        <div className="bg-white border border-[#9DC07A] rounded-xl p-5 flex flex-col gap-4 shadow-sm">
          <h3 className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">Step 1 — Select Account & File</h3>

          {/* Bank account */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Target Bank Account *</label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
            >
              <option value="">Select account...</option>
              {bankAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Manual format override */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Bank Format (auto-detected)</label>
            <select
              value={manualFormat}
              onChange={e => setManualFormat(e.target.value as NepalBankFormat)}
              className="w-full h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
            >
              <option value="">Auto-detect</option>
              {(Object.keys(BANK_FORMAT_LABELS) as NepalBankFormat[]).map(fmt => (
                <option key={fmt} value={fmt}>{BANK_FORMAT_LABELS[fmt]}</option>
              ))}
            </select>
          </div>

          {/* File drop zone */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">CSV File *</label>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
                ${isDragging ? 'border-green-500 bg-green-50' : 'border-[#9DC07A] hover:bg-[#EBF5E2]'}`}
            >
              <Upload className="h-6 w-6 mx-auto text-gray-400 mb-1" />
              <p className="text-[11px] text-gray-600 font-medium">
                {fileName ? fileName : 'Drop CSV here or click to browse'}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">CSV files from all major Nepal banks</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
            </div>
          </div>

          {/* Detected format badge */}
          {detectedFormat && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold
              ${detectedFormat === 'UNKNOWN' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              <Zap className="h-3.5 w-3.5 flex-shrink-0" />
              Detected: {fmtLabel}
              {manualFormat && manualFormat !== detectedFormat && (
                <span className="ml-1 opacity-70">(overridden → {BANK_FORMAT_LABELS[manualFormat]})</span>
              )}
            </div>
          )}

          <button
            onClick={handleParse}
            disabled={!csvContent || !selectedAccountId}
            className="w-full h-9 bg-[#3D6B25] hover:bg-[#2D5A1A] disabled:opacity-40 text-white text-[12px] font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Parse & Preview
          </button>
        </div>

        {/* Right: Format guide */}
        <div className="bg-[#EBF5E2] border border-[#9DC07A] rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#3D6B25]" />
              <h3 className="text-[11px] font-bold uppercase text-gray-600 tracking-wider">Format Guide</h3>
            </div>
            <button
              onClick={() => setShowFormatGuide(!showFormatGuide)}
              className="text-[10px] text-[#1557b0] font-bold flex items-center gap-1 hover:underline"
            >
              {showFormatGuide ? 'Hide' : 'Show all'} <ChevronDown className={`h-3 w-3 transition-transform ${showFormatGuide ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {hint ? (
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">Columns</p>
                <p className="text-[11px] text-gray-700 font-mono bg-white/60 rounded px-2 py-1">{hint.cols}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 mb-0.5">Date Format</p>
                <p className="text-[11px] text-gray-700">{hint.dateFormat}</p>
              </div>
              <div className="flex gap-1.5 items-start bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2">
                <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700">{hint.tip}</p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500">Upload a file to see format hints.</p>
          )}

          {showFormatGuide && (
            <div className="mt-1 space-y-2 border-t border-[#9DC07A] pt-3 max-h-64 overflow-y-auto">
              {(Object.entries(FORMAT_HINTS) as [NepalBankFormat, typeof FORMAT_HINTS[NepalBankFormat]][]).map(([fmt, h]) => (
                <div key={fmt} className="text-[10px] bg-white rounded p-2 border border-[#9DC07A]">
                  <p className="font-bold text-gray-700">{BANK_FORMAT_LABELS[fmt]}</p>
                  <p className="text-gray-500 font-mono mt-0.5 truncate">{h.cols}</p>
                  <p className="text-gray-400 mt-0.5">Date: {h.dateFormat}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Parse warnings ─────────────────────────────────────────────────── */}
      {parseErrors.length > 0 && (
        <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-amber-700">Warnings</p>
            {parseErrors.map((e, i) => <p key={i} className="text-[10px] text-amber-600">{e}</p>)}
          </div>
        </div>
      )}

      {/* ── Preview table ──────────────────────────────────────────────────── */}
      {parsedRows.length > 0 && (
        <div className="bg-white border border-[#9DC07A] rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#9DC07A] bg-[#f5f9f2]">
            <div className="flex items-center gap-3">
              <h3 className="text-[12px] font-bold text-gray-800 uppercase tracking-wide">
                Preview — {parsedRows.length} rows
              </h3>
              <span className="text-[10px] text-gray-500">
                Dr: Rs.{formatNumber(totalDebit)} | Cr: Rs.{formatNumber(totalCredit)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-[#1557b0]">
              <button onClick={selectAll} className="hover:underline">Select All</button>
              <span className="text-gray-300">|</span>
              <button onClick={selectNonDupe} className="hover:underline">Skip Duplicates</button>
              <span className="text-gray-300">|</span>
              <button onClick={selectNone} className="hover:underline">None</button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#EBF5E2] border-b border-[#9DC07A] z-10">
                <tr>
                  <th className="w-8 px-3 py-2.5 text-center"></th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-600">Date</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-600">Description</th>
                  <th className="px-2 py-2.5 text-left font-bold text-gray-600">Ref/Cheque</th>
                  <th className="px-2 py-2.5 text-right font-bold text-gray-600">Debit (Dr.)</th>
                  <th className="px-2 py-2.5 text-right font-bold text-gray-600">Credit (Cr.)</th>
                  <th className="px-2 py-2.5 text-right font-bold text-gray-600">Balance</th>
                  <th className="px-2 py-2.5 text-center font-bold text-gray-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedRows.map((row: any, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-[#EBF5E2]/40 transition-colors
                      ${!checkedIds.has(idx) ? 'opacity-50' : ''}
                      ${row._isDuplicate ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={checkedIds.has(idx)}
                        onChange={() => toggleRow(idx)}
                        className="h-3.5 w-3.5 rounded border-[#9DC07A] text-green-600 focus:ring-green-400"
                      />
                    </td>
                    <td className="px-2 py-2 font-mono font-semibold text-gray-800">{row.date}</td>
                    <td className="px-2 py-2 text-gray-700 max-w-[220px] truncate" title={row.description}>{row.description}</td>
                    <td className="px-2 py-2 font-mono text-gray-500">{row.refNo}</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-red-600">
                      {row.debit > 0 ? formatNumber(row.debit) : ''}
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-emerald-700">
                      {row.credit > 0 ? formatNumber(row.credit) : ''}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-gray-600">
                      {row.balance ? formatNumber(row.balance) : ''}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {row._isDuplicate && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 border border-amber-300 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">
                          <AlertTriangle className="h-2.5 w-2.5" /> Dupe?
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#9DC07A] bg-[#f5f9f2]">
            <span className="text-[11px] font-semibold text-gray-600">
              {checkedIds.size} of {parsedRows.length} rows selected
              {parsedRows.filter((r: any) => r._isDuplicate).length > 0 && (
                <span className="ml-2 text-amber-600">
                  ({parsedRows.filter((r: any) => r._isDuplicate).length} possible duplicates)
                </span>
              )}
            </span>
            <button
              onClick={handleImport}
              disabled={checkedIds.size === 0}
              className="flex items-center gap-2 h-9 px-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Import {checkedIds.size} Rows
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankStatementImport;
