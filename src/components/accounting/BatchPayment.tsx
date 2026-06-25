import React, { useState, useMemo } from "react";
import { VoucherStatus, PartyType, PaymentStatus, BatchPaymentItem } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { round2, today, computePartyAging } from "@/utils/accounting";

export function BatchPayment() {
  const { invoices, parties, accounts, addBatchPayment, postBatchPayment, currentUserId } = useAccountingStore();

  const [paymentDate, setPaymentDate] = useState(today());
  const [bankAccountId, setBankAccountId] = useState("");
  const [narration, setNarration] = useState("");
  const [fileFormat, setFileFormat] = useState<"CSV" | "NACHA" | "SEPA">("CSV");
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; amount: number }>>({});
  const [submitMsg, setSubmitMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"select" | "aging">("select");

  const bankAccounts = accounts.filter(a => !a.isGroup && a.isActive && (a.group === "Cash & Bank" || a.name.toLowerCase().includes("bank")));

  const unpaidBills = useMemo(() => invoices.filter(inv => inv.invoiceType === "PURCHASE" as any && inv.voucherStatus === VoucherStatus.POSTED && inv.status !== PaymentStatus.PAID && inv.status !== PaymentStatus.VOID && inv.amountDue > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [invoices]);

  const aging = useMemo(() => computePartyAging(invoices, today()), [invoices]);
  const vendorAging = aging.filter(a => { const party = parties.find(p => p.id === a.partyId); return party?.type === PartyType.VENDOR || party?.type === PartyType.BOTH; });

  const toggleItem = (id: string, amount: number) => { setSelectedItems(prev => { if (prev[id]) { const { [id]: _, ...rest } = prev; return rest; } return { ...prev, [id]: { selected: true, amount } }; }); };
  const selectAll = () => { const all: Record<string, { selected: boolean; amount: number }> = {}; unpaidBills.forEach(b => { all[b.id] = { selected: true, amount: b.amountDue }; }); setSelectedItems(all); };
  const clearAll = () => setSelectedItems({});
  const updateAmount = (id: string, amount: number) => { setSelectedItems(prev => ({ ...prev, [id]: { selected: true, amount: round2(Math.min(amount, unpaidBills.find(b => b.id === id)?.amountDue || 0)) } })); };

  const totalSelected = round2(Object.values(selectedItems).reduce((s, v) => s + v.amount, 0));
  const selectedCount = Object.keys(selectedItems).length;

  const handleProcess = () => {
    if (!bankAccountId) return setSubmitMsg("Please select a bank account.");
    if (selectedCount === 0) return setSubmitMsg("No bills selected.");

    const bank = accounts.find(a => a.id === bankAccountId);
    const items: BatchPaymentItem[] = Object.entries(selectedItems).map(([billId, { amount }]) => {
      const bill = unpaidBills.find(b => b.id === billId)!;
      return { vendorBillId: billId, vendorName: bill.partyName, billNumber: bill.invoiceNumber, billDate: bill.date, dueDate: bill.dueDate, totalAmount: bill.totalAmount, amountDue: bill.amountDue, selectedAmount: amount, selected: true };
    });

    const bp = addBatchPayment({ paymentDate, bankAccountId, bankAccountName: bank?.name, items, totalAmount: totalSelected, narration, fileFormat, status: VoucherStatus.DRAFT, createdBy: currentUserId });
    postBatchPayment(bp.id);

    if (fileFormat === "CSV") {
      const csvContent = ["Vendor,Bill Number,Bill Date,Due Date,Amount", ...items.map(i => `"${i.vendorName}","${i.billNumber}","${i.billDate}","${i.dueDate}",${i.selectedAmount.toFixed(2)}`)].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch_payment_${paymentDate}.csv`;
      a.click();
    }

    setSubmitMsg(`✓ Batch payment processed — ${selectedCount} bills, total ${totalSelected.toFixed(2)}`);
    setTimeout(() => { setSelectedItems({}); setSubmitMsg(""); }, 3000);
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();
  const daysOverdue = (dueDate: string) => Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Batch Payment Processing</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Select & process multiple vendor bills in one payment run</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleProcess} disabled={selectedCount === 0 || !bankAccountId} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md disabled:opacity-50">Process Batch</button>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Payment Date *</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Account *</label>
              <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="">— Select Bank Account —</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toFixed(2)})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Export Format</label>
              <select value={fileFormat} onChange={e => setFileFormat(e.target.value as any)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="CSV">CSV (Universal)</option>
                <option value="NACHA">NACHA (ACH / US)</option>
                <option value="SEPA">SEPA (EU Transfer)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
              <input type="text" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Batch payment description" className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setActiveTab("select")} className={`h-8 px-4 text-[12px] font-medium rounded-md ${activeTab === "select" ? "bg-[#1557b0] text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}>Select Bills ({unpaidBills.length})</button>
            <button onClick={() => setActiveTab("aging")} className={`h-8 px-4 text-[12px] font-medium rounded-md ${activeTab === "aging" ? "bg-[#1557b0] text-white" : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"}`}>Vendor Aging</button>
          </div>

          {activeTab === "select" ? (
            <div className="border border-gray-200">
              <div className="flex justify-between items-center px-4 py-2 bg-[#f5f6fa] border-b border-gray-200">
                <h2 className="text-[12px] font-semibold text-gray-700">Outstanding Vendor Bills</h2>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#1557b0] bg-[#eef2ff] border border-[#c7d2fe] rounded hover:bg-[#e0e7ff]">Select All</button>
                  <button onClick={clearAll} className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-600 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">Clear</button>
                </div>
              </div>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="py-2 px-3 text-left w-10"></th>
                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bill #</th>
                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bill Date</th>
                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Outstanding</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Pay Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unpaidBills.map((bill) => {
                    const isSelected = !!selectedItems[bill.id];
                    const overdue = isOverdue(bill.dueDate);
                    const days = overdue ? daysOverdue(bill.dueDate) : 0;
                    return (
                      <tr key={bill.id} className={`cursor-pointer ${isSelected ? "bg-[#eef2ff]" : "hover:bg-gray-50"}`} onClick={() => toggleItem(bill.id, bill.amountDue)}>
                        <td className="py-2 px-3"><input type="checkbox" checked={isSelected} readOnly className="w-3.5 h-3.5 accent-[#1557b0]" /></td>
                        <td className="py-2 px-3 text-[12px] text-gray-800 font-medium">{bill.partyName}</td>
                        <td className="py-2 px-3 text-[12px] text-[#1557b0]">{bill.invoiceNumber}</td>
                        <td className="py-2 px-3 text-[12px] text-gray-600">{bill.date}</td>
                        <td className="py-2 px-3"><span className={overdue ? "text-red-600 font-semibold text-[12px]" : "text-gray-600 text-[12px]"}>{bill.dueDate}{overdue && <span className="ml-1 text-[10px] bg-red-50 text-red-700 px-1 py-0.5 border border-red-200 rounded uppercase font-semibold">{days}d</span>}</span></td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] text-gray-700">{bill.totalAmount.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[12px] font-semibold text-amber-700">{bill.amountDue.toFixed(2)}</td>
                        <td className="py-1.5 px-3" onClick={e => e.stopPropagation()}><input type="number" min="0" max={bill.amountDue} step="0.01" value={isSelected ? selectedItems[bill.id]?.amount : ""} onChange={e => updateAmount(bill.id, parseFloat(e.target.value) || 0)} placeholder={bill.amountDue.toFixed(2)} disabled={!isSelected} className="w-full h-7 border border-gray-300 rounded-md px-2 text-[12px] font-mono text-right focus:outline-none focus:border-[#1557b0] disabled:bg-gray-100 disabled:text-gray-400" /></td>
                      </tr>
                    );
                  })}
                  {unpaidBills.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-gray-500 text-[12px]">No outstanding vendor bills found.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td colSpan={5} className="py-2.5 px-3 text-right text-[12px] font-bold text-gray-700">{selectedCount} bills selected</td>
                    <td colSpan={2} className="py-2.5 px-3 text-right text-[12px] font-bold text-gray-700">Total:</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[12px] font-bold text-[#1557b0]">{totalSelected.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              {submitMsg && <div className="px-4 py-3 text-[12px] font-medium text-[#1557b0]">{submitMsg}</div>}
            </div>
          ) : (
            <div className="border border-gray-200">
              <div className="px-4 py-2 bg-[#f5f6fa] border-b border-gray-200"><h2 className="text-[12px] font-semibold text-gray-700">Vendor Aging Report</h2></div>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">1-30 Days</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">31-60 Days</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">61-90 Days</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">91+ Days</th>
                    <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vendorAging.map((row) => (
                    <tr key={row.partyId} className="hover:bg-gray-50">
                      <td className="py-2 px-3 text-[12px] font-medium text-gray-800">{row.partyName}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] text-gray-700">{row.current > 0 ? row.current.toFixed(2) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] text-amber-600">{row.days1to30 > 0 ? row.days1to30.toFixed(2) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] text-amber-700">{row.days31to60 > 0 ? row.days31to60.toFixed(2) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] text-red-600">{row.days61to90 > 0 ? row.days61to90.toFixed(2) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] font-semibold text-red-700">{row.days91plus > 0 ? row.days91plus.toFixed(2) : "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] font-bold text-gray-900">{row.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {vendorAging.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[12px] text-gray-500">No outstanding vendor liabilities.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td className="py-2.5 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Total</td>
                    {["current", "days1to30", "days31to60", "days61to90", "days91plus", "total"].map((field) => (
                      <td key={field} className="py-2.5 px-3 text-right font-mono text-[12px] font-bold text-[#1557b0]">{vendorAging.reduce((s, r) => s + (r[field as keyof typeof r] as number), 0).toFixed(2)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
