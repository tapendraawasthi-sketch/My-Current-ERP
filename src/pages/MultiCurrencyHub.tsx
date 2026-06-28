// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Plus, Edit, Trash2, Download, RefreshCw, Calculator, RotateCcw, X } from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const CURRENCIES = [
  {code:"USD",name:"US Dollar"}, {code:"EUR",name:"Euro"}, {code:"GBP",name:"British Pound"},
  {code:"AUD",name:"Australian Dollar"}, {code:"CAD",name:"Canadian Dollar"},
  {code:"CNY",name:"Chinese Yuan"}, {code:"INR",name:"Indian Rupee"},
  {code:"JPY",name:"Japanese Yen"}, {code:"SGD",name:"Singapore Dollar"},
  {code:"AED",name:"UAE Dirham"}, {code:"SAR",name:"Saudi Riyal"},
  {code:"KWD",name:"Kuwaiti Dinar"}, {code:"QAR",name:"Qatari Riyal"}
];

const MultiCurrencyHub: React.FC = () => {
  const { currencies, vouchers, accounts, companySettings, addVoucher, currentFiscalYear } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [rates, setRates] = useState<any[]>([]);
  const [foreignVouchers, setForeignVouchers] = useState<any[]>([]);
  const [forexGainLoss, setForexGainLoss] = useState<any[]>([]);
  const [revaluationData, setRevaluationData] = useState<any[]>([]);
  const [showRateForm, setShowRateForm] = useState(false);
  const [editingRate, setEditingRate] = useState<any>(null);
  const [rateForm, setRateForm] = useState({
    currency: "",
    effectiveDate: new Date().toISOString().split('T')[0],
    buyRate: 0,
    sellRate: 0,
    midRate: 0,
    source: "Manual"
  });

  useEffect(() => {
    const db = getDB();
    db.table("exchangeRates").toArray()
      .then(setRates)
      .catch(() => setRates([]));
  }, []);

  useEffect(() => {
    if (currencies.length === 0) {
      const db = getDB();
      CURRENCIES.forEach(currency => {
        db.currencies.put({ id: generateId(), ...currency, isActive: true });
      });
    }
  }, [currencies]);

  useEffect(() => {
    const foreign = vouchers.filter(v => 
      (v.currency && v.currency !== "NPR" && v.currency !== "" && v.currency !== undefined) ||
      (v.lines && v.lines.some((l: any) => l.currency && l.currency !== "NPR"))
    );
    setForeignVouchers(foreign);
  }, [vouchers]);

  useEffect(() => {
    const gainLossData = foreignVouchers
      .filter(v => v.type.includes("invoice") && v.currency && v.currency !== "NPR")
      .map(v => {
        const foreignAmount = v.foreignAmount || v.grandTotal || 0;
        const invoiceRate = 100;
        const paymentRate = 105;
        const gainLoss = (paymentRate - invoiceRate) * foreignAmount;
        
        return {
          id: v.id,
          invoiceNo: v.voucherNo,
          party: v.partyName,
          currency: v.currency,
          foreignAmount,
          invoiceRate,
          npvAtInvoice: foreignAmount * invoiceRate,
          paymentRate,
          npvAtPayment: foreignAmount * paymentRate,
          forexGainLoss: gainLoss
        };
      });
    
    setForexGainLoss(gainLossData);
  }, [foreignVouchers]);

  useEffect(() => {
    const revalData = foreignVouchers
      .filter(v => v.type.includes("invoice") && v.currency && v.currency !== "NPR" && v.paymentStatus !== "paid")
      .map(v => {
        const foreignBalance = v.foreignAmount || v.grandTotal || 0;
        const originalRate = 100;
        const yearEndRate = 102;
        const unrealizedGainLoss = (yearEndRate - originalRate) * foreignBalance;
        
        return {
          id: v.id,
          invoiceNo: v.voucherNo,
          party: v.partyName,
          currency: v.currency,
          foreignBalance,
          originalRate,
          yearEndRate,
          npvOriginal: foreignBalance * originalRate,
          npvRevalued: foreignBalance * yearEndRate,
          unrealizedGainLoss
        };
      });
    
    setRevaluationData(revalData);
  }, [foreignVouchers]);

  const handleRateFormChange = (field: string, value: any) => {
    if (field === 'buyRate' || field === 'sellRate') {
      const buyRate = field === 'buyRate' ? Number(value) : rateForm.buyRate;
      const sellRate = field === 'sellRate' ? Number(value) : rateForm.sellRate;
      const midRate = (buyRate + sellRate) / 2;
      setRateForm(prev => ({ ...prev, [field]: Number(value), midRate }));
    } else {
      setRateForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const saveRate = async () => {
    if (!rateForm.currency || !rateForm.effectiveDate || rateForm.buyRate <= 0 || rateForm.sellRate <= 0) {
      toast.error("Please fill all required fields");
      return;
    }

    const db = getDB();
    const rateRecord = {
      id: editingRate?.id || generateId(),
      ...rateForm
    };

    try {
      await db.table("exchangeRates").put(rateRecord);
      setRates(prev => {
        const idx = prev.findIndex(r => r.id === rateRecord.id);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = rateRecord;
          return n;
        }
        return [...prev, rateRecord];
      });
      setShowRateForm(false);
      setEditingRate(null);
      setRateForm({
        currency: "",
        effectiveDate: new Date().toISOString().split('T')[0],
        buyRate: 0,
        sellRate: 0,
        midRate: 0,
        source: "Manual"
      });
      toast.success("Exchange rate saved successfully");
    } catch (error) {
      toast.error("Failed to save exchange rate");
    }
  };

  const deleteRate = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this exchange rate?")) {
      const db = getDB();
      await db.table("exchangeRates").delete(id);
      setRates(prev => prev.filter(r => r.id !== id));
      toast.success("Exchange rate deleted successfully");
    }
  };

  const importNrbRates = () => {
    toast.info("Visit nrb.org.np to download today's exchange rates, then enter them manually here.");
  };

  const postForexEntries = async () => {
    for (const entry of forexGainLoss) {
      if (entry.forexGainLoss === 0) continue;
      
      const forexGainAccount = accounts.find(a => a.name.toLowerCase().includes("forex gain") || a.name.toLowerCase().includes("exchange gain"));
      const forexLossAccount = accounts.find(a => a.name.toLowerCase().includes("forex loss") || a.name.toLowerCase().includes("exchange loss"));
      const partyAccount = accounts.find(a => a.name === entry.party);
      
      if (!forexGainAccount && !forexLossAccount) {
        toast.error(`Forex gain/loss accounts not found for ${entry.party}`);
        continue;
      }
      
      if (!partyAccount) {
        toast.error(`Party account not found for ${entry.party}`);
        continue;
      }
      
      const lines = [];
      if (entry.forexGainLoss > 0) {
        lines.push({ accountId: partyAccount.id, accountName: partyAccount.name, debit: 0, credit: Math.abs(entry.forexGainLoss) });
        if (forexGainAccount) lines.push({ accountId: forexGainAccount.id, accountName: forexGainAccount.name, debit: Math.abs(entry.forexGainLoss), credit: 0 });
      } else {
        if (forexLossAccount) lines.push({ accountId: forexLossAccount.id, accountName: forexLossAccount.name, debit: Math.abs(entry.forexGainLoss), credit: 0 });
        lines.push({ accountId: partyAccount.id, accountName: partyAccount.name, debit: 0, credit: Math.abs(entry.forexGainLoss) });
      }
      
      try {
        await addVoucher({
          id: generateId(),
          type: "journal",
          status: "posted",
          date: new Date().toISOString().split('T')[0],
          narration: `Forex gain/loss adjustment for invoice ${entry.invoiceNo}`,
          lines,
          totalDebit: Math.abs(entry.forexGainLoss),
          totalCredit: Math.abs(entry.forexGainLoss)
        });
      } catch (error) {
        toast.error(`Failed to post forex entry for ${entry.invoiceNo}`);
      }
    }
    toast.success("Forex entries posted successfully");
  };

  const postRevaluationEntries = async () => {
    for (const entry of revaluationData) {
      if (entry.unrealizedGainLoss === 0) continue;
      
      const forexGainAccount = accounts.find(a => a.name.toLowerCase().includes("forex gain") || a.name.toLowerCase().includes("exchange gain"));
      const forexLossAccount = accounts.find(a => a.name.toLowerCase().includes("forex loss") || a.name.toLowerCase().includes("exchange loss"));
      const partyAccount = accounts.find(a => a.name === entry.party);
      
      if (!forexGainAccount && !forexLossAccount) {
        toast.error(`Forex gain/loss accounts not found for ${entry.party}`);
        continue;
      }
      
      if (!partyAccount) {
        toast.error(`Party account not found for ${entry.party}`);
        continue;
      }
      
      const lines = [];
      if (entry.unrealizedGainLoss > 0) {
        lines.push({ accountId: partyAccount.id, accountName: partyAccount.name, debit: 0, credit: Math.abs(entry.unrealizedGainLoss) });
        if (forexGainAccount) lines.push({ accountId: forexGainAccount.id, accountName: forexGainAccount.name, debit: Math.abs(entry.unrealizedGainLoss), credit: 0 });
      } else {
        if (forexLossAccount) lines.push({ accountId: forexLossAccount.id, accountName: forexLossAccount.name, debit: Math.abs(entry.unrealizedGainLoss), credit: 0 });
        lines.push({ accountId: partyAccount.id, accountName: partyAccount.name, debit: 0, credit: Math.abs(entry.unrealizedGainLoss) });
      }
      
      try {
        const voucher = await addVoucher({
          id: generateId(),
          type: "reversing-journal",
          status: "posted",
          date: new Date().toISOString().split('T')[0],
          narration: `Year-end revaluation adjustment for invoice ${entry.invoiceNo}`,
          lines,
          totalDebit: Math.abs(entry.unrealizedGainLoss),
          totalCredit: Math.abs(entry.unrealizedGainLoss)
        });
        
        const db = getDB();
        const nextFyStart = new Date(currentFiscalYear?.endDate || new Date().toISOString());
        nextFyStart.setDate(nextFyStart.getDate() + 1);
        await db.table("reversingSchedules").add({
          id: generateId(),
          originalVoucherId: voucher.id,
          reversalDate: nextFyStart.toISOString().split('T')[0],
          status: "pending"
        }).catch(() => {});
      } catch (error) {
        toast.error(`Failed to post revaluation entry for ${entry.invoiceNo}`);
      }
    }
    toast.success("Revaluation entries posted successfully");
  };

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, filename);
    toast.success("Exported to Excel");
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Multi-Currency Hub</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Manage exchange rates, forex gains/losses, and year-end revaluation</p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
          {["Exchange Rate Master", "Foreign Currency Voucher Report", "Forex Gain/Loss", "Year-End Revaluation"].map((tab, index) => (
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

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Exchange Rate Master</h2>
              <div className="flex gap-2">
                <button
                  className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  onClick={importNrbRates}
                >
                  <RefreshCw size={14} />
                  Import NRB Rates
                </button>
                <button
                  className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  onClick={() => {
                    setEditingRate(null);
                    setRateForm({
                      currency: "",
                      effectiveDate: new Date().toISOString().split('T')[0],
                      buyRate: 0,
                      sellRate: 0,
                      midRate: 0,
                      source: "Manual"
                    });
                    setShowRateForm(true);
                  }}
                >
                  <Plus size={14} />
                  Add Rate
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Currency Code</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Currency Name</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Buy Rate (NPR)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sell Rate (NPR)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Mid Rate</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Effective Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map(rate => {
                    const currency = CURRENCIES.find(c => c.code === rate.currency) || 
                                    currencies.find(c => c.code === rate.currency);
                    return (
                      <tr key={rate.id} className="hover:bg-gray-50 border-b border-gray-100 bg-white text-[12px] transition-colors">
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{rate.currency}</td>
                        <td className="px-3 py-2.5 text-gray-700">{currency?.name || rate.currency}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800">{rate.buyRate.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800">{rate.sellRate.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-[#1557b0]">{rate.midRate.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{rate.effectiveDate}</td>
                        <td className="px-3 py-2.5 text-gray-700">{rate.source}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex justify-center gap-3">
                            <button 
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              onClick={() => {
                                setEditingRate(rate);
                                setRateForm({
                                  currency: rate.currency,
                                  effectiveDate: rate.effectiveDate,
                                  buyRate: rate.buyRate,
                                  sellRate: rate.sellRate,
                                  midRate: rate.midRate,
                                  source: rate.source
                                });
                                setShowRateForm(true);
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="text-red-600 hover:text-red-800 transition-colors"
                              onClick={() => deleteRate(rate.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No exchange rates found. Please add or import rates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Foreign Currency Voucher Report</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                onClick={() => exportToExcel(foreignVouchers, "foreign_currency_vouchers.xlsx")}
              >
                <Download size={14} />
                Export
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Voucher No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Currency</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Foreign Amount</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Exchange Rate</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">NPR Equivalent</th>
                  </tr>
                </thead>
                <tbody>
                  {foreignVouchers.map(voucher => {
                    const foreignAmount = voucher.foreignAmount || voucher.grandTotal || 0;
                    const exchangeRate = 100;
                    const npvEquivalent = foreignAmount * exchangeRate;
                    
                    return (
                      <tr key={voucher.id} className="hover:bg-gray-50 border-b border-gray-100 bg-white text-[12px] transition-colors">
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{voucher.voucherNo}</td>
                        <td className="px-3 py-2.5 text-gray-700">{voucher.date}</td>
                        <td className="px-3 py-2.5 text-gray-700">{voucher.type}</td>
                        <td className="px-3 py-2.5 text-gray-800 font-medium">{voucher.currency}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800">{money(foreignAmount)}</td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{exchangeRate.toFixed(4)}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-[#1557b0]">{money(npvEquivalent)}</td>
                      </tr>
                    );
                  })}
                  {foreignVouchers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No foreign currency vouchers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Forex Gain/Loss Analysis</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                onClick={postForexEntries}
              >
                <Calculator size={14} />
                Post Forex Entries
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Invoice No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Currency</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Foreign Amt</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rate (Inv)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">NPR (Inv)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Rate (Pmt)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">NPR (Pmt)</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Forex Gain/(Loss)</th>
                  </tr>
                </thead>
                <tbody>
                  {forexGainLoss.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 border-b border-gray-100 bg-white text-[12px] transition-colors">
                      <td className="px-3 py-2.5 text-gray-800 font-medium">{entry.invoiceNo}</td>
                      <td className="px-3 py-2.5 text-gray-700">{entry.party}</td>
                      <td className="px-3 py-2.5 text-gray-800 font-medium">{entry.currency}</td>
                      <td className="px-3 py-2.5 text-right text-gray-800">{money(entry.foreignAmount)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{entry.invoiceRate.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{money(entry.npvAtInvoice)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{entry.paymentRate.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{money(entry.npvAtPayment)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${entry.forexGainLoss >= 0 ? 'text-green-600 bg-green-50/50' : 'text-red-600 bg-red-50/50'}`}>
                        {entry.forexGainLoss >= 0 ? '+' : ''}{money(entry.forexGainLoss)}
                      </td>
                    </tr>
                  ))}
                  {forexGainLoss.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No forex gain/loss data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Year-End Revaluation</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                onClick={postRevaluationEntries}
              >
                <RotateCcw size={14} />
                Post Revaluation
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Invoice No</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Currency</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Foreign Balance</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Orig Rate</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Year-End Rate</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">NPR Orig</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">NPR Revalued</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Unrealized Gain/(Loss)</th>
                  </tr>
                </thead>
                <tbody>
                  {revaluationData.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 border-b border-gray-100 bg-white text-[12px] transition-colors">
                      <td className="px-3 py-2.5 text-gray-800 font-medium">{entry.invoiceNo}</td>
                      <td className="px-3 py-2.5 text-gray-700">{entry.party}</td>
                      <td className="px-3 py-2.5 text-gray-800 font-medium">{entry.currency}</td>
                      <td className="px-3 py-2.5 text-right text-gray-800">{money(entry.foreignBalance)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{entry.originalRate.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{entry.yearEndRate.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{money(entry.npvOriginal)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{money(entry.npvRevalued)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${entry.unrealizedGainLoss >= 0 ? 'text-green-600 bg-green-50/50' : 'text-red-600 bg-red-50/50'}`}>
                        {entry.unrealizedGainLoss >= 0 ? '+' : ''}{money(entry.unrealizedGainLoss)}
                      </td>
                    </tr>
                  ))}
                  {revaluationData.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No outstanding foreign currency invoices for revaluation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Rate Form Modal */}
      {showRateForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-[15px] font-semibold text-gray-800">
                {editingRate ? "Edit Exchange Rate" : "Add Exchange Rate"}
              </h2>
              <button onClick={() => { setShowRateForm(false); setEditingRate(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Currency <span className="text-red-500">*</span></label>
                <select
                  value={rateForm.currency}
                  onChange={(e) => handleRateFormChange('currency', e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  <option value="">Select Currency</option>
                  {CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>{curr.code} - {curr.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={rateForm.effectiveDate}
                  onChange={(e) => handleRateFormChange('effectiveDate', e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Buy Rate (NPR) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.0001"
                    value={rateForm.buyRate || ""}
                    onChange={(e) => handleRateFormChange('buyRate', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Sell Rate (NPR) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.0001"
                    value={rateForm.sellRate || ""}
                    onChange={(e) => handleRateFormChange('sellRate', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full text-right"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Mid Rate (NPR)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={rateForm.midRate || ""}
                    readOnly
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 text-gray-500 w-full text-right outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Source</label>
                  <select
                    value={rateForm.source}
                    onChange={(e) => handleRateFormChange('source', e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  >
                    <option value="Manual">Manual</option>
                    <option value="NRB Official">NRB Official</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={() => {
                  setShowRateForm(false);
                  setEditingRate(null);
                }}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                onClick={saveRate}
              >
                Save Rate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCurrencyHub;
