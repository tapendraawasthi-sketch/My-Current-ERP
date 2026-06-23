import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import {
  exportPartyImportTemplate,
  exportItemImportTemplate,
  exportOpeningBalanceTemplate
} from '../lib/exportUtils';
import { UploadCloud, CheckCircle, Download, ChevronRight } from 'lucide-react';

type ImportTab = 'parties' | 'items' | 'accounts' | 'opening_balances';

export default function DataImport() {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<ImportTab>('parties');
  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setParsedData(data);
      setStep(2);
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    switch(activeTab) {
      case 'parties': exportPartyImportTemplate(); break;
      case 'items': exportItemImportTemplate(); break;
      case 'accounts': exportOpeningBalanceTemplate(); break;
      case 'opening_balances': exportOpeningBalanceTemplate(); break;
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    const total = parsedData.length;

    for (let i = 0; i < total; i++) {
      const row = parsedData[i];
      // Simulate delay for progress bar
      await new Promise(r => setTimeout(r, 50));
      setProgress(Math.round(((i + 1) / total) * 100));

      if (activeTab === 'parties') {
        const pan = row['PAN'] || row['VAT No'];
        store.addParty({
          id: 'P-' + Date.now() + i,
          code: row['Code'] || `P${i}`,
          name: row['Name'] || 'Unknown',
          type: String(row['Type']).toLowerCase() === 'supplier' ? 'supplier' : 'customer',
          pan: pan ? String(pan) : undefined,
          phone: row['Phone'] ? String(row['Phone']) : undefined,
          email: row['Email'],
          address: row['Address'],
          openingBalance: parseFloat(String(row['Credit Limit'] || '0').replace(/[^0-9.-]+/g,"")) || 0,
          isActive: true
        });
      } else if (activeTab === 'items') {
        store.addItem({
          id: 'I-' + Date.now() + i,
          code: row['Code'] || `I${i}`,
          name: row['Name'] || 'Unknown',
          type: String(row['Type']).toLowerCase() === 'service' ? 'service' : 'inventory',
          unit: row['Unit'] || 'PCS',
          purchaseRate: parseFloat(String(row['Purchase Rate'] || '0').replace(/[^0-9.-]+/g,"")),
          salesRate: parseFloat(String(row['Sales Rate'] || '0').replace(/[^0-9.-]+/g,"")),
          isTaxable: row['Taxable (Y/N)'] === 'Y',
          isActive: true
        });
      }
    }

    setImporting(false);
    setStep(3);
  };

  const reset = () => {
    setStep(1);
    setParsedData([]);
    setProgress(0);
  };

  const renderStep1 = () => (
    <div className="bg-white p-6 rounded-md border border-gray-200 text-center">
      <div className="mb-6 flex justify-center space-x-4 border-b border-gray-200">
        {['parties', 'items', 'accounts', 'opening_balances'].map(t => (
          <button
            key={t}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 ${activeTab === t ? 'border-[#1557b0] text-[#1557b0]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab(t as ImportTab)}
          >
            {t.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <button onClick={handleDownloadTemplate} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-2">
          <Download size={14} /> Download Template
        </button>
      </div>

      <label className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
        <UploadCloud size={40} className="text-gray-400 mb-4" />
        <p className="text-[14px] font-medium text-gray-700">Click to upload or drag and drop</p>
        <p className="text-[11px] text-gray-500 mt-1">XLSX, XLS, CSV files supported</p>
        <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
      </label>
    </div>
  );

  const renderStep2 = () => {
    const columns = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];
    const previewData = parsedData.slice(0, 10);

    return (
      <div className="bg-white rounded-md border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#f5f6fa]">
           <div>
             <h3 className="text-[13px] font-semibold text-gray-800">Preview & Validate</h3>
             <p className="text-[11px] text-gray-500">Found {parsedData.length} rows to import.</p>
           </div>
           <div className="flex gap-2">
             <button onClick={reset} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Cancel</button>
             <button onClick={handleImport} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Start Import</button>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                {columns.map(c => (
                  <th key={c} className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-[#e8eeff] even:bg-[#f7f9fc]">
                  {columns.map(c => (
                    <td key={c} className="px-3 py-[7px] text-[12px] text-gray-700 whitespace-nowrap">{row[c] || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="bg-white p-12 rounded-md border border-gray-200 text-center flex flex-col items-center">
      {importing ? (
        <div className="w-full max-w-md">
          <h3 className="text-[15px] font-semibold text-gray-800 mb-4">Importing Data...</h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div className="bg-[#1557b0] h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-[11px] text-gray-500">{progress}% Complete</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <CheckCircle size={48} className="text-green-500 mb-4" />
          <h3 className="text-[18px] font-semibold text-gray-800 mb-2">Import Successful!</h3>
          <p className="text-[13px] text-gray-500 mb-6">Successfully imported {parsedData.length} records into the system.</p>
          <button onClick={reset} className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Import More Data</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="page-wrapper max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Data Import Wizard</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Bulk import masters and opening balances</p>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-center">
         <div className="flex items-center gap-3">
           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= 1 ? 'bg-[#1557b0] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
           <span className={`text-[12px] font-medium ${step >= 1 ? 'text-gray-800' : 'text-gray-500'}`}>Upload</span>
           <ChevronRight size={16} className="text-gray-300 mx-2" />
           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= 2 ? 'bg-[#1557b0] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
           <span className={`text-[12px] font-medium ${step >= 2 ? 'text-gray-800' : 'text-gray-500'}`}>Preview</span>
           <ChevronRight size={16} className="text-gray-300 mx-2" />
           <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${step >= 3 ? 'bg-[#1557b0] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
           <span className={`text-[12px] font-medium ${step >= 3 ? 'text-gray-800' : 'text-gray-500'}`}>Import</span>
         </div>
      </div>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
