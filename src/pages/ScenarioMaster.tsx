import React, { useState } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "react-hot-toast";

const ScenarioMaster: React.FC = () => {
  const { scenarios, addScenario, updateScenario, deleteScenario } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    includeActuals: true,
    includeOptionalVouchers: false,
    includePostDatedVouchers: false,
    includeMemorandumVouchers: false,
    includeReversingJournals: false,
    applicablePeriodFrom: "",
    applicablePeriodTo: "",
    isActive: true,
  });

  const filteredScenarios = (scenarios || []).filter(
    (scenario) =>
      scenario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      includeActuals: true,
      includeOptionalVouchers: false,
      includePostDatedVouchers: false,
      includeMemorandumVouchers: false,
      includeReversingJournals: false,
      applicablePeriodFrom: "",
      applicablePeriodTo: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (scenario: any) => {
    setForm({
      name: scenario.name || "",
      description: scenario.description || "",
      includeActuals: scenario.includeActuals ?? true,
      includeOptionalVouchers: scenario.includeOptionalVouchers ?? false,
      includePostDatedVouchers: scenario.includePostDatedVouchers ?? false,
      includeMemorandumVouchers: scenario.includeMemorandumVouchers ?? false,
      includeReversingJournals: scenario.includeReversingJournals ?? false,
      applicablePeriodFrom: scenario.applicablePeriodFrom || "",
      applicablePeriodTo: scenario.applicablePeriodTo || "",
      isActive: scenario.isActive ?? true,
    });
    setSelected(scenario);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Scenario Name is required");
      return;
    }

    try {
      if (selected) {
        await updateScenario(selected.id, form);
        toast.success("Updated successfully");
      } else {
        await addScenario(form);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this scenario?")) {
      try {
        await deleteScenario(id);
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

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-2/3 border-r border-gray-200" : "w-full"}`}>
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Scenario Master</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Manage planning scenarios and projections</p>
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
              placeholder="Search scenarios..."
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
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Include Actuals</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Include Optional</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Applicable From</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredScenarios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No scenarios found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredScenarios.map((scenario, index) => (
                    <tr key={scenario.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{scenario.name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{scenario.includeActuals ? "Yes" : "No"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{scenario.includeOptionalVouchers ? "Yes" : "No"}</td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">{scenario.applicablePeriodFrom || "-"}</td>
                      <td className="px-3 py-2.5 text-[12px]">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${scenario.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {scenario.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => loadFormForEdit(scenario)}
                            className="p-1 text-gray-500 hover:text-[#1557b0] hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(scenario.id)}
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
              {selected ? "Alter Scenario" : "Create Scenario"}
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
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Scenario Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter name"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Description</label>
              <textarea
                className="px-2.5 py-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full min-h-[80px] resize-y"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>

            <div className="space-y-2.5">
              {[
                { label: "Include Actuals", key: "includeActuals" },
                { label: "Include Optional Vouchers", key: "includeOptionalVouchers" },
                { label: "Include Post-Dated Vouchers", key: "includePostDatedVouchers" },
                { label: "Include Memorandum Vouchers", key: "includeMemorandumVouchers" },
                { label: "Include Reversing Journals", key: "includeReversingJournals" },
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

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Applicable From</label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.applicablePeriodFrom}
                  onChange={(e) => setForm({ ...form, applicablePeriodFrom: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">Applicable To</label>
                <input
                  type="date"
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  value={form.applicablePeriodTo}
                  onChange={(e) => setForm({ ...form, applicablePeriodTo: e.target.value })}
                />
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

export default ScenarioMaster;
