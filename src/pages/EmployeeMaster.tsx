/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { Plus, Edit2, Trash2, Users, PlusCircle, MinusCircle } from "lucide-react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import {
  Card,
  Button,
  Input,
  Select,
  NepaliDatePicker,
  AccountSelect,
  ConfirmDialog,
} from "../components/ui";
import { Employee } from "../lib/types";

export default function EmployeeMaster() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getSuggestedCode = () => {
    const nextNum = employees.length + 1;
    return `EMP-${String(nextNum).padStart(3, "0")}`;
  };

  const initialFormData = {
    code: "",
    name: "",
    nameNepali: "",
    designation: "",
    department: "",
    panNo: "",
    basicSalary: 0,
    allowances: [] as { name: string; amount: number }[],
    deductions: [] as { name: string; amount: number }[],
    pfRate: 10,
    citRate: 10,
    bankAccountNo: "",
    bankName: "",
    joinDate: new Date().toISOString().split("T")[0],
    accountId: "",
    isActive: true,
    citizenshipNo: "",
    socialSecurityNo: "",
    pfAccountNo: "",
    citAccountNo: "",
    ssfContributionType: "none" as "basic" | "premium" | "none",
    pfEnabled: false,
    citEnabled: false,
    ssfEnabled: false,
    rentAllowance: 0,
    medicalAllowance: 0,
    transportAllowance: 0,
    maritalStatus: "single" as "single" | "married",
  };

  const [formData, setFormData] = useState(initialFormData);

  const handleOpenAdd = () => {
    setFormData({
      ...initialFormData,
      code: getSuggestedCode(),
    });
    setSelectedEmp(null);
    setShowForm(true);
  };

  const handleEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setFormData({
      code: emp.code,
      name: emp.name,
      nameNepali: emp.nameNepali || "",
      designation: emp.designation,
      department: emp.department || "",
      panNo: emp.panNo || "",
      basicSalary: emp.basicSalary,
      allowances: emp.allowances || [],
      deductions: emp.deductions || [],
      pfRate: emp.pfRate ?? 10,
      citRate: emp.citRate ?? 10,
      bankAccountNo: emp.bankAccountNo || "",
      bankName: emp.bankName || "",
      joinDate: emp.joinDate || new Date().toISOString().split("T")[0],
      accountId: emp.accountId || "",
      isActive: emp.isActive,
      citizenshipNo: emp.citizenshipNo || "",
      socialSecurityNo: emp.socialSecurityNo || "",
      pfAccountNo: emp.pfAccountNo || "",
      citAccountNo: emp.citAccountNo || "",
      ssfContributionType: emp.ssfContributionType || "none",
      pfEnabled: !!emp.pfEnabled,
      citEnabled: !!emp.citEnabled,
      ssfEnabled: !!emp.ssfEnabled,
      rentAllowance: emp.rentAllowance || 0,
      medicalAllowance: emp.medicalAllowance || 0,
      transportAllowance: emp.transportAllowance || 0,
      maritalStatus: emp.maritalStatus || "single",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Employee Name is required");
      return;
    }
    if (!formData.designation) {
      toast.error("Designation is required");
      return;
    }
    if (!formData.accountId) {
      toast.error("Linked Account is required");
      return;
    }

    try {
      if (selectedEmp) {
        await updateEmployee(selectedEmp.id, formData);
        toast.success("Employee updated successfully");
      } else {
        await addEmployee(formData);
        toast.success("Employee added successfully");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Action failed");
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setSelectedEmp(null);
    setShowForm(false);
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEmployee(deleteId);
      toast.success("Employee deleted successfully");
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const handleAddAllowance = () => {
    setFormData({
      ...formData,
      allowances: [...formData.allowances, { name: "", amount: 0 }],
    });
  };

  const handleRemoveAllowance = (index: number) => {
    setFormData({
      ...formData,
      allowances: formData.allowances.filter((_, i) => i !== index),
    });
  };

  const handleAllowanceChange = (
    index: number,
    field: "name" | "amount",
    value: string | number,
  ) => {
    const updated = formData.allowances.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setFormData({ ...formData, allowances: updated });
  };

  const handleAddDeduction = () => {
    setFormData({
      ...formData,
      deductions: [...formData.deductions, { name: "", amount: 0 }],
    });
  };

  const handleRemoveDeduction = (index: number) => {
    setFormData({
      ...formData,
      deductions: formData.deductions.filter((_, i) => i !== index),
    });
  };

  const handleDeductionChange = (
    index: number,
    field: "name" | "amount",
    value: string | number,
  ) => {
    const updated = formData.deductions.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setFormData({ ...formData, deductions: updated });
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <ActionToolbar title="Employee Master" subtitle="Staff and salesman records" />
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Employee Directory</h1>
        <button onClick={handleOpenAdd} className="btn-primary flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search employees..."
          className="input"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Designation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Basic Salary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                PF Rate %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>No employees found</p>
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="font-semibold">{emp.name}</div>
                      {emp.nameNepali && (
                        <div className="text-xs text-gray-400">{emp.nameNepali}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.designation}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    Rs. {emp.basicSalary.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{emp.pfRate}%</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        emp.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(emp)}
                        className="text-[#1557b0] hover:text-indigo-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(emp.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h2 className="text-xl font-semibold mb-4">
              {selectedEmp ? "Edit Employee" : "Add Employee"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name in Nepali
                  </label>
                  <input
                    type="text"
                    value={formData.nameNepali}
                    onChange={(e) => setFormData({ ...formData, nameNepali: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN No (9 characters)
                  </label>
                  <input
                    type="text"
                    maxLength={9}
                    value={formData.panNo}
                    onChange={(e) => setFormData({ ...formData, panNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Basic Salary *
                  </label>
                  <input
                    type="number"
                    value={formData.basicSalary || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, basicSalary: Number(e.target.value) })
                    }
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Linked Account *
                  </label>
                  <AccountSelect
                    value={formData.accountId}
                    onChange={(val) => setFormData({ ...formData, accountId: val })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
                  <select
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as "single" | "married" })}
                    className="input"
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Citizenship No</label>
                  <input
                    type="text"
                    value={formData.citizenshipNo}
                    onChange={(e) => setFormData({ ...formData, citizenshipNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SSF No (Social Security)</label>
                  <input
                    type="text"
                    value={formData.socialSecurityNo}
                    onChange={(e) => setFormData({ ...formData, socialSecurityNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EPF Account No</label>
                  <input
                    type="text"
                    value={formData.pfAccountNo}
                    onChange={(e) => setFormData({ ...formData, pfAccountNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CIT Account No</label>
                  <input
                    type="text"
                    value={formData.citAccountNo}
                    onChange={(e) => setFormData({ ...formData, citAccountNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="pfEnabled"
                    checked={formData.pfEnabled}
                    onChange={(e) => setFormData({ ...formData, pfEnabled: e.target.checked })}
                    className="rounded border-gray-300 mr-2 h-4 w-4"
                  />
                  <label htmlFor="pfEnabled" className="text-sm font-medium text-gray-700">PF Enrolled</label>
                </div>
                {formData.pfEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PF Rate %</label>
                    <input
                      type="number"
                      value={formData.pfRate}
                      onChange={(e) => setFormData({ ...formData, pfRate: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                )}
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="citEnabled"
                    checked={formData.citEnabled}
                    onChange={(e) => setFormData({ ...formData, citEnabled: e.target.checked })}
                    className="rounded border-gray-300 mr-2 h-4 w-4"
                  />
                  <label htmlFor="citEnabled" className="text-sm font-medium text-gray-700">CIT Enrolled</label>
                </div>
                {formData.citEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CIT Rate %</label>
                    <input
                      type="number"
                      value={formData.citRate}
                      onChange={(e) => setFormData({ ...formData, citRate: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                )}
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="ssfEnabled"
                    checked={formData.ssfEnabled}
                    onChange={(e) => setFormData({ ...formData, ssfEnabled: e.target.checked })}
                    className="rounded border-gray-300 mr-2 h-4 w-4"
                  />
                  <label htmlFor="ssfEnabled" className="text-sm font-medium text-gray-700">SSF Enrolled</label>
                </div>
                {formData.ssfEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SSF Scheme</label>
                    <select
                      value={formData.ssfContributionType}
                      onChange={(e) => setFormData({ ...formData, ssfContributionType: e.target.value as "basic" | "premium" | "none" })}
                      className="input"
                    >
                      <option value="none">None</option>
                      <option value="basic">Basic (E'ee 11% / E'r 20%)</option>
                      <option value="premium">Premium (E'ee 1% / E'r 3.33%)</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rent Allowance</label>
                  <input
                    type="number"
                    value={formData.rentAllowance || ""}
                    onChange={(e) => setFormData({ ...formData, rentAllowance: Number(e.target.value) })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medical Allowance</label>
                  <input
                    type="number"
                    value={formData.medicalAllowance || ""}
                    onChange={(e) => setFormData({ ...formData, medicalAllowance: Number(e.target.value) })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transport Allowance</label>
                  <input
                    type="number"
                    value={formData.transportAllowance || ""}
                    onChange={(e) => setFormData({ ...formData, transportAllowance: Number(e.target.value) })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account No</label>
                  <input
                    type="text"
                    value={formData.bankAccountNo}
                    onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Join Date (BS) *
                  </label>
                  <NepaliDatePicker
                    value={formData.joinDate}
                    onChange={(val) => setFormData({ ...formData, joinDate: val })}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 mr-2 h-4 w-4"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Is Active
                  </label>
                </div>
              </div>

              {/* Allowances section */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-gray-800">Salary Allowances</h3>
                  <button
                    type="button"
                    onClick={handleAddAllowance}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Allowance</span>
                  </button>
                </div>
                {formData.allowances.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No allowances configured.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.allowances.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Allowance Name"
                          value={item.name}
                          onChange={(e) => handleAllowanceChange(idx, "name", e.target.value)}
                          className="input flex-1"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={item.amount || ""}
                          onChange={(e) =>
                            handleAllowanceChange(idx, "amount", Number(e.target.value))
                          }
                          className="input w-32"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveAllowance(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Deductions section */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-bold text-gray-800">Salary Deductions</h3>
                  <button
                    type="button"
                    onClick={handleAddDeduction}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Add Deduction</span>
                  </button>
                </div>
                {formData.deductions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No deductions configured.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.deductions.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Deduction Name"
                          value={item.name}
                          onChange={(e) => handleDeductionChange(idx, "name", e.target.value)}
                          className="input flex-1"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          value={item.amount || ""}
                          onChange={(e) =>
                            handleDeductionChange(idx, "amount", Number(e.target.value))
                          }
                          className="input w-32"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDeduction(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-sm">
                  {selectedEmp ? "Update" : "Add"} Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Employee"
        message="Are you sure you want to delete this employee? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
