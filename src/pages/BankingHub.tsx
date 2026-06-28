// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Printer, Download, Plus, Edit2, Trash2, AlertTriangle, CheckCircle, XCircle, Clock, Building, CreditCard, TrendingUp, DollarSign, Calendar, FileText, ArrowRight, ArrowLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function amountToWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const scales = ["", "Thousand", "Lakh", "Crore"];
  
  if (amount === 0) return "Zero";
  
  const n = Math.floor(amount);
  const decimal = Math.round((amount - n) * 100);
  
  if (n === 0) {
    return `Zero and ${decimal}/100`;
  }
  
  let words = "";
  let scaleIndex = 0;
  
  let tempN = n;
  while (tempN > 0) {
    const triplet = tempN % 1000;
    tempN = Math.floor(tempN / 1000);
    
    if (triplet > 0) {
      const tripletWords = convertTriplet(triplet);
      if (scaleIndex > 0) {
        words = `${tripletWords} ${scales[scaleIndex]} ${words}`.trim();
      } else {
        words = tripletWords;
      }
    }
    
    scaleIndex++;
  }
  
  return `${words}${decimal > 0 ? ` and ${decimal}/100` : ''}`;
}

function convertTriplet(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  let result = "";
  
  if (n >= 100) {
    result += ones[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  
  if (n >= 20) {
    result += tens[Math.floor(n / 10)];
    n %= 10;
    if (n > 0) {
      result += " " + ones[n];
    }
  } else if (n > 0) {
    result += ones[n];
  }
  
  return result.trim();
}

const BankingHub: React.FC = () => {
  const { accounts, vouchers, parties, companySettings, currentFiscalYear, addVoucher } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [chequeBooks, setChequeBooks] = useState<any[]>([]);
  const [bankGuarantees, setBankGuarantees] = useState<any[]>([]);
  const [fixedDeposits, setFixedDeposits] = useState<any[]>([]);
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [showChequeBookForm, setShowChequeBookForm] = useState(false);
  const [editingChequeBook, setEditingChequeBook] = useState<any>(null);
  const [chequeForm, setChequeForm] = useState({ voucherId: "", chequeBookId: "" });
  
  const [showBgForm, setShowBgForm] = useState(false);
  const [editingBg, setEditingBg] = useState<any>(null);
  
  const [showFdForm, setShowFdForm] = useState(false);
  const [editingFd, setEditingFd] = useState<any>(null);

  const bankAccounts = useMemo(() => {
    return accounts.filter(a => 
      a.name.toLowerCase().includes("bank") || 
      a.type === "bank" || 
      a.name.toLowerCase().includes("nabil") || 
      a.name.toLowerCase().includes("nmb") || 
      a.name.toLowerCase().includes("everest") || 
      a.name.toLowerCase().includes("himalayan") || 
      a.name.toLowerCase().includes("siddhartha") || 
      a.name.toLowerCase().includes("global ime")
    ) || accounts.filter(a => a.type === "asset" && (a.name.toLowerCase().includes("bank") || a.name.toLowerCase().includes("account")));
  }, [accounts]);

  useEffect(() => {
    const db = getDB();
    
    db.table("chequeBooks").toArray()
      .then(setChequeBooks)
      .catch(() => setChequeBooks([]));
    
    db.table("bankGuarantees").toArray()
      .then(setBankGuarantees)
      .catch(() => setBankGuarantees([]));
    
    db.table("fixedDeposits").toArray()
      .then(setFixedDeposits)
      .catch(() => setFixedDeposits([]));
      
  }, []);

  useEffect(() => {
    if (activeTab === 3) {
      computeCashFlowForecast();
    }
  }, [activeTab, vouchers]);

  const computeCashFlowForecast = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const forecast = [];
    let runningBalance = bankAccounts.reduce((sum, acc) => sum + (acc.openingBalance || 0), 0); // Simplified opening
    
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const receipts = vouchers.filter(v => 
        (v.type === "receipt" || v.type === "pdc-receipt") && 
        (v.date === dateStr || v.chequeDate === dateStr) && 
        v.status === "posted"
      ).reduce((sum, v) => sum + (v.amount || v.grandTotal || 0), 0);
      
      const payments = vouchers.filter(v => 
        (v.type === "payment" || v.type === "pdc-payment") && 
        (v.date === dateStr || v.chequeDate === dateStr) && 
        v.status === "posted"
      ).reduce((sum, v) => sum + (v.amount || v.grandTotal || 0), 0);
      
      runningBalance += (receipts - payments);
      
      forecast.push({
        date: dateStr,
        displayDate: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        inflow: receipts,
        outflow: payments,
        balance: runningBalance
      });
    }
    
    setCashFlowData(forecast);
  };

  const handleChequeBookFormChange = (field: string, value: any) => {
    setEditingChequeBook(prev => ({ ...prev, [field]: value }));
  };

  const saveChequeBook = async () => {
    if (!editingChequeBook.bankAccountId || !editingChequeBook.prefix || !editingChequeBook.fromNumber || !editingChequeBook.toNumber) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const id = editingChequeBook?.id || generateId();
    const record = {
      id,
      ...editingChequeBook,
      usedCheques: editingChequeBook.usedCheques || []
    };

    try {
      await db.table("chequeBooks").put(record);
      setChequeBooks(prev => {
        const idx = prev.findIndex(cb => cb.id === id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = record;
          return n;
        }
        return [...prev, record];
      });
      setShowChequeBookForm(false);
      setEditingChequeBook(null);
      toast.success("Cheque book saved successfully");
    } catch (error) {
      toast.error("Failed to save cheque book");
    }
  };

  const deleteChequeBook = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this cheque book?")) {
      const db = getDB();
      await db.table("chequeBooks").delete(id);
      setChequeBooks(prev => prev.filter(cb => cb.id !== id));
      toast.success("Cheque book deleted successfully");
    }
  };

  const handleBgFormChange = (field: string, value: any) => {
    setEditingBg(prev => ({ ...prev, [field]: value }));
  };

  const saveBg = async () => {
    if (!editingBg.bgNo || !editingBg.bank || !editingBg.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const id = editingBg?.id || generateId();
    const record = { id, ...editingBg };

    try {
      await db.table("bankGuarantees").put(record);
      setBankGuarantees(prev => {
        const idx = prev.findIndex(bg => bg.id === id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = record;
          return n;
        }
        return [...prev, record];
      });
      setShowBgForm(false);
      setEditingBg(null);
      toast.success("Bank guarantee saved successfully");
    } catch (error) {
      toast.error("Failed to save bank guarantee");
    }
  };

  const deleteBg = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this bank guarantee?")) {
      const db = getDB();
      await db.table("bankGuarantees").delete(id);
      setBankGuarantees(prev => prev.filter(bg => bg.id !== id));
      toast.success("Bank guarantee deleted successfully");
    }
  };

  const handleFdFormChange = (field: string, value: any) => {
    setEditingFd(prev => ({ ...prev, [field]: value }));
  };

  const saveFd = async () => {
    if (!editingFd.fdNo || !editingFd.bankName || !editingFd.amount || !editingFd.interestRate || !editingFd.startDate || !editingFd.maturityDate) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const id = editingFd?.id || generateId();
    const record = { id, ...editingFd };

    try {
      await db.table("fixedDeposits").put(record);
      setFixedDeposits(prev => {
        const idx = prev.findIndex(fd => fd.id === id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = record;
          return n;
        }
        return [...prev, record];
      });
      setShowFdForm(false);
      setEditingFd(null);
      toast.success("Fixed deposit saved successfully");
    } catch (error) {
      toast.error("Failed to save fixed deposit");
    }
  };

  const deleteFd = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this fixed deposit?")) {
      const db = getDB();
      await db.table("fixedDeposits").delete(id);
      setFixedDeposits(prev => prev.filter(fd => fd.id !== id));
      toast.success("Fixed deposit deleted successfully");
    }
  };

  const bgStatus = (expiryDate: string) => {
    const today = new Date();
    const exp = new Date(expiryDate);
    const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86400000);
    
    if (daysLeft < 0) return { label: "Expired", color: "bg-red-100 text-red-700 border-red-200", days: daysLeft };
    if (daysLeft <= 30) return { label: "Expiring Soon", color: "bg-amber-100 text-amber-700 border-amber-200", days: daysLeft };
    return { label: "Active", color: "bg-green-100 text-green-700 border-green-200", days: daysLeft };
  };

  const fdStatus = (maturityDate: string) => {
    const today = new Date();
    const mat = new Date(maturityDate);
    const daysLeft = Math.floor((mat.getTime() - today.getTime()) / 86400000);
    
    if (daysLeft < 0) return { label: "Matured", color: "bg-red-100 text-red-700 border-red-200", days: daysLeft };
    if (daysLeft <= 30) return { label: "Maturing Soon", color: "bg-amber-100 text-amber-700 border-amber-200", days: daysLeft };
    return { label: "Active", color: "bg-green-100 text-green-700 border-green-200", days: daysLeft };
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Banking Hub</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage cheque books, bank guarantees, fixed deposits, and cash flow</p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
          {["Cheque Printing", "Bank Guarantee Register", "Fixed Deposit Register", "Cash Flow Forecast"].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === index 
                  ? 'border-[#1557b0] text-[#1557b0]' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab 0: Cheque Printing */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold text-gray-800">Cheque Books</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                onClick={() => {
                  setEditingChequeBook({
                    bankAccountId: "",
                    bankName: "",
                    prefix: "",
                    fromNumber: 0,
                    toNumber: 0,
                    currentNumber: 0
                  });
                  setShowChequeBookForm(true);
                }}
              >
                <Plus size={14} />
                Add Cheque Book
              </button>
            </div>
            
            {showChequeBookForm && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-[13px] font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                  {editingChequeBook?.id ? "Edit Cheque Book" : "Add New Cheque Book"}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Account <span className="text-red-500">*</span></label>
                    <select
                      value={editingChequeBook?.bankAccountId || ""}
                      onChange={(e) => handleChequeBookFormChange('bankAccountId', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="">Select Account</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingChequeBook?.bankName || ""}
                      onChange={(e) => handleChequeBookFormChange('bankName', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Prefix <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingChequeBook?.prefix || ""}
                      onChange={(e) => handleChequeBookFormChange('prefix', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">From Number <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={editingChequeBook?.fromNumber || ""}
                      onChange={(e) => handleChequeBookFormChange('fromNumber', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">To Number <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={editingChequeBook?.toNumber || ""}
                      onChange={(e) => handleChequeBookFormChange('toNumber', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Current Number</label>
                    <input
                      type="number"
                      value={editingChequeBook?.currentNumber || ""}
                      onChange={(e) => handleChequeBookFormChange('currentNumber', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    onClick={() => {
                      setShowChequeBookForm(false);
                      setEditingChequeBook(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm"
                    onClick={saveChequeBook}
                  >
                    Save Cheque Book
                  </button>
                </div>
              </div>
            )}
            
            <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Bank Account</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Prefix</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From No</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To No</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Current No</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Remaining</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Next Cheque</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chequeBooks.map(cb => {
                    const bankAccount = bankAccounts.find(acc => acc.id === cb.bankAccountId);
                    const remaining = cb.toNumber - cb.currentNumber;
                    const isLow = remaining < 10;
                    
                    return (
                      <tr key={cb.id} className="bg-white hover:bg-gray-50 text-[12px] transition-colors">
                        <td className="px-3 py-2.5 font-medium text-gray-800">{bankAccount?.name || "N/A"}</td>
                        <td className="px-3 py-2.5 text-gray-600">{cb.prefix}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{cb.fromNumber}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{cb.toNumber}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800 font-medium">{cb.currentNumber}</td>
                        <td className={`px-3 py-2.5 text-right font-medium ${isLow ? 'text-red-600 bg-red-50' : 'text-green-600'}`}>
                          {remaining}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-[#1557b0]">{cb.currentNumber + 1}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              onClick={() => {
                                setEditingChequeBook(cb);
                                setShowChequeBookForm(true);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={() => deleteChequeBook(cb.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {chequeBooks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No cheque books configured. Create one to enable cheque printing.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Print Cheque Section */}
            {chequeBooks.length > 0 && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4">
                <h3 className="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Printer size={16} className="text-[#1557b0]" /> 
                  Print Individual Cheque
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Payment Voucher</label>
                    <select
                      value={chequeForm.voucherId}
                      onChange={(e) => setChequeForm(prev => ({ ...prev, voucherId: e.target.value }))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm"
                    >
                      <option value="">-- Select Voucher --</option>
                      {vouchers.filter(v => v.type === "payment" && v.status === "posted" && !v.chequeNo).map(v => (
                        <option key={v.id} value={v.id}>{v.voucherNo} - {v.partyName || "N/A"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Select Cheque Book</label>
                    <select
                      value={chequeForm.chequeBookId}
                      onChange={(e) => setChequeForm(prev => ({ ...prev, chequeBookId: e.target.value }))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm"
                    >
                      <option value="">-- Select Cheque Book --</option>
                      {chequeBooks.map(cb => (
                        <option key={cb.id} value={cb.id}>{cb.prefix} - {cb.bankName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm w-full sm:w-auto disabled:opacity-50"
                      disabled={!chequeForm.voucherId || !chequeForm.chequeBookId}
                      onClick={() => {
                        const voucher = vouchers.find(v => v.id === chequeForm.voucherId);
                        const party = parties.find(p => p.id === voucher?.partyId);
                        const chequeBook = chequeBooks.find(cb => cb.id === chequeForm.chequeBookId);
                        
                        if (!voucher || !chequeBook) return;
                        
                        const amount = voucher.grandTotal || 0;
                        const date = voucher.date;
                        const partyName = party?.name || "Walk-in";
                        
                        const db = getDB();
                        db.table("chequeBooks").update(chequeBook.id, {
                          currentNumber: chequeBook.currentNumber + 1,
                          usedCheques: [...(chequeBook.usedCheques || []), {
                            no: chequeBook.currentNumber + 1,
                            voucherId: voucher.id,
                            date,
                            partyName,
                            amount
                          }]
                        });
                        
                        toast.success("Cheque generated. Please use the print preview.");
                        window.print();
                      }}
                    >
                      Preview & Print
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Bank Guarantee Register */}
        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold text-gray-800">Bank Guarantees</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                onClick={() => {
                  setEditingBg({
                    bgNo: "",
                    bank: "",
                    amount: 0,
                    beneficiary: "",
                    purpose: "",
                    issueDate: new Date().toISOString().split('T')[0],
                    expiryDate: new Date().toISOString().split('T')[0],
                    commission: 0,
                    linkedAccountId: "",
                    status: "Active"
                  });
                  setShowBgForm(true);
                }}
              >
                <Plus size={14} />
                Add Bank Guarantee
              </button>
            </div>
            
            {bankGuarantees.some(bg => bgStatus(bg.expiryDate).label === "Expired") && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200 mb-4 flex items-center gap-2 text-[12px] font-medium">
                <AlertTriangle size={16} className="text-red-600" />
                {bankGuarantees.filter(bg => bgStatus(bg.expiryDate).label === "Expired").length} Bank Guarantee(s) have expired! Total exposure: NPR {money(bankGuarantees.filter(bg => bgStatus(bg.expiryDate).label === "Expired").reduce((sum, bg) => sum + bg.amount, 0))}
              </div>
            )}
            
            {bankGuarantees.some(bg => bgStatus(bg.expiryDate).days <= 30 && bgStatus(bg.expiryDate).label !== "Expired") && (
              <div className="bg-amber-50 text-amber-700 p-3 rounded-md border border-amber-200 mb-4 flex items-center gap-2 text-[12px] font-medium">
                <Clock size={16} className="text-amber-600" />
                {bankGuarantees.filter(bg => bgStatus(bg.expiryDate).days <= 30 && bgStatus(bg.expiryDate).label !== "Expired").length} Bank Guarantee(s) expiring within 30 days!
              </div>
            )}
            
            {showBgForm && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-[13px] font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                  {editingBg?.id ? "Edit Bank Guarantee" : "Add New Bank Guarantee"}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">BG Number <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingBg?.bgNo || ""}
                      onChange={(e) => handleBgFormChange('bgNo', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingBg?.bank || ""}
                      onChange={(e) => handleBgFormChange('bank', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Amount NPR <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBg?.amount || ""}
                      onChange={(e) => handleBgFormChange('amount', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Beneficiary <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingBg?.beneficiary || ""}
                      onChange={(e) => handleBgFormChange('beneficiary', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Purpose <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingBg?.purpose || ""}
                      onChange={(e) => handleBgFormChange('purpose', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Issue Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editingBg?.issueDate || ""}
                      onChange={(e) => handleBgFormChange('issueDate', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Expiry Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editingBg?.expiryDate || ""}
                      onChange={(e) => handleBgFormChange('expiryDate', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Commission NPR</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingBg?.commission || ""}
                      onChange={(e) => handleBgFormChange('commission', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Linked Bank Account</label>
                    <select
                      value={editingBg?.linkedAccountId || ""}
                      onChange={(e) => handleBgFormChange('linkedAccountId', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="">Select Account</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
                    <select
                      value={editingBg?.status || "Active"}
                      onChange={(e) => handleBgFormChange('status', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="Active">Active</option>
                      <option value="Released">Released</option>
                      <option value="Renewed">Renewed</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    onClick={() => {
                      setShowBgForm(false);
                      setEditingBg(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm"
                    onClick={saveBg}
                  >
                    Save Bank Guarantee
                  </button>
                </div>
              </div>
            )}
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">BG No & Bank</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Beneficiary & Purpose</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dates</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Amount (NPR)</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Days Left</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bankGuarantees.map(bg => {
                    const statusInfo = bgStatus(bg.expiryDate);
                    
                    return (
                      <tr key={bg.id} className="bg-white hover:bg-gray-50 text-[12px] transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-[#1557b0]">{bg.bgNo}</div>
                          <div className="text-gray-500">{bg.bank}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-800">{bg.beneficiary}</div>
                          <div className="text-gray-500 truncate max-w-[200px]" title={bg.purpose}>{bg.purpose}</div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          <div><span className="text-gray-400">Iss:</span> {bg.issueDate}</div>
                          <div><span className="text-gray-400">Exp:</span> <span className={statusInfo.days <= 30 ? 'font-medium text-red-600' : ''}>{bg.expiryDate}</span></div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-800">{money(bg.amount)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-medium ${statusInfo.days < 0 ? 'text-red-600' : statusInfo.days <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {statusInfo.days < 0 ? 'Expired' : statusInfo.days}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              onClick={() => {
                                setEditingBg(bg);
                                setShowBgForm(true);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={() => deleteBg(bg.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {bankGuarantees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No bank guarantees recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Fixed Deposit Register */}
        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold text-gray-800">Fixed Deposits</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm flex items-center gap-1.5"
                onClick={() => {
                  setEditingFd({
                    fdNo: "",
                    bankName: "",
                    linkedAccountId: "",
                    amount: 0,
                    interestRate: 0,
                    startDate: new Date().toISOString().split('T')[0],
                    maturityDate: new Date().toISOString().split('T')[0],
                    autoRenewal: false,
                    linkedFdAccountId: ""
                  });
                  setShowFdForm(true);
                }}
              >
                <Plus size={14} />
                Add Fixed Deposit
              </button>
            </div>
            
            {fixedDeposits.some(fd => fdStatus(fd.maturityDate).days <= 30 && fdStatus(fd.maturityDate).label !== "Matured") && (
              <div className="bg-amber-50 text-amber-700 p-3 rounded-md border border-amber-200 mb-4 flex items-center gap-2 text-[12px] font-medium">
                <AlertTriangle size={16} className="text-amber-600" />
                {fixedDeposits.filter(fd => fdStatus(fd.maturityDate).days <= 30 && fdStatus(fd.maturityDate).label !== "Matured").length} FD(s) maturing within 30 days — Total: NPR {money(fixedDeposits.filter(fd => fdStatus(fd.maturityDate).days <= 30 && fdStatus(fd.maturityDate).label !== "Matured").reduce((sum, fd) => sum + fd.amount, 0))}
              </div>
            )}
            
            {showFdForm && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-[13px] font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                  {editingFd?.id ? "Edit Fixed Deposit" : "Add New Fixed Deposit"}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">FD Certificate No <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingFd?.fdNo || ""}
                      onChange={(e) => handleFdFormChange('fdNo', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editingFd?.bankName || ""}
                      onChange={(e) => handleFdFormChange('bankName', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Amount NPR <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingFd?.amount || ""}
                      onChange={(e) => handleFdFormChange('amount', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Interest Rate % <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingFd?.interestRate || ""}
                      onChange={(e) => handleFdFormChange('interestRate', Number(e.target.value))}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Start Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editingFd?.startDate || ""}
                      onChange={(e) => handleFdFormChange('startDate', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Maturity Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={editingFd?.maturityDate || ""}
                      onChange={(e) => handleFdFormChange('maturityDate', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer mt-5">
                      <input
                        type="checkbox"
                        checked={editingFd?.autoRenewal || false}
                        onChange={(e) => handleFdFormChange('autoRenewal', e.target.checked)}
                        className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                      />
                      <span className="text-[12px] font-medium text-gray-700">Auto-Renewal</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Linked Bank Account</label>
                    <select
                      value={editingFd?.linkedAccountId || ""}
                      onChange={(e) => handleFdFormChange('linkedAccountId', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="">Select Account</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Linked FD Ledger Account</label>
                    <select
                      value={editingFd?.linkedFdAccountId || ""}
                      onChange={(e) => handleFdFormChange('linkedFdAccountId', e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    >
                      <option value="">Select Account</option>
                      {accounts.filter(a => a.type === "asset").map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                  <button
                    className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                    onClick={() => {
                      setShowFdForm(false);
                      setEditingFd(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm"
                    onClick={saveFd}
                  >
                    Save Fixed Deposit
                  </button>
                </div>
              </div>
            )}
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">FD No & Bank</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Amount (NPR)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Dates</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Monthly Int.</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Days Left</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fixedDeposits.map(fd => {
                    const statusInfo = fdStatus(fd.maturityDate);
                    const monthlyInterest = fd.amount * (fd.interestRate / 100 / 12);
                    const tenor = Math.ceil((new Date(fd.maturityDate).getTime() - new Date(fd.startDate).getTime()) / (1000 * 60 * 60 * 24));
                    const daysToMaturity = Math.ceil((new Date(fd.maturityDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <tr key={fd.id} className="bg-white hover:bg-gray-50 text-[12px] transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-[#1557b0]">{fd.fdNo}</div>
                          <div className="text-gray-500">{fd.bankName}</div>
                          {fd.autoRenewal && <div className="text-[9px] bg-blue-50 text-blue-600 inline-block px-1 rounded mt-0.5">Auto-Renewal</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-800">{money(fd.amount)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{fd.interestRate}%</td>
                        <td className="px-3 py-2.5 text-gray-600">
                          <div><span className="text-gray-400">Start:</span> {fd.startDate}</div>
                          <div><span className="text-gray-400">Mat:</span> <span className={statusInfo.days <= 30 ? 'font-medium text-amber-600' : ''}>{fd.maturityDate}</span></div>
                          <div className="text-[10px] text-gray-400">({tenor} days tenor)</div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-green-600">{money(monthlyInterest)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-medium ${statusInfo.days < 0 ? 'text-red-600' : statusInfo.days <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {statusInfo.days < 0 ? 'Matured' : statusInfo.days}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button 
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              onClick={() => {
                                setEditingFd(fd);
                                setShowFdForm(true);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={() => deleteFd(fd.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {fixedDeposits.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No fixed deposits recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Cash Flow Forecast */}
        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-[14px] font-bold text-gray-800">30-Day Cash Flow Forecast</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Projected inflows, outflows, and net balances based on vouchers and PDCs</p>
              </div>
              <button
                className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(cashFlowData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Cash Flow Forecast");
                  XLSX.writeFile(wb, "cash_flow_forecast.xlsx");
                  toast.success("Exported to Excel");
                }}
              >
                <Download size={14} />
                Export
              </button>
            </div>
            
            {cashFlowData.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50/50 border border-green-100 rounded-md p-4 flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-1">Projected Inflow (30d)</span>
                    <span className="text-xl font-bold text-green-700">NPR {money(cashFlowData.reduce((sum, d) => sum + d.inflow, 0))}</span>
                  </div>
                  <div className="bg-red-50/50 border border-red-100 rounded-md p-4 flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1">Projected Outflow (30d)</span>
                    <span className="text-xl font-bold text-red-700">NPR {money(cashFlowData.reduce((sum, d) => sum + d.outflow, 0))}</span>
                  </div>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4 flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold text-[#1557b0] uppercase tracking-wide mb-1">Est. Closing Balance</span>
                    <span className="text-xl font-bold text-[#1557b0]">NPR {money(cashFlowData[cashFlowData.length - 1]?.balance || 0)}</span>
                  </div>
                </div>
                
                <div className="h-72 mb-8 bg-white border border-gray-200 rounded-md p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlowData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1557b0" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#1557b0" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="displayDate" tick={{fontSize: 10, fill: '#6B7280'}} axisLine={false} tickLine={false} dy={10} minTickGap={30} />
                      <YAxis tick={{fontSize: 10, fill: '#6B7280'}} axisLine={false} tickLine={false} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                      <Tooltip 
                        formatter={(value: number) => [`NPR ${money(value)}`, undefined]}
                        contentStyle={{borderRadius: '6px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}
                        labelStyle={{fontWeight: 'bold', color: '#374151', marginBottom: '4px'}}
                      />
                      <Legend iconType="circle" wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                      <Area type="monotone" dataKey="balance" name="Net Balance" stroke="#1557b0" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                      <Line type="monotone" dataKey="inflow" name="Inflows" stroke="#059669" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="outflow" name="Outflows" stroke="#dc2626" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex justify-center items-center h-40 text-gray-400 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-[12px]">Processing forecast data...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BankingHub;
