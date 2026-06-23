import React, { useState, useMemo } from "react";
import { Save, Upload, AlertCircle, FileSpreadsheet, CheckCircle2, ArrowRight } from "lucide-react";
import { useStore } from "../store";
import { Account, VoucherType, VoucherStatus, JournalEntry } from "../lib/types";
import { ActionToolbar } from "../components/ui";
import { generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { ADToBSString } from "../lib/nepaliDate";

export default function OpeningBalance() {
  const { accounts, addVoucher, addAccount } = useStore();
  const [activeTab, setActiveTab] = useState<"manual" | "excel">("manual");
  
  // Manual Entry State
  const [manualBalances, setManualBalances] = useState<Record<string, { amount: number, nature: "DR"|"CR" }>>({});
  
  // Excel Import State
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [mappedAccounts, setMappedAccounts] = useState<Record<number, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  // Group Accounts for Manual
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    accounts.forEach(a => {
      const g = a.groupName || "Other";
      if(!groups[g]) groups[g] = [];
      groups[g].push(a);
    });
    return groups;
  }, [accounts]);

  const handleManualChange = (accountId: string, amount: number, nature: "DR"|"CR") => {
    setManualBalances(prev => ({
      ...prev,
      [accountId]: { amount, nature }
    }));
  };

  const drTotal = Object.values(manualBalances).filter(b => b.nature === "DR").reduce((s, b) => s + (b.amount || 0), 0);
  const crTotal = Object.values(manualBalances).filter(b => b.nature === "CR").reduce((s, b) => s + (b.amount || 0), 0);
  const diff = Math.abs(drTotal - crTotal);
  const isBalanced = diff === 0 && (drTotal > 0 || crTotal > 0);

  const findOrCreateSuspenseAccount = async (): Promise<Account> => {
    let suspense = accounts.find(a => a.name.toLowerCase().includes("suspense account"));
    if (!suspense) {
      suspense = await addAccount({
        name: "Suspense Account — Opening Difference",
        code: "SUSP-01",
        nature: "liabilities",
        groupName: "Suspense",
        isGroup: false,
        isSystem: true
      });
    }
    return suspense;
  };

  const saveOpeningBalances = async (balances: Record<string, {amount: number, nature: "DR"|"CR"}>) => {
    const lines = [];
    let dTotal = 0;
    let cTotal = 0;

    for (const [accId, data] of Object.entries(balances)) {
      if (data.amount > 0) {
        const acc = accounts.find(a => a.id === accId);
        if (acc) {
          if (data.nature === "DR") {
            dTotal += data.amount;
            lines.push({ id: generateId("line"), accountId: acc.id, accountName: acc.name, debit: data.amount, credit: 0, narration: "Opening Balance" });
          } else {
            cTotal += data.amount;
            lines.push({ id: generateId("line"), accountId: acc.id, accountName: acc.name, debit: 0, credit: data.amount, narration: "Opening Balance" });
          }
        }
      }
    }

    if (lines.length === 0) {
      toast.error("No balances to save");
      return;
    }

    if (dTotal !== cTotal) {
      if (!confirm(`Totals do not match (Diff: Rs. ${Math.abs(dTotal - cTotal)}). Post difference to Suspense Account?`)) return;
      
      const suspense = await findOrCreateSuspenseAccount();
      if (dTotal > cTotal) {
        lines.push({ id: generateId("line"), accountId: suspense.id, accountName: suspense.name, debit: 0, credit: dTotal - cTotal, narration: "Opening Difference" });
      } else {
        lines.push({ id: generateId("line"), accountId: suspense.id, accountName: suspense.name, debit: cTotal - dTotal, credit: 0, narration: "Opening Difference" });
      }
    }

    const todayAD = new Date().toISOString().split("T")[0];
    const todayBS = ADToBSString(todayAD);

    const voucher: Omit<JournalEntry, "id" | "voucherNo" | "totalDebit" | "totalCredit" | "createdBy" | "createdAt"> = {
      type: VoucherType.OPENING_BALANCE,
      date: todayAD,
      dateNepali: todayBS,
      lines,
      narration: "Imported Opening Balances",
      status: VoucherStatus.POSTED
    };

    try {
      await addVoucher(voucher);
      toast.success("Opening balances saved successfully!");
      setManualBalances({});
      setParsedRows([]);
    } catch (e: any) {
      toast.error(e.message || "Failed to save balances");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const rows = data.map((row: any) => {
          const ledgerName = row["Ledger Name"] || row["Account Name"] || row["Ledger"];
          const amount = parseFloat(row["Amount"] || row["Balance"]) || 0;
          const drCrStr = String(row["Dr/Cr"] || row["Nature"] || row["Type"]).toUpperCase();
          const nature = (drCrStr === "CR" || drCrStr === "CREDIT") ? "CR" : "DR";
          
          return { ledgerName, amount, nature };
        }).filter(r => r.ledgerName && r.amount > 0);

        setParsedRows(rows);
        
        // Auto-map
        const mapping: Record<number, string> = {};
        rows.forEach((r, idx) => {
          const match = accounts.find(a => a.name.toLowerCase() === r.ledgerName.toLowerCase());
          if (match) mapping[idx] = match.id;
        });
        setMappedAccounts(mapping);
        toast.success(`Loaded ${rows.length} records`);

      } catch (err) {
        toast.error("Failed to parse Excel file");
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmExcelImport = async () => {
    const unmapped = parsedRows.some((_, idx) => !mappedAccounts[idx]);
    if (unmapped) {
      toast.error("Please map all unmatched accounts before saving.");
      return;
    }

    const balances: Record<string, {amount: number, nature: "DR"|"CR"}> = {};
    parsedRows.forEach((r, idx) => {
      const accId = mappedAccounts[idx];
      if (accId) {
        if (!balances[accId]) balances[accId] = { amount: 0, nature: "DR" };
        balances[accId].amount += r.amount;
        balances[accId].nature = r.nature;
      }
    });

    await saveOpeningBalances(balances);
  };

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Opening Balances</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Initialize or import opening balances for ledgers</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
          <button onClick={() => setActiveTab("manual")} className={`px-4 py-2.5 text-[12px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "manual" ? "border-[#1557b0] text-[#1557b0] bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Manual Entry
          </button>
          <button onClick={() => setActiveTab("excel")} className={`px-4 py-2.5 text-[12px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === "excel" ? "border-[#1557b0] text-[#1557b0] bg-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Import from Excel
          </button>
        </div>

        {/* Manual Tab Content */}
        {activeTab === "manual" && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {Object.entries(groupedAccounts).map(([group, accs]) => (
                <div key={group} className="mb-6">
                  <h3 className="text-[12px] font-bold text-gray-700 uppercase tracking-wide bg-gray-100 px-3 py-1.5 rounded-t border border-gray-200 border-b-0">{group}</h3>
                  <table className="w-full border border-gray-200">
                    <thead className="bg-[#f5f6fa] border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Ledger Name</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase w-48">Opening Amount</th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase w-32">Nature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accs.map(acc => {
                        const bal = manualBalances[acc.id] || { amount: 0, nature: "DR" };
                        return (
                          <tr key={acc.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-[12px] font-medium text-gray-800">{acc.name}</td>
                            <td className="px-3 py-2 text-right">
                              <input 
                                type="number" 
                                value={bal.amount || ""} 
                                onChange={e => handleManualChange(acc.id, Number(e.target.value), bal.nature)}
                                placeholder="0.00"
                                className="w-full text-right text-[12px] font-mono border border-gray-300 rounded px-2 py-1 focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select 
                                value={bal.nature} 
                                onChange={e => handleManualChange(acc.id, bal.amount, e.target.value as "DR"|"CR")}
                                className="text-[11px] font-bold border border-gray-300 rounded px-2 py-1 focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0] bg-white"
                              >
                                <option value="DR">Dr</option>
                                <option value="CR">Cr</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            
            {/* Totals & Action */}
            <div className="p-4 bg-white border-t border-gray-200 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="text-[12px] text-gray-600">Total Debit: <span className="font-mono font-bold text-gray-900 ml-1">Rs. {drTotal.toLocaleString()}</span></div>
                <div className="text-[12px] text-gray-600">Total Credit: <span className="font-mono font-bold text-gray-900 ml-1">Rs. {crTotal.toLocaleString()}</span></div>
                
                <div className={`px-3 py-1 text-[11px] font-bold rounded-full border ${isBalanced ? "bg-green-50 text-green-700 border-green-200" : diff > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                  {isBalanced ? "Balanced" : diff > 0 ? `Difference: Rs. ${diff.toLocaleString()}` : "No Entries"}
                </div>
              </div>
              <button onClick={() => saveOpeningBalances(manualBalances)} className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 shadow-sm">
                <Save className="w-4 h-4" /> Save Opening Balances
              </button>
            </div>
          </>
        )}

        {/* Excel Tab Content */}
        {activeTab === "excel" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {parsedRows.length === 0 ? (
              <div className="flex-1 p-8 flex items-center justify-center">
                <div 
                  className={`w-full max-w-md border-2 border-dashed rounded-xl p-8 text-center transition-colors ${isDragging ? "border-[#1557b0] bg-blue-50" : "border-gray-300 hover:border-[#1557b0] hover:bg-gray-50"}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if(file) {
                      const evt = { target: { files: [file] } } as any;
                      handleFileUpload(evt);
                    }
                  }}
                >
                  <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-[14px] font-semibold text-gray-800 mb-1">Upload Opening Balances</h3>
                  <p className="text-[11px] text-gray-500 mb-4">Drag and drop your Excel (.xlsx) or CSV file here</p>
                  
                  <div className="flex justify-center">
                    <label className="cursor-pointer h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5">
                      <Upload className="w-4 h-4" /> Browse File
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>

                  <div className="mt-6 text-left bg-blue-50 p-3 rounded-lg border border-blue-100 text-[11px] text-blue-800">
                    <p className="font-bold mb-1">Expected Format:</p>
                    <p>Columns: <b>Ledger Name</b>, <b>Amount</b>, <b>Dr/Cr</b></p>
                    <p className="text-blue-600 mt-1">Names must match exactly for auto-mapping. Unmatched accounts can be mapped manually.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
                  <div className="text-[12px] font-medium text-gray-700">Previewing {parsedRows.length} records</div>
                  <div className="flex gap-2">
                    <button onClick={() => setParsedRows([])} className="h-7 px-3 bg-white border border-gray-300 text-gray-600 text-[11px] font-medium rounded hover:bg-gray-100">Cancel</button>
                    <button onClick={confirmExcelImport} className="h-7 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[11px] font-medium rounded flex items-center gap-1 shadow-sm">
                      <Save className="w-3.5 h-3.5" /> Post to System
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <table className="w-full border border-gray-200 bg-white">
                    <thead className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Excel Ledger Name</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase">Amount</th>
                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase">Nature</th>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase w-64">System Account Mapping</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((r, idx) => {
                        const isMapped = !!mappedAccounts[idx];
                        return (
                          <tr key={idx} className={`border-b border-gray-100 ${!isMapped ? "bg-red-50" : "hover:bg-gray-50"}`}>
                            <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800 flex items-center gap-2">
                              {!isMapped ? <AlertCircle className="w-4 h-4 text-red-500" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              {r.ledgerName}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] font-mono text-right">{r.amount.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-[11px] font-bold text-center text-gray-600">{r.nature}</td>
                            <td className="px-3 py-2.5">
                              <select 
                                value={mappedAccounts[idx] || ""}
                                onChange={e => setMappedAccounts({...mappedAccounts, [idx]: e.target.value})}
                                className={`w-full text-[11px] border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1557b0] ${!isMapped ? "border-red-300 bg-white" : "border-gray-300"}`}
                              >
                                <option value="">-- Select Account --</option>
                                {accounts.map(a => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.groupName})</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
