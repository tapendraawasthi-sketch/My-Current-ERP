// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store";
import {
  Globe, Plus, Edit2, Trash2, Download, RefreshCw,
  TrendingUp, TrendingDown, DollarSign, X, AlertTriangle
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  getEffectiveRate, toBase, toForeign,
  computeRealizedGainLoss, computeUnrealizedGainLoss,
  fmtFX, COMMON_CURRENCIES
} from "../lib/fxUtils";

type Tab = "currencies" | "rates" | "gainloss" | "revaluation";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MultiCurrency() {
  const {
    currencies = [], exchangeRates = [], fxGainLossEntries = [],
    accounts = [], vouchers = [],
    loadCurrencyData, addCurrency, updateCurrency,
    addExchangeRate, updateExchangeRate, deleteExchangeRate,
    addFXGainLoss,
    companySettings,
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>("currencies");
  const [showCurrModal, setShowCurrModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editCurr, setEditCurr] = useState<any>(null);
  const [editRate, setEditRate] = useState<any>(null);
  const [revalDate, setRevalDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterCurrency, setFilterCurrency] = useState("all");

  // Currency form
  const [currForm, setCurrForm] = useState({
    code: "", name: "", symbol: "", decimalPlaces: 2, isActive: true, isBase: false,
  });

  // Exchange rate form
  const [rateForm, setRateForm] = useState({
    currencyCode: "", date: new Date().toISOString().slice(0, 10),
    buyRate: 0, sellRate: 0, midRate: 0, source: "manual",
  });

  useEffect(() => { loadCurrencyData?.(); }, []);

  // ── Active currencies (non-base) ─────────────────────────────────────────
  const foreignCurrencies = useMemo(() =>
    currencies.filter(c => !c.isBase && c.isActive), [currencies]);

  // ── Latest rate per currency ──────────────────────────────────────────────
  const latestRates = useMemo(() => {
    const map: Record<string, any> = {};
    exchangeRates.forEach(r => {
      if (!map[r.currencyCode] || r.date > map[r.currencyCode].date) {
        map[r.currencyCode] = r;
      }
    });
    return map;
  }, [exchangeRates]);

  // ── FX gain/loss summary ──────────────────────────────────────────────────
  const gainLossSummary = useMemo(() => {
    const realized   = fxGainLossEntries.filter(e => e.type === "realized").reduce((s, e) => s + e.gainLossAmount, 0);
    const unrealized = fxGainLossEntries.filter(e => e.type === "unrealized").reduce((s, e) => s + e.gainLossAmount, 0);
    return { realized, unrealized, net: realized + unrealized };
  }, [fxGainLossEntries]);

  // ── Filtered rate history ─────────────────────────────────────────────────
  const filteredRates = useMemo(() =>
    exchangeRates
      .filter(r => filterCurrency === "all" || r.currencyCode === filterCurrency)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100),
    [exchangeRates, filterCurrency]);

  // ── Unrealized revaluation computation ───────────────────────────────────
  const revaluationRows = useMemo(() => {
    // Look for vouchers that contain foreign currency amounts (tagged by currencyCode field)
    const rows: any[] = [];
    vouchers.forEach(v => {
      if (!v.currencyCode || v.currencyCode === "NPR") return;
      const rateAtTxn = v.exchangeRate || 1;
      const foreignAmt = v.foreignAmount || 0;
      if (!foreignAmt) return;

      const revalRate = getEffectiveRate(exchangeRates, v.currencyCode, revalDate);
      if (!revalRate) return;

      const gl = computeUnrealizedGainLoss(foreignAmt, rateAtTxn, revalRate.midRate);
      if (gl === 0) return;

      rows.push({
        voucherId: v.id,
        date: v.date,
        currencyCode: v.currencyCode,
        foreignAmount: foreignAmt,
        rateAtTransaction: rateAtTxn,
        rateAtRevaluation: revalRate.midRate,
        baseAtTransaction: toBase(foreignAmt, rateAtTxn),
        baseAtRevaluation: toBase(foreignAmt, revalRate.midRate),
        gainLoss: gl,
        narration: v.narration || v.description || "",
      });
    });
    return rows;
  }, [vouchers, exchangeRates, revalDate]);

  const totalUnrealizedGL = useMemo(() =>
    revaluationRows.reduce((s, r) => s + r.gainLoss, 0), [revaluationRows]);

  // ── Save currency ──────────────────────────────────────────────────────────
  const handleSaveCurrency = async () => {
    const now = new Date().toISOString();
    if (editCurr?.id) {
      await updateCurrency(editCurr.id, { ...currForm, updatedAt: now });
    } else {
      await addCurrency({ ...currForm, createdAt: now, updatedAt: now });
    }
    setShowCurrModal(false);
    setEditCurr(null);
    setCurrForm({ code:"", name:"", symbol:"", decimalPlaces:2, isActive:true, isBase:false });
  };

  // ── Save exchange rate ─────────────────────────────────────────────────────
  const handleSaveRate = async () => {
    const now = new Date().toISOString();
    if (editRate?.id) {
      await updateExchangeRate(editRate.id, { ...rateForm, updatedAt: now });
    } else {
      await addExchangeRate({ ...rateForm, createdAt: now, updatedAt: now });
    }
    setShowRateModal(false);
    setEditRate(null);
    setRateForm({ currencyCode:"", date:new Date().toISOString().slice(0,10), buyRate:0, sellRate:0, midRate:0, source:"manual" });
  };

  // ── Post unrealized GL entries ─────────────────────────────────────────────
  const handlePostRevaluation = async () => {
    for (const row of revaluationRows) {
      await addFXGainLoss({
        date: revalDate,
        currencyCode: row.currencyCode,
        foreignAmount: row.foreignAmount,
        rateAtTransaction: row.rateAtTransaction,
        rateAtSettlement: 0,
        rateAtRevaluation: row.rateAtRevaluation,
        baseAmountAtTransaction: row.baseAtTransaction,
        baseAmountAtSettlement: 0,
        gainLossAmount: row.gainLoss,
        type: "unrealized",
        voucherId: row.voucherId,
        relatedAccountId: "",
        narration: `Unrealized FX revaluation at ${revalDate} – ${row.currencyCode}`,
      });
    }
    alert(`${revaluationRows.length} revaluation entries posted.`);
  };

  // ── Export rates ───────────────────────────────────────────────────────────
  const exportRates = () => {
    const data = filteredRates.map(r => ({
      Currency: r.currencyCode,
      Date: r.date,
      "Buy Rate": r.buyRate,
      "Sell Rate": r.sellRate,
      "Mid Rate": r.midRate,
      Source: r.source,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exchange Rates");
    XLSX.writeFile(wb, `ExchangeRates_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const tabs = [
    { id: "currencies", label: "Currency Master", icon: Globe },
    { id: "rates",      label: "Exchange Rates",  icon: RefreshCw },
    { id: "gainloss",   label: "FX Gain / Loss",  icon: TrendingUp },
    { id: "revaluation",label: "Period Revaluation", icon: DollarSign },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Multi-Currency Accounting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage foreign currencies, exchange rates, and FX gain/loss (NRB-compliant)
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "currencies" && (
            <button onClick={() => { setEditCurr(null); setShowCurrModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4"/> Add Currency
            </button>
          )}
          {activeTab === "rates" && (
            <>
              <button onClick={exportRates}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                <Download className="w-4 h-4"/> Export
              </button>
              <button onClick={() => { setEditRate(null); setShowRateModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                <Plus className="w-4 h-4"/> Add Rate
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Currencies", value: foreignCurrencies.length, color: "blue", icon: Globe },
          { label: "Realized FX", value: fmtFX(gainLossSummary.realized, "NPR "), color: gainLossSummary.realized >= 0 ? "green" : "red", icon: TrendingUp },
          { label: "Unrealized FX", value: fmtFX(gainLossSummary.unrealized, "NPR "), color: gainLossSummary.unrealized >= 0 ? "green" : "red", icon: TrendingDown },
          { label: "Net FX P&L", value: fmtFX(gainLossSummary.net, "NPR "), color: gainLossSummary.net >= 0 ? "green" : "red", icon: DollarSign },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{card.label}</span>
              <card.icon className={`w-4 h-4 text-${card.color}-500`}/>
            </div>
            <div className={`text-lg font-bold text-${card.color}-700 font-mono`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <t.icon className="w-4 h-4"/> {t.label}
          </button>
        ))}
      </div>

      {/* ── CURRENCY MASTER ───────────────────────────────────────────────── */}
      {activeTab === "currencies" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Base Currency */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-amber-600"/>
              <span className="font-semibold text-amber-800">NPR – Nepalese Rupee</span>
              <span className="ml-auto text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">Base</span>
            </div>
            <div className="text-xs text-amber-700">Company's home currency. All reports are consolidated in NPR.</div>
          </div>

          {/* Foreign currencies */}
          {foreignCurrencies.map(c => {
            const rate = latestRates[c.code];
            return (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-800">{c.symbol}</span>
                    <div>
                      <div className="font-semibold text-gray-800">{c.code}</div>
                      <div className="text-xs text-gray-500">{c.name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditCurr(c); setCurrForm({...c}); setShowCurrModal(true); }}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </div>
                {rate ? (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-gray-400">Buy</div>
                      <div className="font-semibold text-gray-700">{fmt(rate.buyRate)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-blue-400">Mid</div>
                      <div className="font-semibold text-blue-700">{fmt(rate.midRate)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-gray-400">Sell</div>
                      <div className="font-semibold text-gray-700">{fmt(rate.sellRate)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-1 text-xs text-orange-500">
                    <AlertTriangle className="w-3.5 h-3.5"/> No rate configured
                  </div>
                )}
                {rate && <div className="mt-1 text-xs text-gray-400">Rate as of {rate.date}</div>}
              </div>
            );
          })}

          {/* Add Currency quick cards */}
          <button onClick={() => { setEditCurr(null); setShowCurrModal(true); }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors min-h-28">
            <Plus className="w-6 h-6 mb-1"/>
            <span className="text-sm">Add Currency</span>
          </button>
        </div>
      )}

      {/* ── EXCHANGE RATES ────────────────────────────────────────────────── */}
      {activeTab === "rates" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Currencies</option>
              {foreignCurrencies.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
            </select>
            <span className="text-sm text-gray-500">Showing {filteredRates.length} rates</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Currency","Date","Buy Rate","Sell Rate","Mid Rate","Source","Actions"]
                    .map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRates.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-800">{r.currencyCode}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {currencies.find(c => c.code === r.currencyCode)?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.buyRate)}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.sellRate)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">{fmt(r.midRate)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        r.source === "NRB" ? "bg-green-100 text-green-700" :
                        r.source === "IRD" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-600"}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => { setEditRate(r); setRateForm({...r}); setShowRateModal(true); }}
                          className="text-blue-500 hover:text-blue-700"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => deleteExchangeRate(r.id!)}
                          className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRates.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No exchange rates found. Add rates using the button above.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FX GAIN / LOSS REGISTER ───────────────────────────────────────── */}
      {activeTab === "gainloss" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Realized Gain / (Loss)", value: gainLossSummary.realized, entries: fxGainLossEntries.filter(e=>e.type==="realized").length },
              { label: "Unrealized Gain / (Loss)", value: gainLossSummary.unrealized, entries: fxGainLossEntries.filter(e=>e.type==="unrealized").length },
              { label: "Net FX Gain / (Loss)", value: gainLossSummary.net, entries: fxGainLossEntries.length },
            ].map(item => (
              <div key={item.label} className={`rounded-xl p-4 border ${item.value >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                <div className={`text-xl font-bold ${item.value >= 0 ? "text-green-700" : "text-red-700"} font-mono`}>
                  {fmtFX(item.value, "NPR ")}
                </div>
                <div className="text-xs text-gray-400 mt-1">{item.entries} entries</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Date","Currency","Foreign Amt","Rate (Txn)","Rate (Settle/Reval)","Base (Txn)","Base (Settle)","Gain/(Loss)","Type","Narration"]
                    .map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fxGainLossEntries.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(e => (
                  <tr key={e.id} className={`hover:bg-gray-50 ${e.gainLossAmount < 0 ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">{e.date}</td>
                    <td className="px-3 py-2 font-semibold">{e.currencyCode}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.foreignAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.rateAtTransaction)}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.type === "realized" ? e.rateAtSettlement : e.rateAtRevaluation)}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.baseAmountAtTransaction)}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.baseAmountAtSettlement || toBase(e.foreignAmount, e.rateAtRevaluation))}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${e.gainLossAmount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtFX(e.gainLossAmount)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${e.type === "realized" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-48 truncate">{e.narration}</td>
                  </tr>
                ))}
                {fxGainLossEntries.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No FX gain/loss entries yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PERIOD REVALUATION ────────────────────────────────────────────── */}
      {activeTab === "revaluation" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <div className="font-semibold mb-1">Period-End Unrealized FX Revaluation (IAS 21)</div>
            All open foreign-currency transactions are revalued at the closing exchange rate. The resulting unrealized gain/loss is posted to the FX P&amp;L account and reversed at period start.
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revaluation Date</label>
              <input type="date" value={revalDate} onChange={e => setRevalDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div className="mt-5">
              <div className={`text-lg font-bold font-mono ${totalUnrealizedGL >= 0 ? "text-green-700" : "text-red-700"}`}>
                Net Unrealized GL: {fmtFX(totalUnrealizedGL, "NPR ")}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Voucher Date","Currency","Foreign Amt","Rate (Original)","Rate (Revaluation)","Base (Original)","Base (Revalued)","Unrealized GL","Narration"]
                    .map(h => <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {revaluationRows.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${r.gainLoss < 0 ? "bg-red-50/30" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">{r.date}</td>
                    <td className="px-3 py-2 font-semibold">{r.currencyCode}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.foreignAmount)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.rateAtTransaction)}</td>
                    <td className="px-3 py-2 text-right text-blue-700 font-medium">{fmt(r.rateAtRevaluation)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.baseAtTransaction)}</td>
                    <td className="px-3 py-2 text-right">{fmt(r.baseAtRevaluation)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${r.gainLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmtFX(r.gainLoss)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-40">{r.narration}</td>
                  </tr>
                ))}
                {revaluationRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No open foreign-currency transactions found for revaluation.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {revaluationRows.length > 0 && (
            <div className="flex justify-end">
              <button onClick={handlePostRevaluation}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">
                <RefreshCw className="w-4 h-4"/> Post Revaluation Entries ({revaluationRows.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CURRENCY MODAL ────────────────────────────────────────────────── */}
      {showCurrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editCurr ? "Edit Currency" : "Add Currency"}</h2>
              <button onClick={() => setShowCurrModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Quick-select common currencies */}
              {!editCurr && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CURRENCIES.slice(0, 8).map(c => (
                      <button key={c.code} onClick={() => setCurrForm({ ...currForm, code: c.code, name: c.name, symbol: c.symbol, decimalPlaces: 2, isActive: true, isBase: false })}
                        className={`px-3 py-1 rounded-full text-xs border ${currForm.code === c.code ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-blue-400"}`}>
                        {c.code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {[
                ["code", "Currency Code (e.g. USD)", "text"],
                ["name", "Currency Name", "text"],
                ["symbol", "Symbol (e.g. $)", "text"],
                ["decimalPlaces", "Decimal Places", "number"],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={currForm[field] || ""} onChange={e => setCurrForm({ ...currForm, [field]: type === "number" ? +e.target.value : e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={currForm.isActive} onChange={e => setCurrForm({ ...currForm, isActive: e.target.checked })} className="w-4 h-4 rounded"/>
                Active
              </label>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={() => setShowCurrModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSaveCurrency} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXCHANGE RATE MODAL ───────────────────────────────────────────── */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">{editRate ? "Edit Exchange Rate" : "Add Exchange Rate"}</h2>
              <button onClick={() => setShowRateModal(false)}><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select value={rateForm.currencyCode} onChange={e => setRateForm({ ...rateForm, currencyCode: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select Currency</option>
                  {foreignCurrencies.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                <input type="date" value={rateForm.date} onChange={e => setRateForm({ ...rateForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[["buyRate","Buy Rate"],["midRate","Mid Rate"],["sellRate","Sell Rate"]].map(([field,label]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <input type="number" step="0.0001" value={rateForm[field] || ""} onChange={e => setRateForm({ ...rateForm, [field]: +e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                <select value={rateForm.source} onChange={e => setRateForm({ ...rateForm, source: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="manual">Manual Entry</option>
                  <option value="NRB">NRB (Nepal Rastra Bank)</option>
                  <option value="IRD">IRD Official Rate</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button onClick={() => setShowRateModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleSaveRate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Rate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
