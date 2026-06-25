import React, { useState, useMemo } from "react";
import { PartyType, VoucherStatus, PaymentStatus } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { round2, today } from "@/utils/accounting";

export function PaymentReceiptForm() {
  const { parties, invoices, accounts, addPayment, currentUserId } = useAccountingStore();
  const [partyId, setPartyId] = useState("");
  const [partyType, setPartyType] = useState<PartyType>(PartyType.CUSTOMER);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState("");
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitMsg, setSubmitMsg] = useState("");

  const filteredParties = parties.filter((p) => p.type === partyType || p.type === PartyType.BOTH);
  const bankAccounts = accounts.filter(a => !a.isGroup && (a.group === "Cash & Bank" || a.name.toLowerCase().includes("bank")));

  const outstandingInvoices = useMemo(() => {
    if (!partyId) return [];
    return invoices.filter(inv => inv.partyId === partyId && (inv.status === PaymentStatus.UNPAID || inv.status === PaymentStatus.PARTIAL) && inv.voucherStatus === VoucherStatus.POSTED);
  }, [invoices, partyId]);

  const allocatedTotal = useMemo(() => round2(Object.values(allocations).reduce((a, b) => a + b, 0)), [allocations]);
  const unallocated = round2(amount - allocatedTotal);

  const autoAllocate = () => {
    let remaining = amount;
    const newAlloc: Record<string, number> = {};
    for (const inv of outstandingInvoices) {
      if (remaining <= 0) break;
      const due = inv.amountDue;
      const alloc = Math.min(remaining, due);
      newAlloc[inv.id] = alloc;
      remaining = round2(remaining - alloc);
    }
    setAllocations(newAlloc);
  };

  const handleSave = () => {
    if (!partyId || !bankAccountId || amount <= 0) return setSubmitMsg("Fill required fields.");
    addPayment({
      partyId, partyType, date, amount, reference, bankAccountId, narration,
      allocations: Object.entries(allocations).map(([invId, amt]) => {
        const inv = invoices.find(i => i.id === invId);
        return { invoiceId: invId, invoiceNumber: inv?.invoiceNumber, allocatedAmount: amt };
      }).filter(a => a.allocatedAmount > 0),
      unallocatedAmount: unallocated,
      status: VoucherStatus.DRAFT,
      createdBy: currentUserId,
    });
    setSubmitMsg("✓ Saved");
    setTimeout(() => { setPartyId(""); setAmount(0); setAllocations({}); setSubmitMsg(""); }, 2000);
  };

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Payment & Receipt</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Allocate money in or out</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Save Payment</button>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Type</label>
              <select value={partyType} onChange={e => { setPartyType(e.target.value as PartyType); setPartyId(""); setAllocations({}); }} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value={PartyType.CUSTOMER}>Receipt (from Customer)</option>
                <option value={PartyType.VENDOR}>Payment (to Vendor)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Party *</label>
              <select value={partyId} onChange={e => { setPartyId(e.target.value); setAllocations({}); }} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="">— Select —</option>
                {filteredParties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Amount *</label>
              <input type="number" step="0.01" value={amount || ""} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className="w-full h-8 px-2.5 text-[12px] font-mono text-right border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Account *</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="">— Select Bank —</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
              <input type="text" value={narration} onChange={e => setNarration(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[12px] font-semibold text-gray-700">Outstanding Invoices</h2>
            <button onClick={autoAllocate} className="h-7 px-2 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50">Auto-Allocate</button>
          </div>
          <table className="w-full border-collapse border border-gray-200 mb-4">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Invoice #</th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Due</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Allocate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {outstandingInvoices.map(inv => (
                <tr key={inv.id}>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{inv.invoiceNumber}</td>
                  <td className="px-3 py-2 text-[12px] text-gray-700">{inv.date}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px]">{inv.totalAmount.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12px]">{inv.amountDue.toFixed(2)}</td>
                  <td className="px-2 py-1.5"><input type="number" step="0.01" max={inv.amountDue} value={allocations[inv.id] || ""} onChange={e => setAllocations({ ...allocations, [inv.id]: parseFloat(e.target.value) || 0 })} className="w-full h-7 px-2 text-[12px] font-mono text-right border border-gray-300 rounded bg-white focus:outline-none focus:border-[#1557b0]" /></td>
                </tr>
              ))}
              {outstandingInvoices.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-[12px] text-gray-500">No outstanding invoices.</td></tr>}
            </tbody>
            <tfoot>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td colSpan={4} className="px-3 py-2 text-right text-[12px] font-bold text-gray-700">Allocated:</td>
                <td className="px-3 py-2 text-right font-mono text-[12px] font-bold text-[#1557b0]">{allocatedTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="text-[11px] text-gray-600 font-medium">Unallocated Balance: <span className="font-mono text-[#1557b0]">{unallocated.toFixed(2)}</span></div>
          {submitMsg && <div className="mt-2 text-[12px] text-gray-600">{submitMsg}</div>}
        </div>
      </div>
    </div>
  );
}
