import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";

const VoucherTypeMaster: React.FC = () => {
  const { voucherTypeMasters, addVoucherTypeMaster, updateVoucherTypeMaster, deleteVoucherTypeMaster } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    name: "",
    type: "",
    abbreviation: "",
    numberingMethod: "automatic",
    startingNumber: 1,
    prefix: "",
    suffix: "",
    restartNumbering: "never",
    printAfterSaving: false,
    allowNarration: true,
    allowOptionalVoucher: false,
    allowPostDatedVoucher: false,
    preventDuplicateNumbers: false,
    isActive: true,
  });

  const filteredTypes = (voucherTypeMasters || []).filter(
    (vt) =>
      vt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vt.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      name: "",
      type: "",
      abbreviation: "",
      numberingMethod: "automatic",
      startingNumber: 1,
      prefix: "",
      suffix: "",
      restartNumbering: "never",
      printAfterSaving: false,
      allowNarration: true,
      allowOptionalVoucher: false,
      allowPostDatedVoucher: false,
      preventDuplicateNumbers: false,
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (typeRecord: any) => {
    setForm({
      name: typeRecord.name || "",
      type: typeRecord.type || "",
      abbreviation: typeRecord.abbreviation || "",
      numberingMethod: typeRecord.numberingMethod || "automatic",
      startingNumber: typeRecord.startingNumber || 1,
      prefix: typeRecord.prefix || "",
      suffix: typeRecord.suffix || "",
      restartNumbering: typeRecord.restartNumbering || "never",
      printAfterSaving: typeRecord.printAfterSaving ?? false,
      allowNarration: typeRecord.allowNarration ?? true,
      allowOptionalVoucher: typeRecord.allowOptionalVoucher ?? false,
      allowPostDatedVoucher: typeRecord.allowPostDatedVoucher ?? false,
      preventDuplicateNumbers: typeRecord.preventDuplicateNumbers ?? false,
      isActive: typeRecord.isActive ?? true,
    });
    setSelected(typeRecord);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Voucher Type Name is required");
      return;
    }
    if (!form.type) {
      toast.error("Type of Voucher is required");
      return;
    }

    try {
      if (selected) {
        await updateVoucherTypeMaster(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addVoucherTypeMaster(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this voucher type?")) {
      try {
        await deleteVoucherTypeMaster(id);
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sales": return "Sales";
      case "purchase": return "Purchase";
      case "payment": return "Payment";
      case "receipt": return "Receipt";
      case "contra": return "Contra";
      case "journal": return "Journal";
      case "debit_note": return "Debit Note";
      case "credit_note": return "Credit Note";
      case "stock_journal": return "Stock Journal";
      default: return type;
    }
  };

  const getNumberingLabel = (method: string) => {
    switch (method) {
      case "automatic": return "Automatic";
      case "manual": return "Manual";
      case "none": return "None";
      default: return method;
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Voucher Type Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage voucher types and numbering schemes</p>
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
              placeholder="Search voucher types..."
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
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Abbreviation</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Numbering Method</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTypes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No voucher types found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredTypes.map((typeRecord, index) => (
                    <tr key={typeRecord.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{typeRecord.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{getTypeLabel(typeRecord.type)}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{typeRecord.abbreviation || "-"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{getNumberingLabel(typeRecord.numberingMethod)}</td>
                      <td className="px-3 py-2.5 text-[12px]">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${typeRecord.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {typeRecord.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(typeRecord)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(typeRecord.id)}
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
              {selected ? "Alter Voucher Type" : "Create Voucher Type"}
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
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Voucher Type Name <span className="text-red-500">*</span></label>
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
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Type of Voucher <span className="text-red-500">*</span></label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="">-- Select Type --</option>
                  <option value="sales">Sales</option>
                  <option value="purchase">Purchase</option>
                  <option value="payment">Payment</option>
                  <option value="receipt">Receipt</option>
                  <option value="contra">Contra</option>
                  <option value="journal">Journal</option>
                  <option value="debit_note">Debit Note</option>
                  <option value="credit_note">Credit Note</option>
                  <option value="stock_journal">Stock Journal</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Abbreviation</label>
                <input
                  type="text"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full uppercase"
                  value={form.abbreviation}
                  onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                  placeholder="e.g. SL"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Method of Numbering</label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.numberingMethod}
                  onChange={(e) => setForm({ ...form, numberingMethod: e.target.value })}
                >
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                  <option value="none">None</option>
                </select>
              </div>
              
              {form.numberingMethod === "automatic" && (
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">Starting Number</label>
                  <input
                    type="number"
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={form.startingNumber}
                    onChange={(e) => setForm({ ...form, startingNumber: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>
              )}
            </div>

            {form.numberingMethod === "automatic" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 mb-1 block">Prefix</label>
                    <input
                      type="text"
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                      value={form.prefix}
                      onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                      placeholder="e.g. INV/"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 mb-1 block">Suffix</label>
                    <input
                      type="text"
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                      value={form.suffix}
                      onChange={(e) => setForm({ ...form, suffix: e.target.value })}
                      placeholder="e.g. /23-24"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">Restart Numbering</label>
                  <select
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                    value={form.restartNumbering}
                    onChange={(e) => setForm({ ...form, restartNumbering: e.target.value })}
                  >
                    <option value="never">Never</option>
                    <option value="yearly">Yearly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </>
            )}

            <div className="mt-2 space-y-2.5">
              {[
                { label: "Print After Saving", key: "printAfterSaving" },
                { label: "Allow Narration", key: "allowNarration" },
                { label: "Allow Optional Voucher", key: "allowOptionalVoucher" },
                { label: "Allow Post-Dated Voucher", key: "allowPostDatedVoucher" },
                { label: "Prevent Duplicate Numbers", key: "preventDuplicateNumbers" },
                { label: "Is Active", key: "isActive" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={item.key}
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0] h-3.5 w-3.5 cursor-pointer"
                    checked={(form as any)[item.key]}
                    onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                  />
                  <label htmlFor={item.key} className="text-[12px] text-gray-700 cursor-pointer select-none">
                    {item.label}
                  </label>
                </div>
              ))}
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

export default VoucherTypeMaster;
