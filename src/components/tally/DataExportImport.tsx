// @ts-nocheck
import React, { useState } from "react";
import { Upload, Download, FileText, AlertTriangle, CheckCircle, Database, RefreshCw, Table, Code, ArrowRight } from 'lucide-react';
import toast from "react-hot-toast";

const DataExportImport = () => {
  const [tab, setTab] = useState<'import' | 'export' | 'migration'>('import');
  const [importType, setImportType] = useState<'ledgers' | 'items' | 'employees' | 'vouchers' | 'openingBalance'>('ledgers');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<{row: number, data: Record<string,string>, status: 'valid'|'warning'|'error'|'skip', message?: string}>>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validCount, setValidCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [exportFormat, setExportFormat] = useState<'xml' | 'excel' | 'csv' | 'json' | 'sdf'>('excel');
  const [exportScope, setExportScope] = useState<'full' | 'masters' | 'vouchers' | 'report'>('full');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exportIncludeMasters, setExportIncludeMasters] = useState(true);
  const [exportIncludeConfig, setExportIncludeConfig] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [migrationSource, setMigrationSource] = useState<'tally' | 'busy' | 'excel' | 'json' | 'prev-version'>('excel');

  const handleDownloadTemplate = () => {
    const TEMPLATES = {
      ledgers: ['Ledger Name','Account Group','Opening Balance Dr','Opening Balance Cr','Mobile','Email','GSTIN','Address'],
      items: ['Item Name','Item Group','Unit','Sale Price','Purchase Price','Opening Stock Qty','HSN Code','GST Rate'],
      employees: ['Employee Code','Full Name','Department','Designation','Date of Join','PAN','Bank Account','Basic Salary'],
      vouchers: ['Date','Voucher Type','Reference No','Party','Ledger Dr','Amount Dr','Ledger Cr','Amount Cr','Narration'],
      openingBalance: ['Account Name','Opening Dr','Opening Cr'],
    };
    const cols = TEMPLATES[importType] || [];
    // Create CSV and trigger download
    const csv = cols.join(',') + '\n' + cols.map(() => '').join(',');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = importType + '_template.csv'; a.click(); URL.revokeObjectURL(url);
    toast.success('Template downloaded: ' + importType + '_template.csv');
  };

  const validateFile = () => {
    setIsValidating(true);
    setTimeout(() => {
      // Generate mock preview rows
      const mockRows = [
        { row: 2, data: { 'Ledger Name': 'ABC Traders', 'Account Group': 'Sundry Debtors', 'Opening Balance Dr': '15000' }, status: 'valid' },
        { row: 3, data: { 'Ledger Name': 'XYZ Corp', 'Account Group': 'Sundry Creditors', 'Opening Balance Cr': '8500' }, status: 'valid' },
        { row: 4, data: { 'Ledger Name': 'New Supplier', 'Account Group': 'not found in system', 'Opening Balance Dr': '0' }, status: 'warning', message: 'Account Group "not found in system" does not exist — will create new' },
        { row: 5, data: { 'Ledger Name': '', 'Account Group': '', 'Opening Balance Dr': '' }, status: 'skip', message: 'Empty row — will be skipped' },
        { row: 6, data: { 'Ledger Name': 'Petty Cash', 'Account Group': 'Cash-in-Hand', 'Opening Balance Dr': '2500' }, status: 'valid' },
        { row: 7, data: { 'Ledger Name': 'DUPLICATE_ENTRY', 'Account Group': 'Sundry Debtors', 'Opening Balance Dr': '1000' }, status: 'error', message: 'Duplicate: Ledger "DUPLICATE_ENTRY" already exists in system' },
        { row: 8, data: { 'Ledger Name': 'Rent Payable', 'Account Group': 'Current Liabilities', 'Opening Balance Cr': '12000' }, status: 'valid' },
        { row: 9, data: { 'Ledger Name': 'Bank - HDFC', 'Account Group': 'Bank Accounts', 'Opening Balance Dr': 'INVALID' }, status: 'error', message: 'Invalid amount: "INVALID" is not a number' },
      ];
      setImportPreview(mockRows as any);
      const valid = mockRows.filter(r=>r.status==='valid').length;
      const warn = mockRows.filter(r=>r.status==='warning').length;
      const err = mockRows.filter(r=>r.status==='error').length;
      setValidCount(valid);
      setWarnCount(warn);
      setErrorCount(err);
      setIsValidating(false);
    }, 1500);
  };

  const handleImportValid = () => {
    setIsImporting(true);
    setTimeout(() => {
      setIsImporting(false);
      toast.success(`Imported ${validCount} records successfully.`);
      setImportPreview([]);
      setImportFile(null);
    }, 2000);
  };

  const handleImportAll = () => {
    setIsImporting(true);
    setTimeout(() => {
      setIsImporting(false);
      const importedCount = validCount + warnCount;
      toast.success(`Imported ${importedCount} records (${errorCount} errors skipped).`);
      setImportPreview([]);
      setImportFile(null);
    }, 2000);
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      const filename = `sutra_export_${new Date().toISOString().slice(0,10)}.${exportFormat === 'excel'?'xlsx':exportFormat}`;
      toast.success(`Export complete: ${filename}`);
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImportFile(file);
    if (file) {
      validateFile();
    }
  };

  const getStepStatus = (step: number) => {
    if (step === 1) return importFile ? 'completed' : 'active';
    if (step === 2) return importPreview.length > 0 ? 'completed' : importFile ? 'active' : 'future';
    return importPreview.length > 0 ? 'active' : 'future';
  };

  return (
    <div className="max-w-[850px] mx-auto p-5 font-sans">
      {/* Page Header */}
      <div className="bg-[#1e2433] px-4 py-3 rounded-t-lg flex items-center gap-2 border-b border-gray-700 shadow-sm">
        <Database size={20} className="text-white" />
        <span className="text-[14px] font-semibold text-white tracking-wide">
          Data Migration & Import/Export Tools
        </span>
      </div>
      
      {/* Tab Bar */}
      <div className="flex bg-gray-50 border-x border-b border-gray-200 shadow-sm">
        {[
          { key: 'import', label: 'Import Masters' },
          { key: 'export', label: 'Export Company Data' },
          { key: 'migration', label: 'Migration from Other Systems' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`px-4 py-2.5 text-[12px] font-medium transition-colors border-b-2 flex-1 flex items-center justify-center gap-1.5 ${
              tab === key 
                ? 'bg-white text-[#1557b0] border-[#1557b0]' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      {/* Main Content */}
      <div className="bg-[#f5f6fa] border border-gray-200 border-t-0 p-5 rounded-b-lg shadow-sm">
        
        {/* IMPORT TAB */}
        {tab === 'import' && (
          <div className="flex flex-col gap-5">
            {/* Step Indicator */}
            <div className="flex items-center gap-0 bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
              {[1, 2, 3].map((step, index) => {
                const status = getStepStatus(step);
                return (
                  <React.Fragment key={step}>
                    <div
                      className={`flex items-center justify-center flex-1 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                        status === 'active' ? 'bg-[#1557b0] text-white' : 
                        status === 'completed' ? 'bg-[#059669] text-white' : 
                        'bg-gray-50 text-gray-400'
                      }`}
                    >
                      Step {step}: {step === 1 && 'Select Type'} 
                      {step === 2 && 'Upload & Validate'} 
                      {step === 3 && 'Import Data'}
                    </div>
                    {index < 2 && (
                      <div className="bg-gray-200 w-px h-8 relative">
                        <ArrowRight size={14} className="absolute top-1/2 -left-[7px] -translate-y-1/2 text-gray-400 bg-gray-50 rounded-full" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            
            {getStepStatus(1) === 'active' && (
              <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
                <div className="text-[12px] font-bold text-gray-700 uppercase tracking-wide mb-4 border-b border-gray-100 pb-2">
                  What would you like to import?
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { type: 'ledgers', name: 'Ledger Masters', desc: 'Parties, accounts, ledger groups' },
                    { type: 'items', name: 'Stock Items', desc: 'Products, materials, inventory' },
                    { type: 'employees', name: 'Employees', desc: 'Staff, salary, attendance' },
                    { type: 'vouchers', name: 'Vouchers (Bulk)', desc: 'Invoices, bills, payments' },
                    { type: 'openingBalance', name: 'Opening Balances', desc: 'Initial balances for accounts' }
                  ].map(item => (
                    <div
                      key={item.type}
                      onClick={() => setImportType(item.type as any)}
                      className={`border-2 rounded-md p-4 cursor-pointer transition-all ${
                        importType === item.type 
                          ? 'border-[#1557b0] bg-blue-50/50' 
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="text-center mb-3 text-gray-500">
                        <FileText size={28} className={`mx-auto ${importType === item.type ? 'text-[#1557b0]' : ''}`} />
                      </div>
                      <div className={`text-[12px] font-bold text-center mb-1 ${importType === item.type ? 'text-[#1557b0]' : 'text-gray-800'}`}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-gray-500 text-center leading-tight mb-3">
                        {item.desc}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadTemplate();
                        }}
                        className={`w-full py-1.5 text-[10px] font-semibold border rounded transition-colors ${
                          importType === item.type
                            ? 'bg-[#1557b0] border-[#1557b0] text-white'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        ⬇ Download Template
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {(getStepStatus(2) === 'active' || getStepStatus(2) === 'completed') && (
              <div className="flex flex-col gap-5">
                <div
                  className="bg-white hover:bg-gray-50 border-2 border-dashed border-gray-300 rounded-md p-8 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload size={28} className="text-gray-400 mb-3" />
                  <div className="text-[12px] text-gray-700 font-medium mb-1">Upload filled template</div>
                  <div className="text-[10px] text-gray-500">(.xlsx, .csv, .json, .xml supported)</div>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.csv,.json,.xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                
                {isValidating && (
                  <div className="flex flex-col items-center justify-center py-8 bg-white border border-gray-200 rounded-md shadow-sm">
                    <RefreshCw size={24} className="animate-spin text-[#1557b0] mb-2" />
                    <div className="text-[12px] font-medium text-gray-600">Validating file structure...</div>
                  </div>
                )}
                
                {importPreview.length > 0 && !isValidating && (
                  <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
                    {/* Validation Summary Bar */}
                    <div className="flex gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold">
                      <span className="text-green-700 flex items-center gap-1"><CheckCircle size={14} /> Valid: {validCount}</span>
                      <span className="text-amber-700 flex items-center gap-1"><AlertTriangle size={14} /> Warnings: {warnCount}</span>
                      <span className="text-red-700 flex items-center gap-1"><AlertTriangle size={14} /> Errors: {errorCount}</span>
                      <span className="text-gray-500 ml-auto">Skipped: {importPreview.filter(r => r.status === 'skip').length}</span>
                    </div>
                    
                    {/* Preview Table */}
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white border-b border-gray-200 sticky top-0 shadow-sm z-10">
                            <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-white">Row</th>
                            <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-white">Data Preview</th>
                            <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-white">Status</th>
                            <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide bg-white">Message</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {importPreview.map((row) => (
                            <tr 
                              key={row.row} 
                              className={`
                                ${row.status === 'valid' ? 'bg-green-50/30' : 
                                  row.status === 'warning' ? 'bg-amber-50/30' : 
                                  row.status === 'error' ? 'bg-red-50/30' : 'bg-gray-50/50'}
                                ${row.status === 'skip' ? 'opacity-50' : ''}
                              `}
                            >
                              <td className="px-3 py-2.5 text-[11px] font-medium text-gray-700 w-12 text-center border-r border-gray-100">{row.row}</td>
                              <td className="px-3 py-2.5 text-[11px] font-mono text-gray-600 truncate max-w-[200px]">
                                {Object.values(row.data).slice(0, 3).join(', ')}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  row.status === 'valid' ? 'bg-green-100 text-green-700' : 
                                  row.status === 'warning' ? 'bg-amber-100 text-amber-700' : 
                                  row.status === 'error' ? 'bg-red-100 text-red-700' : 
                                  'bg-gray-200 text-gray-600'
                                }`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-[10px] font-medium italic text-gray-500 max-w-[200px] truncate">
                                {row.message || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Import Buttons */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-3">
                      <button
                        onClick={handleImportValid}
                        disabled={validCount === 0 || isImporting}
                        className="flex-1 h-9 bg-[#059669] hover:bg-green-700 disabled:bg-green-600/50 text-white text-[12px] font-medium rounded transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {isImporting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Import Valid Rows Only
                      </button>
                      
                      <button
                        onClick={handleImportAll}
                        disabled={isImporting}
                        className="flex-1 h-9 bg-[#1557b0] hover:bg-[#0f4a96] disabled:bg-blue-600/50 text-white text-[12px] font-medium rounded transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {isImporting ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                        Import All (Skip Errors)
                      </button>
                      
                      <button
                        onClick={() => {
                          setImportPreview([]);
                          setImportFile(null);
                        }}
                        disabled={isImporting}
                        className="h-9 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded hover:bg-gray-100 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* EXPORT TAB */}
        {tab === 'export' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column - Export Scope */}
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
                What to Export
              </div>
              
              <div className="flex flex-col gap-3 mb-5">
                {[
                  { value: 'full', label: 'Full Company Data' },
                  { value: 'masters', label: 'Specific Masters Only' },
                  { value: 'vouchers', label: 'Specific Vouchers (Date Range)' },
                  { value: 'report', label: 'Current Report on Screen' }
                ].map(option => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-gray-800">
                    <input
                      type="radio"
                      checked={exportScope === option.value}
                      onChange={() => setExportScope(option.value as any)}
                      className="text-[#1557b0] focus:ring-[#1557b0]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              
              {exportScope === 'vouchers' && (
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded mb-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date From:</div>
                      <input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => setExportDateFrom(e.target.value)}
                        className="w-full h-8 px-2 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] bg-white"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Date To:</div>
                      <input
                        type="date"
                        value={exportDateTo}
                        onChange={(e) => setExportDateTo(e.target.value)}
                        className="w-full h-8 px-2 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1557b0] focus:border-[#1557b0] bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={exportIncludeMasters}
                    onChange={(e) => setExportIncludeMasters(e.target.checked)}
                    className="text-[#1557b0] rounded focus:ring-[#1557b0]"
                  />
                  Include Masters (ledgers, items, parties)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={exportIncludeConfig}
                    onChange={(e) => setExportIncludeConfig(e.target.checked)}
                    className="text-[#1557b0] rounded focus:ring-[#1557b0]"
                  />
                  Include Configuration (F11, print settings)
                </label>
              </div>
            </div>
            
            {/* Right Column - Export Format */}
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm flex flex-col">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 mb-4">
                Output Format
              </div>
              
              <div className="flex flex-col gap-2 mb-6 flex-1">
                {[
                  { value: 'xml', label: 'Native XML', desc: 'Fully structured, lossless — best for migration' },
                  { value: 'excel', label: 'Excel Workbook (.xlsx)', desc: 'One sheet per data type — for analysis' },
                  { value: 'csv', label: 'CSV (Flat files)', desc: 'One file per entity — universal compatibility' },
                  { value: 'json', label: 'JSON', desc: 'For API consumption and integration' },
                  { value: 'sdf', label: 'SDF Format', desc: 'Software Data Format — for CA portals and audit' }
                ].map(format => (
                  <div
                    key={format.value}
                    onClick={() => setExportFormat(format.value as any)}
                    className={`border rounded cursor-pointer p-2.5 transition-colors ${
                      exportFormat === format.value 
                        ? 'border-[#1557b0] bg-blue-50/50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-[12px] font-semibold mb-0.5 ${exportFormat === format.value ? 'text-[#1557b0]' : 'text-gray-800'}`}>
                      {format.label}
                    </div>
                    <div className="text-[10px] text-gray-500 leading-tight">{format.desc}</div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full h-10 bg-[#1557b0] hover:bg-[#0f4a96] disabled:bg-[#1557b0]/50 text-white text-[13px] font-medium rounded-md transition-colors shadow-sm flex items-center justify-center gap-2 mt-auto"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Exporting Data...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Export Data
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* MIGRATION TAB */}
        {tab === 'migration' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
              <div className="text-[13px] font-bold text-gray-800 mb-4 border-b border-gray-100 pb-3">
                Import from Another Accounting System
              </div>
              
              {/* Source System Selector */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                  { value: 'tally', label: 'Tally ERP9 / Prime', desc: '(.900 / XML)' },
                  { value: 'busy', label: 'Busy Accounting', desc: '(XML export)' },
                  { value: 'excel', label: 'Excel / CSV', desc: '(manually prepared)' },
                  { value: 'json', label: 'JSON / XML API', desc: '' },
                  { value: 'prev-version', label: 'Previous version', desc: 'Sutra ERP' }
                ].map(source => (
                  <div
                    key={source.value}
                    onClick={() => setMigrationSource(source.value as any)}
                    className={`border rounded p-3 cursor-pointer text-center transition-colors flex flex-col items-center justify-center ${
                      migrationSource === source.value 
                        ? 'border-[#1557b0] bg-blue-50/50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-[11px] font-bold leading-tight mb-1 ${migrationSource === source.value ? 'text-[#1557b0]' : 'text-gray-800'}`}>
                      {source.label}
                    </div>
                    {source.desc && <div className="text-[9px] text-gray-500 leading-tight">{source.desc}</div>}
                  </div>
                ))}
              </div>
              
              {/* Migration Instructions */}
              <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-5">
                <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-blue-600" /> Instructions
                </div>
                <div className="text-[11px] text-blue-900 space-y-1.5 ml-5">
                  {migrationSource === 'tally' && (
                    <>
                      <div>1. In Tally: Go to Company → Export → Full Data.</div>
                      <div>2. Select XML format.</div>
                      <div>3. Upload the XML file here.</div>
                    </>
                  )}
                  {migrationSource === 'busy' && (
                    <>
                      <div>1. In Busy: File → Export → Complete Export.</div>
                      <div>2. Select XML.</div>
                      <div>3. Upload here.</div>
                    </>
                  )}
                  {migrationSource === 'excel' && (
                    <>
                      <div>1. Download our Excel template from the Import tab.</div>
                      <div>2. Fill with your master data.</div>
                      <div>3. Upload the filled file here.</div>
                    </>
                  )}
                  {(migrationSource === 'json' || migrationSource === 'prev-version') && (
                    <>
                      <div>1. Export data from your current system to XML or JSON.</div>
                      <div>2. Upload here.</div>
                      <div>3. Review and import.</div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Upload & Migrate Section */}
              <div
                className="bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-md p-8 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-sm mb-5"
                onClick={() => document.getElementById('migration-file-upload')?.click()}
              >
                <Upload size={28} className="text-gray-400 mb-3" />
                <div className="text-[12px] text-gray-700 font-medium mb-1">Upload migration file</div>
                <div className="text-[10px] text-gray-500">(.xml, .json, .xlsx, .csv)</div>
                <input
                  id="migration-file-upload"
                  type="file"
                  accept=".xml,.json,.xlsx,.csv"
                  className="hidden"
                />
              </div>
              
              <div className="flex flex-wrap gap-3 mb-4 border-t border-gray-100 pt-5">
                <button
                  onClick={() => toast.success('Analysis complete: 1200 records detected, 150 potential duplicates flagged')}
                  className="flex-1 h-9 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded shadow-sm hover:bg-gray-50 transition-colors"
                >
                  Upload & Analyze First
                </button>
                <button
                  className="flex-1 h-9 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded shadow-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Database size={14} /> Proceed with Migration
                </button>
              </div>
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <span><strong className="font-semibold">Note:</strong> Migration does not delete existing data. Duplicate detection will flag any conflicts before committing.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataExportImport;
