// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Download,
  Calculator,
  CheckCircle,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  computeNepalTDS,
  fmtNPR,
  EPF_EMPLOYEE_RATE,
  EPF_EMPLOYER_RATE,
  SSF_EMPLOYEE_RATE,
  SSF_EMPLOYER_RATE,
  CIT_RATE,
  EXEMPTION_SINGLE,
  EXEMPTION_MARRIED,
} from "../lib/nepalTax";
import { useBranchFilter } from "../hooks/useBranchFilter";
import { readActiveBranchId } from "../lib/activeBranch";

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = "employees" | "salary" | "process" | "register" | "payslip";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTHS = [
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
  "Baisakh",
  "Jestha",
  "Ashadh",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Payroll() {
  const {
    employees = [],
    salaryStructures = [],
    payrollRuns = [],
    payrollEntries = [],
    loadPayrollData,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addSalaryStructure,
    processPayroll,
    currentFiscalYear,
    companySettings,
  } = useStore();
  const { branchFilter, setBranchFilter, matchBranch, branchOptions } = useBranchFilter();

  const [activeTab, setActiveTab] = useState<Tab>("employees");
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showSalModal, setShowSalModal] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [searchEmp, setSearchEmp] = useState("");
  const [processing, setProcessing] = useState(false);

  // Employee form state
  const [empForm, setEmpForm] = useState({
    employeeCode: "",
    name: "",
    department: "",
    designation: "",
    panNumber: "",
    bankAccount: "",
    bankName: "",
    joiningDate: "",
    gender: "male",
    maritalStatus: "single",
    epfApplicable: true,
    citApplicable: false,
    ssfApplicable: false,
    isActive: true,
  });

  // Salary form state
  const [salForm, setSalForm] = useState({
    employeeId: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    basicSalary: 0,
    houseRentAllowance: 0,
    medicalAllowance: 0,
    transportAllowance: 0,
    otherAllowances: 0,
    epfRate: 10,
    citRate: 10,
    ssfRate: 1,
  });

  useEffect(() => {
    loadPayrollData?.();
  }, []);

  const scopedEmployees = useMemo(
    () => employees.filter((e: any) => matchBranch(e.branchId)),
    [employees, matchBranch, branchFilter],
  );

  // ── Filtered employees ────────────────────────────────────────────────────
  const filteredEmps = useMemo(
    () =>
      scopedEmployees.filter(
        (e: any) =>
          e.name?.toLowerCase().includes(searchEmp.toLowerCase()) ||
          e.employeeCode?.toLowerCase().includes(searchEmp.toLowerCase()) ||
          e.department?.toLowerCase().includes(searchEmp.toLowerCase()),
      ),
    [scopedEmployees, searchEmp],
  );

  // ── Current payroll run entries ───────────────────────────────────────────
  const runEntries = useMemo(
    () =>
      selectedRunId ? payrollEntries.filter((e: any) => e.payrollRunId === selectedRunId) : [],
    [payrollEntries, selectedRunId],
  );

  // ── Payslip data for selected employee ───────────────────────────────────
  const payslipEntry = useMemo(
    () =>
      selectedEmpId && selectedRunId
        ? runEntries.find((e: any) => e.employeeId === selectedEmpId)
        : null,
    [runEntries, selectedEmpId, selectedRunId],
  );

  // ── Save employee ─────────────────────────────────────────────────────────
  const handleSaveEmployee = async () => {
    const now = new Date().toISOString();
    const branchId = empForm.branchId || readActiveBranchId() || undefined;
    if (editEmp?.id) {
      await updateEmployee(editEmp.id, { ...empForm, branchId, updatedAt: now });
    } else {
      await addEmployee({ ...empForm, branchId, createdAt: now, updatedAt: now });
    }
    setShowEmpModal(false);
    setEditEmp(null);
    setEmpForm({
      employeeCode: "",
      name: "",
      department: "",
      designation: "",
      panNumber: "",
      bankAccount: "",
      bankName: "",
      joiningDate: "",
      gender: "male",
      maritalStatus: "single",
      epfApplicable: true,
      citApplicable: false,
      ssfApplicable: false,
      isActive: true,
    });
  };

  // ── Save salary structure ──────────────────────────────────────────────────
  const handleSaveSalary = async () => {
    const now = new Date().toISOString();
    await addSalaryStructure({ ...salForm, createdAt: now, updatedAt: now });
    setShowSalModal(false);
  };

  // ── Process payroll ───────────────────────────────────────────────────────
  const handleProcess = async () => {
    setProcessing(true);
    try {
      await processPayroll(payrollMonth, payrollYear, currentFiscalYear || "2081-82");
      setActiveTab("register");
    } finally {
      setProcessing(false);
    }
  };

  // ── Export payroll register ───────────────────────────────────────────────
  const exportRegister = () => {
    if (!selectedRunId) return;
    const run = payrollRuns.find((r: any) => r.id === selectedRunId);
    const data = runEntries.map((e: any) => ({
      "Emp Code": employees.find((x: any) => x.id === e.employeeId)?.employeeCode || "",
      "Employee Name": e.employeeName,
      Department: e.department,
      Basic: e.basicSalary,
      HRA: e.houseRentAllowance,
      Medical: e.medicalAllowance,
      Transport: e.transportAllowance,
      "Other Allow": e.otherAllowances,
      Gross: e.grossSalary,
      "EPF (Emp)": e.epfEmployee,
      CIT: e.citEmployee,
      "SSF (Emp)": e.ssfEmployee,
      TDS: e.tdsAmount,
      "Total Deductions": e.totalDeductions,
      "Net Pay": e.netPay,
      "EPF (Employer)": e.epfEmployer,
      "SSF (Employer)": e.ssfEmployer,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Register");
    XLSX.writeFile(wb, `PayrollRegister_${run?.month}_${run?.year}.xlsx`);
  };

  // ── Tabs UI ───────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "employees", label: "Employees", icon: Users },
    { id: "salary", label: "Salary Structure", icon: DollarSign },
    { id: "process", label: "Process Payroll", icon: Calculator },
    { id: "register", label: "Payroll Register", icon: FileText },
    { id: "payslip", label: "Payslip", icon: FileText },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Payroll</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Pay employees.
          </p>
        </div>
        <div className="flex gap-2 items-center">
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
          {activeTab === "employees" && (
            <button
              onClick={() => {
                setEditEmp(null);
                setShowEmpModal(true);
              }}
              className="flex items-center gap-2 h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )}
          {activeTab === "salary" && (
            <button
              onClick={() => setShowSalModal(true)}
              className="flex items-center gap-2 h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-medium rounded-md"
            >
              <Plus className="w-4 h-4" /> Add Salary Structure
            </button>
          )}
          {activeTab === "register" && selectedRunId && (
            <button
              onClick={exportRegister}
              className="flex items-center gap-2 h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Employees",
            value: scopedEmployees.filter((e: any) => e.isActive).length,
            color: "blue",
            icon: Users,
          },
          {
            label: "This Month Gross",
            value: fmt(payrollRuns.slice(-1)[0]?.totalGross || 0),
            color: "green",
            icon: DollarSign,
          },
          {
            label: "This Month TDS",
            value: fmt(
              payrollEntries
                .filter((e: any) => {
                  const run = payrollRuns.find((r: any) => r.id === e.payrollRunId);
                  return (
                    run?.month === new Date().getMonth() + 1 &&
                    run?.year === new Date().getFullYear()
                  );
                })
                .reduce((s: number, e: any) => s + e.tdsAmount, 0),
            ),
            color: "orange",
            icon: Calculator,
          },
          { label: "Attendances", value: payrollRuns.length, color: "purple", icon: CheckCircle },
        ].map((card) => (
          <div
            key={card.label}
            className={`bg-${card.color}-50 rounded-xl p-4 border border-${card.color}-200`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{card.label}</span>
              <card.icon className={`w-4 h-4 text-${card.color}-600`} />
            </div>
            <div className={`text-xl font-bold text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── EMPLOYEES TAB ─────────────────────────────────────────────────── */}
      {activeTab === "employees" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b">
            <input
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="Search employees…"
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Code",
                  "Name",
                  "Department",
                  "Designation",
                  "PAN",
                  "EPF",
                  "CIT",
                  "SSF",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmps.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{emp.employeeCode}</td>
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                  <td className="px-4 py-3 text-gray-600">{emp.designation}</td>
                  <td className="px-4 py-3 font-mono text-xs">{emp.panNumber}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${emp.epfApplicable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {emp.epfApplicable ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${emp.citApplicable ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      {emp.citApplicable ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${emp.ssfApplicable ? "bg-[var(--ds-status-info-surface)] text-[var(--ds-status-info)]" : "bg-[var(--ds-surface-muted)] text-[var(--ds-text-muted)]"}`}
                    >
                      {emp.ssfApplicable ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {emp.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditEmp(emp);
                          setEmpForm({ ...emp });
                          setShowEmpModal(true);
                        }}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteEmployee(emp.id!)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmps.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    No employees found. Add your first employee.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SALARY STRUCTURE TAB ─────────────────────────────────────────── */}
      {activeTab === "salary" && (
        <div className="space-y-4">
          {employees
            .filter((e: any) => e.isActive && matchBranch(e.branchId))
            .map((emp: any) => {
              const structs = salaryStructures
                .filter((s: any) => s.employeeId === emp.id)
                .sort((a: any, b: any) => b.effectiveFrom.localeCompare(a.effectiveFrom));
              const latest = structs[0];
              const gross = latest
                ? latest.basicSalary +
                  latest.houseRentAllowance +
                  latest.medicalAllowance +
                  latest.transportAllowance +
                  latest.otherAllowances
                : 0;
              return (
                <div
                  key={emp.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold text-gray-800">{emp.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({emp.department})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {latest && (
                        <span className="text-sm font-medium text-green-700">
                          Gross: {fmt(gross)}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSalForm({ ...salForm, employeeId: emp.id! });
                          setShowSalModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs hover:bg-green-100"
                      >
                        <Plus className="w-3 h-3" /> Revise
                      </button>
                    </div>
                  </div>
                  {latest && (
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                      {[
                        ["Basic", latest.basicSalary],
                        ["HRA", latest.houseRentAllowance],
                        ["Medical", latest.medicalAllowance],
                        ["Transport", latest.transportAllowance],
                        ["Other", latest.otherAllowances],
                        ["EPF Rate", latest.epfRate + "%"],
                      ].map(([l, v]) => (
                        <div key={l as string} className="bg-gray-50 rounded-lg p-2 text-center">
                          <div className="text-gray-500">{l}</div>
                          <div className="font-semibold text-gray-800 mt-0.5">
                            {typeof v === "number" ? fmt(v) : v}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* ── PROCESS PAYROLL TAB ──────────────────────────────────────────── */}
      {activeTab === "process" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" /> Process Monthly Payroll
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(+e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {MONTHS_EN.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={payrollYear}
                  onChange={(e) => setPayrollYear(+e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 space-y-1">
              <div className="font-semibold mb-2">Tax Parameters (IRD 2081/82)</div>
              <div>• Personal Exemption (Single): Rs. 4,00,000</div>
              <div>• Personal Exemption (Married): Rs. 5,00,000</div>
              <div>• EPF: 10% employee + 10% employer (of basic)</div>
              <div>• SSF: 1% employee + 3.33% employer (of gross)</div>
              <div>• CIT: 10% (optional, of basic, tax-deductible)</div>
              <div>• Slabs: 1% / 10% / 20% / 30% / 36%</div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                {scopedEmployees.filter((e: any) => e.isActive).length}
              </span>{" "}
              active employees will be processed.
            </div>
            <button
              onClick={handleProcess}
              disabled={processing}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" /> Run Payroll
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── PAYROLL REGISTER TAB ────────────────────────────────────────── */}
      {activeTab === "register" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            {payrollRuns.map((run: any) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id!)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  selectedRunId === run.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                }`}
              >
                {MONTHS_EN[run.month - 1]} {run.year}
                <span
                  className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    run.status === "paid"
                      ? "bg-green-100 text-green-700"
                      : run.status === "approved"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {run.status}
                </span>
              </button>
            ))}
            {payrollRuns.length === 0 && (
              <div className="text-gray-400 text-sm">
                No payroll runs yet. Go to Process Payroll tab.
              </div>
            )}
          </div>

          {selectedRunId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {[
                      "Emp Code",
                      "Name",
                      "Dept",
                      "Basic",
                      "HRA",
                      "Medical",
                      "Transport",
                      "Other",
                      "Gross",
                      "EPF(E)",
                      "CIT",
                      "SSF(E)",
                      "TDS",
                      "Total Ded.",
                      "Net Pay",
                      "EPF(ER)",
                      "SSF(ER)",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-semibold text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {runEntries.map((e: any) => (
                    <tr
                      key={e.id}
                      className="hover:bg-blue-50 cursor-pointer"
                      onClick={() => {
                        setSelectedEmpId(e.employeeId);
                        setActiveTab("payslip");
                      }}
                    >
                      <td className="px-3 py-2 font-mono">
                        {employees.find((x: any) => x.id === e.employeeId)?.employeeCode}
                      </td>
                      <td className="px-3 py-2 font-medium">{e.employeeName}</td>
                      <td className="px-3 py-2 text-gray-500">{e.department}</td>
                      {[
                        e.basicSalary,
                        e.houseRentAllowance,
                        e.medicalAllowance,
                        e.transportAllowance,
                        e.otherAllowances,
                        e.grossSalary,
                        e.epfEmployee,
                        e.citEmployee,
                        e.ssfEmployee,
                        e.tdsAmount,
                        e.totalDeductions,
                        e.netPay,
                        e.epfEmployer,
                        e.ssfEmployer,
                      ].map((v, i) => (
                        <td
                          key={i}
                          className={`px-3 py-2 text-right ${i >= 9 ? "font-semibold" : ""}`}
                        >
                          {fmt(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Totals row */}
                  {runEntries.length > 0 &&
                    (() => {
                      const t = (field: keyof (typeof runEntries)[0]) =>
                        runEntries.reduce(
                          (s: number, e: any) => s + ((e[field] as number) || 0),
                          0,
                        );
                      return (
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                          <td colSpan={3} className="px-3 py-2 text-right">
                            TOTAL
                          </td>
                          {(
                            [
                              "basicSalary",
                              "houseRentAllowance",
                              "medicalAllowance",
                              "transportAllowance",
                              "otherAllowances",
                              "grossSalary",
                              "epfEmployee",
                              "citEmployee",
                              "ssfEmployee",
                              "tdsAmount",
                              "totalDeductions",
                              "netPay",
                              "epfEmployer",
                              "ssfEmployer",
                            ] as any[]
                          ).map((f, i) => (
                            <td key={i} className="px-3 py-2 text-right">
                              {fmt(t(f))}
                            </td>
                          ))}
                        </tr>
                      );
                    })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PAYSLIP TAB ──────────────────────────────────────────────────── */}
      {activeTab === "payslip" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select
              value={selectedRunId || ""}
              onChange={(e) => setSelectedRunId(+e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select Month</option>
              {payrollRuns.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {MONTHS_EN[r.month - 1]} {r.year}
                </option>
              ))}
            </select>
            <select
              value={selectedEmpId || ""}
              onChange={(e) => setSelectedEmpId(+e.target.value || null)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select Employee</option>
              {scopedEmployees
                .filter((e: any) => e.isActive)
                .map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </div>

          {payslipEntry ? (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl print:shadow-none"
              id="payslip"
            >
              {/* Company Header */}
              <div className="text-center border-b pb-4 mb-6">
                <h2 className="text-xl font-bold text-gray-800">
                  {companySettings?.name || "Company Name"}
                </h2>
                <p className="text-sm text-gray-500">SALARY SLIP</p>
                <p className="text-sm text-gray-600 font-medium">
                  {
                    MONTHS_EN[
                      (payrollRuns.find((r: any) => r.id === selectedRunId)?.month || 1) - 1
                    ]
                  }{" "}
                  {payrollRuns.find((r: any) => r.id === selectedRunId)?.year}
                </p>
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                {[
                  ["Employee Name", payslipEntry.employeeName],
                  ["Department", payslipEntry.department],
                  [
                    "Designation",
                    employees.find((e: any) => e.id === payslipEntry.employeeId)?.designation || "",
                  ],
                  [
                    "PAN Number",
                    employees.find((e: any) => e.id === payslipEntry.employeeId)?.panNumber || "",
                  ],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <span className="text-gray-500">{l}: </span>
                    <span className="font-medium">{v as string}</span>
                  </div>
                ))}
              </div>

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-700 border-b pb-1 mb-2">Earnings</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ["Basic Salary", payslipEntry.basicSalary],
                        ["House Rent Allowance", payslipEntry.houseRentAllowance],
                        ["Medical Allowance", payslipEntry.medicalAllowance],
                        ["Transport Allowance", payslipEntry.transportAllowance],
                        ["Other Allowances", payslipEntry.otherAllowances],
                        ["Overtime Pay", payslipEntry.overtimePay],
                      ].map(([l, v]) => (
                        <tr key={l as string}>
                          <td className="py-1 text-gray-600">{l as string}</td>
                          <td className="py-1 text-right">{fmt(v as number)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold border-t">
                        <td className="py-1">Gross Salary</td>
                        <td className="py-1 text-right">{fmt(payslipEntry.grossSalary)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 border-b pb-1 mb-2">Deductions</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        ["EPF (Employee 10%)", payslipEntry.epfEmployee],
                        ["CIT (10%)", payslipEntry.citEmployee],
                        ["SSF (Employee 1%)", payslipEntry.ssfEmployee],
                        ["Income Tax (TDS)", payslipEntry.tdsAmount],
                        ["Other Deductions", payslipEntry.otherDeductions],
                      ].map(([l, v]) => (
                        <tr key={l as string}>
                          <td className="py-1 text-gray-600">{l as string}</td>
                          <td className="py-1 text-right">{fmt(v as number)}</td>
                        </tr>
                      ))}
                      <tr className="font-bold border-t">
                        <td className="py-1">Total Deductions</td>
                        <td className="py-1 text-right">{fmt(payslipEntry.totalDeductions)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Pay */}
              <div className="mt-6 bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-sm text-gray-600">NET PAY (Take Home)</div>
                <div className="text-[15px] font-semibold text-blue-700 mt-1">
                  {fmt(payslipEntry.netPay)}
                </div>
              </div>

              {/* Employer Contributions (informational) */}
              <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <div className="font-semibold mb-1">
                  Employer Contributions (not deducted from salary)
                </div>
                <div className="flex gap-6">
                  <span>EPF (Employer 10%): {fmt(payslipEntry.epfEmployer)}</span>
                  <span>SSF (Employer 3.33%): {fmt(payslipEntry.ssfEmployer)}</span>
                </div>
              </div>

              {/* Tax Workings */}
              <div className="mt-4 bg-yellow-50 rounded-lg p-3 text-xs">
                <div className="font-semibold text-yellow-800 mb-1">
                  TDS Calculation Workings (Annual)
                </div>
                <div className="space-y-0.5 text-yellow-700">
                  <div>Annualised Gross: {fmt(payslipEntry.annualisedGross)}</div>
                  <div>
                    Less: EPF + CIT (annual):{" "}
                    {fmt((payslipEntry.epfEmployee + payslipEntry.citEmployee) * 12)}
                  </div>
                  <div>
                    Less: Personal Exemption:{" "}
                    {fmt(
                      employees.find((e: any) => e.id === payslipEntry.employeeId)
                        ?.maritalStatus === "married"
                        ? 500000
                        : 400000,
                    )}
                  </div>
                  <div>Taxable Income: {fmt(payslipEntry.taxableIncome)}</div>
                  <div>Annual Tax: {fmt(payslipEntry.annualTax)}</div>
                  <div className="font-semibold">Monthly TDS: {fmt(payslipEntry.tdsAmount)}</div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800"
                >
                  <FileText className="w-4 h-4" /> Print Payslip
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">
              Select a month and employee to view payslip.
            </div>
          )}
        </div>
      )}

      {/* ── EMPLOYEE MODAL ───────────────────────────────────────────────── */}
      {showEmpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">
                {editEmp ? "Edit Employee" : "Add Employee"}
              </h2>
              <button onClick={() => setShowEmpModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                ["employeeCode", "Employee Code", "text"],
                ["name", "Full Name", "text"],
                ["department", "Department", "text"],
                ["designation", "Designation", "text"],
                ["panNumber", "PAN Number", "text"],
                ["bankName", "Bank Name", "text"],
                ["bankAccount", "Bank Account", "text"],
                ["joiningDate", "Joining Date", "date"],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(empForm as any)[field] || ""}
                    onChange={(e) => setEmpForm({ ...empForm, [field]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={empForm.gender}
                  onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marital Status
                </label>
                <select
                  value={empForm.maritalStatus}
                  onChange={(e) => setEmpForm({ ...empForm, maritalStatus: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-6 pt-2">
                {[
                  ["epfApplicable", "EPF Applicable (10%)"],
                  ["citApplicable", "CIT Applicable (10%)"],
                  ["ssfApplicable", "SSF Applicable (1%+3.33%)"],
                  ["isActive", "Active"],
                ].map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(empForm as any)[field]}
                      onChange={(e) => setEmpForm({ ...empForm, [field]: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button
                onClick={() => setShowEmpModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Save Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SALARY MODAL ─────────────────────────────────────────────────── */}
      {showSalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Add / Revise Salary Structure</h2>
              <button onClick={() => setShowSalModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={salForm.employeeId}
                  onChange={(e) => setSalForm({ ...salForm, employeeId: +e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={0}>Select Employee</option>
                  {scopedEmployees
                    .filter((e: any) => e.isActive)
                    .map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={salForm.effectiveFrom}
                  onChange={(e) => setSalForm({ ...salForm, effectiveFrom: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["basicSalary", "Basic Salary"],
                  ["houseRentAllowance", "House Rent Allowance"],
                  ["medicalAllowance", "Medical Allowance"],
                  ["transportAllowance", "Transport Allowance"],
                  ["otherAllowances", "Other Allowances"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type="number"
                      value={(salForm as any)[field] || 0}
                      onChange={(e) => setSalForm({ ...salForm, [field]: +e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <div className="bg-green-50 rounded-lg p-3 flex flex-col justify-center">
                  <div className="text-xs text-gray-500">Gross Salary</div>
                  <div className="text-lg font-bold text-green-700">
                    {fmt(
                      salForm.basicSalary +
                        salForm.houseRentAllowance +
                        salForm.medicalAllowance +
                        salForm.transportAllowance +
                        salForm.otherAllowances,
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <button
                onClick={() => setShowSalModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSalary}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                Save Structure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
