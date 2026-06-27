// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { ActionToolbar, Select, NepaliDatePicker, Button, Badge } from "../components/ui";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { useStore } from "../store/useStore";
import { formatNumber } from "../lib/utils";
import { generateId } from "../lib/db";
import toast from "react-hot-toast";
import { Building2, Plus, Eye, Check, RotateCcw } from "lucide-react";
import { formatADToBS } from "../lib/nepaliDate";

interface Instrument {
  voucherId: string;
  voucherNo: string;
  instrumentNo: string;
  drawerName: string;
  drawerBankName: string;
  drawerBankBranch: string;
  instrumentDate: string;
  amount: number;
}

export default function DepositSlip() {
  const { 
    accounts, 
    vouchers, 
    parties, 
    depositSlips, 
    companySettings,
    saveDepositSlip,
    updateDepositSlip,
    markDepositConfirmed
  } = useStore();

  const [view, setView] = useState<"list" | "form">("list");
  const [selectedSlip, setSelectedSlip] = useState<any>(null);
  const [bankFilter, setBankFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [printPreview, setPrintPreview] = useState(false);
  
  // Form state
  const [slipNo, setSlipNo] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const [narration, setNarration] = useState("");
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>([]);
  const [cashAmount, setCashAmount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const bankAccounts = useMemo(() => {
    return accounts.filter(a => a.group === "Bank Accounts" || a.group === "Bank OD Accounts");
  }, [accounts]);

  const undepositedVouchers = useMemo(() => {
    // Get all receipt vouchers with cheque payment mode that haven't been included in a non-reversed deposit slip
    const depositedVoucherIds = new Set();
    depositSlips.forEach(slip => {
      if (slip.status !== "reversed") {
        try {
          const instruments = JSON.parse(slip.instruments || "[]");
          instruments.forEach((inst: any) => depositedVoucherIds.add(inst.voucherId));
        } catch (e) {
          console.error("Error parsing instruments:", e);
        }
      }
    });
    
    return vouchers.filter(v => 
      v.type === "receipt" && 
      (v.paymentMode === "cheque" || v.paymentMode === "Cheque") && 
      !depositedVoucherIds.has(v.id)
    );
  }, [vouchers, depositSlips]);

  const filteredSlips = useMemo(() => {
    return depositSlips.filter(s => {
      const matchesBank = !bankFilter || s.bankAccountId === bankFilter;
      const matchesDateFrom = !dateFrom || s.depositDate >= dateFrom;
      const matchesDateTo = !dateTo || s.depositDate <= dateTo;
      return matchesBank && matchesDateFrom && matchesDateTo;
    });
  }, [depositSlips, bankFilter, dateFrom, dateTo]);

  const totalAmount = useMemo(() => {
    return selectedInstruments.reduce((sum, inst) => sum + inst.amount, 0) + cashAmount;
  }, [selectedInstruments, cashAmount]);

  const chequeAmount = useMemo(() => {
    return selectedInstruments.reduce((sum, inst) => sum + inst.amount, 0);
  }, [selectedInstruments]);

  const handleNewSlip = () => {
    // Generate slip number
    const today = new Date().toISOString().split('T')[0];
    const formattedDate = today.replace(/-/g, '');
    const count = depositSlips.filter(s => s.slipNo.startsWith(`DS-${formattedDate}`)).length + 1;
    const newSlipNo = `DS-${formattedDate}-${count.toString().padStart(3, '0')}`;
    
    setSlipNo(newSlipNo);
    setBankAccountId("");
    setDepositDate("");
    setNarration("");
    setSelectedInstruments([]);
    setCashAmount(0);
    setEditingId(null);
    setView("form");
  };

  const handleEditSlip = (slip: any) => {
    setSlipNo(slip.slipNo);
    setBankAccountId(slip.bankAccountId);
    setDepositDate(slip.depositDate);
    setNarration(slip.narration || "");
    
    try {
      const instruments = JSON.parse(slip.instruments || "[]");
      setSelectedInstruments(instruments);
    } catch (e) {
      setSelectedInstruments([]);
    }
    
    setCashAmount(slip.cashAmount || 0);
    setEditingId(slip.id);
    setView("form");
  };

  const handleSaveDraft = async () => {
    if (!bankAccountId || !depositDate) {
      toast.error("Bank account and deposit date are required");
      return;
    }

    try {
      const slipData = {
        slipNo,
        bankAccountId,
        depositDate,
        depositDateNepali: formatADToBS(depositDate),
        instruments: JSON.stringify(selectedInstruments),
        totalAmount,
        cashAmount,
        chequeAmount,
        status: "draft",
        narration
      };

      if (editingId) {
        await updateDepositSlip(editingId, slipData);
        toast.success("Deposit slip updated");
      } else {
        await saveDepositSlip(slipData);
        toast.success("Deposit slip saved as draft");
      }

      setView("list");
      resetForm();
    } catch (error) {
      toast.error("Failed to save deposit slip");
    }
  };

  const handleConfirmDeposit = async () => {
    if (!bankAccountId || !depositDate) {
      toast.error("Bank account and deposit date are required");
      return;
    }

    try {
      const slipData = {
        slipNo,
        bankAccountId,
        depositDate,
        depositDateNepali: formatADToBS(depositDate),
        instruments: JSON.stringify(selectedInstruments),
        totalAmount,
        cashAmount,
        chequeAmount,
        status: "draft", // Will be changed to deposited by markDepositConfirmed
        narration
      };

      let slipId;
      if (editingId) {
        await updateDepositSlip(editingId, slipData);
        slipId = editingId;
      } else {
        slipId = await saveDepositSlip(slipData);
      }

      // Now confirm the deposit
      await markDepositConfirmed(slipId);
      toast.success("Deposit slip confirmed");

      setView("list");
      resetForm();
    } catch (error) {
      toast.error("Failed to confirm deposit");
    }
  };

  const handleMarkDeposited = async (slipId: string) => {
    try {
      await markDepositConfirmed(slipId);
      toast.success("Deposit slip marked as deposited");
    } catch (error) {
      toast.error("Failed to mark as deposited");
    }
  };

  const handleReverseSlip = async (slipId: string) => {
    try {
      await updateDepositSlip(slipId, { status: "reversed" });
      toast.success("Deposit slip reversed");
    } catch (error) {
      toast.error("Failed to reverse deposit slip");
    }
  };

  const handlePrint = (slip: any) => {
    setSelectedSlip(slip);
    setPrintPreview(true);
  };

  const resetForm = () => {
    setSlipNo("");
    setBankAccountId("");
    setDepositDate("");
    setNarration("");
    setSelectedInstruments([]);
    setCashAmount(0);
    setEditingId(null);
  };

  const toggleInstrumentSelection = (instrument: Instrument) => {
    setSelectedInstruments(prev => {
      const exists = prev.some(i => i.voucherId === instrument.voucherId);
      if (exists) {
        return prev.filter(i => i.voucherId !== instrument.voucherId);
      } else {
        return [...prev, instrument];
      }
    });
  };

  const toggleAllInstruments = () => {
    if (selectedInstruments.length === undepositedVouchers.length) {
      setSelectedInstruments([]);
    } else {
      const instruments = undepositedVouchers.map(v => ({
        voucherId: v.id,
        voucherNo: v.voucherNo,
        instrumentNo: v.chequeNo || v.narration || "N/A",
        drawerName: v.partyName || "Unknown",
        drawerBankName: parties.find(p => p.id === v.partyId)?.bankName || "Unknown",
        drawerBankBranch: parties.find(p => p.id === v.partyId)?.bankBranch || "Unknown",
        instrumentDate: v.date,
        amount: v.grandTotal || 0
      }));
      setSelectedInstruments(instruments);
    }
  };

  if (printPreview && selectedSlip) {
    const bankAccount = accounts.find(a => a.id === selectedSlip.bankAccountId);
    const instruments = JSON.parse(selectedSlip.instruments || "[]");
    
    return (
      <div className="print-only">
        <div className="max-w-4xl mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">{companySettings?.companyNameEn}</h1>
            <p className="text-sm text-gray-600">{companySettings?.addressEn}</p>
          </div>
          
          <div className="border-b-2 border-gray-800 pb-4 mb-6">
            <h2 className="text-xl font-bold text-center">DEPOSIT SLIP</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p><strong>Slip No:</strong> {selectedSlip.slipNo}</p>
              <p><strong>Deposit Date:</strong> {selectedSlip.depositDate}</p>
            </div>
            <div>
              <p><strong>Bank Account:</strong> {bankAccount?.name}</p>
              <p><strong>Status:</strong> {selectedSlip.status}</p>
            </div>
          </div>
          
          <div className="mb-6">
            <table className="w-full border-collapse border border-gray-800">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 p-2">Instrument No</th>
                  <th className="border border-gray-800 p-2">Drawer Name</th>
                  <th className="border border-gray-800 p-2">Bank Name</th>
                  <th className="border border-gray-800 p-2">Branch</th>
                  <th className="border border-gray-800 p-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((inst: any, index: number) => (
                  <tr key={index}>
                    <td className="border border-gray-800 p-2">{inst.instrumentNo}</td>
                    <td className="border border-gray-800 p-2">{inst.drawerName}</td>
                    <td className="border border-gray-800 p-2">{inst.drawerBankName}</td>
                    <td className="border border-gray-800 p-2">{inst.drawerBankBranch}</td>
                    <td className="border border-gray-800 p-2 text-right">{formatNumber(inst.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="border border-gray-800 p-2 text-right font-bold">Cash Amount</td>
                  <td className="border border-gray-800 p-2 text-right">{formatNumber(selectedSlip.cashAmount || 0)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="border border-gray-800 p-2 text-right font-bold">Total Amount</td>
                  <td className="border border-gray-800 p-2 text-right">{formatNumber(selectedSlip.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {selectedSlip.narration && (
            <div className="mb-6">
              <p><strong>Narration:</strong> {selectedSlip.narration}</p>
            </div>
          )}
          
          <div className="flex justify-between mt-12">
            <div className="text-center">
              <p>Prepared By</p>
              <div className="mt-8 border-t border-gray-800"></div>
            </div>
            <div className="text-center">
              <p>Checked By</p>
              <div className="mt-8 border-t border-gray-800"></div>
            </div>
            <div className="text-center">
              <p>Authorized By</p>
              <div className="mt-8 border-t border-gray-800"></div>
            </div>
          </div>
        </div>
        
        <style jsx>{`
          @media print {
            .print-only {
              display: block;
            }
            .no-print {
              display: none;
            }
          }
        `}</style>
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="flex flex-col h-full">
        <ActionToolbar 
          title={editingId ? "Edit Deposit Slip" : "New Deposit Slip"} 
          icon={<Building2 size={16} />}
        >
          <Button size="sm" variant="outline" onClick={() => setView("list")}>
            Back to List
          </Button>
        </ActionToolbar>
        
        <div className="flex-1 overflow-auto p-4">
          <FormPanel title="Deposit Slip Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Select
                  label="Bank Account"
                  options={bankAccounts.map(acc => ({ value: acc.id, label: acc.name }))}
                  value={bankAccountId}
                  onChange={setBankAccountId}
                />
              </div>
              
              <div>
                <NepaliDatePicker
                  label="Deposit Date"
                  value={depositDate}
                  onChange={setDepositDate}
                />
              </div>
              
              <div>
                <input
                  type="text"
                  label="Slip No"
                  value={slipNo}
                  onChange={(e) => setSlipNo(e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              
              <div>
                <input
                  type="number"
                  label="Cash Amount"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Number(e.target.value) || 0)}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Narration</label>
              <textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full p-2 border rounded text-sm"
                rows={2}
                placeholder="Additional notes..."
              />
            </div>
          </FormPanel>
          
          <FormPanel title="Select Instruments to Deposit">
            <p className="text-sm text-gray-600 mb-4">
              Select cheques/cash from un-deposited receipt vouchers
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 p-2">
                      <input 
                        type="checkbox" 
                        checked={selectedInstruments.length === undepositedVouchers.length && undepositedVouchers.length > 0}
                        onChange={toggleAllInstruments}
                      />
                    </th>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Party Name</th>
                    <th className="p-2 text-left">Instrument No</th>
                    <th className="p-2 text-left">Bank Name</th>
                    <th className="p-2 text-left">Branch</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {undepositedVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-gray-500">
                        No undeposited instruments found
                      </td>
                    </tr>
                  ) : (
                    undepositedVouchers.map(v => {
                      const isSelected = selectedInstruments.some(i => i.voucherId === v.id);
                      const party = parties.find(p => p.id === v.partyId);
                      
                      return (
                        <tr key={v.id} className="border-t hover:bg-gray-50">
                          <td className="p-2">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleInstrumentSelection({
                                voucherId: v.id,
                                voucherNo: v.voucherNo,
                                instrumentNo: v.chequeNo || v.narration || "N/A",
                                drawerName: v.partyName || "Unknown",
                                drawerBankName: party?.bankName || "Unknown",
                                drawerBankBranch: party?.bankBranch || "Unknown",
                                instrumentDate: v.date,
                                amount: v.grandTotal || 0
                              })}
                            />
                          </td>
                          <td className="p-2">{v.date}</td>
                          <td className="p-2">{v.partyName}</td>
                          <td className="p-2">{v.chequeNo || v.narration || "N/A"}</td>
                          <td className="p-2">{party?.bankName || "Unknown"}</td>
                          <td className="p-2">{party?.bankBranch || "Unknown"}</td>
                          <td className="p-2 text-right">{formatNumber(v.grandTotal || 0)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500">Selected Instruments</p>
                <p className="font-bold">{selectedInstruments.length}</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500">Cheque Amount</p>
                <p className="font-bold">{formatNumber(chequeAmount)}</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-xs text-gray-500">Cash Amount</p>
                <p className="font-bold">{formatNumber(cashAmount)}</p>
              </div>
              
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="text-xs text-blue-600">Grand Total</p>
                <p className="font-bold text-blue-800">{formatNumber(totalAmount)}</p>
              </div>
            </div>
          </FormPanel>
          
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setView("list")}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSaveDraft}>
              Save as Draft
            </Button>
            <Button onClick={handleConfirmDeposit}>
              Confirm Deposit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ActionToolbar 
        title="Deposit Slip" 
        icon={<Building2 size={16} />}
      >
        <Button size="sm" onClick={handleNewSlip}>
          <Plus size={14} className="mr-1" />
          New Deposit Slip
        </Button>
        <Button size="sm" variant="outline" onClick={() => setView("list")}>
          <Eye size={14} className="mr-1" />
          View All Slips
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
        </div>
        
        {/* Deposit Slips Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left">Slip No</th>
                <th className="p-3 text-left">Deposit Date</th>
                <th className="p-3 text-left">Bank Account</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-right">Cheque Amount</th>
                <th className="p-3 text-right">Cash Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSlips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-gray-500">
                    No deposit slips found
                  </td>
                </tr>
              ) : (
                filteredSlips.map(slip => {
                  const bankAccount = accounts.find(a => a.id === slip.bankAccountId);
                  
                  return (
                    <tr key={slip.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{slip.slipNo}</td>
                      <td className="p-3">{slip.depositDate}</td>
                      <td className="p-3">{bankAccount?.name || "Unknown"}</td>
                      <td className="p-3 text-right">{formatNumber(slip.totalAmount)}</td>
                      <td className="p-3 text-right">{formatNumber(slip.chequeAmount || (slip.totalAmount - slip.cashAmount))}</td>
                      <td className="p-3 text-right">{formatNumber(slip.cashAmount)}</td>
                      <td className="p-3">
                        <Badge 
                          variant={
                            slip.status === "draft" ? "warning" :
                            slip.status === "deposited" ? "success" :
                            "destructive"
                          }
                        >
                          {slip.status.charAt(0).toUpperCase() + slip.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button 
                            size="xs" 
                            variant="ghost" 
                            onClick={() => handleEditSlip(slip)}
                          >
                            Edit
                          </Button>
                          
                          {slip.status === "draft" && (
                            <Button 
                              size="xs" 
                              variant="outline" 
                              onClick={() => handleMarkDeposited(slip.id)}
                            >
                              <Check size={12} className="mr-1" />
                              Confirm
                            </Button>
                          )}
                          
                          {slip.status === "deposited" && (
                            <Button 
                              size="xs" 
                              variant="outline" 
                              onClick={() => handleReverseSlip(slip.id)}
                            >
                              <RotateCcw size={12} className="mr-1" />
                              Reverse
                            </Button>
                          )}
                          
                          <Button 
                            size="xs" 
                            variant="ghost" 
                            onClick={() => handlePrint(slip)}
                          >
                            Print
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
    </div>
  );
}
