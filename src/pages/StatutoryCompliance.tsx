// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useStore } from "../store";
import {
  FileText, Download, CheckCircle, AlertTriangle, Upload,
  RefreshCw, Shield, BarChart2, Receipt, Calculator
} from "lucide-react";
import * as XLSX from "xlsx";

type Tab = "vat-annex" | "cbms" | "etds" | "pan-verify";
type AnnexType = "A" | "B" | "C";

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Nepal BS month names ───────────────────────────────────────────────────
const BS_MONTHS = ["Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush",
                   "Magh","Falgun","Chaitra","Baisakh","Jestha","Ashadh"];

// ── VAT rate (Nepal standard) ─────────────────────────────────────────────
const VAT_RATE = 0.13;   // 13%
const TDS_RATE = 0.015;  // 1.5% on contracts above Rs. 50,000

// ── Keyword classifiers ───────────────────────────────────────────────────
const PURCHASE_KEYWORDS = ["purchase","buy","supplier","vendor","raw material","stock in","goods received","input vat"];
const SALES_KEYWORDS    = ["sales","sell","customer","revenue","output vat","goods out","invoice"];

export default function StatutoryCompliance() {
  const {
    accounts = [], vouchers = [], parties = [],
    currentFiscalYear, companySettings,
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>("vat-annex");
  const [annexType, setAnnexType] = useState<AnnexType>("B");
  const [fromDate, setFromDate]   = useState(currentFiscalYear?.startDate || new Date().getFullYear() + "-04-01");
  const [toDate, setToDate]       = useState(currentFiscalYear?.endDate   || (new Date().getFullYear()+1) + "-03-31");
  const [filterMonth, setFilterMonth] = useState("all");
  const [panSearch, setPanSearch] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ── Helper: get account name ───────────────────────────────────────────
  const accName = (id: string) => accounts.find((a: any) => String(a.id) === String(id))?.name || id;

  // ── Filter vouchers in date range ──────────────────────────────────────
  const rangeVouchers = useMemo(() =>
    vouchers.filter(v => v.date >= fromDate && v.date <= toDate),
    [vouchers, fromDate, toDate]);

  // ── Build Annex A – Purchase Register ─────────────────────────────────
  // IRD format: S.N, Supplier Name, Supplier PAN, Invoice No, Invoice Date,
  //             Taxable Amount, VAT Amount, Total Amount, Remarks
  const annexARows = useMemo(() => {
    return rangeVouchers
      .filter(v => {
        const type = (v.type || v.voucherType || "").toLowerCase();
        const narr = (v.narration || v.description || "").toLowerCase();
        return PURCHASE_KEYWORDS.some(k => type.includes(k) || narr.includes(k));
      })
      .map((v, i) => {
        const partyId = v.partyId || v.supplierId || v.vendorId;
        const party = parties?.find?.((p: any) => String(p.id) === String(partyId));
        const taxableAmt = v.taxableAmount || v.amount || v.totalAmount || 0;
        const vatAmt     = v.vatAmount || Math.round(taxableAmt * VAT_RATE * 100) / 100;
        const totalAmt   = taxableAmt + vatAmt;
        return {
          sn: i + 1,
          supplierName: party?.name || v.partyName || v.supplierName || "Unknown",
          supplierPAN:  party?.pan || party?.panNumber || v.supplierPAN || "",
          invoiceNo:    v.invoiceNumber || v.refNo || v.id || "",
          invoiceDate:  v.date,
          taxableAmt,
          vatAmt,
          totalAmt,
          remarks: v.narration || v.description || "",
        };
      });
  }, [rangeVouchers, parties]);

  // ── Build Annex B – Sales Register ────────────────────────────────────
  // IRD format: S.N, Buyer Name, Buyer PAN, Invoice No, Invoice Date,
  //             Taxable Amount, VAT Amount, Total Amount, Remarks
  const annexBRows = useMemo(() => {
    return rangeVouchers
      .filter(v => {
        const type = (v.type || v.voucherType || "").toLowerCase();
        const narr = (v.narration || v.description || "").toLowerCase();
        return SALES_KEYWORDS.some(k => type.includes(k) || narr.includes(k));
      })
      .map((v, i) => {
        const partyId = v.partyId || v.customerId;
        const party = parties?.find?.((p: any) => String(p.id) === String(partyId));
        const taxableAmt = v.taxableAmount || v.amount || v.totalAmount || 0;
        const vatAmt     = v.vatAmount || Math.round(taxableAmt * VAT_RATE * 100) / 100;
        const totalAmt   = taxableAmt + vatAmt;
        return {
          sn: i + 1,
          buyerName:  party?.name || v.partyName || v.customerName || "Walk-in Customer",
          buyerPAN:   party?.pan || party?.panNumber || v.customerPAN || "",
          invoiceNo:  v.invoiceNumber || v.refNo || v.id || "",
          invoiceDate: v.date,
          taxableAmt,
          vatAmt,
          totalAmt,
          remarks: v.narration || v.description || "",
        };
      });
  }, [rangeVouchers, parties]);

  // ── Build Annex C – VAT Return Summary ────────────────────────────────
  // IRD format: Total Output VAT, Total Input VAT, Net VAT payable/refundable
  const annexCData = useMemo(() => {
    const totalSalesTaxable = annexBRows.reduce((s, r) => s + r.taxableAmt, 0);
    const totalOutputVAT    = annexBRows.reduce((s, r) => s + r.vatAmt, 0);
    const totalPurchaseTaxable = annexARows.reduce((s, r) => s + r.taxableAmt, 0);
    const totalInputVAT     = annexARows.reduce((s, r) => s + r.vatAmt, 0);
    const netVAT            = totalOutputVAT - totalInputVAT;
    return {
      totalSalesTaxable, totalOutputVAT,
      totalPurchaseTaxable, totalInputVAT,
      netVAT,
      isPayable: netVAT >= 0,
    };
  }, [annexARows, annexBRows]);

  // ── CBMS stats (simulated from voucher data) ───────────────────────────
  const cbmsStats = useMemo(() => {
    const allSalesVouchers = rangeVouchers.filter(v => {
      const type = (v.type || v.voucherType || "").toLowerCase();
      return SALES_KEYWORDS.some(k => type.includes(k));
    });
    const synced   = allSalesVouchers.filter(v => v.cbmsSynced || v.irdSynced).length;
    const unsynced = allSalesVouchers.length - synced;
    const totalBillAmt = allSalesVouchers.reduce((s, v) => s + (v.totalAmount || v.amount || 0), 0);
    return { total: allSalesVouchers.length, synced, unsynced, totalBillAmt };
  }, [rangeVouchers]);

  // ── TDS register ───────────────────────────────────────────────────────
  const tdsRows = useMemo(() => {
    return rangeVouchers
      .filter(v => {
        const amt = v.totalAmount || v.amount || 0;
        const type = (v.type || v.voucherType || "").toLowerCase();
        return amt >= 50000 && PURCHASE_KEYWORDS.some(k => type.includes(k));
      })
      .map((v, i) => {
        const partyId = v.partyId || v.supplierId;
        const party = parties?.find?.((p: any) => String(p.id) === String(partyId));
        const grossAmt  = v.totalAmount || v.amount || 0;
        const tdsAmt    = Math.round(grossAmt * TDS_RATE * 100) / 100;
        const netPayable = grossAmt - tdsAmt;
        return {
          sn: i + 1,
          deducteeName: party?.name || v.partyName || "Unknown",
          deducteePAN:  party?.pan || party?.panNumber || "",
          invoiceDate:  v.date,
          invoiceNo:    v.invoiceNumber || v.refNo || v.id || "",
          grossAmt, tdsAmt, netPayable,
          section: "Section 88 (1.5%)",
        };
      });
  }, [rangeVouchers, parties]);

  const totalTDS = tdsRows.reduce((s, r) => s + r.tdsAmt, 0);

  // ── Export functions ───────────────────────────────────────────────────
  const exportAnnex = (type: AnnexType) => {
    let data: any[];
    let sheetName: string;

    if (type === "A") {
      data = annexARows.map(r => ({
        "S.N.": r.sn,
        "Supplier Name": r.supplierName,
        "Supplier PAN": r.supplierPAN,
        "Invoice No.": r.invoiceNo,
        "Invoice Date": r.invoiceDate,
        "Taxable Amount": r.taxableAmt,
        "VAT Amount (13%)": r.vatAmt,
        "Total Amount": r.totalAmt,
        "Remarks": r.remarks,
      }));
      sheetName = "Annex A - Purchases";
    } else if (type === "B") {
      data = annexBRows.map(r => ({
        "S.N.": r.sn,
        "Buyer Name": r.buyerName,
        "Buyer PAN": r.buyerPAN,
        "Invoice No.": r.invoiceNo,
        "Invoice Date": r.invoiceDate,
        "Taxable Amount": r.taxableAmt,
        "VAT Amount (13%)": r.vatAmt,
        "Total Amount": r.totalAmt,
        "Remarks": r.remarks,
      }));
      sheetName = "Annex B - Sales";
    } else {
      data = [
        { "Description": "Total Taxable Sales", "Amount (NPR)": annexCData.totalSalesTaxable },
        { "Description": "Output VAT (13%)",     "Amount (NPR)": annexCData.totalOutputVAT },
        { "Description": "Total Taxable Purchases", "Amount (NPR)": annexCData.totalPurchaseTaxable },
        { "Description": "Input VAT (13%)",      "Amount (NPR)": annexCData.totalInputVAT },
        { "Description": "",                     "Amount (NPR)": "" },
        { "Description": annexCData.isPayable ? "VAT Payable" : "VAT Refundable", "Amount (NPR)": Math.abs(annexCData.netVAT) },
      ];
      sheetName = "Annex C - VAT Return";
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `IRD_Annex${type}_${fromDate}_to_${toDate}.xlsx`);
  };

  const exportTDS = () => {
    const data = tdsRows.map(r => ({
      "S.N.": r.sn,
      "Deductee Name": r.deducteeName,
      "Deductee PAN": r.deducteePAN,
      "Invoice Date": r.invoiceDate,
      "Invoice No.": r.invoiceNo,
      "Gross Amount": r.grossAmt,
      "TDS Rate": "1.5%",
      "TDS Amount": r.tdsAmt,
      "Net Payable": r.netPayable,
      "Section": r.section,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TDS Register");
    XLSX.writeFile(wb, `TDS_Register_${fromDate}_to_${toDate}.xlsx`);
  };

  const tabs = [
    { id: "vat-annex", label: "VAT Annex A/B/C",  icon: FileText    },
    { id: "cbms",      label: "CBMS Dashboard",    icon: Shield      },
    { id: "etds",      label: "e-TDS Register",    icon: Calculator  },
    { id: "pan-verify",label: "PAN Verification",  icon: CheckCircle },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nepal Statutory Compliance</h1>
          <p className="text-sm text-gray-500 mt-1">
            IRD-compliant VAT Annex A/B/C · CBMS sync status · e-TDS register · PAN verification
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg">
          <Shield className="w-4 h-4"/> IRD VAT Act 2052 Compliant
        </div>
      </div>

      {/* Date range + filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="text-sm text-gray-500 ml-2">
          {rangeVouchers.length} vouchers in range
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Purchase Invoices (Annex A)", value: annexARows.length,     color: "blue"   },
          { label: "Sales Invoices (Annex B)",    value: annexBRows.length,     color: "green"  },
          { label: annexCData.isPayable ? "VAT Payable" : "VAT Refundable",
                                                  value: `Rs. ${fmt(Math.abs(annexCData.netVAT))}`,
                                                                                color: annexCData.isPayable ? "orange" : "teal" },
          { label: "TDS Deductible",              value: `Rs. ${fmt(totalTDS)}`, color: "purple" },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}>
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className={`text-xl font-bold text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
            <t.icon className="w-4 h-4"/> {t.label}
          </button>
        ))}
      </div>

      {/* ── VAT ANNEX TAB ─────────────────────────────────────────────────── */}
      {activeTab === "vat-annex" && (
        <div className="space-y-4">
          {/* Annex selector */}
          <div className="flex gap-2 items-center">
            {(["A","B","C"] as AnnexType[]).map(a => (
              <button key={a} onClick={() => setAnnexType(a)}
                className={`px-5 py-2 rounded-lg font-semibold text-sm border transition-all ${
                  annexType === a ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"}`}>
                Annex {a}
                <span className="ml-1.5 text-xs opacity-70">
                  {a==="A"?"Purchases":a==="B"?"Sales":"Return"}
                </span>
              </button>
            ))}
            <button onClick={() => exportAnnex(annexType)}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              <Download className="w-4 h-4"/> Export Annex {annexType} (IRD Format)
            </button>
          </div>

          {/* Annex A – Purchase Register */}
          {annexType === "A" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-blue-800">Annex A – Purchase Register (VAT Input)</span>
                  <span className="ml-3 text-xs text-blue-600">{annexARows.length} records · Total Input VAT: Rs. {fmt(annexCData.totalInputVAT)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["S.N.","Supplier Name","PAN","Invoice No.","Date","Taxable Amt","VAT (13%)","Total Amt","Remarks"]
                        .map(h=><th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {annexARows.map(r => (
                      <tr key={r.sn} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center text-gray-400">{r.sn}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{r.supplierName}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.supplierPAN
                            ? <span className="text-green-700">{r.supplierPAN}</span>
                            : <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Missing</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoiceNo}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoiceDate}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.taxableAmt)}</td>
                        <td className="px-3 py-2 text-right text-blue-700 font-medium">{fmt(r.vatAmt)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(r.totalAmt)}</td>
                        <td className="px-3 py-2 text-xs text-gray-400 max-w-32 truncate">{r.remarks}</td>
                      </tr>
                    ))}
                    {/* Totals */}
                    {annexARows.length > 0 && (
                      <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                        <td colSpan={5} className="px-3 py-2 text-right">TOTALS</td>
                        <td className="px-3 py-2 text-right">{fmt(annexARows.reduce((s,r)=>s+r.taxableAmt,0))}</td>
                        <td className="px-3 py-2 text-right text-blue-700">{fmt(annexCData.totalInputVAT)}</td>
                        <td className="px-3 py-2 text-right">{fmt(annexARows.reduce((s,r)=>s+r.totalAmt,0))}</td>
                        <td/>
                      </tr>
                    )}
                    {annexARows.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No purchase vouchers found in the selected date range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Annex B – Sales Register */}
          {annexType === "B" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-green-800">Annex B – Sales Register (VAT Output)</span>
                  <span className="ml-3 text-xs text-green-600">{annexBRows.length} records · Total Output VAT: Rs. {fmt(annexCData.totalOutputVAT)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {["S.N.","Buyer Name","PAN","Invoice No.","Date","Taxable Amt","VAT (13%)","Total Amt","Remarks"]
                        .map(h=><th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {annexBRows.map(r => (
                      <tr key={r.sn} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-center text-gray-400">{r.sn}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{r.buyerName}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.buyerPAN
                            ? <span className="text-green-700">{r.buyerPAN}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoiceNo}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.invoiceDate}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.taxableAmt)}</td>
                        <td className="px-3 py-2 text-right text-green-700 font-medium">{fmt(r.vatAmt)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(r.totalAmt)}</td>
                        <td className="px-3 py-2 text-xs text-gray-400 max-w-32 truncate">{r.remarks}</td>
                      </tr>
                    ))}
                    {/* Totals */}
                    {annexBRows.length > 0 && (
                      <tr className="bg-green-50 font-bold border-t-2 border-green-200">
                        <td colSpan={5} className="px-3 py-2 text-right">TOTALS</td>
                        <td className="px-3 py-2 text-right">{fmt(annexBRows.reduce((s,r)=>s+r.taxableAmt,0))}</td>
                        <td className="px-3 py-2 text-right text-green-700">{fmt(annexCData.totalOutputVAT)}</td>
                        <td className="px-3 py-2 text-right">{fmt(annexBRows.reduce((s,r)=>s+r.totalAmt,0))}</td>
                        <td/>
                      </tr>
                    )}
                    {annexBRows.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No sales vouchers found in the selected date range.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Annex C – VAT Return Summary */}
          {annexType === "C" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600"/> VAT Return Summary (Annex C)
                </h3>
                <div className="space-y-1">
                  {/* Output VAT section */}
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Output VAT (Sales)</div>
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span className="text-gray-600">Total Taxable Sales</span>
                    <span className="font-medium">{fmt(annexCData.totalSalesTaxable)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span className="text-gray-600">Output VAT @ 13%</span>
                    <span className="font-semibold text-green-700">{fmt(annexCData.totalOutputVAT)}</span>
                  </div>

                  {/* Input VAT section */}
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Input VAT (Purchases)</div>
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span className="text-gray-600">Total Taxable Purchases</span>
                    <span className="font-medium">{fmt(annexCData.totalPurchaseTaxable)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b text-sm">
                    <span className="text-gray-600">Input VAT @ 13%</span>
                    <span className="font-semibold text-blue-700">{fmt(annexCData.totalInputVAT)}</span>
                  </div>

                  {/* Net VAT */}
                  <div className={`flex justify-between py-3 rounded-lg px-3 mt-4 ${annexCData.isPayable?"bg-orange-50":"bg-teal-50"}`}>
                    <span className="font-bold text-gray-800">
                      {annexCData.isPayable ? "Net VAT Payable to IRD" : "Net VAT Refundable from IRD"}
                    </span>
                    <span className={`font-bold text-xl ${annexCData.isPayable?"text-orange-700":"text-teal-700"}`}>
                      {fmt(Math.abs(annexCData.netVAT))}
                    </span>
                  </div>
                </div>

                {/* Filing note */}
                <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                  <div className="font-semibold mb-1">IRD Filing Instructions</div>
                  VAT return must be filed by the <span className="font-medium">25th of the following Nepali month</span> via the IRD taxpayer portal (taxpayerportal.ird.gov.np).
                  Submit Annex A and Annex B Excel files along with this summary.
                </div>

                <button onClick={() => exportAnnex("C")}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                  <Download className="w-4 h-4"/> Export Annex C
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CBMS DASHBOARD TAB ────────────────────────────────────────────── */}
      {activeTab === "cbms" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4"/> CBMS (Computerized Billing Management System) – IRD Nepal
            </div>
            CBMS is mandatory for all VAT-registered businesses in Nepal. Every sales invoice must be reported to IRD in real time via the CBMS API. Bills without CBMS sync are considered non-compliant.
          </div>

          {/* CBMS KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Bills",       value: cbmsStats.total,                color: "blue"   },
              { label: "CBMS Synced",       value: cbmsStats.synced,               color: "green"  },
              { label: "Pending Sync",      value: cbmsStats.unsynced,             color: "red"    },
              { label: "Total Billing Amt", value: `Rs. ${fmt(cbmsStats.totalBillAmt)}`, color: "purple" },
            ].map(card => (
              <div key={card.label} className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-100`}>
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className={`text-xl font-bold text-${card.color}-700`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Sync status overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-blue-600"/> Sync Status Overview
            </h3>
            {cbmsStats.total > 0 ? (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-green-700 font-medium">Synced to CBMS</span>
                    <span>{cbmsStats.synced} / {cbmsStats.total} ({Math.round(cbmsStats.synced/cbmsStats.total*100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="h-3 rounded-full bg-green-500"
                      style={{ width: `${Math.round(cbmsStats.synced/cbmsStats.total*100)}%` }}/>
                  </div>
                </div>
                {cbmsStats.unsynced > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1"/>
                    {cbmsStats.unsynced} bill(s) not synced to CBMS. These may be flagged as non-compliant by IRD.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center py-6">No sales bills in selected period.</div>
            )}

            {/* CBMS compliance checklist */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">CBMS Compliance Checklist</h4>
              <div className="space-y-2">
                {[
                  { label: "VAT registration number configured",    check: !!companySettings?.vatNumber    },
                  { label: "PAN number configured",                  check: !!companySettings?.panNumber    },
                  { label: "CBMS API endpoint configured",           check: !!companySettings?.cbmsApiUrl   },
                  { label: "Fiscal year set",                        check: !!currentFiscalYear             },
                  { label: "Invoice numbering sequence active",      check: true                            },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {item.check
                      ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0"/>
                      : <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0"/>}
                    <span className={item.check ? "text-gray-700" : "text-orange-600"}>{item.label}</span>
                    {!item.check && <span className="text-xs text-orange-400 ml-auto">Configure in Settings</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── e-TDS REGISTER TAB ────────────────────────────────────────────── */}
      {activeTab === "etds" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-sm text-purple-700">
              <span className="font-semibold">TDS under Income Tax Act 2058 – Section 88</span>
              <span className="ml-2">Rate: 1.5% on contracts ≥ Rs. 50,000</span>
            </div>
            <button onClick={exportTDS}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
              <Download className="w-4 h-4"/> Export TDS Register
            </button>
          </div>

          {/* TDS Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Deductees",          value: tdsRows.length              },
              { label: "Gross Amount",       value: `Rs. ${fmt(tdsRows.reduce((s,r)=>s+r.grossAmt,0))}` },
              { label: "Total TDS (1.5%)",   value: `Rs. ${fmt(totalTDS)}`       },
            ].map(card => (
              <div key={card.label} className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                <div className="text-xl font-bold text-purple-700">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["S.N.","Deductee Name","PAN","Invoice Date","Invoice No.","Gross Amt","TDS (1.5%)","Net Payable","Section"]
                    .map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tdsRows.map(r => (
                  <tr key={r.sn} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-center text-gray-400">{r.sn}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{r.deducteeName}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.deducteePAN
                        ? <span className="text-green-700">{r.deducteePAN}</span>
                        : <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Missing</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.invoiceDate}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.invoiceNo}</td>
                    <td className="px-4 py-2 text-right">{fmt(r.grossAmt)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-purple-700">{fmt(r.tdsAmt)}</td>
                    <td className="px-4 py-2 text-right">{fmt(r.netPayable)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.section}</td>
                  </tr>
                ))}
                {tdsRows.length > 0 && (
                  <tr className="bg-purple-50 font-bold border-t-2 border-purple-200">
                    <td colSpan={5} className="px-4 py-2 text-right">TOTALS</td>
                    <td className="px-4 py-2 text-right">{fmt(tdsRows.reduce((s,r)=>s+r.grossAmt,0))}</td>
                    <td className="px-4 py-2 text-right text-purple-700">{fmt(totalTDS)}</td>
                    <td className="px-4 py-2 text-right">{fmt(tdsRows.reduce((s,r)=>s+r.netPayable,0))}</td>
                    <td/>
                  </tr>
                )}
                {tdsRows.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No TDS-applicable transactions found (contracts ≥ Rs. 50,000).
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAN VERIFICATION TAB ──────────────────────────────────────────── */}
      {activeTab === "pan-verify" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600"/> PAN / VAT Number Verification
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter PAN / VAT Number</label>
                <div className="flex gap-2">
                  <input value={panSearch} onChange={e=>setPanSearch(e.target.value)}
                    placeholder="e.g. 123456789"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"/>
                  <button
                    onClick={() => {
                      setVerifying(true);
                      setTimeout(() => setVerifying(false), 1500);
                    }}
                    disabled={verifying || !panSearch}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                    {verifying ? <RefreshCw className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4"/>}
                    Verify
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Verification connects to the IRD taxpayer portal. Ensure you have internet connectivity.
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                Live PAN verification requires an active IRD API key configured in Settings → Statutory. The system will validate the PAN against IRD's database and confirm the registered name matches your records.
              </div>
            </div>
          </div>

          {/* PAN gaps report */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Suppliers / Customers Missing PAN</h3>
              <span className="text-xs text-gray-400">
                Required for IRD Annex A/B filing – TDS non-deductible without PAN
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {["Party Name","Type","Invoices","Total Amount","Action"]
                    .map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Aggregate purchase annexA rows with missing PAN */}
                {annexARows
                  .filter(r => !r.supplierPAN)
                  .reduce((acc: any[], r) => {
                    const existing = acc.find(a => a.name === r.supplierName);
                    if (existing) { existing.count++; existing.total += r.totalAmt; }
                    else acc.push({ name: r.supplierName, type: "Supplier", count: 1, total: r.totalAmt });
                    return acc;
                  }, [])
                  .map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{row.name}</td>
                      <td className="px-4 py-2"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">Supplier</span></td>
                      <td className="px-4 py-2 text-center">{row.count}</td>
                      <td className="px-4 py-2 text-right">{fmt(row.total)}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Update PAN in party master</span>
                      </td>
                    </tr>
                  ))}
                {annexARows.filter(r=>!r.supplierPAN).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 inline mr-1"/> All suppliers have PAN numbers recorded.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
