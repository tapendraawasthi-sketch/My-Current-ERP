// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Plus, Edit2, Trash2, Search, X, Save } from "lucide-react";
import { useStore } from "../store/useStore";
import toast from "@/lib/appToast";
import { ConfirmDialog } from "../components/ui";
import { ReportEmptyState } from "../components/ReportEmptyState";
import { Employee } from "../lib/types";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

const th = "px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase tracking-wide";
const td = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";
const btnPrimary =
  "h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md inline-flex items-center gap-1.5";
const btnOutline =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 inline-flex items-center gap-1.5";
const inputCls =
  "w-full h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]";
const labelCls = "text-[12px] font-medium text-gray-600 mb-1 block";
const sectionTitle = "text-[12px] font-semibold text-gray-500 uppercase tracking-wide";

const emptyForm = (): Omit<Employee, "id"> => ({
  name: "",
  nameNe: "",
  designation: "",
  department: "",
  dateOfJoining: new Date().toISOString().split("T")[0],
  dateOfJoiningBS: "",
  pan: "",
  citizenshipNumber: "",
  bankAccount: "",
  bankName: "",
  ssf: false,
  ssfContributorNumber: "",
  basicSalary: 0,
  gradePayPercent: 0,
  allowances: {
    houseRent: 0,
    transport: 0,
    medical: 0,
    dashain: 0,
  },
  taxDeclarations: {
    lifeInsurance: 0,
    healthInsurance: 0,
  },
  employmentType: "permanent",
  bonusEligible: true,
  status: "active",
});

export default function EmployeeMaster() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [showForm, setShowForm] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(emptyForm());

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return employees.filter((e) => {
      if (!matchBranch((e as { branchId?: string }).branchId)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q)
      );
    });
  }, [employees, searchTerm, matchBranch, branchFilter]);

  const resetForm = () => {
    setFormData(emptyForm());
    setSelectedEmp(null);
    setShowForm(false);
  };

  const handleOpenAdd = () => {
    setFormData(emptyForm());
    setSelectedEmp(null);
    setShowForm(true);
  };

  const handleEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setFormData({ ...emp });
    setShowForm(true);
  };

  const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await deleteEmployee(deleteId);
      toast.success("Employee deleted");
      setShowDeleteConfirm(false);
      setDeleteId(null);
      if (selectedEmp?.id === deleteId) {
        resetForm();
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.designation) {
      toast.error("Name and Designation are required");
      return;
    }

    try {
      const payload = {
        ...formData,
        branchId:
          (formData as { branchId?: string }).branchId || readActiveBranchId() || undefined,
      } as any;
      if (selectedEmp) {
        await updateEmployee(selectedEmp.id, payload);
        toast.success("Employee updated successfully");
      } else {
        await addEmployee(payload);
        toast.success("Employee added successfully");
      }
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save employee");
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-[var(--ds-canvas)]">
      <div className={`flex flex-1 flex-col min-w-0 ${showForm ? "border-r border-gray-200" : ""}`}>
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[15px] font-semibold text-gray-800">Employees</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Staff records.</p>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Manage staff, designations, and payroll details
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
              <button type="button" className={btnPrimary} onClick={handleOpenAdd}>
                <Plus className="h-3.5 w-3.5" />
                Add employee
              </button>
            </div>
          </div>

          <div className="relative mb-3 max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredEmployees.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-md">
              <ReportEmptyState
                message={searchTerm ? "No employees match your search" : "No employees found"}
                hint={
                  searchTerm
                    ? "Try a different search term."
                    : 'Click "Add employee" to create your first employee record.'
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                    <th className={th}>Name</th>
                    <th className={th}>Designation</th>
                    <th className={th}>Department</th>
                    <th className={`${th} text-center`}>Status</th>
                    <th className={`${th} text-center`}>SSF</th>
                    <th className={`${th} text-right`}>Basic salary</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="group cursor-pointer hover:bg-gray-50 border-l-[3px] border-l-transparent hover:border-l-[var(--ds-action-primary)]"
                      onClick={() => handleEdit(emp)}
                    >
                      <td className={td}>
                        <div className="font-medium text-gray-800">{emp.name}</div>
                        {emp.nameNe && (
                          <div className="text-[12px] text-gray-500">{emp.nameNe}</div>
                        )}
                      </td>
                      <td className={td}>{emp.designation}</td>
                      <td className={`${td} text-gray-500`}>{emp.department || "—"}</td>
                      <td className={`${td} text-center`}>
                        <span
                          className={`rounded px-2 py-0.5 text-[12px] font-semibold uppercase ${
                            emp.status === "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className={`${td} text-center`}>
                        {emp.ssf ? (
                          <span className="rounded px-2 py-0.5 text-[12px] font-semibold uppercase bg-blue-100 text-blue-700">
                            Enrolled
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className={`${td} font-mono text-right`}>
                        {emp.basicSalary.toLocaleString()}
                      </td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(emp);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-red-600 hover:bg-red-50"
                            onClick={(e) => handleDeleteClick(emp.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-200 bg-[var(--ds-canvas)] text-[12px] text-gray-500">
                {filteredEmployees.length} employee{filteredEmployees.length === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="w-[min(640px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-800">
              {selectedEmp ? "Edit employee" : "Add employee"}
            </span>
            <button type="button" className="text-gray-500 hover:text-gray-700" aria-label="Close form" onClick={resetForm}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <p className={sectionTitle}>Basic details</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Full name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputCls}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Name (Nepali)</label>
                  <input
                    type="text"
                    value={formData.nameNe}
                    onChange={(e) => setFormData({ ...formData, nameNe: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Designation *</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as "active" | "inactive" })
                    }
                    className={inputCls}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Employment type</label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) =>
                      setFormData({ ...formData, employmentType: e.target.value as any })
                    }
                    className={inputCls}
                  >
                    <option value="permanent">Permanent</option>
                    <option value="contract">Contract</option>
                    <option value="parttime">Part time</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Join date (AD)</label>
                  <input
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Join date (BS)</label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    value={formData.dateOfJoiningBS}
                    onChange={(e) => setFormData({ ...formData, dateOfJoiningBS: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className={sectionTitle}>Payroll & allowances</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Basic salary</label>
                  <input
                    type="number"
                    value={formData.basicSalary}
                    onChange={(e) =>
                      setFormData({ ...formData, basicSalary: Number(e.target.value) })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>House rent (HRA)</label>
                  <input
                    type="number"
                    value={formData.allowances.houseRent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowances: { ...formData.allowances, houseRent: Number(e.target.value) },
                      })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Transport allowance</label>
                  <input
                    type="number"
                    value={formData.allowances.transport}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowances: { ...formData.allowances, transport: Number(e.target.value) },
                      })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Medical allowance</label>
                  <input
                    type="number"
                    value={formData.allowances.medical}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowances: { ...formData.allowances, medical: Number(e.target.value) },
                      })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Dashain allowance</label>
                  <input
                    type="number"
                    value={formData.allowances.dashain}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowances: { ...formData.allowances, dashain: Number(e.target.value) },
                      })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className={sectionTitle}>Compliance & banking</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>PAN number</label>
                  <input
                    type="text"
                    maxLength={9}
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Citizenship no.</label>
                  <input
                    type="text"
                    value={formData.citizenshipNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, citizenshipNumber: e.target.value })
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bank name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bank account no.</label>
                  <input
                    type="text"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md p-3 bg-gray-50 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  id="ssf"
                  checked={formData.ssf}
                  onChange={(e) => setFormData({ ...formData, ssf: e.target.checked })}
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Contributes to Social Security Fund (SSF)
              </label>
              <div>
                <label className={labelCls}>SSF no.</label>
                <input
                  type="text"
                  disabled={!formData.ssf}
                  value={formData.ssfContributorNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, ssfContributorNumber: e.target.value })
                  }
                  className={`${inputCls} font-mono disabled:bg-gray-100 disabled:text-gray-500`}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-700">
                <input
                  type="checkbox"
                  id="bonusEligible"
                  checked={formData.bonusEligible !== false}
                  onChange={(e) => setFormData({ ...formData, bonusEligible: e.target.checked })}
                  className="rounded border-gray-300 text-[var(--ds-action-primary)] focus:ring-[var(--ds-action-primary)]"
                />
                Eligible for annual bonus provision
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Life insurance premium</label>
                  <input
                    type="number"
                    value={formData.taxDeclarations.lifeInsurance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        taxDeclarations: {
                          ...formData.taxDeclarations,
                          lifeInsurance: Number(e.target.value),
                        },
                      })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Health insurance premium</label>
                  <input
                    type="number"
                    value={formData.taxDeclarations.healthInsurance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        taxDeclarations: {
                          ...formData.taxDeclarations,
                          healthInsurance: Number(e.target.value),
                        },
                      })
                    }
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-gray-200 shrink-0">
            <button type="button" className={btnPrimary} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {selectedEmp ? "Update" : "Save"}
            </button>
            <button type="button" className={btnOutline} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Employee"
          message="Are you sure you want to delete this employee? This will not remove their historical payroll records, but they will be removed from active lists."
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          confirmText="Delete Employee"
          isDestructive={true}
        />
      )}
    </div>
  );
}
