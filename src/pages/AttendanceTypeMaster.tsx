import React, { useState, useEffect } from "react";
import { useStore } from "../store";
import { Plus, Edit2, Trash2, X, Save } from "lucide-react";
import toast from "@/lib/appToast";
import { generateId } from "../lib/db";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const AttendanceTypeMaster: React.FC = () => {
  const {
    attendanceTypes,
    addAttendanceType,
    updateAttendanceType,
    deleteAttendanceType,
    payrollUnits,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [seedDone, setSeedDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    underTypeId: "",
    attendanceType: "",
    periodType: "daily",
    payrollUnitId: "",
    isActive: true,
  });

  // Seeding logic
  useEffect(() => {
    if ((attendanceTypes || []).length === 0 && !seedDone) {
      setSeedDone(true);
      const seedData = [
        {
          name: "Present",
          attendanceType: "attendance_leave_with_pay",
          periodType: "daily",
          isActive: true,
        },
        {
          name: "Absent",
          attendanceType: "leave_without_pay",
          periodType: "daily",
          isActive: true,
        },
        {
          name: "Paid Leave",
          attendanceType: "attendance_leave_with_pay",
          periodType: "daily",
          isActive: true,
        },
        {
          name: "Unpaid Leave",
          attendanceType: "leave_without_pay",
          periodType: "daily",
          isActive: true,
        },
        { name: "Overtime", attendanceType: "overtime", periodType: "hourly", isActive: true },
      ];

      seedData.forEach(async (item) => {
        await addAttendanceType(item);
      });
      // toast.success("Default Attendance Types seeded.");
    }
  }, [attendanceTypes, seedDone, addAttendanceType]);

  const filteredTypes = (attendanceTypes || []).filter(
    (type) =>
      matchBranch((type as any).branchId) &&
      (type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.attendanceType.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const resetForm = () => {
    setForm({
      name: "",
      underTypeId: "",
      attendanceType: "",
      periodType: "daily",
      payrollUnitId: "",
      isActive: true,
    });
    setSelected(null);
    setShowForm(false);
  };

  const loadFormForEdit = (type: any) => {
    setForm({
      name: type.name || "",
      underTypeId: type.underTypeId || "",
      attendanceType: type.attendanceType || "",
      periodType: type.periodType || "daily",
      payrollUnitId: type.payrollUnitId || "",
      isActive: type.isActive ?? true,
    });
    setSelected(type);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.attendanceType) {
      toast.error("Attendance Type is required");
      return;
    }

    try {
      const payload = {
        ...form,
        branchId: selected?.branchId || readActiveBranchId() || undefined,
      };
      if (selected) {
        await updateAttendanceType(selected.id, payload);
        toast.success("Updated successfully");
      } else {
        await addAttendanceType(payload);
        toast.success("Saved successfully");
      }
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An error occurred while saving.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this attendance type?")) return;
    const row = (attendanceTypes || []).find((t) => t.id === id);
    if (!row) return;
    const snapshot = { ...row };
    try {
      await deleteAttendanceType(id);
      if (selected && selected.id === id) {
        resetForm();
      }
      toast.undo(`"${row.name}" deleted`, async () => {
        try {
          await addAttendanceType({ ...snapshot });
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

  const getPeriodTypeLabel = (type: string) => {
    switch (type) {
      case "daily":
        return "Daily";
      case "hourly":
        return "Hourly";
      case "shift":
        return "Shift";
      case "unit_based":
        return "Unit Based";
      default:
        return type;
    }
  };

  const getDisplayTypeLabel = (type: string) => {
    switch (type) {
      case "attendance_leave_with_pay":
        return "Paid Leave";
      case "leave_without_pay":
        return "Unpaid Leave";
      case "production":
        return "Production";
      case "user_defined":
        return "User Defined";
      case "overtime":
        return "Overtime";
      default:
        return type;
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* List Panel */}
      <div
        className={`flex-1 flex flex-col ${showForm ? "hidden lg:flex lg:w-1/2 xl:w-2/3 border-r border-gray-200" : "w-full"}`}
      >
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">
                Attendance / Production Type Master
              </h1>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Manage types for daily attendance and production tracking
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
            <input
              type="text"
              placeholder="Search types..."
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
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Period Type
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
                {filteredTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No attendance types found. Click "Add New" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredTypes.map((type, index) => {
                    const parentType = (attendanceTypes || []).find(
                      (t) => t.id === type.underTypeId,
                    );
                    return (
                      <tr key={type.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{index + 1}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                          {type.name}
                          {parentType && (
                            <span className="text-gray-400 font-normal ml-1">
                              ({parentType.name})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {getDisplayTypeLabel(type.attendanceType)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {getPeriodTypeLabel(type.periodType)}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full ${type.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                          >
                            {type.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => loadFormForEdit(type)}
                              className="p-1 text-gray-500 hover:text-[var(--ds-action-primary)] hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(type.id)}
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="w-full lg:w-[380px] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-20">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="text-[13px] font-semibold text-gray-700">
              {selected ? "Alter Attendance Type" : "Create Attendance Type"}
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
                placeholder="Enter name (e.g. Present, Overtime)"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">Under Type</label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.underTypeId}
                onChange={(e) => setForm({ ...form, underTypeId: e.target.value })}
              >
                <option value="">-- None --</option>
                {(attendanceTypes || [])
                  .filter((t) => !selected || t.id !== selected.id) // Exclude self to prevent circular reference
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Attendance Type <span className="text-red-500">*</span>
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.attendanceType}
                onChange={(e) => setForm({ ...form, attendanceType: e.target.value })}
              >
                <option value="">-- Select Type --</option>
                <option value="attendance_leave_with_pay">Attendance/Leave with Pay</option>
                <option value="leave_without_pay">Leave without Pay</option>
                <option value="production">Production Based</option>
                <option value="user_defined">User Defined</option>
                <option value="overtime">Overtime</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                Period Type
              </label>
              <select
                className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                value={form.periodType}
                onChange={(e) => setForm({ ...form, periodType: e.target.value })}
              >
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
                <option value="shift">Shift</option>
                <option value="unit_based">Unit Based</option>
              </select>
            </div>

            {(form.periodType === "unit_based" || form.periodType === "hourly") && (
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Payroll Unit
                </label>
                <select
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                  value={form.payrollUnitId}
                  onChange={(e) => setForm({ ...form, payrollUnitId: e.target.value })}
                >
                  <option value="">-- None --</option>
                  {(payrollUnits || []).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.symbol} - {unit.formalName}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

export default AttendanceTypeMaster;
