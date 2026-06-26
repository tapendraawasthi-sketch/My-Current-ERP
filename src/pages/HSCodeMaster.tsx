import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";

const HSCodeMaster: React.FC = () => {
  const { hsCodes, addHSCode, updateHSCode, deleteHSCode } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    code: "",
    description: "",
    vatRate: "13",
    customsDutyRate: "",
    exempted: false,
    effectiveDate: "",
    isActive: true,
  });

  const filteredCodes = (hsCodes || []).filter(
    (code) =>
      code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      code: "",
      description: "",
      vatRate: "13",
      customsDutyRate: "",
      exempted: false,
      effectiveDate: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (code: any) => {
    setForm({
      code: code.code || "",
      description: code.description || "",
      vatRate: code.vatRate || "13",
      customsDutyRate: code.customsDutyRate || "",
      exempted: code.exempted ?? false,
      effectiveDate: code.effectiveDate || "",
      isActive: code.isActive ?? true,
    });
    setSelected(code);
    setShowForm(true);
  };

  const handleExemptedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setForm(prev => ({
      ...prev,
      exempted: checked,
      vatRate: checked ? "0" : prev.vatRate
    }));
  };

  const handleSubmit = async () => {
    if (!form.code.trim()) {
      toast.error("HS Code is required");
      return;
    }
    if (!/^\d{6,8}$/.test(form.code)) {
      toast.error("HS Code must be 6-8 digits only");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Description is required");
      return;
    }

    try {
      if (selected) {
        await updateHSCode(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addHSCode(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this HS Code?")) {
      try {
        await deleteHSCode(id);
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

  const getVatRateLabel = (rate: string) => {
    return rate === "0" ? "0% (Exempt/Zero-Rated)" : "13% (Standard VAT)";
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">HS Code Master (Nepal Customs / IRD)</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage customs classifications and tax rates</p>
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
            <p className="text-[11px] italic text-gray-600 bg-gray-100 py-1.5 px-3 rounded inline-block">
              Nepal HS Codes (6-8 digits) are used for customs classification. VAT rate is either 0% or 13% (Nepal VAT Act).
            </p>
          </div>

          <div className="mb-4">
            <input
              type="text"
              placeholder="Search HS codes..."
              className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto border border-gray-200 rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200 sticky top-0 z-10">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">HS Code</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">VAT Rate</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Exempted</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No HS codes found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredCodes.map((code, index) => (
                    <tr key={code.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-mono font-medium">{code.code}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{code.description}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{getVatRateLabel(code.vatRate)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{code.exempted ? "Yes" : "No"}</td>
                      <td className="px-3 py-2.5 text-[12px]">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {code.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(code)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(code.id)}
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
        <div className="w-full lg:w-96 bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-800">
              {selected ? "Alter HS Code" : "Create HS Code"}
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
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">HS Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] font-mono border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
                placeholder="Enter 6-8 digit code"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Description <span className="text-red-500">*</span></label>
              <textarea
                className="px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full min-h-[60px] resize-y"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">VAT Rate</label>
                <select
                  className={`h-8 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full ${form.exempted ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
                  value={form.vatRate}
                  onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                  disabled={form.exempted}
                >
                  <option value="0">0% (Exempt/Zero-Rated)</option>
                  <option value="13">13% (Standard VAT)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Customs Duty Rate %</label>
                <input
                  type="number"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.customsDutyRate}
                  onChange={(e) => setForm({ ...form, customsDutyRate: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder="e.g. 10.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Effective Date</label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2.5 mt-2 border-t border-gray-100 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="exempted"
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                  checked={form.exempted}
                  onChange={handleExemptedChange}
                />
                <label htmlFor="exempted" className="text-[12px] text-gray-700 cursor-pointer select-none">
                  Exempted from VAT
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label htmlFor="isActive" className="text-[12px] text-gray-700 cursor-pointer select-none">
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

export default HSCodeMaster;
