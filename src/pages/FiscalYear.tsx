import React, { useState } from "react";
import { Calendar, Plus, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { useStore } from "../store";
import { FiscalYearStatus } from "../lib/types";

export default function FiscalYear() {
  const {
    fiscalYears,
    addFiscalYear,
    closeFiscalYear,
    setCurrentFiscalYear,
    currentUser,
    companySettings,
  } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const seriesState: Record<string, { prefix: string; nextNumber: number }> = {};
    Object.entries(companySettings?.voucherSeries || {}).forEach(([key, val]) => {
      seriesState[key] = { prefix: val.prefix || "", nextNumber: 1 };
    });

    addFiscalYear({
      id: Date.now().toString(),
      ...formData,
      status: FiscalYearStatus.FUTURE,
      isCurrent: false,
      voucherSeriesState: seriesState,
    });
    setFormData({ name: "", startDate: "", endDate: "" });
    setShowForm(false);
  };

  const [closingFYId, setClosingFYId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const CLOSING_CHECKLIST = [
    { id: "bank", label: "All bank accounts reconciled" },
    { id: "stock", label: "Closing stock physically counted and valued" },
    { id: "depreciation", label: "Depreciation entries posted" },
    { id: "tds", label: "All TDS deposited with IRD" },
    { id: "vat", label: "VAT returns filed for all months" },
    { id: "trial", label: "Trial Balance tallied (Debit = Credit)" },
  ];

  const handleClose = (id: string) => {
    setClosingFYId(id);
    setChecklist({});
  };

  const handleSetActive = (id: string) => {
    if (confirm("Set this as the current fiscal year?")) {
      setCurrentFiscalYear(id);
    }
  };

  const getStatusBadge = (status: FiscalYearStatus) => {
    const classes = {
      [FiscalYearStatus.ACTIVE]: "badge badge-active",
      [FiscalYearStatus.CLOSED]: "badge badge-cancelled",
      [FiscalYearStatus.FUTURE]: "badge badge-draft",
    };
    const labels = {
      [FiscalYearStatus.ACTIVE]: "Active",
      [FiscalYearStatus.CLOSED]: "Closed",
      [FiscalYearStatus.FUTURE]: "Future",
    };
    return (
      <span className={classes[status] || "badge"}>
        {labels[status]}
      </span>
    );
  };

  const hasFutureFY = fiscalYears.some(fy => fy.status === FiscalYearStatus.FUTURE);

  return (
    <div className="flex flex-col gap-4 animate-fadeIn pb-4">
      {/* Standard Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Fiscal Year</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage accounting periods and year-end</p>
        </div>
        <div className="flex items-center gap-2">
          {!hasFutureFY && (
            <button
              onClick={() => {
                const lastFY = fiscalYears[fiscalYears.length - 1];
                let nextName = "FY 2081/82";
                let nextStart = "2027-07-16";
                let nextEnd = "2028-07-15";
                if (lastFY) {
                  const parts = lastFY.name.match(/\d+/g);
                  if (parts && parts.length >= 2) {
                    const startYear = parseInt(parts[0]) + 1;
                    const endYear = parseInt(parts[1]) + 1;
                    nextName = `FY ${startYear}/${String(endYear).slice(-2)}`;
                  }
                  const sD = new Date(lastFY.startDate);
                  sD.setFullYear(sD.getFullYear() + 1);
                  nextStart = sD.toISOString().split("T")[0];

                  const eD = new Date(lastFY.endDate);
                  eD.setFullYear(eD.getFullYear() + 1);
                  nextEnd = eD.toISOString().split("T")[0];
                }
                setFormData({ name: nextName, startDate: nextStart, endDate: nextEnd });
                setShowForm(true);
              }}
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 flex items-center gap-1 cursor-pointer"
            >
              Create Next Fiscal Year
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Fiscal Year
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-wrapper bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="form-header mb-4">
            <h2 className="text-[13px] font-bold text-gray-800">New Fiscal Year</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  placeholder="e.g., FY 2080/81"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-gray-700">End Date *</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md cursor-pointer"
              >
                Add Fiscal Year
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-1/4">Name</th>
              <th className="w-1/4">Start Date</th>
              <th className="w-1/4">End Date</th>
              <th className="w-1/8">Status</th>
              <th className="w-1/8 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {fiscalYears.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                  <p className="font-semibold text-[13px]">No fiscal years defined</p>
                  <p className="text-[11px] mt-1">Add your first fiscal year to get started</p>
                </td>
              </tr>
            ) : (
              fiscalYears.map((fy) => (
                <tr key={fy.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {fy.status === FiscalYearStatus.ACTIVE && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      <span className="font-medium text-gray-900">{fy.name}</span>
                    </div>
                  </td>
                  <td>{new Date(fy.startDate).toLocaleDateString()}</td>
                  <td>{new Date(fy.endDate).toLocaleDateString()}</td>
                  <td>{getStatusBadge(fy.status)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {fy.status === FiscalYearStatus.ACTIVE && (
                        <button
                          onClick={() => {
                            if (confirm("Closing FY will prevent new entries. P&L will be transferred to retained earnings. This cannot be undone. Proceed?")) {
                              handleClose(fy.id);
                            }
                          }}
                          className="h-6 px-2 text-[11px] font-medium border border-red-200 text-red-600 rounded bg-red-50 hover:bg-red-100 flex items-center gap-1 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Year End Closing</span>
                        </button>
                      )}
                      {fy.status === FiscalYearStatus.FUTURE && (
                        <button
                          onClick={() => handleSetActive(fy.id)}
                          className="h-6 px-2 text-[11px] font-medium border border-gray-300 text-[#1557b0] rounded bg-white hover:bg-gray-50 flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Set Active</span>
                        </button>
                      )}
                      {fy.status === FiscalYearStatus.CLOSED && (
                        <span className="text-gray-450 flex items-center gap-1 text-[11px]">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Closed</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-md">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[12px] font-bold text-amber-800">Important Notes</h3>
            <ul className="list-disc pl-4 mt-1 text-[11px] text-amber-700 space-y-1">
              <li>Only one fiscal year can be active at a time</li>
              <li>Closing a fiscal year will automatically create closing entries</li>
              <li>Ensure all transactions are posted before closing</li>
              <li>Closed fiscal years cannot be reopened</li>
            </ul>
          </div>
        </div>
      </div>

      {closingFYId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl border border-gray-200">
            <h3 className="text-[14px] font-bold text-gray-900 mb-1">Year-End Closing Checklist</h3>
            <p className="text-[11px] text-gray-500 mb-4">
              You must confirm and check all items before closing the fiscal year.
            </p>

            <div className="space-y-2 mb-4">
              {CLOSING_CHECKLIST.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2.5 p-2 rounded hover:bg-gray-50 cursor-pointer border border-gray-150 bg-white"
                >
                  <input
                    type="checkbox"
                    checked={!!checklist[item.id]}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, [item.id]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                  />
                  <span className="text-[12px] text-gray-700 font-medium">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setClosingFYId(null)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  Object.values(checklist).filter(Boolean).length !== CLOSING_CHECKLIST.length
                }
                onClick={async () => {
                  await closeFiscalYear(closingFYId, currentUser?.name || "admin");
                  setClosingFYId(null);
                }}
                className="h-8 px-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-[12px] font-medium rounded-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

