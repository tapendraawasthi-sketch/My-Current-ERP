import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { VoucherType, VoucherStatus, VoucherLine, AccountType } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { validateJournalBalance, round2, today, isPeriodLocked } from "@/utils/accounting";

const emptyLine = (): VoucherLine => ({
  id: uuidv4(), accountId: "", description: "", debit: 0, credit: 0
});

export function GeneralJournal() {
  const { accounts, addJournalEntry, periodLocks, fiscalYears, currentUserId } = useAccountingStore();
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<VoucherLine[]>([emptyLine(), emptyLine()]);
  const [submitMsg, setSubmitMsg] = useState("");

  const activeFy = fiscalYears.find((fy) => fy.isActive);
  const activeLock = periodLocks.find((pl) => pl.fiscalYearId === activeFy?.id);

  const addLine = () => setLines([...lines, emptyLine()]);
  const updateLine = (id: string, field: keyof VoucherLine, value: string | number) => setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  const removeLine = (id: string) => lines.length > 2 && setLines(lines.filter(l => l.id !== id));

  const { valid, totalDebit, totalCredit, difference } = validateJournalBalance(lines);

  const handleSubmit = (status: VoucherStatus) => {
    if (!narration) return setSubmitMsg("Narration required.");
    if (!valid) return setSubmitMsg("Entry must balance.");
    if (lines.some(l => !l.accountId)) return setSubmitMsg("Select accounts.");
    const lockCheck = isPeriodLocked(date, activeLock?.hardLockDate, activeLock?.softLockDate);
    if (lockCheck.locked) return setSubmitMsg(lockCheck.message || "Locked.");

    addJournalEntry({ voucherType: VoucherType.JOURNAL, date, narration, status, lines, createdBy: currentUserId });
    setSubmitMsg(`✓ Saved`);
    setTimeout(() => { setDate(today()); setNarration(""); setLines([emptyLine(), emptyLine()]); setSubmitMsg(""); }, 2000);
  };

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">General Journal</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manual double-entry accounting record</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSubmit(VoucherStatus.DRAFT)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Save Draft</button>
            <button onClick={() => handleSubmit(VoucherStatus.POSTED)} disabled={!valid} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md disabled:opacity-50">Post Entry</button>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-4 mb-4">
            <div className="w-1/4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div className="w-3/4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration *</label>
              <input type="text" value={narration} onChange={e => setNarration(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
          </div>
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Debit</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Credit</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lines.map(line => (
                <tr key={line.id}>
                  <td className="px-2 py-1.5"><select value={line.accountId} onChange={e => updateLine(line.id, "accountId", e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"><option value="">— Select —</option>{accounts.filter(a => !a.isGroup).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></td>
                  <td className="px-2 py-1.5"><input type="text" value={line.description || ""} onChange={e => updateLine(line.id, "description", e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" /></td>
                  <td className="px-2 py-1.5"><input type="number" step="0.01" value={line.debit || ""} onChange={e => { updateLine(line.id, "debit", parseFloat(e.target.value) || 0); if (parseFloat(e.target.value) > 0) updateLine(line.id, "credit", 0); }} className="w-full h-8 px-2.5 text-[12px] font-mono text-right border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" /></td>
                  <td className="px-2 py-1.5"><input type="number" step="0.01" value={line.credit || ""} onChange={e => { updateLine(line.id, "credit", parseFloat(e.target.value) || 0); if (parseFloat(e.target.value) > 0) updateLine(line.id, "debit", 0); }} className="w-full h-8 px-2.5 text-[12px] font-mono text-right border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" /></td>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(line.id)} className="text-gray-400 hover:text-red-600">×</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={5} className="px-2 py-2"><button onClick={addLine} className="h-8 px-3 text-[#1557b0] text-[12px] font-medium">+ Add Line</button></td></tr>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td colSpan={2} className="px-3 py-2.5 text-right text-[12px] font-bold text-gray-700">Total:</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold">{totalDebit.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold">{totalCredit.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-[12px] text-gray-600">{submitMsg}</span>
            <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${valid ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {valid ? "BALANCED" : `UNBALANCED (${difference.toFixed(2)})`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
