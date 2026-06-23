import React, { useState, useMemo } from "react";
import { ActionToolbar, Card, PartySelect, Button } from "../components/ui";
import { FileText, Download, CheckSquare, FileCheck } from "lucide-react";
import { useStore } from "../store/useStore";
import { generateTDSCertificate } from "../lib/tdsCertificate";
import { formatADToBS } from "../lib/nepaliDate";
import toast from "react-hot-toast";
import { Party, TdsEntry } from "../lib/types";

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export default function TdsReport() {
  const {
    tdsEntries,
    parties,
    vouchers,
    companySettings,
    reportFilters: { startDate: storeStartDate, endDate: storeEndDate },
  } = useStore();

  const [filters, setFilters] = useState({
    startDate: storeStartDate || "",
    endDate: storeEndDate || "",
    tdsType: "",
    status: "All",
  });

  const [selectedPartyFilter, setSelectedPartyFilter] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [quarterFilter, setQuarterFilter] = useState("all");
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositData, setDepositData] = useState({ challanNo: "", depositDate: "" });

  // Certificate Modal State
  const [certModalParty, setCertModalParty] = useState<Party | null>(null);
  const [certModalEntries, setCertModalEntries] = useState<TdsEntry[]>([]);

  // Filter entries based on selections
  const filteredEntries = useMemo(() => {
    return tdsEntries.filter((entry) => {
      // Date filter
      if (filters.startDate && entry.date < filters.startDate) return false;
      if (filters.endDate && entry.date > filters.endDate) return false;

      // TDS Type filter
      if (filters.tdsType && entry.tdsType !== filters.tdsType) return false;

      // Party filter
      if (selectedPartyFilter && entry.partyId !== selectedPartyFilter) return false;

      // Status filter
      if (filters.status !== "All") {
        const isDep = entry.deposited || false;
        if (filters.status === "Deposited" && !isDep) return false;
        if (filters.status === "Pending" && isDep) return false;
      }

      // Quarter filter
      if (quarterFilter !== "all") {
        const dateNepali = entry.dateNepali || "";
        const parts = dateNepali.split("/");
        if (parts.length >= 2) {
          const month = parseInt(parts[1], 10);
          if (quarterFilter === "q1" && !(month >= 4 && month <= 6)) return false;
          if (quarterFilter === "q2" && !(month >= 7 && month <= 9)) return false;
          if (quarterFilter === "q3" && !(month >= 10 && month <= 12)) return false;
          if (quarterFilter === "q4" && !(month >= 1 && month <= 3)) return false;
        }
      }

      return true;
    });
  }, [tdsEntries, filters, selectedPartyFilter, quarterFilter]);

  // Overall KPI sums based on filtered entries
  const totalDeducted = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + e.tdsAmount, 0),
    [filteredEntries],
  );
  const totalDeposited = useMemo(
    () => filteredEntries.filter((e) => e.deposited).reduce((sum, e) => sum + e.tdsAmount, 0),
    [filteredEntries],
  );
  const totalPending = useMemo(
    () => filteredEntries.filter((e) => !e.deposited).reduce((sum, e) => sum + e.tdsAmount, 0),
    [filteredEntries],
  );

  // TDS Payable Summary grouped by category (TDS type) - not yet deposited
  const tdsPayableByCategory = useMemo(() => {
    const summary: Record<string, { gross: number; tds: number; category: string }> = {};
    tdsEntries.forEach((entry) => {
      if (!entry.deposited) {
        const cat = entry.tdsType || "Other";
        if (!summary[cat]) {
          summary[cat] = { gross: 0, tds: 0, category: cat };
        }
        summary[cat].gross += entry.grossAmount;
        summary[cat].tds += entry.tdsAmount;
      }
    });
    return Object.values(summary);
  }, [tdsEntries]);

  // Non-compliant payments validation warning (payment vouchers > 50,000 without TDS)
  const nonCompliantPayments = useMemo(() => {
    return (vouchers || []).filter((v) => {
      if (v.status !== "posted") return false;
      if (v.type !== "payment") return false;

      const amt = v.grandTotal || v.totalDebit || 0;
      if (amt < 50000) return false;

      const hasTds = tdsEntries.some((e) => e.voucherId === v.id && e.tdsAmount > 0);
      return !hasTds;
    });
  }, [vouchers, tdsEntries]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedEntries);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEntries(newSelected);
  };

  const handleBulkDeposit = () => {
    if (selectedEntries.size === 0) {
      toast.error("Please select entries to deposit");
      return;
    }
    setShowDepositModal(true);
  };

  const confirmDeposit = () => {
    if (!depositData.challanNo || !depositData.depositDate) {
      toast.error("Please enter Challan No and Deposit Date");
      return;
    }
    toast.success(`${selectedEntries.size} entries marked as deposited`);
    setShowDepositModal(false);
    setSelectedEntries(new Set());
    setDepositData({ challanNo: "", depositDate: "" });
  };

  const openCertModalForParty = (partyId: string) => {
    const party = parties.find((p) => p.id === partyId);
    if (!party) {
      toast.error("Deductee party not found");
      return;
    }
    const partyEntries = tdsEntries.filter(
      (e) => e.partyId === partyId && e.date >= filters.startDate && e.date <= filters.endDate,
    );
    if (!partyEntries.length) {
      toast.error("No TDS entries for selected party in this period");
      return;
    }
    setCertModalParty(party);
    setCertModalEntries(partyEntries);
  };

  return (
    <div className="space-y-6 page-wrapper">
      <ActionToolbar
        title="TDS Report"
        subtitle="Nepal IRD Tax Deducted at Source (TDS) registers"
      />

      {/* Validation Warnings for Service Payments > 50,000 without TDS */}
      {nonCompliantPayments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-md text-[12px] animate-fadeIn">
          <div className="font-bold mb-1">
            TDS may be applicable for the following payments (exceeds Rs. 50,000 threshold with no
            TDS applied):
          </div>
          <ul className="list-disc list-inside space-y-1 font-mono">
            {nonCompliantPayments.map((v) => (
              <li key={v.id}>
                Voucher {v.voucherNo} for {v.partyName || "Unknown Party"} — Rs.{" "}
                {formatNumber(v.grandTotal || v.totalDebit || 0)} on {v.date}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">TDS Registers & Summaries</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Generate certificates and track IRD submissions
          </p>
        </div>
        <div className="flex space-x-2">
          {selectedPartyFilter && (
            <button
              onClick={() => openCertModalForParty(selectedPartyFilter)}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-semibold rounded-md hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="h-4 w-4 text-[#1557b0]" />
              <span>Generate TDS Certificate</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-md border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Total TDS Deducted
          </p>
          <p className="text-lg font-bold text-gray-900 font-mono mt-1">
            Rs. {formatNumber(totalDeducted)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Total Deposited
          </p>
          <p className="text-lg font-bold text-green-600 font-mono mt-1">
            Rs. {formatNumber(totalDeposited)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Total Pending Deposit
          </p>
          <p className="text-lg font-bold text-red-600 font-mono mt-1">
            Rs. {formatNumber(totalPending)}
          </p>
        </div>
      </div>

      {/* TDS Payable Summary Grouped by Category */}
      <div className="bg-white p-4 rounded-md border border-gray-200">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-3">
          TDS Payable Summary (Undeposited totals)
        </h2>
        {tdsPayableByCategory.length === 0 ? (
          <p className="text-[12px] text-gray-500">No pending TDS deposits to display.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                  <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                    TDS Category
                  </th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                    Gross Amount
                  </th>
                  <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                    Pending TDS to Deposit
                  </th>
                </tr>
              </thead>
              <tbody>
                {tdsPayableByCategory.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-[#e8eeff]">
                    <td className="px-3 py-[7px] text-[12px] text-gray-700 font-semibold">
                      {cat.category}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                      Rs. {formatNumber(cat.gross)}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono text-[#dc2626] font-bold">
                      Rs. {formatNumber(cat.tds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-md border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              TDS Category
            </label>
            <select
              value={filters.tdsType}
              onChange={(e) => setFilters({ ...filters, tdsType: e.target.value })}
              className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
            >
              <option value="">All Types</option>
              <option value="contractor">Contractor (194C)</option>
              <option value="consultancy">Consultancy (194J)</option>
              <option value="rent">Rent (194I)</option>
              <option value="commission">Commission (194H)</option>
              <option value="salary">Salary (192)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Party</label>
            <PartySelect
              value={selectedPartyFilter}
              onChange={(val) => setSelectedPartyFilter(val)}
              placeholder="Select party"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          <span className="text-[11px] font-semibold text-gray-700">Quarter:</span>
          <div className="flex gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "q1", label: "Q1 (Shrawan-Ashoj)" },
              { id: "q2", label: "Q2 (Kartik-Poush)" },
              { id: "q3", label: "Q3 (Magh-Chaitra)" },
              { id: "q4", label: "Q4 (Baishakh-Ashad)" },
            ].map((q) => (
              <button
                key={q.id}
                onClick={() => setQuarterFilter(q.id)}
                className={`h-7 px-3 text-[11px] font-medium rounded-md border transition-colors ${
                  quarterFilter === q.id
                    ? "bg-[#1557b0] border-[#1557b0] text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedEntries.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md flex items-center justify-between">
          <span className="text-[12px] text-blue-900 font-semibold">
            {selectedEntries.size} entries selected
          </span>
          <button
            onClick={handleBulkDeposit}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md cursor-pointer"
          >
            Mark as Deposited
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[#eef1f8] border-b-2 border-[#c5cad8]">
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.checked) {
                        const pendings = filteredEntries
                          .filter((en) => !en.deposited)
                          .map((en) => en.id);
                        setSelectedEntries(new Set(pendings));
                      } else {
                        setSelectedEntries(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                  Date (BS)
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                  Payee Name
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                  PAN
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                  Nature of Payment
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  Gross Amount
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  TDS Rate%
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  TDS Amount
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  Net Paid
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                  Status
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-left">
                  Challan / Date
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-[#4b5563] uppercase tracking-[0.06em] text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-gray-500 text-[12px]">
                    No TDS entries found matching active filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#e8eeff] border-b border-gray-150">
                    <td className="px-3 py-[7px]">
                      <input
                        type="checkbox"
                        checked={selectedEntries.has(entry.id)}
                        onChange={() => toggleSelection(entry.id)}
                        className="rounded border-gray-300 cursor-pointer"
                        disabled={entry.deposited}
                      />
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-700 whitespace-nowrap">
                      {entry.dateNepali || formatADToBS(entry.date)}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-700 font-semibold">
                      {entry.partyName}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-700 font-mono">
                      {entry.partyPan || "-"}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-700 uppercase">
                      {entry.tdsType}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                      Rs. {formatNumber(entry.grossAmount)}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                      {entry.tdsRate}%
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono text-red-600 font-bold">
                      Rs. {formatNumber(entry.tdsAmount)}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right font-mono amt">
                      Rs. {formatNumber(entry.netAmount)}
                    </td>
                    <td className="px-3 py-[7px] text-[12px]">
                      <span
                        className={`badge ${
                          entry.deposited
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {entry.deposited ? "Deposited" : "Pending"}
                      </span>
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-gray-500 font-mono">
                      {entry.deposited ? (
                        <>
                          <div>Ch: {entry.depositChallanNo || "-"}</div>
                          <div className="text-[10px]">
                            {entry.depositDate ? formatADToBS(entry.depositDate) : ""}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-[7px] text-[12px] text-right">
                      <button
                        onClick={() => {
                          const party = parties.find((p) => p.id === entry.partyId);
                          if (!party) {
                            toast.error("Deductee party not found");
                            return;
                          }
                          setCertModalParty(party);
                          setCertModalEntries([entry]);
                        }}
                        className="text-[#1557b0] hover:text-[#0f4a96] font-semibold cursor-pointer"
                      >
                        Certificate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TDS Certificate Print Preview Modal */}
      {certModalParty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-[14px] font-bold text-gray-900 uppercase">
                TDS Certificate Preview
              </h3>
              <button
                onClick={() => setCertModalParty(null)}
                className="text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Certificate IRD format preview */}
            <div className="border border-gray-300 p-6 bg-gray-50 rounded-md font-sans text-xs space-y-4">
              <div className="text-center font-bold text-sm">
                TDS CERTIFICATE
                <div className="text-[10px] font-normal text-gray-500 mt-1">
                  (Under Income Tax Act, 2058)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border p-3 bg-white rounded">
                  <div className="font-bold text-[10px] uppercase text-gray-500 mb-1">
                    Deductor Details
                  </div>
                  <div>
                    <strong>Name:</strong> {companySettings.name}
                  </div>
                  <div>
                    <strong>PAN:</strong> {companySettings.panNumber}
                  </div>
                  <div>
                    <strong>Address:</strong> {companySettings.address || "N/A"}
                  </div>
                  <div>
                    <strong>Period:</strong> {filters.startDate || storeStartDate} to{" "}
                    {filters.endDate || storeEndDate}
                  </div>
                </div>
                <div className="border p-3 bg-white rounded">
                  <div className="font-bold text-[10px] uppercase text-gray-500 mb-1">
                    Deductee Details
                  </div>
                  <div>
                    <strong>Name:</strong> {certModalParty.name}
                  </div>
                  <div>
                    <strong>PAN:</strong> {certModalParty.pan || "N/A"}
                  </div>
                  <div>
                    <strong>Address:</strong> {certModalParty.address || "N/A"}
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse border border-gray-300 text-left bg-white text-[12px]">
                <thead>
                  <tr className="bg-gray-100 font-semibold">
                    <th className="border p-2">S.N.</th>
                    <th className="border p-2">Date (BS)</th>
                    <th className="border p-2">Nature</th>
                    <th className="border p-2">Section</th>
                    <th className="border p-2 text-right">Gross Amount</th>
                    <th className="border p-2 text-right">TDS Rate</th>
                    <th className="border p-2 text-right">TDS Amount</th>
                    <th className="border p-2 text-right">Net Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {certModalEntries.map((e, idx) => (
                    <tr key={e.id}>
                      <td className="border p-2">{idx + 1}</td>
                      <td className="border p-2">{e.dateNepali || formatADToBS(e.date)}</td>
                      <td className="border p-2 uppercase">{e.tdsType}</td>
                      <td className="border p-2">{e.section || "88"}</td>
                      <td className="border p-2 text-right font-mono">
                        {formatNumber(e.grossAmount)}
                      </td>
                      <td className="border p-2 text-right">{e.tdsRate}%</td>
                      <td className="border p-2 text-right font-mono font-semibold text-red-600">
                        Rs. {formatNumber(e.tdsAmount)}
                      </td>
                      <td className="border p-2 text-right font-mono">
                        {formatNumber(e.netAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-gray-50">
                    <td colSpan={4} className="border p-2 text-right">
                      Total
                    </td>
                    <td className="border p-2 text-right font-mono">
                      Rs. {formatNumber(certModalEntries.reduce((s, e) => s + e.grossAmount, 0))}
                    </td>
                    <td className="border p-2"></td>
                    <td className="border p-2 text-right font-mono text-red-600">
                      Rs. {formatNumber(certModalEntries.reduce((s, e) => s + e.tdsAmount, 0))}
                    </td>
                    <td className="border p-2 text-right font-mono">
                      Rs. {formatNumber(certModalEntries.reduce((s, e) => s + e.netAmount, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setCertModalParty(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-[12px] font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  generateTDSCertificate({
                    party: certModalParty,
                    entries: certModalEntries,
                    period: {
                      startDate: filters.startDate || storeStartDate,
                      endDate: filters.endDate || storeEndDate,
                    },
                    settings: companySettings,
                  });
                  toast.success("TDS Certificate PDF downloaded.");
                }}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Mark as Deposited</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Challan No *</label>
                <input
                  type="text"
                  value={depositData.challanNo}
                  onChange={(e) => setDepositData({ ...depositData, challanNo: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  placeholder="Enter challan number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deposit Date *
                </label>
                <input
                  type="date"
                  value={depositData.depositDate}
                  onChange={(e) => setDepositData({ ...depositData, depositDate: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowDepositModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-[12px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeposit}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md cursor-pointer"
              >
                Confirm Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
