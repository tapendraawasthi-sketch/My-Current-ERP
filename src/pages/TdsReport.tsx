// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { ActionToolbar, Card, Button, Select } from "../components/ui";
import { FileSpreadsheet, Layers, FileCheck } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { exportTdsReturnToExcel } from "../lib/exportUtils";
import { PillTitle, FormPanel } from "../components/BusyShell";
import { VoucherType, VoucherStatus } from "../lib/types";
import toast from "react-hot-toast";

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

  // Group by section
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

      // 1. Create a payment voucher
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

      // 2. Add TDS Challan to Dexie
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

      // 3. Update entry status
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
    <div className="p-3 bg-[#f5f6fa] min-h-full">
      <PillTitle title="TDS Report" />
      <FormPanel>
        <div className="flex flex-col gap-6 animate-fadeIn select-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-[#000000]">TDS Register</h1>
              <p className="text-[11px] text-[#000000] mt-0.5">
                Section-wise TDS records for Income Tax Act 2058
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage("tds-certificate")}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="h-3.5 w-3.5" /> TDS Certificate
              </button>
              <button
                onClick={handleExport}
                className="h-8 px-3 bg-[#3D6B25] hover:bg-[#2D5A1A] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export TDS Return
              </button>
            </div>
          </div>

          <Card border padding="md">
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <div className="grid gap-1">
                <label className="text-[11px] font-medium text-[#000000]">Fiscal Year (BS)</label>
                <input
                  type="text"
                  value={fiscalYearBS}
                  onChange={(e) => setFiscalYearBS(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                />
              </div>
              <Select
                label="Section"
                value={sectionFilter}
                onChange={setSectionFilter}
                options={uniqueSections.map((s) => ({ value: s, label: s }))}
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "All", label: "All Status" },
                  { value: "pending", label: "Pending" },
                  { value: "challanGenerated", label: "Challan Generated" },
                ]}
              />
            </div>
          </Card>

          <div className="grid gap-6">
            {Object.keys(groupedBySection).length === 0 ? (
              <div className="p-8 text-center text-[#000000] text-[12px] bg-white border border-[#9DC07A] rounded-md">
                No TDS entries found for the selected filters.
              </div>
            ) : (
              Object.keys(groupedBySection).map((sec) => {
                const entries = groupedBySection[sec];
                const secGross = entries.reduce((acc, e) => acc + e.grossAmount, 0);
                const secTds = entries.reduce((acc, e) => acc + e.tdsAmount, 0);
                const secNet = entries.reduce((acc, e) => acc + e.netAmount, 0);

                return (
                  <Card key={sec} border padding="none" className="overflow-hidden">
                    <div className="bg-[#1557b0] px-3 py-2 text-white text-[12px] font-semibold flex justify-between items-center">
                      <h3 className="text-[13px] font-bold text-white">Section {sec}</h3>
                      <div className="text-[11px] font-medium text-white/80">
                        {entries.length} Entries
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-[#f5f6fa] border-b border-gray-200">
                          <tr>
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
                              Payment Nature
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                              Gross Amount
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                              TDS Rate
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                              TDS Amount
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">
                              Net Paid
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              Status
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                              Challan No
                            </th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-[#EBF5E2]/50">
                              <td className="px-3 py-2 text-[12px] text-[#000000]">
                                {entry.dateBS}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000] font-medium">
                                {entry.partyName}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000] font-mono">
                                {entry.partyPAN || "-"}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000]">
                                {entry.paymentNature}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000] font-mono text-right">
                                Rs.{formatNumber(entry.grossAmount)}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000] font-mono text-right">
                                {entry.tdsRate}%
                              </td>
                              <td className="px-3 py-2 text-[12px] text-red-600 font-mono font-bold text-right">
                                Rs.{formatNumber(entry.tdsAmount)}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000] font-mono text-right">
                                Rs.{formatNumber(entry.netAmount)}
                              </td>
                              <td className="px-3 py-2 text-[12px]">
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                                    entry.status === "challanGenerated"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {entry.status || "pending"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[12px] text-[#000000] font-mono">
                                {entry.challanNumber || "-"}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-center">
                                {(!entry.status || entry.status === "pending") && (
                                  <button
                                    onClick={() => openChallanModal(entry.id)}
                                    className="h-6 px-2 bg-white border border-[#9DC07A] text-[#000000] text-[10px] font-medium rounded hover:bg-[#EBF5E2]"
                                  >
                                    Generate Challan
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                          <tr>
                            <td
                              colSpan={4}
                              className="px-3 py-2 text-[12px] font-bold text-[#000000] text-right"
                            >
                              Section {sec} Total
                            </td>
                            <td className="px-3 py-2 text-[12px] font-bold text-[#000000] font-mono text-right">
                              Rs.{formatNumber(secGross)}
                            </td>
                            <td></td>
                            <td className="px-3 py-2 text-[12px] font-bold text-red-700 font-mono text-right">
                              Rs.{formatNumber(secTds)}
                            </td>
                            <td className="px-3 py-2 text-[12px] font-bold text-green-700 font-mono text-right">
                              Rs.{formatNumber(secNet)}
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {filteredEntries.length > 0 && (
            <div className="mt-4 bg-white border border-[#9DC07A] rounded-md p-4 grid grid-cols-3 gap-4">
              <div className="bg-[#EBF5E2] p-3 rounded border border-[#9DC07A]">
                <div className="text-[10px] uppercase font-bold text-[#000000]">
                  Total Gross Amount
                </div>
                <div className="text-[16px] font-bold text-[#000000]">
                  Rs. {formatNumber(totalGross)}
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <div className="text-[10px] uppercase font-bold text-red-700">
                  Total TDS Deducted
                </div>
                <div className="text-[16px] font-bold text-red-800">
                  Rs. {formatNumber(totalTds)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <div className="text-[10px] uppercase font-bold text-green-700">Total Net Paid</div>
                <div className="text-[16px] font-bold text-green-800">
                  Rs. {formatNumber(totalNet)}
                </div>
              </div>
            </div>
          )}
        </div>
      </FormPanel>

      {showChallanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#1e2433] px-4 py-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Generate Challan
              </h2>
              <button
                onClick={() => setShowChallanModal(false)}
                className="text-white hover:text-white/80 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveChallan} className="p-5">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-[#000000]">Challan Number *</label>
                  <input
                    type="text"
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    placeholder="Enter Challan Number"
                    autoFocus
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-[#000000]">
                    Challan Date (BS) *
                  </label>
                  <input
                    type="text"
                    value={challanDateBS}
                    onChange={(e) => setChallanDateBS(e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-[#000000]">
                    Payment Bank Account *
                  </label>
                  <select
                    value={bankAccountId}
                    onChange={(e) => setBankAccountId(e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                  >
                    <option value="">Select Bank Account</option>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1">
                    <label className="text-[11px] font-medium text-[#000000]">
                      Depositing Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                      placeholder="e.g. Nabil Bank"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-[11px] font-medium text-[#000000]">Bank Branch</label>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                      placeholder="e.g. Kathmandu"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1">
                    <label className="text-[11px] font-medium text-[#000000]">
                      Period From (BS) *
                    </label>
                    <input
                      type="text"
                      value={fromBS}
                      onChange={(e) => setFromBS(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-[11px] font-medium text-[#000000]">
                      Period To (BS) *
                    </label>
                    <input
                      type="text"
                      value={toBS}
                      onChange={(e) => setToBS(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[#9DC07A] rounded-md bg-white"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#9DC07A]">
                <button
                  type="button"
                  onClick={() => setShowChallanModal(false)}
                  className="h-8 px-4 text-[12px] font-medium text-[#000000] bg-white border border-[#9DC07A] rounded-md hover:bg-[#EBF5E2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 text-[12px] font-medium text-white bg-[#3D6B25] rounded-md hover:bg-[#2D5A1A] flex items-center gap-1.5 cursor-pointer"
                >
                  Save Challan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
