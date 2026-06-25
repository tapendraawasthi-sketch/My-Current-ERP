import React, { useState, useMemo } from "react";
import { ReconcileStatus } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { round2, today, computeLedger } from "@/utils/accounting";

export function BankReconciliation() {
  const { accounts, journalEntries, addBankReconciliation } = useAccountingStore();
  const bankAccounts = accounts.filter(a => !a.isGroup && (a.group === "Cash & Bank" || a.name.toLowerCase().includes("bank")));

  const [bankAccountId, setBankAccountId] = useState("");
  const [statementDate, setStatementDate] = useState(today());
  const [statementBalance, setStatementBalance] = useState<number>(0);
  const [submitMsg, setSubmitMsg] = useState("");

  const ledgerData = useMemo(() => {
    if (!bankAccountId) return null;
    return computeLedger(bankAccountId, accounts, journalEntries, "2000-01-01", statementDate);
  }, [bankAccountId, accounts, journalEntries, statementDate]);

  const systemBalance = ledgerData?.closingBalance ?? 0;
  const difference = round2(Math.abs(statementBalance - systemBalance));
  const isReconciled = difference < 0.01;

  const handleSave = () => {
    if (!bankAccountId) return;
    addBankReconciliation({
      bankAccountId, statementDate, statementEndBalance: statementBalance, systemLedgerBalance: systemBalance,
      reconciledBalance: statementBalance, outstandingDeposits: 0, outstandingPayments: 0, isReconciled, statementLines: [], createdBy: ""
    });
    setSubmitMsg(isReconciled ? "✓ Reconciled successfully" : `Saved with difference of ${difference.toFixed(2)}`);
  };

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Bank Reconciliation</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Match bank statement with system ledger</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Save Reconciliation</button>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Account *</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]">
                <option value="">— Select Bank —</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Statement Date</label>
              <input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Statement End Balance</label>
              <input type="number" step="0.01" value={statementBalance || ""} onChange={e => setStatementBalance(parseFloat(e.target.value) || 0)} className="w-full h-8 px-2.5 text-[12px] font-mono text-right border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]" />
            </div>
          </div>

          {bankAccountId && (
            <div className="flex items-center gap-4 mb-4">
              <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-[12px]">System Balance: <span className="font-mono font-bold text-gray-800">{systemBalance.toFixed(2)}</span></div>
              <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-[12px]">Statement Balance: <span className="font-mono font-bold text-gray-800">{statementBalance.toFixed(2)}</span></div>
              <div className={`px-3 py-2 border rounded-md text-[12px] ${isReconciled ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                Difference: <span className="font-mono font-bold">{difference.toFixed(2)}</span> {isReconciled && "✓"}
              </div>
            </div>
          )}

          <div className="border border-gray-200">
            <div className="bg-[#f5f6fa] border-b border-gray-200 px-4 py-2">
              <h2 className="text-[12px] font-semibold text-gray-700">Ledger Entries</h2>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Voucher</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Narration</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Debit</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerData?.entries.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-[12px] text-gray-600">{e.date}</td>
                      <td className="px-3 py-1.5 text-[12px] text-gray-800 font-medium">{e.voucherNumber}</td>
                      <td className="px-3 py-1.5 text-[12px] text-gray-600">{e.narration}</td>
                      <td className="px-3 py-1.5 text-[12px] font-mono text-right text-red-600">{e.debit > 0 ? e.debit.toFixed(2) : ""}</td>
                      <td className="px-3 py-1.5 text-[12px] font-mono text-right text-green-600">{e.credit > 0 ? e.credit.toFixed(2) : ""}</td>
                    </tr>
                  ))}
                  {(!ledgerData || ledgerData.entries.length === 0) && <tr><td colSpan={5} className="px-3 py-4 text-center text-[12px] text-gray-500">No entries.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {submitMsg && <div className="mt-2 text-[12px] text-gray-600">{submitMsg}</div>}
        </div>
      </div>
    </div>
  );
}
