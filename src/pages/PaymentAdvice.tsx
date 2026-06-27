// @ts-nocheck
import React, { useState, useMemo } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "react-hot-toast";
import { FileCheck, Send, Mail, Printer, Plus, Eye } from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

export default function PaymentAdvice() {
  const { 
    accounts, 
    vouchers, 
    parties, 
    paymentAdvices, 
    companySettings,
    savePaymentAdvice,
    updatePaymentAdvice
  } = useStore();

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedAdvice, setSelectedAdvice] = useState<any>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [bulkGenerateOpen, setBulkGenerateOpen] = useState(false);
  
  // Filters
  const [bankFilter, setBankFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Generation state
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState({ from: "", to: "" });
  const [selectedVouchers, setSelectedVouchers] = useState<string[]>([]);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);

  const bankAccounts = useMemo(() => {
    return accounts.filter(a => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  const filteredAdvices = useMemo(() => {
    return paymentAdvices.filter(a => {
      const matchesBank = !bankFilter || vouchers.find(v => v.id === a.voucherId)?.bankAccountId === bankFilter;
      const matchesDateFrom = !dateFrom || a.paymentDate >= dateFrom;
      const matchesDateTo = !dateTo || a.paymentDate <= dateTo;
      const matchesStatus = statusFilter === "ALL" || a.status === statusFilter.toLowerCase();
      return matchesBank && matchesDateFrom && matchesDateTo && matchesStatus;
    });
  }, [paymentAdvices, vouchers, bankFilter, dateFrom, dateTo, statusFilter]);

  const unadvisedVouchers = useMemo(() => {
    const advisedVoucherIds = new Set(paymentAdvices.map(pa => pa.voucherId));
    return vouchers.filter(v => 
      v.type === "payment" && 
      !advisedVoucherIds.has(v.id) &&
      (!selectedBank || v.bankAccountId === selectedBank) &&
      (!selectedDateRange.from || v.date >= selectedDateRange.from) &&
      (!selectedDateRange.to || v.date <= selectedDateRange.to)
    );
  }, [vouchers, paymentAdvices, selectedBank, selectedDateRange]);

  const handleGenerateAdvice = () => {
    setGenerateModalOpen(true);
    setSelectedVouchers([]);
    setAvailableVouchers(unadvisedVouchers);
  };

  const handleBulkGenerate = () => {
    setBulkGenerateOpen(true);
    setSelectedVouchers([]);
    // For bulk, show all unadvised vouchers regardless of bank
    const advisedVoucherIds = new Set(paymentAdvices.map(pa => pa.voucherId));
    const allUnadvised = vouchers.filter(v => 
      v.type === "payment" && 
      !advisedVoucherIds.has(v.id) &&
      (!selectedDateRange.from || v.date >= selectedDateRange.from) &&
      (!selectedDateRange.to || v.date <= selectedDateRange.to)
    );
    setAvailableVouchers(allUnadvised);
  };

  const handleGenerateSingle = async () => {
    if (selectedVouchers.length === 0) {
      toast.error("Please select at least one voucher");
      return;
    }

    try {
      for (const voucherId of selectedVouchers) {
        const voucher = vouchers.find(v => v.id === voucherId);
        if (!voucher) continue;

        const party = parties.find(p => p.id === voucher.partyId);
        if (!party) continue;

        // Extract bill references from voucher lines
        const billDetails = voucher.lines
          .filter(line => line.particulars && (line.particulars.includes("Bill") || line.particulars.includes("Inv")))
          .map(line => ({
            billRef: line.particulars,
            billDate: voucher.date,
            billAmount: Math.abs(line.drAmount - line.crAmount),
            adjustedAmount: Math.abs(line.drAmount - line.crAmount)
          }));

        await savePaymentAdvice({
          voucherId: voucher.id,
          voucherNo: voucher.voucherNo,
          partyId: party.id,
          partyName: party.name,
          partyEmail: party.email,
          partyAddress: party.address,
          paymentDate: voucher.date,
          paymentMode: voucher.paymentMode || "Bank Transfer",
          chequeNo: voucher.chequeNo,
          chequeDate: voucher.chequeDate,
          bankName: voucher.bankName,
          totalAmount: voucher.grandTotal || 0,
          billDetails: JSON.stringify(billDetails),
          status: "draft",
          createdAt: new Date().toISOString()
        });
      }

      toast.success(`Generated ${selectedVouchers.length} payment advices`);
      setGenerateModalOpen(false);
      setBulkGenerateOpen(false);
    } catch (error) {
      toast.error("Failed to generate payment advices");
    }
  };

  const handleViewAdvice = (advice: any) => {
    setSelectedAdvice(advice);
    setView("detail");
  };

  const handleMarkSent = async (adviceId: string) => {
    try {
      await updatePaymentAdvice(adviceId, { 
        status: "sent", 
        sentAt: new Date().toISOString() 
      });
      toast.success("Payment advice marked as sent");
      // Refresh data
      const updated = [...paymentAdvices];
      const index = updated.findIndex(pa => pa.id === adviceId);
      if (index !== -1) {
        updated[index] = { ...updated[index], status: "sent", sentAt: new Date().toISOString() };
        // In a real app, this would be handled by the store update
      }
    } catch (error) {
      toast.error("Failed to mark as sent");
    }
  };

  const handleEmailAdvice = async (advice: any) => {
    try {
      const subject = `Payment Advice - ${advice.voucherNo}`;
      const body = `Dear ${advice.partyName},

We are pleased to inform you that your payment has been processed as per the details below:

Payment Date: ${advice.paymentDate}
Amount: ${formatNumber(advice.totalAmount)}
Payment Mode: ${advice.paymentMode}

Please find the detailed breakdown attached.

Thank you for your business.

Best regards,
${companySettings?.companyNameEn || "Your Company"}
${companySettings?.addressEn || "Your Address"}`;

      const mailtoLink = `mailto:${advice.partyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink, '_blank');

      // Mark as emailed
      await updatePaymentAdvice(advice.id, { 
        status: "emailed", 
        emailedAt: new Date().toISOString() 
      });
      
      toast.success("Payment advice marked as emailed");
    } catch (error) {
      toast.error("Failed to send email");
    }
  };

  const handlePrintAdvice = (advice: any) => {
    setSelectedAdvice(advice);
    // Open print view directly
    window.print();
  };

  const toggleVoucherSelection = (voucherId: string) => {
    setSelectedVouchers(prev => 
      prev.includes(voucherId) 
        ? prev.filter(id => id !== voucherId) 
        : [...prev, voucherId]
    );
  };

  const toggleAllVouchers = () => {
    if (selectedVouchers.length === availableVouchers.length) {
      setSelectedVouchers([]);
    } else {
      setSelectedVouchers(availableVouchers.map(v => v.id));
    }
  };

  if (view === "detail" && selectedAdvice) {
    const voucher = vouchers.find(v => v.id === selectedAdvice.voucherId);
    const party = parties.find(p => p.id === selectedAdvice.partyId);
    let billDetails = [];
    try {
      billDetails = JSON.parse(selectedAdvice.billDetails || "[]");
    } catch (e) {
      billDetails = [];
    }

    return (
      <div className="flex flex-col h-full">
        <ActionToolbar 
          title="Payment Advice" 
          icon={<FileCheck size={16} />}
        >
          <Button size="sm" variant="outline" onClick={() => setView("list")}>
            Back to List
          </Button>
        </ActionToolbar>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg print:p-0 print:shadow-none">
            {/* Letterhead */}
            <div className="mb-8 text-center print:text-left">
              <h1 className="text-2xl font-bold">{companySettings?.companyNameEn}</h1>
              <p className="text-sm text-gray-600">{companySettings?.addressEn}</p>
              <p className="text-sm text-gray-600">
                Phone: {companySettings?.phone} | Email: {companySettings?.email}
              </p>
            </div>
            
            <div className="border-b-2 border-gray-800 py-4 mb-6">
              <h2 className="text-xl font-bold text-center">PAYMENT ADVICE / REMITTANCE ADVICE</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-bold mb-2">To:</h3>
                <p>{party?.name}</p>
                <p>{party?.address}</p>
                <p>Email: {party?.email}</p>
              </div>
              
              <div>
                <h3 className="font-bold mb-2">Our Reference:</h3>
                <p>Voucher No: {selectedAdvice.voucherNo}</p>
                <p>Payment Date: {selectedAdvice.paymentDate}</p>
                <p>Payment Mode: {selectedAdvice.paymentMode}</p>
                {selectedAdvice.chequeNo && (
                  <>
                    <p>Cheque No: {selectedAdvice.chequeNo}</p>
                    <p>Cheque Date: {selectedAdvice.chequeDate}</p>
                    <p>Bank: {selectedAdvice.bankName}</p>
                  </>
                )}
              </div>
            </div>
            
            <div className="mb-8">
              <h3 className="font-bold mb-4">Bills Settled:</h3>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Bill Reference</th>
                    <th className="border border-gray-300 p-2 text-left">Bill Date</th>
                    <th className="border border-gray-300 p-2 text-right">Bill Amount</th>
                    <th className="border border-gray-300 p-2 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {billDetails.map((bill: any, index: number) => (
                    <tr key={index}>
                      <td className="border border-gray-300 p-2">{bill.billRef}</td>
                      <td className="border border-gray-300 p-2">{bill.billDate}</td>
                      <td className="border border-gray-300 p-2 text-right">{formatNumber(bill.billAmount)}</td>
                      <td className="border border-gray-300 p-2 text-right">{formatNumber(bill.adjustedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-end mb-8">
              <div className="text-right">
                <p className="font-bold text-lg">Total Amount Paid: {formatNumber(selectedAdvice.totalAmount)}</p>
              </div>
            </div>
            
            <div className="mt-12 text-center print:text-left">
              <p>This is a computer-generated advice.</p>
            </div>
            
            <div className="mt-8 flex flex-wrap gap-3 justify-center print:hidden">
              <Button onClick={() => handlePrintAdvice(selectedAdvice)}>
                <Printer size={14} className="mr-1" />
                Print
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => handleMarkSent(selectedAdvice.id)}
              >
                <Send size={14} className="mr-1" />
                Mark as Sent
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => handleEmailAdvice(selectedAdvice)}
              >
                <Mail size={14} className="mr-1" />
                Email
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar 
        title="Payment Advice" 
        icon={<FileCheck size={16} />}
      >
        <Button size="sm" onClick={handleGenerateAdvice}>
          <Plus size={14} className="mr-1" />
          Generate Advice
        </Button>
        <Button size="sm" variant="outline" onClick={handleBulkGenerate}>
          Bulk Generate
        </Button>
      </ActionToolbar>
      
      <div className="flex-1 overflow-auto p-4">
        {/* Filter Bar */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <Select
              label="Bank Account"
              options={[
                { value: "", label: "All Banks" },
                ...bankAccounts.map(acc => ({ value: acc.id, label: acc.name }))
              ]}
              value={bankFilter}
              onChange={setBankFilter}
            />
          </div>
          
          <div className="w-32">
            <NepaliDatePicker
              label="From Date"
              value={dateFrom}
              onChange={setDateFrom}
            />
          </div>
          
          <div className="w-32">
            <NepaliDatePicker
              label="To Date"
              value={dateTo}
              onChange={setDateTo}
            />
          </div>
          
          <div className="w-32">
            <Select
              label="Status"
              options={[
                { value: "ALL", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "emailed", label: "Emailed" }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
        </div>
        
        {/* Payment Advices Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Voucher No</th>
                <th className="p-3 text-left">Payment Date</th>
                <th className="p-3 text-left">Supplier Name</th>
                <th className="p-3 text-right">Payment Amount</th>
                <th className="p-3 text-left">Mode</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdvices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    No payment advices found
                  </td>
                </tr>
              ) : (
                filteredAdvices.map(advice => {
                  const voucher = vouchers.find(v => v.id === advice.voucherId);
                  const party = parties.find(p => p.id === advice.partyId);
                  
                  return (
                    <tr key={advice.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{advice.voucherNo}</td>
                      <td className="p-3">{advice.paymentDate}</td>
                      <td className="p-3">{party?.name || "Unknown"}</td>
                      <td className="p-3 text-right">{formatNumber(advice.totalAmount)}</td>
                      <td className="p-3">{advice.paymentMode}</td>
                      <td className="p-3">
                        <Badge 
                          variant={
                            advice.status === "draft" ? "warning" :
                            advice.status === "sent" ? "info" :
                            "success"
                          }
                        >
                          {advice.status.charAt(0).toUpperCase() + advice.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button 
                            size="xs" 
                            variant="ghost" 
                            onClick={() => handleViewAdvice(advice)}
                          >
                            <Eye size={12} className="mr-1" />
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Generate Advice Modal */}
      {(generateModalOpen || bulkGenerateOpen) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b">
              <h3 className="font-bold text-lg">
                {bulkGenerateOpen ? "Bulk Generate Payment Advices" : "Generate Payment Advice"}
              </h3>
            </div>
            
            <div className="p-4">
              {!bulkGenerateOpen && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Select
                      label="Bank Account"
                      options={bankAccounts.map(acc => ({ value: acc.id, label: acc.name }))}
                      value={selectedBank}
                      onChange={setSelectedBank}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <NepaliDatePicker
                        label="From Date"
                        value={selectedDateRange.from}
                        onChange={(val) => setSelectedDateRange(prev => ({ ...prev, from: val }))}
                      />
                    </div>
                    <div>
                      <NepaliDatePicker
                        label="To Date"
                        value={selectedDateRange.to}
                        onChange={(val) => setSelectedDateRange(prev => ({ ...prev, to: val }))}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-sm text-gray-600 mb-4">
                Select payment vouchers to generate payment advices for
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-10 p-2">
                        <input 
                          type="checkbox" 
                          checked={selectedVouchers.length === availableVouchers.length && availableVouchers.length > 0}
                          onChange={toggleAllVouchers}
                        />
                      </th>
                      <th className="p-2 text-left">Voucher No</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Payee Name</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-left">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-500">
                          No un-advised payment vouchers found
                        </td>
                      </tr>
                    ) : (
                      availableVouchers.map(voucher => {
                        const party = parties.find(p => p.id === voucher.partyId);
                        
                        return (
                          <tr key={voucher.id} className="border-t hover:bg-gray-50">
                            <td className="p-2">
                              <input 
                                type="checkbox" 
                                checked={selectedVouchers.includes(voucher.id)}
                                onChange={() => toggleVoucherSelection(voucher.id)}
                              />
                            </td>
                            <td className="p-2">{voucher.voucherNo}</td>
                            <td className="p-2">{voucher.date}</td>
                            <td className="p-2">{party?.name || "Unknown"}</td>
                            <td className="p-2 text-right">{formatNumber(voucher.grandTotal || 0)}</td>
                            <td className="p-2">{voucher.paymentMode || "N/A"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setGenerateModalOpen(false);
                  setBulkGenerateOpen(false);
                  setSelectedVouchers([]);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerateSingle}>
                Generate Advices ({selectedVouchers.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
