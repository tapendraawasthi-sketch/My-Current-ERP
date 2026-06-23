import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { formatADToBS } from "../lib/nepaliDate";
import { TDS_SECTIONS_FULL } from "../lib/constants";
import { Party, TdsEntry } from "../lib/types";
import { generateTDSCertificate } from "../lib/tdsCertificate";
import { Download, FileText, CheckSquare, Info, Printer } from "lucide-react";
import toast from "react-hot-toast";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const TABS = [
  { id: "deducted", label: "TDS Deducted" },
  { id: "deposit", label: "Deposit Status" },
  { id: "certificate", label: "TDS Certificate (Annex 10)" },
  { id: "return", label: "TDS Return Summary" },
];

export default function TdsReport() {
  const { tdsEntries, parties, vouchers, companySettings, reportFilters, currentFiscalYear } = useStore();

  const [activeTab, setActiveTab] = useState("deducted");

  // Deducted tab filters
  const [startDate, setStartDate] = useState(reportFilters?.startDate || currentFiscalYear?.startDate || "");
  const [endDate, setEndDate] = useState(reportFilters?.endDate || currentFiscalYear?.endDate || "");
  const [sectionFilter, setSectionFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");

  // Certificate tab
  const [certPartyId, setCertPartyId] = useState("");
  const [certFY, setCertFY] = useState(currentFiscalYear?.name || "2083/84");

  // Deposit tab
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositRecord, setDepositRecord] = useState<{ section: string; month: string } | null>(null);
  const [challanNo, setChallanNo] = useState("");
  const [depositDate, setDepositDate] = useState("");

  // Filtered entries for Deducted tab
  const filteredEntries = useMemo(() => {
    return tdsEntries.filter((e) => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (sectionFilter && !e.tdsType?.toLowerCase().includes(sectionFilter.toLowerCase())) return false;
      if (partyFilter && e.partyId !== partyFilter) return false;
      return true;
    });
  }, [tdsEntries, startDate, endDate, sectionFilter, partyFilter]);

  const totals = useMemo(() => ({
    gross: filteredEntries.reduce((s, e) => s + (e.grossAmount || 0), 0),
    tds: filteredEntries.reduce((s, e) => s + (e.tdsAmount || 0), 0),
    net: filteredEntries.reduce((s, e) => s + (e.netAmount || 0), 0),
    deposited: filteredEntries.filter((e) => e.deposited).reduce((s, e) => s + (e.tdsAmount || 0), 0),
    pending: filteredEntries.filter((e) => !e.deposited).reduce((s, e) => s + (e.tdsAmount || 0), 0),
  }), [filteredEntries]);

  // Monthly deposit summary
  const monthlyDepositRows = useMemo(() => {
    const map = new Map<string, { deducted: number; deposited: number; section: string }>();
    tdsEntries.forEach((e) => {
      const prefix = e.date?.substring(0, 7) || ""; // YYYY-MM
      const key = `${prefix}-${e.tdsType || "other"}`;
      if (!map.has(key)) map.set(key, { deducted: 0, deposited: 0, section: e.tdsType || "other" });
      const row = map.get(key)!;
      row.deducted += e.tdsAmount || 0;
      if (e.deposited) row.deposited += e.tdsAmount || 0;
    });
    return Array.from(map.entries())
      .map(([key, v]) => {
        const [prefix] = key.split("-").slice(0, 2);
        const month = key.substring(0, 7);
        const d = new Date(month + "-15");
        const deadline = new Date(d.getFullYear(), d.getMonth() + 1, 25);
        const isLate = new Date() > deadline && v.deducted > v.deposited;
        return {
          month,
          section: v.section,
          deducted: v.deducted,
          deposited: v.deposited,
          balance: v.deducted - v.deposited,
          deadline: deadline.toISOString().split("T")[0],
          isLate,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [tdsEntries]);

  // Certificate data
  const certParty = useMemo(() => parties.find((p) => p.id === certPartyId) || null, [parties, certPartyId]);
  const certEntries = useMemo(
    () =>
      tdsEntries.filter(
        (e) =>
          e.partyId === certPartyId &&
          (!currentFiscalYear ||
            (e.date >= currentFiscalYear.startDate && e.date <= currentFiscalYear.endDate)),
      ),
    [tdsEntries, certPartyId, currentFiscalYear],
  );
  const certTotal = certEntries.reduce((s, e) => s + (e.tdsAmount || 0), 0);
  const certGross = certEntries.reduce((s, e) => s + (e.grossAmount || 0), 0);

  // Return summary (quarterly)
  const returnSummary = useMemo(() => {
    const qMap = new Map<string, { section: string; count: number; gross: number; tds: number; deposited: number }>();
    tdsEntries.forEach((e) => {
      const dateBS = e.dateNepali || "";
      const parts = dateBS.split("/");
      const month = parts[1] ? parseInt(parts[1], 10) : 0;
      let q = "Q1";
      if (month >= 4 && month <= 6) q = "Q1";
      else if (month >= 7 && month <= 9) q = "Q2";
      else if (month >= 10 && month <= 12) q = "Q3";
      else if (month >= 1 && month <= 3) q = "Q4";
      const key = `${q}-${e.tdsType || "other"}`;
      if (!qMap.has(key)) qMap.set(key, { section: e.tdsType || "other", count: 0, gross: 0, tds: 0, deposited: 0 });
      const row = qMap.get(key)!;
      row.count += 1;
      row.gross += e.grossAmount || 0;
      row.tds += e.tdsAmount || 0;
      if (e.deposited) row.deposited += e.tdsAmount || 0;
    });
    return Array.from(qMap.entries()).map(([key, v]) => ({ ...v, quarter: key.split("-")[0], key }));
  }, [tdsEntries]);

  const getPartyName = (id: string) => parties.find((p) => p.id === id)?.name || id;
  const getPartyPan = (id: string) => parties.find((p) => p.id === id)?.pan || "—";

  const get88KCumulative = (partyId: string) =>
    tdsEntries
      .filter((e) => e.partyId === partyId && e.tdsType === "contractor")
      .reduce((s, e) => s + (e.grossAmount || 0), 0);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">TDS Report</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Nepal ITA 2058 — Tax Deducted at Source registers, certificates &amp; returns
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total TDS Deducted", value: totals.tds, color: "text-[#1557b0]" },
          { label: "Total Deposited", value: totals.deposited, color: "text-green-600" },
          { label: "Pending Deposit", value: totals.pending, color: "text-red-600" },
          { label: "Gross Amount", value: totals.gross, color: "text-gray-800" },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.color}`}>Rs. {fmt(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`h-8 px-4 text-[12px] font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: TDS DEDUCTED                                          */}
      {/* ============================================================ */}
      {activeTab === "deducted" && (
        <div className="flex flex-col gap-4">
          {/* Filter bar */}
          <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">Section</label>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
              >
                <option value="">All Sections</option>
                {TDS_SECTIONS_FULL.map((s) => (
                  <option key={s.id} value={s.section}>
                    Section {s.section} — {s.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-gray-600">Party</label>
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
              >
                <option value="">All Parties</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                    {["Date (BS)", "Voucher No", "Party", "PAN", "Section", "Gross Amt", "TDS %", "TDS Amt", "Net Paid", "Deposited"].map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-[12px] text-gray-400">
                        No TDS entries found for selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e, idx) => {
                      const cumulative88K = e.tdsType === "contractor" ? get88KCumulative(e.partyId || "") : 0;
                      return (
                        <tr key={e.id} className={`border-b border-gray-100 hover:bg-[#e8eeff] ${idx % 2 === 0 ? "" : "bg-[#f7f9fc]"}`}>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">
                            {e.dateNepali || formatADToBS(e.date)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700 font-mono">
                            {e.voucherNo || "—"}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-700">
                            {getPartyName(e.partyId || "")}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-gray-500 font-mono">
                            {getPartyPan(e.partyId || "")}
                          </td>
                          <td className="px-3 py-[7px] text-[12px]">
                            <span className="inline-flex items-center gap-1">
                              <span className="text-gray-700">{e.section || e.tdsType}</span>
                              {e.tdsType === "contractor" && (
                                <span
                                  title={`Section 88K — Cumulative: Rs. ${fmt(cumulative88K)}`}
                                  className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 rounded cursor-help"
                                >
                                  88K रू{fmt(cumulative88K)}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-[7px] text-[12px] font-mono text-right">
                            {fmt(e.grossAmount || 0)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] text-center text-gray-600">
                            {e.tdsRate || 0}%
                          </td>
                          <td className="px-3 py-[7px] text-[12px] font-mono text-right text-red-600 font-semibold">
                            {fmt(e.tdsAmount || 0)}
                          </td>
                          <td className="px-3 py-[7px] text-[12px] font-mono text-right">
                            {fmt(e.netAmount || 0)}
                          </td>
                          <td className="px-3 py-[7px] text-center">
                            {e.deposited ? (
                              <span className="badge badge-posted">✓</span>
                            ) : (
                              <span className="badge badge-draft">✗</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                    <td colSpan={5} className="px-3 py-2 text-[12px] text-gray-700">
                      TOTAL ({filteredEntries.length} entries)
                    </td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right">{fmt(totals.gross)}</td>
                    <td></td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right text-red-600">{fmt(totals.tds)}</td>
                    <td className="px-3 py-2 text-[12px] font-mono text-right">{fmt(totals.net)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: DEPOSIT STATUS                                         */}
      {/* ============================================================ */}
      {activeTab === "deposit" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-bold text-gray-700">TDS Deposit Status</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Nepal deadline: 25th of the following BS month</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  {["Month", "Section", "TDS Deducted", "Deposited", "Balance", "Due Date", "Status", "Action"].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyDepositRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-400">
                      No TDS entries recorded.
                    </td>
                  </tr>
                ) : (
                  monthlyDepositRows.map((row, idx) => (
                    <tr key={row.month + row.section} className={`border-b border-gray-100 hover:bg-[#e8eeff] ${idx % 2 === 0 ? "" : "bg-[#f7f9fc]"}`}>
                      <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.month}</td>
                      <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.section}</td>
                      <td className="px-3 py-[7px] text-[12px] font-mono text-right">{fmt(row.deducted)}</td>
                      <td className="px-3 py-[7px] text-[12px] font-mono text-right text-green-600">{fmt(row.deposited)}</td>
                      <td className={`px-3 py-[7px] text-[12px] font-mono text-right font-bold ${row.balance > 0 ? "text-red-600" : "text-gray-600"}`}>
                        {fmt(row.balance)}
                      </td>
                      <td className="px-3 py-[7px] text-[12px] text-gray-500">{row.deadline}</td>
                      <td className="px-3 py-[7px]">
                        {row.balance <= 0 ? (
                          <span className="badge badge-posted">Deposited</span>
                        ) : row.isLate ? (
                          <span className="badge badge-cancelled">Late</span>
                        ) : (
                          <span className="badge badge-draft">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-[7px]">
                        {row.balance > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDepositRecord({ section: row.section, month: row.month });
                              setChallanNo("");
                              setDepositDate("");
                              setShowDepositModal(true);
                            }}
                            className="h-6 px-2 bg-[#1557b0] text-white text-[10px] font-semibold rounded cursor-pointer hover:bg-[#0f4a96]"
                          >
                            Mark Deposited
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Deposit Modal */}
          {showDepositModal && depositRecord && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-2xl w-[380px] p-6">
                <h3 className="text-[14px] font-bold text-gray-800 mb-4">
                  Mark TDS as Deposited
                </h3>
                <p className="text-[12px] text-gray-600 mb-4">
                  Section: <strong>{depositRecord.section}</strong> | Month: <strong>{depositRecord.month}</strong>
                </p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-600">Challan No.</label>
                    <input
                      value={challanNo}
                      onChange={(e) => setChallanNo(e.target.value)}
                      className="mt-1 h-8 w-full px-2.5 text-[12px] border border-gray-300 rounded-md"
                      placeholder="e.g. CHN-20240101"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-600">Deposit Date</label>
                    <input
                      type="date"
                      value={depositDate}
                      onChange={(e) => setDepositDate(e.target.value)}
                      className="mt-1 h-8 w-full px-2.5 text-[12px] border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                  <button
                    onClick={() => setShowDepositModal(false)}
                    className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      toast.success(`TDS deposit recorded. Challan: ${challanNo || "N/A"}. Note: Update TDS entries individually to mark as deposited.`);
                      setShowDepositModal(false);
                    }}
                    className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-semibold rounded-md hover:bg-[#0f4a96] cursor-pointer"
                  >
                    Confirm Deposit
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: TDS CERTIFICATE (ANNEX 10)                            */}
      {/* ============================================================ */}
      {activeTab === "certificate" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">Select Party</label>
                <select
                  value={certPartyId}
                  onChange={(e) => setCertPartyId(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md w-56"
                >
                  <option value="">— Select Party —</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-gray-600">Fiscal Year</label>
                <select
                  value={certFY}
                  onChange={(e) => setCertFY(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md"
                >
                  {["2081/82", "2082/83", "2083/84"].map((fy) => (
                    <option key={fy} value={fy}>{fy}</option>
                  ))}
                </select>
              </div>
              {certParty && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const blob = generateTDSCertificate(
                        { grossAmount: certGross, tdsAmount: certTotal, netAmount: certGross - certTotal, tdsType: "contractor", date: new Date().toISOString().split("T")[0], dateNepali: "", partyId: certPartyId, section: "88K", tdsRate: 1.5 } as any,
                        certParty,
                        companySettings as any,
                      );
                      const url = URL.createObjectURL(blob);
                      const win = window.open(url);
                      if (win) win.focus();
                    } catch (e: any) {
                      toast.error("Could not generate certificate: " + e.message);
                    }
                  }}
                  className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-semibold rounded-md hover:bg-[#0f4a96] flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Certificate
                </button>
              )}
            </div>
          </div>

          {certParty ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6 print-only" id="tds-certificate">
              {/* IRD Annex 10 Layout */}
              <div className="border-b-2 border-gray-800 pb-3 mb-4">
                <h2 className="text-[16px] font-black text-gray-900 text-center uppercase tracking-widest">
                  TDS Certificate (Annex 10)
                </h2>
                <p className="text-[11px] text-center text-gray-500 mt-0.5">
                  As per Income Tax Act 2058, Nepal
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div>
                  <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-2">Deductor (Company)</h4>
                  <p className="text-[13px] font-bold text-gray-800">{companySettings?.name}</p>
                  <p className="text-[12px] text-gray-600">{companySettings?.address}</p>
                  <p className="text-[12px] text-gray-600">PAN: {companySettings?.panNumber}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-2">Deductee (Party)</h4>
                  <p className="text-[13px] font-bold text-gray-800">{certParty.name}</p>
                  <p className="text-[12px] text-gray-600">{certParty.address || "—"}</p>
                  <p className="text-[12px] text-gray-600">PAN: {certParty.pan || "—"}</p>
                </div>
              </div>
              <div className="overflow-x-auto mb-4">
                <table className="data-table w-full text-left">
                  <thead>
                    <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase">Date (BS)</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase">Section</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase text-right">Gross Amount</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase text-center">Rate %</th>
                      <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase text-right">TDS Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certEntries.map((e, i) => (
                      <tr key={e.id} className={i % 2 === 0 ? "" : "bg-[#f7f9fc]"}>
                        <td className="px-3 py-[7px] text-[12px] text-gray-700">{e.dateNepali || formatADToBS(e.date)}</td>
                        <td className="px-3 py-[7px] text-[12px] text-gray-700">{e.section || e.tdsType}</td>
                        <td className="px-3 py-[7px] text-[12px] font-mono text-right">{fmt(e.grossAmount || 0)}</td>
                        <td className="px-3 py-[7px] text-[12px] text-center">{e.tdsRate || 0}%</td>
                        <td className="px-3 py-[7px] text-[12px] font-mono text-right text-red-600">{fmt(e.tdsAmount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                      <td colSpan={2} className="px-3 py-2 text-[12px]">TOTAL</td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right">{fmt(certGross)}</td>
                      <td></td>
                      <td className="px-3 py-2 text-[12px] font-mono text-right text-red-600">{fmt(certTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
                <div className="text-[11px] text-gray-500">
                  Certificate No: TDS-{certFY.replace("/", "")}-{certParty.code || "P"}-001
                </div>
                <div className="text-[11px] text-gray-500">
                  FY: {certFY} | Generated: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-[13px]">Select a party to preview the TDS Certificate (Annex 10)</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: TDS RETURN SUMMARY                                     */}
      {/* ============================================================ */}
      {activeTab === "return" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-[12px] font-bold text-gray-700">TDS Return Summary (Quarterly)</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Q1=Shrawan–Ashwin, Q2=Kartik–Poush, Q3=Magh–Baisakh, Q4=Jestha–Ashadh</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  {["Quarter", "Section", "No. of Txns", "Total Payment", "TDS Amount", "Deposited", "Balance"].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returnSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-400">
                      No TDS entries found.
                    </td>
                  </tr>
                ) : (
                  returnSummary.map((row, idx) => (
                    <tr key={row.key} className={`border-b border-gray-100 hover:bg-[#e8eeff] ${idx % 2 === 0 ? "" : "bg-[#f7f9fc]"}`}>
                      <td className="px-3 py-[7px] text-[12px] font-semibold text-gray-700">{row.quarter}</td>
                      <td className="px-3 py-[7px] text-[12px] text-gray-700">{row.section}</td>
                      <td className="px-3 py-[7px] text-[12px] text-center font-mono">{row.count}</td>
                      <td className="px-3 py-[7px] text-[12px] font-mono text-right">{fmt(row.gross)}</td>
                      <td className="px-3 py-[7px] text-[12px] font-mono text-right text-red-600 font-semibold">{fmt(row.tds)}</td>
                      <td className="px-3 py-[7px] text-[12px] font-mono text-right text-green-600">{fmt(row.deposited)}</td>
                      <td className={`px-3 py-[7px] text-[12px] font-mono text-right font-bold ${row.tds - row.deposited > 0 ? "text-red-600" : "text-gray-500"}`}>
                        {fmt(row.tds - row.deposited)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef1f8] border-t-2 border-[#c5cad8] font-bold">
                  <td colSpan={2} className="px-3 py-2 text-[12px]">TOTAL</td>
                  <td className="px-3 py-2 text-[12px] text-center font-mono">
                    {returnSummary.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right">
                    {fmt(returnSummary.reduce((s, r) => s + r.gross, 0))}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-red-600">
                    {fmt(returnSummary.reduce((s, r) => s + r.tds, 0))}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-green-600">
                    {fmt(returnSummary.reduce((s, r) => s + r.deposited, 0))}
                  </td>
                  <td className="px-3 py-2 text-[12px] font-mono text-right text-red-600">
                    {fmt(returnSummary.reduce((s, r) => s + (r.tds - r.deposited), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
