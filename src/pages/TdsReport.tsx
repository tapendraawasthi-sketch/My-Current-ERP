import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { FileText, Download, CheckSquare, FileCheck } from "lucide-react";
import { useStore } from "../store/useStore";
import { PartySelect, Button } from "../components/ui";
import { generateTDSCertificate } from "../lib/tdsCertificate";
import toast from "react-hot-toast";

export default function TdsReport() {
  const {
    tdsEntries,
    parties,
    companySettings,
    reportFilters: { startDate, endDate },
  } = useStore();

  const [filters, setFilters] = useState({
    startDate: startDate || "",
    endDate: endDate || "",
    tdsType: "",
    party: "",
    status: "All",
  });
  const [selectedPartyFilter, setSelectedPartyFilter] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [quarterFilter, setQuarterFilter] = useState("all");
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositData, setDepositData] = useState({ challanNo: "", depositDate: "" });
  const totalDeducted = tdsEntries.reduce((sum, e) => sum + e.tdsAmount, 0);
  const totalDeposited = tdsEntries
    .filter((e) => e.deposited)
    .reduce((sum, e) => sum + e.tdsAmount, 0);
  const totalPending = tdsEntries
    .filter((e) => !e.deposited)
    .reduce((sum, e) => sum + e.tdsAmount, 0);

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
      alert("Please select entries to deposit");
      return;
    }
    setShowDepositModal(true);
  };

  const confirmDeposit = () => {
    if (!depositData.challanNo || !depositData.depositDate) {
      alert("Please enter Challan No and Deposit Date");
      return;
    }
    alert(`${selectedEntries.size} entries marked as deposited`);
    setShowDepositModal(false);
    setSelectedEntries(new Set());
    setDepositData({ challanNo: "", depositDate: "" });
  };

  const exportAnnex = (type: "11A" | "12B") => {
    alert(`Exporting Annex ${type} in IRD-compatible format`);
  };

  return (
    <div className="space-y-6">
      <ActionToolbar title="TDS Report" subtitle="Tax Deducted at Source register" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">TDS Report</h1>
        <div className="flex space-x-2">
          {selectedPartyFilter && (
            <Button
              variant="outline"
              size="sm"
              icon={<FileText className="h-4 w-4" />}
              onClick={() => {
                const party = parties.find((p) => p.id === selectedPartyFilter);
                if (!party) {
                  toast.error("Select a party first");
                  return;
                }
                const partyEntries = tdsEntries.filter(
                  (e) =>
                    e.partyId === selectedPartyFilter && e.date >= startDate && e.date <= endDate,
                );
                if (!partyEntries.length) {
                  toast.error("No TDS entries for selected party/period");
                  return;
                }
                generateTDSCertificate({
                  party,
                  entries: partyEntries,
                  period: { startDate, endDate },
                  settings: companySettings,
                });
              }}
            >
              Generate TDS Certificate
            </Button>
          )}
          <button
            onClick={() => exportAnnex("11A")}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Annex 11A</span>
          </button>
          <button
            onClick={() => exportAnnex("12B")}
            className="btn-primary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export Annex 12B</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total TDS Deducted</p>
              <p className="text-2xl font-bold text-gray-900">
                Rs. {totalDeducted.toLocaleString()}
              </p>
            </div>
            <FileText className="w-12 h-12 text-[#1557b0]" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Deposited</p>
              <p className="text-2xl font-bold text-green-600">
                Rs. {totalDeposited.toLocaleString()}
              </p>
            </div>
            <CheckSquare className="w-12 h-12 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pending</p>
              <p className="text-2xl font-bold text-orange-600">
                Rs. {totalPending.toLocaleString()}
              </p>
            </div>
            <FileCheck className="w-12 h-12 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">TDS Type</label>
            <select
              value={filters.tdsType}
              onChange={(e) => setFilters({ ...filters, tdsType: e.target.value })}
              className="input"
            >
              <option value="">All Types</option>
              <option value="194C">194C - Contractor</option>
              <option value="194J">194J - Professional</option>
              <option value="194H">194H - Commission</option>
              <option value="194I">194I - Rent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party</label>
            <PartySelect
              value={selectedPartyFilter}
              onChange={(val) => {
                setSelectedPartyFilter(val);
                const matched = parties.find((p) => p.id === val);
                setFilters({ ...filters, party: matched ? matched.name : "" });
              }}
              placeholder="Select party"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="All">All</option>
              <option value="Deposited">Deposited</option>
              <option value="Pending">Pending</option>
            </select>
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
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex items-center justify-between">
          <span className="text-sm text-indigo-900">{selectedEntries.size} entries selected</span>
          <button onClick={handleBulkDeposit} className="btn-primary">
            Mark as Deposited
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-2 py-3">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Party Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  PAN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  TDS Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Section
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Gross Amt
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Rate %
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  TDS Amt
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Net Amt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Deposit Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Challan
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tdsEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-2 py-4">
                    <input
                      type="checkbox"
                      checked={selectedEntries.has(entry.id)}
                      onChange={() => toggleSelection(entry.id)}
                      className="rounded border-gray-300"
                      disabled={entry.deposited}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(entry.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{entry.partyName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.partyPan || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{entry.tdsType}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.section || "88"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 amt">
                    {entry.grossAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 amt">
                    {entry.tdsRate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 amt">
                    {entry.tdsAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 amt">
                    {entry.netAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        entry.deposited
                          ? "bg-green-100 text-green-800"
                          : "bg-orange-100 text-orange-800"
                      }`}
                    >
                      {entry.deposited ? "Deposited" : "Pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.depositDate ? new Date(entry.depositDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.depositChallanNo || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        const party = parties.find((p) => p.id === entry.partyId);
                        if (!party) {
                          toast.error("Deductee party not found");
                          return;
                        }
                        generateTDSCertificate({
                          party,
                          entries: [entry],
                          period: { startDate: entry.date, endDate: entry.date },
                          settings: companySettings,
                        });
                      }}
                      className="text-[#1557b0] hover:text-indigo-900"
                    >
                      Certificate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                  className="input"
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
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowDepositModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button onClick={confirmDeposit} className="btn-primary">
                Confirm Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
