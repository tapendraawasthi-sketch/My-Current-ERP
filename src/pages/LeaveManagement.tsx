// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "@/lib/appToast";
import { Calendar, Plus, Edit, Trash2, Check, X, XCircle } from "lucide-react";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const LeaveManagement: React.FC = () => {
  const { employees } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const [activeTab, setActiveTab] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [leaveFilter, setLeaveFilter] = useState({ month: "", employee: "", status: "all" });
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<any>(null);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: "",
    leaveTypeId: "",
    fromDate: new Date().toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
    reason: "",
  });

  const scopedEmployees = useMemo(
    () => (employees || []).filter((e) => matchBranch((e as { branchId?: string }).branchId)),
    [employees, matchBranch, branchFilter],
  );

  // Load data from DB
  useEffect(() => {
    const db = getDB();

    // Load leave types
    db.leaveTypes
      .toArray()
      .then((types) => {
        if (types.length === 0) {
          // Pre-seed with default types
          const defaultTypes = [
            {
              id: generateId(),
              name: "Earned Leave",
              daysPerYear: 15,
              carryForward: true,
              maxCarryForward: 15,
              isEncashable: true,
              encashmentRate: 1,
            },
            {
              id: generateId(),
              name: "Sick Leave",
              daysPerYear: 12,
              carryForward: false,
              maxCarryForward: 0,
              isEncashable: false,
              encashmentRate: 0,
            },
            {
              id: generateId(),
              name: "Casual Leave",
              daysPerYear: 6,
              carryForward: false,
              maxCarryForward: 0,
              isEncashable: false,
              encashmentRate: 0,
            },
            {
              id: generateId(),
              name: "Maternity Leave",
              daysPerYear: 98,
              carryForward: false,
              maxCarryForward: 0,
              isEncashable: false,
              encashmentRate: 0,
            },
            {
              id: generateId(),
              name: "Paternity Leave",
              daysPerYear: 15,
              carryForward: false,
              maxCarryForward: 0,
              isEncashable: false,
              encashmentRate: 0,
            },
            {
              id: generateId(),
              name: "Festival Leave",
              daysPerYear: 13,
              carryForward: false,
              maxCarryForward: 0,
              isEncashable: false,
              encashmentRate: 0,
            },
          ];
          db.leaveTypes.bulkAdd(defaultTypes);
          setLeaveTypes(defaultTypes);
        } else {
          setLeaveTypes(types);
        }
      })
      .catch(() => setLeaveTypes([]));

    // Load leave applications
    db.leaveApplications
      .toArray()
      .then((apps) => setLeaveApplications(apps))
      .catch(() => setLeaveApplications([]));
  }, []);

  // Handle form changes
  const handleFormChange = (field: string, value: any) => {
    setLeaveForm((prev) => ({ ...prev, [field]: value }));
  };

  // Submit leave application
  const handleSubmitLeave = async () => {
    if (
      !leaveForm.employeeId ||
      !leaveForm.leaveTypeId ||
      !leaveForm.fromDate ||
      !leaveForm.toDate ||
      !leaveForm.reason
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    // Calculate days (including weekends for simplicity)
    const from = new Date(leaveForm.fromDate);
    const to = new Date(leaveForm.toDate);
    const timeDiff = Math.abs(to.getTime() - from.getTime());
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    const db = getDB();
    const emp = (employees || []).find((e) => e.id === leaveForm.employeeId);
    const application = {
      id: generateId(),
      ...leaveForm,
      days,
      status: "pending",
      appliedDate: new Date().toISOString(),
      branchId:
        (emp as { branchId?: string } | undefined)?.branchId ||
        readActiveBranchId() ||
        undefined,
    };

    try {
      await db.leaveApplications.add(application);
      setLeaveApplications((prev) => [...prev, application]);
      setLeaveForm({
        employeeId: "",
        leaveTypeId: "",
        fromDate: new Date().toISOString().split("T")[0],
        toDate: new Date().toISOString().split("T")[0],
        reason: "",
      });
      toast.success("Leave application submitted successfully");
      setShowLeaveModal(false); // Only close modal if we used it, but here it submits the form directly from the tab
    } catch (error) {
      toast.error("Failed to submit leave application");
    }
  };

  // Update leave application status
  const updateLeaveStatus = async (id: string, status: string) => {
    const db = getDB();
    try {
      await db.leaveApplications.update(id, { status });
      setLeaveApplications((prev) => prev.map((app) => (app.id === id ? { ...app, status } : app)));
      toast.success(`Leave application ${status.toLowerCase()} successfully`);
    } catch (error) {
      toast.error(`Failed to ${status.toLowerCase()} leave application`);
    }
  };

  // Calculate leave balance
  const calculateLeaveBalance = (employeeId: string, leaveTypeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return { entitled: 0, taken: 0, balance: 0, encashable: 0 };

    const leaveType = leaveTypes.find((lt) => lt.id === leaveTypeId);
    if (!leaveType) return { entitled: 0, taken: 0, balance: 0, encashable: 0 };

    const entitled = leaveType.daysPerYear;
    const taken = leaveApplications
      .filter(
        (app) =>
          app.employeeId === employeeId &&
          app.leaveTypeId === leaveTypeId &&
          app.status === "approved",
      )
      .reduce((sum, app) => sum + app.days, 0);

    const balance = entitled - taken;
    const encashable = leaveType.isEncashable
      ? ((Math.max(0, balance) * (emp.salaryDetails?.basicSalary || emp.basicSalary || 0)) / 30) *
        leaveType.encashmentRate
      : 0;

    return { entitled, taken, balance, encashable: Math.round(encashable) };
  };

  // Filter applications based on criteria
  const filteredApplications = leaveApplications.filter((app) => {
    const emp = (employees || []).find((e) => e.id === app.employeeId);
    const appBranch =
      app.branchId || (emp as { branchId?: string } | undefined)?.branchId;
    if (!matchBranch(appBranch)) return false;
    const matchesMonth =
      !leaveFilter.month || new Date(app.fromDate).getMonth() === Number(leaveFilter.month) - 1;
    const matchesEmployee = !leaveFilter.employee || app.employeeId === leaveFilter.employee;
    const matchesStatus = leaveFilter.status === "all" || app.status === leaveFilter.status;
    return matchesMonth && matchesEmployee && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Leave Management</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Manage leave policies, applications, and employee balances
            </p>
          </div>
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
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm">
          {["Leave Policy", "Leave Ledger", "Apply Leave", "Leave Register"].map((tab, index) => (
            <button
              key={index}
              className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === index
                  ? "border-[var(--ds-action-primary)] text-[var(--ds-action-primary)]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-semibold text-gray-800">Leave Policy</h2>
              <button
                className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={() => {
                  setEditingLeaveType(null);
                  setShowLeaveModal(true);
                }}
              >
                <Plus size={14} />
                Add Leave Type
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Leave Type
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Days/Year
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Carry Forward
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Max Carry Forward
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Is Encashable
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Encashment Rate
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.map((type) => (
                    <tr key={type.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800 font-medium">
                        {type.name}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {type.daysPerYear}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {type.carryForward ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                            YES
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                            NO
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {type.maxCarryForward}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700">
                        {type.isEncashable ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                            YES
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-semibold">
                            NO
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                        {type.encashmentRate}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            className="text-[var(--ds-action-primary)] hover:text-[var(--ds-action-primary-hover)] transition-colors"
                            onClick={() => {
                              setEditingLeaveType(type);
                              setShowLeaveModal(true);
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-700 transition-colors"
                            onClick={async () => {
                              if (
                                window.confirm("Are you sure you want to delete this leave type?")
                              ) {
                                const db = getDB();
                                await db.leaveTypes.delete(type.id);
                                setLeaveTypes((prev) => prev.filter((t) => t.id !== type.id));
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leaveTypes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No leave policies found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="mb-6 max-w-sm">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Select Employee
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
              >
                <option value="">Select Employee</option>
                {scopedEmployees
                  .filter((e) => e.isActive)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
              </select>
            </div>

            {selectedEmployee ? (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Leave Type
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Entitled Days
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Days Taken
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Balance
                      </th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Encashable Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.map((type) => {
                      const balance = calculateLeaveBalance(selectedEmployee, type.id);
                      return (
                        <tr key={type.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-[12px] text-gray-800 font-medium">
                            {type.name}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {balance.entitled}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-red-600 font-medium text-right bg-red-50/30">
                            {balance.taken}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-green-700 font-medium text-right bg-green-50/30">
                            {balance.balance}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                            {balance.encashable > 0 ? balance.encashable.toLocaleString() : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-md">
                <p className="text-[13px] text-gray-500">
                  Select an employee to view their leave ledger
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 mb-4 max-w-3xl">
            <h2 className="text-[14px] font-semibold text-gray-800 mb-6 pb-2 border-b border-gray-100">
              Apply Leave
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={leaveForm.employeeId}
                  onChange={(e) => handleFormChange("employeeId", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                >
                  <option value="">Select Employee</option>
                  {scopedEmployees
                    .filter((e) => e.isActive)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={leaveForm.leaveTypeId}
                  onChange={(e) => handleFormChange("leaveTypeId", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  From Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={(e) => handleFormChange("fromDate", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  To Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={leaveForm.toDate}
                  onChange={(e) => handleFormChange("toDate", e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) => handleFormChange("reason", e.target.value)}
                  className="p-2 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full h-24 resize-none"
                  placeholder="Provide detailed reason for the leave application..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                className="h-8 px-6 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors shadow-sm"
                onClick={handleSubmitLeave}
              >
                Submit Leave Application
              </button>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4 mb-4 max-w-full overflow-auto">
            <div className="flex flex-wrap gap-4 mb-6">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Month</label>
                <select
                  value={leaveFilter.month}
                  onChange={(e) => setLeaveFilter((prev) => ({ ...prev, month: e.target.value }))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                >
                  <option value="">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2023, i, 1).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Employee</label>
                <select
                  value={leaveFilter.employee}
                  onChange={(e) =>
                    setLeaveFilter((prev) => ({ ...prev, employee: e.target.value }))
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                >
                  <option value="">All Employees</option>
                  {scopedEmployees
                    .filter((e) => e.isActive)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={leaveFilter.status}
                  onChange={(e) => setLeaveFilter((prev) => ({ ...prev, status: e.target.value }))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Employee Name
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Leave Type
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      From Date
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      To Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Days
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide max-w-xs">
                      Reason
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Approved By
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => {
                    const emp = employees.find((e) => e.id === app.employeeId);
                    const leaveType = leaveTypes.find((lt) => lt.id === app.leaveTypeId);

                    return (
                      <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-[12px] text-gray-800 font-medium">
                          {emp?.name || "Unknown"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {leaveType?.name || "Unknown"}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{app.fromDate}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">{app.toDate}</td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right">
                          {app.days}
                        </td>
                        <td
                          className="px-3 py-2.5 text-[12px] text-gray-600 truncate max-w-xs"
                          title={app.reason}
                        >
                          {app.reason}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                              app.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : app.status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {app.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] text-gray-700">
                          {app.approvedBy || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {app.status === "pending" && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="h-6 px-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-[11px] font-medium transition-colors"
                                onClick={() => updateLeaveStatus(app.id, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                className="h-6 px-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-[11px] font-medium transition-colors"
                                onClick={() => updateLeaveStatus(app.id, "rejected")}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredApplications.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-[12px] text-gray-500 text-center">
                        No leave applications found for the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Leave Type Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md shadow-xl border border-gray-200 w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-[#f5f6fa]">
              <h2 className="text-[15px] font-semibold text-gray-800">
                {editingLeaveType ? "Edit Leave Type" : "Add New Leave Type"}
              </h2>
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  setEditingLeaveType(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Leave Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingLeaveType?.name || ""}
                  onChange={(e) =>
                    setEditingLeaveType((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Days Per Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editingLeaveType?.daysPerYear || 0}
                  onChange={(e) =>
                    setEditingLeaveType((prev) => ({
                      ...prev,
                      daysPerYear: Number(e.target.value),
                    }))
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 mt-2">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="carryForward"
                    checked={editingLeaveType?.carryForward || false}
                    onChange={(e) =>
                      setEditingLeaveType((prev) => ({ ...prev, carryForward: e.target.checked }))
                    }
                    className="mr-2 h-3.5 w-3.5 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
                  />
                  <label htmlFor="carryForward" className="text-[12px] font-medium text-gray-700">
                    Carry Forward Balance to Next Year
                  </label>
                </div>

                {editingLeaveType?.carryForward && (
                  <div className="ml-5">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Max Carry Forward Days
                    </label>
                    <input
                      type="number"
                      value={editingLeaveType?.maxCarryForward || 0}
                      onChange={(e) =>
                        setEditingLeaveType((prev) => ({
                          ...prev,
                          maxCarryForward: Number(e.target.value),
                        }))
                      }
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 mt-2">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="isEncashable"
                    checked={editingLeaveType?.isEncashable || false}
                    onChange={(e) =>
                      setEditingLeaveType((prev) => ({ ...prev, isEncashable: e.target.checked }))
                    }
                    className="mr-2 h-3.5 w-3.5 text-[var(--ds-action-primary)] rounded border-gray-300 focus:ring-[var(--ds-action-primary)]"
                  />
                  <label htmlFor="isEncashable" className="text-[12px] font-medium text-gray-700">
                    Is Leave Encashable
                  </label>
                </div>

                {editingLeaveType?.isEncashable && (
                  <div className="ml-5">
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Encashment Rate (Factor)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingLeaveType?.encashmentRate || 0}
                      onChange={(e) =>
                        setEditingLeaveType((prev) => ({
                          ...prev,
                          encashmentRate: Number(e.target.value),
                        }))
                      }
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)] w-full"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setShowLeaveModal(false);
                  setEditingLeaveType(null);
                }}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md transition-colors"
                onClick={async () => {
                  if (!editingLeaveType?.name || editingLeaveType.daysPerYear < 0) {
                    toast.error("Please provide a valid name and days per year");
                    return;
                  }

                  const db = getDB();
                  if (editingLeaveType.id) {
                    // Update existing
                    await db.leaveTypes.update(editingLeaveType.id, editingLeaveType);
                    setLeaveTypes((prev) =>
                      prev.map((t) => (t.id === editingLeaveType.id ? editingLeaveType : t)),
                    );
                  } else {
                    // Add new
                    const newType = { ...editingLeaveType, id: generateId() };
                    await db.leaveTypes.add(newType);
                    setLeaveTypes((prev) => [...prev, newType]);
                  }
                  setShowLeaveModal(false);
                  setEditingLeaveType(null);
                  toast.success("Leave type saved successfully");
                }}
              >
                Save Leave Type
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagement;
