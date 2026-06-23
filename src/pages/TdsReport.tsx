// @ts-nocheck
import React, { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { ActionToolbar, Card, Button, Select } from "../components/ui";
import { FileSpreadsheet, Layers, FileCheck } from "lucide-react";
import { formatNumber } from "../lib/utils";
import { exportTdsReturnToExcel } from "../lib/exportUtils";
import { PillTitle, FormPanel } from "../components/BusyShell";
import toast from "react-hot-toast";

export default function TdsReport() {
  const { tdsEntries, updateTdsEntry, currentFiscalYear, companySettings } = useStore();
  
  const [fiscalYearBS, setFiscalYearBS] = useState(currentFiscalYear?.bsYear || "2081/2082");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showChallanModal, setShowChallanModal] = useState(false);
  const [challanEntryId, setChallanEntryId] = useState("");
  const [challanNo, setChallanNo] = useState("");

  const filteredEntries = useMemo(() => {
    return tdsEntries.filter(entry => {
      const matchFY = entry.fiscalYearBS === fiscalYearBS;
      const matchSection = sectionFilter === "All" || entry.section === sectionFilter;
      const matchStatus = statusFilter === "All" || entry.status === statusFilter || (!entry.status && statusFilter === "pending");
      return matchFY && matchSection && matchStatus;
    });
  }, [tdsEntries, fiscalYearBS, sectionFilter, statusFilter]);

  // Group by section
  const groupedBySection = useMemo(() => {
    const groups: Record<string, typeof filteredEntries> = {};
    filteredEntries.forEach(entry => {
      const sec = entry.section || "Other";
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const uniqueSections = useMemo(() => {
    const secs = new Set(tdsEntries.map(e => e.section || "Other"));
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
    setShowChallanModal(true);
  };

  const saveChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challanNo) {
      toast.error("Please enter a Challan Number");
      return;
    }
    try {
      await updateTdsEntry(challanEntryId, {
        challanNumber: challanNo,
        status: "challanGenerated",
        depositedAt: new Date().toISOString()
      });
      toast.success("Challan generated successfully");
      setShowChallanModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save challan");
    }
  };

  let totalGross = 0;
  let totalTds = 0;
  let totalNet = 0;

  return (
    <div style={{ background: "#e8e4f0", padding: 12 }}>
      <PillTitle title="TDS Report" />
      <FormPanel>
        <div className="flex flex-col gap-6 animate-fadeIn select-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">TDS Register</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Section-wise TDS records for Income Tax Act 2058</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Export TDS Return
              </button>
            </div>
          </div>

          <Card border padding="md">
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <div className="grid gap-1">
                <label className="text-[11px] font-medium text-gray-600">Fiscal Year (BS)</label>
                <input
                  type="text"
                  value={fiscalYearBS}
                  onChange={e => setFiscalYearBS(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
                />
              </div>
              <Select
                label="Section"
                value={sectionFilter}
                onChange={setSectionFilter}
                options={uniqueSections.map(s => ({ value: s, label: s }))}
              />
              <Select
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "All", label: "All Status" },
                  { value: "pending", label: "Pending" },
                  { value: "challanGenerated", label: "Challan Generated" }
                ]}
              />
            </div>
          </Card>

          <div className="grid gap-6">
            {Object.keys(groupedBySection).length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-[12px] bg-white border border-gray-200 rounded-md">
                No TDS entries found for the selected filters.
              </div>
            ) : (
              Object.keys(groupedBySection).map(sec => {
                const entries = groupedBySection[sec];
                const secGross = entries.reduce((acc, e) => acc + e.grossAmount, 0);
                const secTds = entries.reduce((acc, e) => acc + e.tdsAmount, 0);
                const secNet = entries.reduce((acc, e) => acc + e.netAmount, 0);
                totalGross += secGross;
                totalTds += secTds;
                totalNet += secNet;

                return (
                  <Card key={sec} border padding="none" className="overflow-hidden">
                    <div className="bg-[#1e2433] px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="text-[13px] font-bold text-white">Section {sec}</h3>
                      <div className="text-[11px] font-medium text-gray-300">
                        {entries.length} Entries
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-[#f5f6fa] border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date (BS)</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Party</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">PAN</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Payment Nature</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Gross Amount</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">TDS Rate</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">TDS Amount</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-right">Net Paid</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Challan No</th>
                            <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {entries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-[12px] text-gray-700">{entry.dateBS}</td>
                              <td className="px-3 py-2 text-[12px] text-gray-700 font-medium">{entry.partyName}</td>
                              <td className="px-3 py-2 text-[12px] text-gray-700 font-mono">{entry.partyPAN || "-"}</td>
                              <td className="px-3 py-2 text-[12px] text-gray-700">{entry.paymentNature}</td>
                              <td className="px-3 py-2 text-[12px] text-gray-700 font-mono text-right">Rs.{formatNumber(entry.grossAmount)}</td>
                              <td className="px-3 py-2 text-[12px] text-gray-700 font-mono text-right">{entry.tdsRate}%</td>
                              <td className="px-3 py-2 text-[12px] text-red-600 font-mono font-bold text-right">Rs.{formatNumber(entry.tdsAmount)}</td>
                              <td className="px-3 py-2 text-[12px] text-gray-700 font-mono text-right">Rs.{formatNumber(entry.netAmount)}</td>
                              <td className="px-3 py-2 text-[12px]">
                                <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${
                                  entry.status === 'challanGenerated' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {entry.status || "pending"}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-[12px] text-gray-700 font-mono">{entry.challanNumber || "-"}</td>
                              <td className="px-3 py-2 text-[12px] text-center">
                                {(!entry.status || entry.status === "pending") && (
                                  <button
                                    onClick={() => openChallanModal(entry.id)}
                                    className="h-6 px-2 bg-white border border-gray-300 text-gray-700 text-[10px] font-medium rounded hover:bg-gray-50"
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
                            <td colSpan={4} className="px-3 py-2 text-[12px] font-bold text-gray-800 text-right">Section {sec} Total</td>
                            <td className="px-3 py-2 text-[12px] font-bold text-gray-800 font-mono text-right">Rs.{formatNumber(secGross)}</td>
                            <td></td>
                            <td className="px-3 py-2 text-[12px] font-bold text-red-700 font-mono text-right">Rs.{formatNumber(secTds)}</td>
                            <td className="px-3 py-2 text-[12px] font-bold text-green-700 font-mono text-right">Rs.{formatNumber(secNet)}</td>
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
            <div className="mt-4 bg-white border border-gray-200 rounded-md p-4 grid grid-cols-3 gap-4">
               <div className="bg-gray-50 p-3 rounded border border-gray-200">
                 <div className="text-[10px] uppercase font-bold text-gray-500">Total Gross Amount</div>
                 <div className="text-[16px] font-bold text-gray-800">Rs. {formatNumber(totalGross)}</div>
               </div>
               <div className="bg-red-50 p-3 rounded border border-red-200">
                 <div className="text-[10px] uppercase font-bold text-red-700">Total TDS Deducted</div>
                 <div className="text-[16px] font-bold text-red-800">Rs. {formatNumber(totalTds)}</div>
               </div>
               <div className="bg-green-50 p-3 rounded border border-green-200">
                 <div className="text-[10px] uppercase font-bold text-green-700">Total Net Paid</div>
                 <div className="text-[16px] font-bold text-green-800">Rs. {formatNumber(totalNet)}</div>
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
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveChallan} className="p-5">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <label className="text-[11px] font-medium text-gray-700">Challan Number *</label>
                  <input
                    type="text"
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                    placeholder="Enter Challan Number"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowChallanModal(false)}
                  className="h-8 px-4 text-[12px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 text-[12px] font-medium text-white bg-[#1557b0] rounded-md hover:bg-[#0f4a96] flex items-center gap-1.5 cursor-pointer"
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
