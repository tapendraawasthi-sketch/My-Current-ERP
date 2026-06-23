/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ActionToolbar } from "../components/ui";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import {
  Card,
  Button,
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

  const initialFormData: Omit<Employee, "id"> = {
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
    status: "active",
  };

  const [formData, setFormData] = useState(initialFormData);

  const handleOpenAdd = () => {
    setFormData({ ...initialFormData });
    setSelectedEmp(null);
    setShowForm(true);
  };

  const handleEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setFormData({ ...emp });
    setShowForm(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      await deleteEmployee(deleteId);
      toast.success("Employee deleted");
      setShowDeleteConfirm(false);
      setDeleteId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.designation) {
      toast.error("Name and Designation are required");
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
      setShowForm(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save employee");
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1557b0]" /> Employee Master
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Manage staff, designations, and payroll details</p>
        </div>
        <div className="flex items-center gap-2">
          {!showForm && (
            <Button onClick={handleOpenAdd} className="bg-[#1557b0] hover:bg-[#0f4a96] text-white h-8 text-[12px]">
              <Plus className="w-4 h-4 mr-1.5" /> Add Employee
            </Button>
          )}
        </div>
      </div>

      {!showForm ? (
        <Card className="bg-white border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-64 px-2.5 text-[12px] border border-gray-300 rounded-md focus:outline-none focus:border-[#1557b0]"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Designation</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">SSF</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Basic Salary</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">
                      <div className="font-medium">{emp.name}</div>
                      {emp.nameNe && <div className="text-[10px] text-gray-500">{emp.nameNe}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600">{emp.designation}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-600">{emp.department}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${emp.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {emp.ssf ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-100 text-blue-700">SSF ENROLLED</span>
                      ) : (
                        <span className="text-[11px] text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-right">{emp.basicSalary.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(emp)} className="text-gray-500 hover:text-[#1557b0]" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(emp.id)} className="text-gray-500 hover:text-red-600" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-gray-500">
                      No employees found. Click "Add Employee" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="bg-white border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-[#f5f6fa] flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-gray-800">
              {selectedEmp ? "Edit Employee" : "Add Employee"}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" className="h-7 text-[11px]" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-[#1557b0] hover:bg-[#0f4a96] text-white h-7 text-[11px]">
                Save Employee
              </Button>
            </div>
          </div>
          
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Name (Nepali)</label>
                <input
                  type="text"
                  value={formData.nameNe}
                  onChange={(e) => setFormData({ ...formData, nameNe: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Designation *</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "active"|"inactive" })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0] bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Employment Type</label>
                <select
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0] bg-white"
                >
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contract</option>
                  <option value="parttime">Part Time</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Join Date (AD)</label>
                <input
                  type="date"
                  value={formData.dateOfJoining}
                  onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Join Date (BS)</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={formData.dateOfJoiningBS}
                  onChange={(e) => setFormData({ ...formData, dateOfJoiningBS: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] focus:ring-1 focus:ring-[#1557b0]"
                />
              </div>
            </div>

            <hr className="border-gray-100" />
            <h3 className="text-[12px] font-semibold text-[#1557b0]">Payroll & Allowances</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Basic Salary</label>
                <input
                  type="number"
                  value={formData.basicSalary}
                  onChange={(e) => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">House Rent (HRA)</label>
                <input
                  type="number"
                  value={formData.allowances.houseRent}
                  onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances, houseRent: Number(e.target.value) } })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Transport Allow.</label>
                <input
                  type="number"
                  value={formData.allowances.transport}
                  onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances, transport: Number(e.target.value) } })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Medical Allow.</label>
                <input
                  type="number"
                  value={formData.allowances.medical}
                  onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances, medical: Number(e.target.value) } })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Dashain Allow.</label>
                <input
                  type="number"
                  value={formData.allowances.dashain}
                  onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances, dashain: Number(e.target.value) } })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
            </div>

            <hr className="border-gray-100" />
            <h3 className="text-[12px] font-semibold text-[#1557b0]">Compliance & Banking</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">PAN Number</label>
                <input
                  type="text"
                  maxLength={9}
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Citizenship No.</label>
                <input
                  type="text"
                  value={formData.citizenshipNumber}
                  onChange={(e) => setFormData({ ...formData, citizenshipNumber: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Bank Account No.</label>
                <input
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 border border-gray-200 rounded-md">
              <div className="flex items-center gap-2 col-span-2">
                <input
                  type="checkbox"
                  id="ssf"
                  checked={formData.ssf}
                  onChange={(e) => setFormData({ ...formData, ssf: e.target.checked })}
                  className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                />
                <label htmlFor="ssf" className="text-[12px] font-medium text-gray-700">Contributes to Social Security Fund (SSF)</label>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-gray-600 mb-1">SSF No.</label>
                <input
                  type="text"
                  disabled={!formData.ssf}
                  value={formData.ssfContributorNumber}
                  onChange={(e) => setFormData({ ...formData, ssfContributorNumber: e.target.value })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0] disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Life Insurance Prem.</label>
                <input
                  type="number"
                  value={formData.taxDeclarations.lifeInsurance}
                  onChange={(e) => setFormData({ ...formData, taxDeclarations: { ...formData.taxDeclarations, lifeInsurance: Number(e.target.value) } })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Health Insurance Prem.</label>
                <input
                  type="number"
                  value={formData.taxDeclarations.healthInsurance}
                  onChange={(e) => setFormData({ ...formData, taxDeclarations: { ...formData.taxDeclarations, healthInsurance: Number(e.target.value) } })}
                  className="h-8 px-2.5 w-full text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
                />
              </div>
            </div>
          </div>
        </Card>
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
