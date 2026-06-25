import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { InvoiceType, InvoiceLine, VoucherStatus, PaymentStatus, PartyType } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { calculateInvoiceLine, round2, today, addDays } from "@/utils/accounting";

const emptyLine = (): InvoiceLine => ({
  id: uuidv4(), itemCode: "", description: "", quantity: 1, unitPrice: 0, discountPercent: 0, discountAmount: 0, taxCode: "", taxPercent: 0, taxAmount: 0, lineTotal: 0, lineTotalWithTax: 0,
});

export function VendorBill() {
  const { parties, addInvoice, taxRates, currentUserId } = useAccountingStore();
  const vendors = parties.filter((p) => p.type === PartyType.VENDOR || p.type === PartyType.BOTH);

  const [partyId, setPartyId] = useState("");
  const [billReference, setBillReference] = useState("");
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState(addDays(today(), 30));
  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()]);

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id));

  const updateLine = (id: string, field: keyof InvoiceLine, value: number | string) => {
    setLines(prev => prev.map(line => {
      if (line.id !== id) return line;
      const newLine = { ...line, [field]: value };
      if (["quantity", "unitPrice", "discountPercent", "taxPercent"].includes(field)) {
        const qty = field === "quantity" ? Number(value) : line.quantity;
        const price = field === "unitPrice" ? Number(value) : line.unitPrice;
        const disc = field === "discountPercent" ? Number(value) : line.discountPercent;
        const tax = field === "taxPercent" ? Number(value) : line.taxPercent;
        const calc = calculateInvoiceLine(qty, price, disc, tax);
        return { ...newLine, ...calc };
      }
      return newLine;
    }));
  };

  const subtotal = round2(lines.reduce((s, l) => s + (l.quantity * l.unitPrice), 0));
  const totalDiscount = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
  const totalTax = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
  const totalAmount = round2(subtotal - totalDiscount + totalTax);

  const handleSubmit = (status: VoucherStatus) => {
    addInvoice({
      invoiceType: InvoiceType.PURCHASE,
      partyId,
      billReference,
      date,
      dueDate,
      status: PaymentStatus.UNPAID,
      voucherStatus: status,
      lines,
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount,
      amountPaid: 0,
      amountDue: totalAmount,
      createdBy: currentUserId,
    });
    setPartyId(""); setBillReference(""); setLines([emptyLine()]);
  };

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Vendor Bill</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Record an Accounts Payable bill</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSubmit(VoucherStatus.DRAFT)} className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50">Save Draft</button>
            <button onClick={() => handleSubmit(VoucherStatus.POSTED)} className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Post Bill</button>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Vendor *</label>
              <select value={partyId} onChange={e => setPartyId(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]">
                <option value="">— Select Vendor —</option>
                {vendors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bill Reference *</label>
              <input type="text" value={billReference} onChange={e => setBillReference(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Bill Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]" />
            </div>
          </div>
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Item / Description</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Qty</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">Rate</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Tax</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32">Amount</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lines.map(line => (
                <tr key={line.id}>
                  <td className="px-2 py-1.5"><input type="text" value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white" placeholder="Description" /></td>
                  <td className="px-2 py-1.5"><input type="number" value={line.quantity} onChange={e => updateLine(line.id, "quantity", parseFloat(e.target.value))} className="w-full h-8 px-2.5 text-[12px] font-mono text-right border border-gray-300 rounded-md bg-white" /></td>
                  <td className="px-2 py-1.5"><input type="number" value={line.unitPrice} onChange={e => updateLine(line.id, "unitPrice", parseFloat(e.target.value))} className="w-full h-8 px-2.5 text-[12px] font-mono text-right border border-gray-300 rounded-md bg-white" /></td>
                  <td className="px-2 py-1.5"><select value={line.taxPercent} onChange={e => updateLine(line.id, "taxPercent", parseFloat(e.target.value))} className="w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"><option value="0">No Tax</option>{taxRates.map(t => <option key={t.id} value={t.rate}>{t.name}</option>)}</select></td>
                  <td className="px-3 py-2 text-right font-mono text-[12px]">{line.lineTotalWithTax.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-center"><button onClick={() => removeLine(line.id)} className="text-gray-400 hover:text-red-600">×</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={6} className="px-2 py-2"><button onClick={addLine} className="h-8 px-3 text-[#1557b0] text-[12px] font-medium">+ Add Line</button></td></tr>
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                <td colSpan={4} className="px-3 py-2.5 text-right text-[12px] font-bold text-gray-700">Total:</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#1557b0]">{totalAmount.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
