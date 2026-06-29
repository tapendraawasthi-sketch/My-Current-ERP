import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";
import { generateId } from "../lib/db";

const VATClassificationMaster: React.FC = () => {
  const {
    vatClassifications,
    addVATClassification,
    updateVATClassification,
    deleteVATClassification,
  } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    taxability: "",
    vatRate: 0,
    inputOutput: "both",
    effectiveDate: "",
    isActive: true,
  });

  // Seeding logic
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
        { name: "Non-VAT", vatRate: 0, taxability: "non_vat", inputOutput: "both", isActive: true },
      ];

      seedData.forEach(async (item) => {
        await addVATClassification(item);
      });
      // toast.success("Default VAT classifications seeded.");
    }
  }, [vatClassifications, seedDone, addVATClassification]);

  const filteredClassifications = (vatClassifications || []).filter(
    (cls) =>
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.taxability.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const resetForm = () => {
    setForm({
      name: "",
      taxability: "",
      vatRate: 0,
      inputOutput: "both",
      effectiveDate: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
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
        await updateVATClassification(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addVATClassification(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this VAT classification?")) {
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
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
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
              <button
                className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
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
            <input
              type="text"
              placeholder="Search classifications..."
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Taxability
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    VAT Rate %
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Input/Output
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClassifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No VAT classifications found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredClassifications.map((classification, index) => (
                    <tr key={classification.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                        {classification.name}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {getTaxabilityLabel(classification.taxability)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {classification.vatRate}%
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {getInputOutputLabel(classification.inputOutput)}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${classification.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                        >
                          {classification.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(classification)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(classification.id)}
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
        <div className="w-full lg:w-[400px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Alter VAT Classification" : "Create VAT Classification"}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Classification Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter name"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Taxability <span className="text-red-500">*</span>
                </label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.taxability}
                  onChange={handleTaxabilityChange}
                >
                  <option value="">-- Select --</option>
                  <option value="taxable">Taxable</option>
                  <option value="exempt">Exempt</option>
                  <option value="zero_rated">Zero Rated</option>
                  <option value="non_vat">Non-VAT</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  VAT Rate %
                </label>
                <div className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-gray-100 flex items-center justify-end text-gray-600">
                  {form.vatRate}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Input/Output
                </label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.inputOutput}
                  onChange={(e) => setForm({ ...form, inputOutput: e.target.value })}
                >
                  <option value="input">Input</option>
                  <option value="output">Output</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Effective Date
                </label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
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
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
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
              className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
              onClick={resetForm}
            >
              Cancel
            </button>
            <button
              className="h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5"
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

export default VATClassificationMaster;
