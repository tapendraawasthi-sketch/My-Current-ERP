import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save, Search } from "lucide-react";
import toast from "@/lib/appToast";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const th = "px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[11px] font-medium text-gray-600 mb-1 block";

const emptyForm = () => ({
  name: "",
  taxability: "",
  vatRate: 0,
  inputOutput: "both",
  effectiveDate: "",
  isActive: true,
});

const VATClassificationMaster: React.FC = () => {
  const {
    vatClassifications,
    addVATClassification,
    updateVATClassification,
    deleteVATClassification,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if ((vatClassifications || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        {
          name: "Taxable (13%)",
          vatRate: 13,
          taxability: "taxable",
          inputOutput: "both",
          isActive: true,
        },
        {
          name: "VAT Exempt",
          vatRate: 0,
          taxability: "exempt",
          inputOutput: "both",
          isActive: true,
        },
        {
          name: "Zero Rated",
          vatRate: 0,
          taxability: "zero_rated",
          inputOutput: "both",
          isActive: true,
        },
        {
          name: "Non-VAT",
          vatRate: 0,
          taxability: "non_vat",
          inputOutput: "both",
          isActive: true,
        },
      ];

      seedData.forEach(async (item) => {
        await addVATClassification(item);
      });
    }
  }, [vatClassifications, seedDone, addVATClassification]);

  const filteredClassifications = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = vatClassifications || [];
    return list.filter((cls) => {
      if (!matchBranch((cls as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return cls.name.toLowerCase().includes(q) || cls.taxability.toLowerCase().includes(q);
    });
  }, [vatClassifications, searchTerm, matchBranch, branchFilter]);

  const resetForm = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(false);
  };

  const openAdd = () => {
    setForm(emptyForm());
    setSelected(null);
    setShowForm(true);
  };

  const loadFormForEdit = (classification: any) => {
    setForm({
      name: classification.name || "",
      taxability: classification.taxability || "",
      vatRate: classification.vatRate || 0,
      inputOutput: classification.inputOutput || "both",
      effectiveDate: classification.effectiveDate || "",
      isActive: classification.isActive ?? true,
    });
    setSelected(classification);
    setShowForm(true);
  };

  const handleTaxabilityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    let rate = 0;
    if (value === "taxable") {
      rate = 13;
    }
    setForm({ ...form, taxability: value, vatRate: rate });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Classification Name is required");
      return;
    }
    if (!form.taxability) {
      toast.error("Taxability is required");
      return;
    }

    try {
      if (selected) {
        await updateVATClassification(selected.id, {
          ...form,
          branchId: selected.branchId || readActiveBranchId() || undefined,
        } as any);
        toast.success("Updated successfully");
      } else {
        await addVATClassification({
          ...form,
          branchId: readActiveBranchId() || undefined,
        } as any);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm("Delete this VAT classification?")) return;
    try {
      await deleteVATClassification(id);
      toast.success("Deleted");
      if (selected && selected.id === id) {
        resetForm();
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("An error occurred while deleting.");
    }
  };

  const getTaxabilityLabel = (taxability: string) => {
    switch (taxability) {
      case "taxable":
        return "Taxable";
      case "exempt":
        return "Exempt";
      case "zero_rated":
        return "Zero Rated";
      case "non_vat":
        return "Non-VAT";
      default:
        return taxability;
    }
  };

  const getInputOutputLabel = (io: string) => {
    switch (io) {
      case "input":
        return "Input";
      case "output":
        return "Output";
      case "both":
        return "Both";
      default:
        return io;
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[#f5f6fa]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">
                VAT Classification Master (Nepal)
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage tax classifications and nature of transactions
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branchOptions.length > 0 && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]"
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
              <button type="button" className={btnPrimary} onClick={openAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add classification
              </button>
            </div>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search classifications..."
              className={`${inputCls} pl-8`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredClassifications.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={
                  searchTerm
                    ? "No classifications match your search"
                    : "No VAT classifications found"
                }
                hint={
                  searchTerm
                    ? "Try a different search term."
                    : 'Click "Add classification" to create your first VAT classification.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className={th}>Name</th>
                    <th className={th}>Taxability</th>
                    <th className={`${th} text-right`}>VAT rate %</th>
                    <th className={th}>Input/output</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClassifications.map((classification) => (
                    <tr
                      key={classification.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                      onClick={() => loadFormForEdit(classification)}
                    >
                      <td className={`${td} font-medium text-gray-800`}>{classification.name}</td>
                      <td className={td}>
                        <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
                          {getTaxabilityLabel(classification.taxability)}
                        </span>
                      </td>
                      <td className={`${td} text-right font-mono`}>{classification.vatRate}%</td>
                      <td className={td}>{getInputOutputLabel(classification.inputOutput)}</td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            classification.isActive
                              ? "bg-[var(--ds-status-success-surface)] text-[var(--ds-status-success)]"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {classification.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadFormForEdit(classification);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDelete(classification.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[#f5f6fa] text-[11px] text-gray-500">
                {filteredClassifications.length} classification
                {filteredClassifications.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[400px] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-800">
              {selected ? "Edit VAT classification" : "Add VAT classification"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div>
              <label className={labelCls}>
                Classification name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter name"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Taxability <span className="text-red-500">*</span>
                </label>
                <select
                  className={inputCls}
                  value={form.taxability}
                  onChange={handleTaxabilityChange}
                >
                  <option value="">— Select —</option>
                  <option value="taxable">Taxable</option>
                  <option value="exempt">Exempt</option>
                  <option value="zero_rated">Zero Rated</option>
                  <option value="non_vat">Non-VAT</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>VAT rate %</label>
                <div className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-50 flex items-center justify-end font-mono text-gray-700">
                  {form.vatRate}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Input/output</label>
                <select
                  className={inputCls}
                  value={form.inputOutput}
                  onChange={(e) => setForm({ ...form, inputOutput: e.target.value })}
                >
                  <option value="input">Input</option>
                  <option value="output">Output</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Effective date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSubmit}>
              <Save className="h-3.5 w-3.5" />
              {selected ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VATClassificationMaster;
