// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, X, Save } from "lucide-react";
import { useStore } from "../store/useStore";
import toast from "@/lib/appToast";
import { Employee } from "../lib/types";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";
import { useAppRoute, useNavigateApp } from "../routing/useAppRoute";
import {
  Button,
  PageHeader,
  PageMeta,
  EnterpriseDataTable,
  type EnterpriseColumnDef,
  formatAmountCell,
} from "@/design-system";

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
  const { employees, addEmployee, updateEmployee, deleteEmployee, initLifecycle } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();
  const route = useAppRoute();
  const { openEntity, clearEntity } = useNavigateApp();
  const pageId = route.pageId === "employee-master" ? "employee-master" : "employees";

  const [showForm, setShowForm] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState(emptyForm());

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

  const columns = useMemo<EnterpriseColumnDef<Employee>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (emp) => (
          <span className="font-medium text-[12px] text-[var(--ds-text-default)]">
            {emp.name}
            {emp.nameNe ? (
              <span className="block text-[11px] font-normal text-[var(--ds-text-muted)]">{emp.nameNe}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "designation",
        header: "Designation",
        cell: (emp) => (
          <span className="text-[12px] text-[var(--ds-text-default)]">{emp.designation}</span>
        ),
      },
      {
        id: "department",
        header: "Department",
        cell: (emp) => (
          <span className="text-[12px] text-[var(--ds-text-muted)]">{emp.department || "—"}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        cell: (emp) => (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
              emp.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {emp.status}
          </span>
        ),
      },
      {
        id: "ssf",
        header: "SSF",
        align: "center",
        cell: (emp) =>
          emp.ssf ? (
            <span className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">
              Enrolled
            </span>
          ) : (
            <span className="text-[12px] text-[var(--ds-text-subtle)]">—</span>
          ),
      },
      {
        id: "basicSalary",
        header: "Basic salary",
        align: "right",
        financial: true,
        cell: (emp) => formatAmountCell(Number(emp.basicSalary ?? 0)),
      },
    ],
    [],
  );

  const resetForm = () => {
    setFormData(emptyForm());
    setSelectedEmp(null);
    setShowForm(false);
    clearEntity(pageId);
  };

  const handleOpenAdd = () => {
    setFormData(emptyForm());
    setSelectedEmp(null);
    setShowForm(true);
    openEntity(pageId, "new");
  };

  const handleEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setFormData({ ...emp });
    setShowForm(true);
    openEntity(pageId, String(emp.id));
  };

  // Deep link: /app/employees/:id | /app/employee-master/new
  useEffect(() => {
    if (route.pageId !== "employees" && route.pageId !== "employee-master") return;
    if (route.entityId === "new") {
      setFormData(emptyForm());
      setSelectedEmp(null);
      setShowForm(true);
      return;
    }
    if (route.entityId) {
      const emp = employees.find((e) => String(e.id) === route.entityId);
      if (emp) {
        setSelectedEmp(emp);
        setFormData({ ...emp });
        setShowForm(true);
      }
      return;
    }
    if (showForm) setShowForm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.pageId, route.entityId, employees]);

  const handleDelete = async (emp: Employee) => {
    const snapshot = { ...emp };
    try {
      await deleteEmployee(emp.id);
      if (selectedEmp?.id === emp.id) {
        resetForm();
      }
      toast.undo(`"${emp.name}" deleted`, async () => {
        try {
          await addEmployee({ ...snapshot });
        } catch {
          toast.error("Failed to restore employee.");
        }
      });
    } catch {
      toast.error("Failed to delete employee.");
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
        <div className="p-4 pb-0 flex flex-col gap-3">
          <PageHeader
            title="Employees"
            description="Manage staff, designations, and payroll details"
            meta={
              <PageMeta>
                {filteredEmployees.length} of {employees.length} employees
              </PageMeta>
            }
            primaryAction={
              <Button
                variant="primary"
                size="small"
                onClick={handleOpenAdd}
                startIcon={<Plus className="h-3.5 w-3.5" />}
              >
                Add employee
              </Button>
            }
            secondaryActions={[
              ...(branchOptions.length > 0
                ? [
                    <select
                      key="branch"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="h-8 px-2.5 text-[12px] border border-[var(--ds-border-default)] rounded-lg bg-[var(--ds-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-action-primary)]/20 focus:border-[var(--ds-action-primary)]"
                      aria-label="Branch"
                    >
                      <option value="all">All branches</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.code || b.id}
                        </option>
                      ))}
                    </select>,
                  ]
                : []),
            ]}
          />

          <div className="relative max-w-xs">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-subtle)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <EnterpriseDataTable
            columns={columns}
            rows={filteredEmployees}
            getRowId={(emp) => String(emp.id)}
            loading={employees == null || initLifecycle === "loading" || initLifecycle === "initializing"}
            emptyTitle={searchTerm ? "No employees match your search" : "No employees found"}
            emptyDescription={
              searchTerm
                ? "Try a different search term."
                : 'Click "Add employee" to create your first employee record.'
            }
            emptyAction={
              !searchTerm ? (
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleOpenAdd}
                  startIcon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add employee
                </Button>
              ) : undefined
            }
            onRowClick={handleEdit}
            rowActions={(emp) => [
              { label: "Edit", onSelect: () => handleEdit(emp) },
              { label: "Delete", destructive: true, onSelect: () => handleDelete(emp) },
            ]}
            caption="Employees"
          />
        </div>
      </div>

      {showForm && (
        <div className="w-[min(640px,100%)] shrink-0 flex flex-col bg-white border-l border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-700">
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

            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-3">
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

    </div>
  );
}
