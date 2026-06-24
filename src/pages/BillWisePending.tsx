// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { VoucherType } from "../lib/types";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { Receipt, MessageCircle, Copy, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "../components/ui";
import { formatNumber } from "../lib/utils";
import toast from "react-hot-toast";
import { getDB, generateId } from "../lib/db";

export default function BillWisePending() {
  const { invoices, parties, companySettings } = useStore();
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [searchTerm, setSearchTerm] = useState("");

  const [reminderModal, setReminderModal] = useState<{
    show: boolean;
    invoiceNo: string;
    partyName: string;
    partyPhone: string;
    amount: number;
    date: string;
    message: string;
  } | null>(null);

  const pendingBills = useMemo(() => {
    const today = new Date().getTime();
    
    return invoices
      .filter(inv => {
        if (inv.paymentStatus !== "UNPAID" && inv.paymentStatus !== "PARTIAL") return false;
        if (partyType === "customer" && inv.type !== VoucherType.SALES_INVOICE) return false;
        if (partyType === "supplier" && inv.type !== VoucherType.PURCHASE_INVOICE) return false;
        if (searchTerm && !inv.partyName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      })
      .map(inv => {
        const balance = inv.grandTotal - (inv.paidAmount || 0);
        const refDate = inv.dueDate || inv.date;
        const overdueDays = Math.floor((today - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24));
        const party = parties.find(p => p.id === inv.partyId);

        return {
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          partyName: inv.partyName,
          partyPhone: party?.phone || "",
          date: inv.date,
          dateNepali: inv.dateNepali,
          dueDate: inv.dueDate || inv.date,
          originalAmount: inv.grandTotal,
          paidAmount: inv.paidAmount || 0,
          balance,
          overdueDays,
          status: overdueDays > 90 ? "severely overdue" : (overdueDays > 0 ? "overdue" : "current")
        };
      })
      .filter(b => b.balance > 0.05)
      .sort((a, b) => b.overdueDays - a.overdueDays);
  }, [invoices, parties, partyType, searchTerm]);

  const handleOpenReminder = (bill: any) => {
    if (!bill.partyPhone) {
      toast.error("No phone number found for this party.");
      return;
    }
    const msg = `Dear ${bill.partyName}, This is a reminder that invoice ${bill.invoiceNo} of Rs.${formatNumber(bill.balance)} dated ${bill.dateNepali || bill.date} is due. Please arrange payment. - ${companySettings?.companyName || "Sutra ERP"}, ${companySettings?.phone || ""}`;
    setReminderModal({
      show: true,
      invoiceNo: bill.invoiceNo,
      partyName: bill.partyName,
      partyPhone: bill.partyPhone,
      amount: bill.balance,
      date: bill.dateNepali || bill.date,
      message: msg
    });
  };

  const handleCopyMessage = () => {
    if (reminderModal) {
      navigator.clipboard.writeText(reminderModal.message);
      toast.success("Message copied to clipboard!");
    }
  };

  const handleWhatsApp = async () => {
    if (reminderModal) {
      const url = `https://wa.me/977${reminderModal.partyPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(reminderModal.message)}`;
      window.open(url, "_blank");

      try {
        const db = getDB();
        await db.auditLogs.add({
          id: generateId("audit"),
          timestamp: new Date().toISOString(),
          userId: "system",
          userName: "System",
          action: "PAYMENT_REMINDER",
          module: "BillWisePending",
          recordId: reminderModal.invoiceNo,
          recordType: "Invoice",
          newValue: `Reminder sent via WhatsApp to ${reminderModal.partyPhone}`
        });
        toast.success("Reminder logged in Audit Trail.");
      } catch (err) {
        console.error("Failed to log audit", err);
      }
      setReminderModal(null);
    }
  };

  return (
    <div className="space-y-4">
      <PillTitle title="Bill-wise Outstanding" icon={Receipt} />
      
      <FormPanel>
        <div className="flex items-end gap-4 mb-6">
          <div>
            <label className="block text-[11px] font-medium text-[#000000] mb-1">Party Type</label>
            <select 
              value={partyType} 
              onChange={e => setPartyType(e.target.value as any)}
              className="h-8 px-2.5 w-40 text-[12px] border border-[#9DC07A] rounded-md focus:border-[#1557b0] bg-white"
            >
              <option value="customer">Receivables</option>
              <option value="supplier">Payables</option>
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <label className="block text-[11px] font-medium text-[#000000] mb-1">Search Party</label>
            <input 
              type="text" 
              placeholder="Filter by name..."
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8 px-2.5 w-full text-[12px] border border-[#9DC07A] rounded-md focus:border-[#1557b0]"
            />
          </div>
        </div>

        <div className="border border-[#9DC07A] rounded-lg bg-white overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-[#9DC07A]">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Date (BS)</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Invoice No</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Party</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Orig. Amt</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Paid</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#1557b0] uppercase tracking-wide">Balance</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Due Date</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Days Overdue</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Status</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-[#000000] uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingBills.map(bill => (
                <tr key={bill.id} className="border-b border-[#9DC07A] hover:bg-[#EBF5E2]">
                  <td className="px-3 py-2.5 text-[12px] text-[#000000]">{bill.dateNepali || bill.date}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#000000] font-mono">{bill.invoiceNo}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#000000] font-medium">{bill.partyName}</td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono text-[#000000]">{formatNumber(bill.originalAmount)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono text-[#000000]">{formatNumber(bill.paidAmount)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono font-bold text-[#1557b0]">{formatNumber(bill.balance)}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#000000]">{bill.dueDate}</td>
                  <td className="px-3 py-2.5 text-[12px] text-right font-mono text-[#000000]">
                    {bill.overdueDays > 0 ? <span className="text-red-600 font-bold">{bill.overdueDays}</span> : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {bill.status === "severely overdue" && <span className="bg-red-100 text-red-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Severely Overdue</span>}
                    {bill.status === "overdue" && <span className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Overdue</span>}
                    {bill.status === "current" && <span className="bg-[#EBF5E2] text-[#000000] text-[10px] px-2 py-0.5 rounded font-bold uppercase">Current</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {partyType === "customer" && (
                      <Button onClick={() => handleOpenReminder(bill)} className="h-7 bg-green-600 hover:bg-green-700 text-[#000000] text-[11px]">
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> Reminder
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {pendingBills.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-[12px] text-[#000000]">
                    No pending bills found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FormPanel>

      {/* Reminder Modal */}
      {reminderModal && reminderModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-[#9DC07A] flex items-center justify-between bg-[#f5f6fa]">
              <h2 className="text-[14px] font-semibold text-[#000000] flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" /> Send Reminder
              </h2>
              <button onClick={() => setReminderModal(null)} className="text-[#000000] hover:text-[#000000]">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-[#D4EABD] border border-[#9DC07A] rounded-md p-3 text-[12px] text-[#000000] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>This will log an audit entry tracking that you chased this payment.</p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#000000] mb-1">WhatsApp Message Template</label>
                <textarea 
                  value={reminderModal.message}
                  onChange={e => setReminderModal({...reminderModal, message: e.target.value})}
                  className="w-full h-32 p-3 text-[12px] border border-[#9DC07A] rounded-md focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>

              <div className="flex items-center gap-3 justify-end pt-2">
                <Button variant="outline" onClick={handleCopyMessage} className="text-[12px] h-8">
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Text
                </Button>
                <Button onClick={handleWhatsApp} className="bg-green-600 hover:bg-green-700 text-[#000000] text-[12px] h-8">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Send WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

