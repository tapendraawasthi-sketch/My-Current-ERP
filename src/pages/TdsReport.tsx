// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { FileSpreadsheet, FileCheck, X } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { exportTdsReturnToExcel } from "../lib/exportUtils";
import { VoucherType, VoucherStatus } from "../lib/types";
import toast from "react-hot-toast";
import { ReportEmptyState } from "../components/ReportEmptyState";

const inputCls =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full";
const labelCls = "block text-[11px] font-medium text-gray-600 mb-1";
const btnPrimary =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";

const statusBadgeCls = (status?: string) => {
  if (status === "challanGenerated") return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-700";
};

export default function TdsReport() {
  const {
    tdsEntries,
    updateTdsEntry,
    currentFiscalYear,
    companySettings,
    addTdsChallan,
    accounts,
    addVoucher,
    setCurrentPage,
  } = useStore();

  const [fiscalYearBS, setFiscalYearBS] = useState(currentFiscalYear?.fiscalYearBS || "2081/2082");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showChallanModal, setShowChallanModal] = useState(false);
  const [challanEntryId, setChallanEntryId] = useState("");
  const [challanNo, setChallanNo] = useState("");
  const [challanDateBS, setChallanDateBS] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [fromBS, setFromBS] = useState("");
  const [toBS, setToBS] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  const filteredEntries = useMemo(() => {
    return tdsEntries.filter((entry) => {
      const matchFY = entry.fiscalYearBS === fiscalYearBS;
      const matchSection = sectionFilter === "All" || entry.section === sectionFilter;
      const matchStatus =
        statusFilter === "All" ||
        entry.status === statusFilter ||
        (!entry.status && statusFilter === "pending");
      return matchFY && matchSection && matchStatus;
    });
  }, [tdsEntries, fiscalYearBS, sectionFilter, statusFilter]);

  const groupedBySection = useMemo(() => {
    const groups: Record<string, typeof filteredEntries> = {};
    filteredEntries.forEach((entry) => {
      const sec = entry.section || "Other";
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const uniqueSections = useMemo(() => {
    const secs = new Set(tdsEntries.map((e) => e.section || "Other"));
    return ["All", ...Array.from(secs)];
  }, [tdsEntries]);

  const handleExport = () => {
    try {
      exportTdsReturnToExcel(filteredEntries, fiscalYearBS, companySettings?.name || "Company");
      toast.success("TDS Return Excel generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  };

  const openChallanModal = (id: string) => {
    setChallanEntryId(id);
    setChallanNo("");
    setChallanDateBS("");
    setBankName("");
    setBankBranch("");
    setFromBS("");
    setToBS("");
    setBankAccountId("");
    setShowChallanModal(true);
  };

  const saveChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanNo || !challanDateBS || !bankAccountId || !fromBS || !toBS) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      const entry = tdsEntries.find((e) => e.id === challanEntryId);
      if (!entry) throw new Error("Entry not found");

      const tdsPayableId =
        accounts.find((a) => a.name?.toLowerCase().includes("tds") && a.type === "liability")?.id ||
        "acc-tds-payable";
      const bankAcc = accounts.find((a) => a.id === bankAccountId);

      const paymentVoucher = {
        id: "pv-" + Date.now(),
        type: VoucherType.PAYMENT,
        voucherNo: "PV-" + Math.floor(Math.random() * 10000),
        date: new Date().toISOString().split("T")[0],
        dateNepali: challanDateBS,
        narration: `TDS Deposit to IRD for ${entry.partyName}`,
        status: VoucherStatus.POSTED,
        lines: [
          {
            accountId: tdsPayableId,
            accountName: "TDS Payable",
            debit: entry.tdsAmount,
            credit: 0,
          },
          {
            accountId: bankAccountId,
            accountName: bankAcc?.name,
            debit: 0,
            credit: entry.tdsAmount,
          },
        ],
        tdsChallanNo: challanNo,
        tdsChallanDateBS: challanDateBS,
        createdAt: new Date().toISOString(),
      };

      await addVoucher(paymentVoucher);

      const newChallan = {
        id: crypto.randomUUID(),
        challanNo,
        dateBS: challanDateBS,
        dateNepali: challanDateBS,
        bankName,
        bankBranch,
        amount: entry.tdsAmount,
        fiscalYearBS,
        fromBS,
        toBS,
        createdAt: new Date().toISOString(),
      };
      await addTdsChallan(newChallan);

      await updateTdsEntry(challanEntryId, {
        challanNumber: challanNo,
        status: "challanGenerated",
        depositedAt: new Date().toISOString(),
      });

      toast.success("TDS Payment recorded and Challan generated successfully");
      setShowChallanModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save challan");
    }
  };

  const { totalGross, totalTds, totalNet } = useMemo(() => {
    const round2 = (num: number) => Math.round((Number(num) || 0) * 100) / 100;
    return filteredEntries.reduce(
      (acc, e) => ({
        totalGross: round2(acc.totalGross + Number(e.grossAmount || 0)),
        totalTds: round2(acc.totalTds + Number(e.tdsAmount || 0)),
        totalNet: round2(acc.totalNet + Number(e.netAmount || 0)),
      }),
      { totalGross: 0, totalTds: 0, totalNet: 0 },
    );
  }, [filteredEntries]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f5f6fa] overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">TDS register</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Section-wise TDS records for Income Tax Act 2058
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage("tds-certificate")}
            className={btnOutline}
          >
            <FileCheck className="h-3.5 w-3.5" />
            TDS certificate
          </button>
          <button type="button" onClick={handleExport} className={btnPrimary}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export TDS return
          </button>
        </div>
      </div>

      <div className="no-print bg-white border border-gray-200 rounded-md p-3 mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className={labelCls}>Fiscal year (BS)</label>
            <input
              type="text"
              value={fiscalYearBS}
              onChange={(e) => setFiscalYearBS(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Section</label>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className={inputCls}
            >
              {uniqueSections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputCls}
            >
              <option value="All">All statuses</option>
              <option value="pending">Pending</option>
              <option value="challanGenerated">Challan generated</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          {filteredEntries.length} TDS entr{filteredEntries.length === 1 ? "y" : "ies"}
        </p>
      </div>

      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Total gross
            </p>
            <p className="text-[14px] font-semibold text-gray-800 mt-0.5 font-mono">
              Rs. {formatNumber(totalGross)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Total TDS deducted
            </p>
            <p className="text-[14px] font-semibold text-red-700 mt-0.5 font-mono">
              Rs. {formatNumber(totalTds)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              Total net paid
            </p>
            <p className="text-[14px] font-semibold text-green-700 mt-0.5 font-mono">
              Rs. {formatNumber(totalNet)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.keys(groupedBySection).length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md">
            <ReportEmptyState
              message="No TDS entries found"
              hint="Adjust fiscal year, section, or status filters."
            />
          </div>
        ) : (
          Object.keys(groupedBySection).map((sec) => {
            const entries = groupedBySection[sec];
            const secGross = entries.reduce((acc, e) => acc + e.grossAmount, 0);
            const secTds = entries.reduce((acc, e) => acc + e.tdsAmount, 0);
            const secNet = entries.reduce((acc, e) => acc + e.netAmount, 0);

            return (
              <div
                key={sec}
                className="bg-white border border-gray-200 rounded-md overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-gray-200 bg-[#f5f6fa] flex justify-between items-center">
                  <h3 className="text-[12px] font-semibold text-gray-800">Section {sec}</h3>
                  <span className="text-[11px] text-gray-500">
                    {entries.length} entr{entries.length === 1 ? "y" : "ies"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Date (BS)
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Party
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          PAN
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Payment nature
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Gross amount
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          TDS rate
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          TDS amount
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Net paid
                        </th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Challan no.
                        </th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-28">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="group hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[#1557b0] border-b border-gray-100"
                        >
                          <td className="px-3 py-2.5 text-[12px] text-gray-700">{entry.dateBS}</td>
                          <td className="px-3 py-2.5 text-[12px] font-medium text-gray-800">
                            {entry.partyName}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] font-mono text-gray-700">
                            {entry.partyPAN || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700">
                            {entry.paymentNature}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                            Rs.{formatNumber(entry.grossAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                            {entry.tdsRate}%
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] font-medium text-red-700">
                            Rs.{formatNumber(entry.tdsAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] text-gray-700">
                            Rs.{formatNumber(entry.netAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadgeCls(entry.status)}`}
                            >
                              {entry.status || "pending"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[12px] font-mono text-gray-700">
                            {entry.challanNumber || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {(!entry.status || entry.status === "pending") && (
                              <button
                                type="button"
                                onClick={() => openChallanModal(entry.id)}
                                className="h-7 px-2 bg-white border border-gray-300 text-gray-700 text-[11px] font-medium rounded-md hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Generate challan
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                        <td colSpan={4} className="px-3 py-2.5 text-right text-gray-800">
                          Section {sec} total
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-800">
                          Rs.{formatNumber(secGross)}
                        </td>
                        <td />
                        <td className="px-3 py-2.5 text-right font-mono text-red-700">
                          Rs.{formatNumber(secTds)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-green-700">
                          Rs.{formatNumber(secNet)}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                  {entries.length} record{entries.length === 1 ? "" : "s"} in section {sec}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showChallanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowChallanModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-md shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-[#f5f6fa] flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-[#1557b0]" />
                Generate challan
              </h2>
              <button
                type="button"
                onClick={() => setShowChallanModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveChallan} className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Challan number *</label>
                <input
                  type="text"
                  value={challanNo}
                  onChange={(e) => setChallanNo(e.target.value)}
                  className={inputCls}
                  placeholder="Enter challan number"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>Challan date (BS) *</label>
                <input
                  type="text"
                  value={challanDateBS}
                  onChange={(e) => setChallanDateBS(e.target.value)}
                  className={inputCls}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <label className={labelCls}>Payment bank account *</label>
                <select
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select bank account</option>
                  {accounts
                    .filter(
                      (a) =>
                        a.type === "bank" ||
                        a.type === "cash" ||
                        a.group?.toLowerCase().includes("bank"),
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Depositing bank name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Nabil Bank"
                  />
                </div>
                <div>
                  <label className={labelCls}>Bank branch</label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Kathmandu"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Period from (BS) *</label>
                  <input
                    type="text"
                    value={fromBS}
                    onChange={(e) => setFromBS(e.target.value)}
                    className={inputCls}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div>
                  <label className={labelCls}>Period to (BS) *</label>
                  <input
                    type="text"
                    value={toBS}
                    onChange={(e) => setToBS(e.target.value)}
                    className={inputCls}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                <button type="button" onClick={() => setShowChallanModal(false)} className={btnOutline}>
                  Cancel
                </button>
                <button type="submit" className={btnPrimary}>
                  Save challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
