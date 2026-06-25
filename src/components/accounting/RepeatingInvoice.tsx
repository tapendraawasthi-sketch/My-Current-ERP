import React, { useState } from "react";
import { RepeatFrequency, DueDateType, PartyType, VoucherStatus, InvoiceType } from "@/types";
import { useAccountingStore } from "@/store/accountingStore";
import { today } from "@/utils/accounting";

export function RepeatingInvoice() {
  const { parties, invoices, repeatingInvoices, addRepeatingInvoice, updateRepeatingInvoice } = useAccountingStore();
  const customers = parties.filter((p) => p.type === PartyType.CUSTOMER || p.type === PartyType.BOTH);

  const [partyId, setPartyId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [frequency, setFrequency] = useState<RepeatFrequency>(RepeatFrequency.MONTHLY);
  const [startDate, setStartDate] = useState(today());
  const [submitMsg, setSubmitMsg] = useState("");

  const templateInvoices = invoices.filter(inv => inv.invoiceType === InvoiceType.SALES && inv.voucherStatus === VoucherStatus.POSTED);

  const handleCreate = () => {
    if (!partyId || !templateId) return setSubmitMsg("Missing fields.");
    addRepeatingInvoice({
      templateInvoiceId: templateId, partyId, frequency, startDate, nextRunDate: startDate, dueDateType: DueDateType.DAYS_AFTER_INVOICE, dueDateDays: 30, autoApprove: false, autoEmail: false, isActive: true
    });
    setSubmitMsg("✓ Schedule created");
    setTimeout(() => { setPartyId(""); setTemplateId(""); setSubmitMsg(""); }, 2000);
  };

  return (
    <div className="p-4 bg-[#f5f6fa] min-h-screen">
      <div className="max-w-6xl mx-auto bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Repeating Invoices</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Automate subscription billing</p>
          </div>
        </div>
        <div className="flex">
          <div className="w-1/3 border-r border-gray-200 px-6 py-4">
            <h2 className="text-[12px] font-semibold text-gray-700 mb-3">New Schedule</h2>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Customer *</label>
            <select value={partyId} onChange={e => setPartyId(e.target.value)} className="w-full h-8 mb-3 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]">
              <option value="">— Select —</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Template Invoice *</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="w-full h-8 mb-3 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]">
              <option value="">— Select —</option>{templateInvoices.filter(i => !partyId || i.partyId === partyId).map(i => <option key={i.id} value={i.id}>{i.invoiceNumber}</option>)}
            </select>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Start Date *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-8 mb-4 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:border-[#1557b0]" />
            <button onClick={handleCreate} className="w-full h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md">Create Schedule</button>
            {submitMsg && <div className="mt-2 text-[11px] text-gray-600 text-center">{submitMsg}</div>}
          </div>
          <div className="w-2/3 px-6 py-4">
            <h2 className="text-[12px] font-semibold text-gray-700 mb-3">Active Schedules</h2>
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Freq</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Next Run</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {repeatingInvoices.map(ri => {
                  const party = parties.find(p => p.id === ri.partyId);
                  return (
                    <tr key={ri.id}>
                      <td className="px-3 py-2 text-[12px] text-gray-700">{party?.name}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-700">{ri.frequency}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-700">{ri.nextRunDate}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => updateRepeatingInvoice(ri.id, { isActive: !ri.isActive })} className="text-[11px] text-[#1557b0] hover:underline">{ri.isActive ? "Pause" : "Resume"}</button>
                      </td>
                    </tr>
                  )
                })}
                {repeatingInvoices.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-[12px] text-gray-500">No active schedules.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
