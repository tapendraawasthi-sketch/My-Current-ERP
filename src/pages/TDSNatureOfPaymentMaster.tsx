import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "@/lib/appToast";
import { generateId } from "../lib/db";
import { NEPAL_TDS_RATES_2081_82 } from "../lib/tdsNepal";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const TDSNatureOfPaymentMaster: React.FC = () => {
  const {
    tdsNatureOfPayment,
    addTDSNatureOfPayment,
    updateTDSNatureOfPayment,
    deleteTDSNatureOfPayment,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sectionCode: "",
    tdsRate: 0,
    panNotAvailableRate: 0,
    thresholdAmount: 0,
    effectiveDate: "",
    isActive: true,
  });

  // Seeding logic
  useEffect(() => {
    if ((tdsNatureOfPayment || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = NEPAL_TDS_RATES_2081_82.map((rate) => ({
        name: rate.description,
        sectionCode: rate.sectionCode,
        tdsRate: rate.rate || 0,
        panNotAvailableRate: (rate.rate || 0) * 1.5, // approximate placeholder
        thresholdAmount: rate.thresholdAmount,
        isActive: true,
      }));

      seedData.forEach(async (item) => {
        await addTDSNatureOfPayment({
          ...item,
          branchId: readActiveBranchId() || undefined,
        });
      });
      // toast.success("Default TDS Nature of Payment entries seeded.");
    }
  }, [tdsNatureOfPayment, seedDone, addTDSNatureOfPayment]);

  const filteredPayments = (tdsNatureOfPayment || []).filter(
    (payment) =>
      matchBranch((payment as any).branchId) &&
      (payment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.sectionCode.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const resetForm = () => {
    setForm({
      name: "",
      sectionCode: "",
      tdsRate: 0,
      panNotAvailableRate: 0,
      thresholdAmount: 0,
      effectiveDate: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (payment: any) => {
    setForm({
      name: payment.name || "",
      sectionCode: payment.sectionCode || "",
      tdsRate: payment.tdsRate || 0,
      panNotAvailableRate: payment.panNotAvailableRate || 0,
      thresholdAmount: payment.thresholdAmount || 0,
      effectiveDate: payment.effectiveDate || "",
      isActive: payment.isActive ?? true,
    });
    setSelected(payment);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.sectionCode.trim()) {
      toast.error("Section Code is required");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: selected?.branchId || readActiveBranchId() || undefined,
      };
      if (selected) {
        await updateTDSNatureOfPayment(selected.id, payload);
        toast.success("Updated successfully");
      } else {
        await addTDSNatureOfPayment(payload);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this TDS Nature of Payment?")) return;
    const row = (tdsNatureOfPayment || []).find((p) => p.id === id);
    if (!row) return;
    const snapshot = { ...row };
    try {
      await deleteTDSNatureOfPayment(id);
      if (selected && selected.id === id) {
        resetForm();
      }
      toast.undo(`"${row.name}" deleted`, async () => {
        try {
          await addTDSNatureOfPayment({ ...snapshot });
        } catch (error) {
          console.error("Restore error:", error);
          toast.error("An error occurred while restoring.");
        }
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 xl:w-3/4 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">
                TDS Nature of Payment Master (Nepal ITA 2058)
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage TDS rates, sections, and thresholds
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branchOptions.length > 0 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
                  aria-label="Branch"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name || b.code || b.id}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                <Plus size={14} />
                Add New
              </button>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[11px] italic text-gray-600 bg-gray-100 py-1.5 px-3 rounded inline-block">
              Nepal TDS is governed by Income Tax Act 2058. Rates are set by IRD (Inland Revenue
              Department). Section 88: resident payments, Section 88K: bank interest, Section 107:
              non-resident payments.
            </p>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search natures..."
              className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Section
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    TDS Rate %
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    PAN N/A Rate
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Threshold (NPR)
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No TDS payments found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment, index) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                        {payment.name}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {payment.sectionCode}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {payment.tdsRate}%
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {payment.panNotAvailableRate}%
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono text-right">
                        {payment.thresholdAmount ? payment.thresholdAmount.toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${payment.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                        >
                          {payment.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(payment)}
                            className="p-1 text-gray-500 hover:text-[var(--ds-action-primary)] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="w-full lg:w-[350px] xl:w-[400px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-700">
              {selected ? "Alter TDS Nature of Payment" : "Create TDS Nature of Payment"}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter name (e.g. Contract/Consultancy)"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Section Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.sectionCode}
                onChange={(e) => setForm({ ...form, sectionCode: e.target.value })}
                placeholder="Enter section (e.g. 88, 88K)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  TDS Rate % <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.tdsRate}
                  onChange={(e) => setForm({ ...form, tdsRate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  placeholder="e.g. 1.5"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  PAN N/A Rate %
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.panNotAvailableRate}
                  onChange={(e) =>
                    setForm({ ...form, panNotAvailableRate: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="0.01"
                  placeholder="e.g. 3.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Threshold (NPR)
                </label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.thresholdAmount}
                  onChange={(e) =>
                    setForm({ ...form, thresholdAmount: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  step="any"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Effective Date
                </label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="rounded border-gray-200 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)] h-3.5 w-3.5 cursor-pointer"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label
                  htmlFor="isActive"
                  className="text-[12px] text-gray-700 cursor-pointer select-none"
                >
                  Is Active
                </label>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-lg hover:bg-gray-50"
              onClick={resetForm}
            >
              Cancel
            </button>
            <button
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
              onClick={handleSubmit}
            >
              <Save size={14} />
              {selected ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TDSNatureOfPaymentMaster;
