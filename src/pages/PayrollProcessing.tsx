import React, { useCallback, useMemo, useState } from "react";
import {
  Users,
  DollarSign,
  Calculator,
  Download,
  Printer,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Edit2,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  computePayrollBatch,
  getPayrollSummary,
  generatePayslipData,
  type EmployeePayrollInput,
  type PayrollResult,
} from "@/lib/nepalPayrollEngine";
import * as XLSX from "xlsx";

interface Employee {
  id: string;
  name: string;
  designation: string;
  department: string;
  panNo: string;
  pfNo: string;
  ssfNo: string;
  basicSalary: number;
  gradeAllowance: number;
  houseRentAllowance: number;
  medicalAllowance: number;
  fuelAllowance: number;
  telephoneAllowance: number;
  otherAllowances: number;
  isSSFContributor: boolean;
  isPFContributor: boolean;
  paymentMode: "bank" | "cash" | "cheque";
  bankName: string;
  bankAccount: string;
  joiningDate: string;
  isActive: boolean;
}

const EMPLOYEE_KEY = "sutra_employees";
const PAYROLL_RUN_KEY = "sutra_payroll_runs";

const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

function loadEmployees(companyId: string): Employee[] {
  try {
    const raw = localStorage.getItem(EMPLOYEE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((emp: any) => !emp.companyId || emp.companyId === companyId)
      .map((emp: any) => ({
        id: emp.id ?? crypto.randomUUID(),
        name: emp.name ?? "",
        designation: emp.designation ?? "",
        department: emp.department ?? "",
        panNo: emp.panNo ?? "",
        pfNo: emp.pfNo ?? "",
        ssfNo: emp.ssfNo ?? "",
        basicSalary: Number(emp.basicSalary ?? 0),
        gradeAllowance: Number(emp.gradeAllowance ?? 0),
        houseRentAllowance: Number(emp.houseRentAllowance ?? 0),
        medicalAllowance: Number(emp.medicalAllowance ?? 0),
        fuelAllowance: Number(emp.fuelAllowance ?? 0),
        telephoneAllowance: Number(emp.telephoneAllowance ?? 0),
        otherAllowances: Number(emp.otherAllowances ?? 0),
        isSSFContributor: Boolean(emp.isSSFContributor),
        isPFContributor: Boolean(emp.isPFContributor),
        paymentMode: emp.paymentMode ?? "bank",
        bankName: emp.bankName ?? "",
        bankAccount: emp.bankAccount ?? "",
        joiningDate: emp.joiningDate ?? "",
        isActive: emp.isActive !== false,
      }));
  } catch {
    return [];
  }
}

function saveEmployee(emp: Employee, companyId: string): void {
  try {
    const raw = localStorage.getItem(EMPLOYEE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(all) ? all : [];
    const withCompany = { ...emp, companyId };
    const idx = list.findIndex((x: any) => x.id === emp.id);

    if (idx >= 0) list[idx] = withCompany;
    else list.push(withCompany);

    localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
}

function savePayrollRun(run: any): void {
  try {
    const raw = localStorage.getItem(PAYROLL_RUN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    arr.push(run);
    localStorage.setItem(PAYROLL_RUN_KEY, JSON.stringify(arr));
  } catch {
    // no-op
  }
}

function money(n: number): string {
  return Number(n || 0).toLocaleString("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function totalAllowances(emp: Employee): number {
  return (
    Number(emp.gradeAllowance || 0) +
    Number(emp.houseRentAllowance || 0) +
    Number(emp.medicalAllowance || 0) +
    Number(emp.fuelAllowance || 0) +
    Number(emp.telephoneAllowance || 0) +
    Number(emp.otherAllowances || 0)
  );
}

const blankEmployee: Employee = {
  id: "",
  name: "",
  designation: "",
  department: "",
  panNo: "",
  pfNo: "",
  ssfNo: "",
  basicSalary: 0,
  gradeAllowance: 0,
  houseRentAllowance: 0,
  medicalAllowance: 0,
  fuelAllowance: 0,
  telephoneAllowance: 0,
  otherAllowances: 0,
  isSSFContributor: true,
  isPFContributor: false,
  paymentMode: "bank",
  bankName: "",
  bankAccount: "",
  joiningDate: new Date().toISOString().split("T")[0],
  isActive: true,
};

export default function PayrollProcessing() {
  const store = useStore() as any;
  const companyId = store.currentCompany?.id ?? "default";
  const companyName = store.currentCompany?.name ?? store.companySettings?.name ?? "Company Name";

  const [employees, setEmployees] = useState<Employee[]>(() => loadEmployees(companyId));
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [selectedYear, setSelectedYear] = useState(2081);
  const [workingDays, setWorkingDays] = useState(26);
  const [payrollResults, setPayrollResults] = useState<PayrollResult[]>([]);
  const [payrollProcessed, setPayrollProcessed] = useState(false);
  const [activeTab, setActiveTab] = useState<"employees" | "process" | "summary" | "payslips">(
    "employees",
  );
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [attendanceOverrides, setAttendanceOverrides] = useState<
    Record<string, { presentDays: number; workingDays: number; overtimeHours: number }>
  >({});
  const [advanceDeductions, setAdvanceDeductions] = useState<Record<string, number>>({});
  const [otherDeductions, setOtherDeductions] = useState<Record<string, number>>({});
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const activeEmployees = useMemo(() => employees.filter((emp) => emp.isActive), [employees]);

  const payrollSummary = useMemo(() => getPayrollSummary(payrollResults), [payrollResults]);

  const refreshEmployees = () => {
    setEmployees(loadEmployees(companyId));
  };

  const handleProcessPayroll = useCallback(() => {
    const inputs: EmployeePayrollInput[] = activeEmployees.map((emp) => {
      const attendance = attendanceOverrides[emp.id] ?? {
        presentDays: workingDays,
        workingDays,
        overtimeHours: 0,
      };

      const overtimeRate = emp.basicSalary / (26 * 8);

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        designation: emp.designation,
        department: emp.department,
        panNo: emp.panNo,
        pfNo: emp.pfNo,
        ssfNo: emp.ssfNo,
        citizenshipNo: "",
        bankAccount: emp.bankAccount,
        bankName: emp.bankName,
        joiningDate: emp.joiningDate,
        salaryStructure: {
          basicSalary: emp.basicSalary,
          gradeAllowance: emp.gradeAllowance,
          houseRentAllowance: emp.houseRentAllowance,
          medicalAllowance: emp.medicalAllowance,
          fuelAllowance: emp.fuelAllowance,
          telephoneAllowance: emp.telephoneAllowance,
          otherAllowances: emp.otherAllowances,
        },
        presentDays: attendance.presentDays,
        workingDays: attendance.workingDays,
        overtimeHours: attendance.overtimeHours,
        overtimeRate,
        advanceDeduction: advanceDeductions[emp.id] ?? 0,
        otherDeductions: otherDeductions[emp.id] ?? 0,
        arrears: 0,
        bonus: 0,
        isSSFContributor: emp.isSSFContributor,
        isPFContributor: emp.isPFContributor,
        fiscalYear: `${selectedYear}-${String(selectedYear + 1).slice(-2)}`,
        month: selectedMonth,
        paymentMode: emp.paymentMode,
      };
    });

    const results = computePayrollBatch(inputs);
    setPayrollResults(results);
    setPayrollProcessed(true);

    savePayrollRun({
      id: crypto.randomUUID(),
      companyId,
      month: selectedMonth,
      year: selectedYear,
      results,
      createdAt: new Date().toISOString(),
    });

    setActiveTab("summary");
  }, [
    activeEmployees,
    attendanceOverrides,
    workingDays,
    advanceDeductions,
    otherDeductions,
    selectedMonth,
    selectedYear,
    companyId,
  ]);

  const handleExportExcel = () => {
    const rows = payrollResults.map((r) => ({
      "Emp Name": r.employeeName,
      Designation: r.designation,
      Dept: r.department,
      Basic: r.basicSalary,
      "Total Allowances":
        r.gradeAllowance +
        r.houseRentAllowance +
        r.medicalAllowance +
        r.fuelAllowance +
        r.telephoneAllowance +
        r.otherAllowances,
      Gross: r.grossEarnings,
      "PF (Emp)": r.employeePF,
      "SSF (Emp)": r.employeeSSF,
      "Income Tax": r.incomeTax,
      "Total Deductions": r.totalDeductions,
      "Net Salary": r.netSalary,
      "Employer PF": r.employerPF,
      "Employer SSF": r.employerSSF,
      "Total Employer Cost": r.totalEmployerCost,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, `payroll_${selectedYear}_${selectedMonth}.xlsx`);
  };

  const handleExportBank = () => {
    const rows = payrollResults
      .map((r) => {
        const emp = employees.find((e) => e.id === r.employeeId);
        return { r, emp };
      })
      .filter(({ emp }) => emp?.paymentMode === "bank")
      .map(({ r, emp }) => ({
        "Employee Name": r.employeeName,
        Bank: emp?.bankName ?? "",
        "Account No": emp?.bankAccount ?? "",
        "Net Salary": r.netSalary,
        Remarks: `${NEPALI_MONTHS[selectedMonth - 1]} ${selectedYear} salary`,
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Transfer");
    XLSX.writeFile(wb, `bank_transfer_${selectedYear}_${selectedMonth}.xlsx`);
  };

  const handlePrintPayslip = (result: PayrollResult) => {
    const emp = employees.find((e) => e.id === result.employeeId);
    const slip = generatePayslipData(
      result,
      companyName,
      NEPALI_MONTHS[selectedMonth - 1],
      String(selectedYear),
    );

    slip.header.panNo = emp?.panNo;

    const earningsRows = slip.earnings
      .map(
        (x) => `<tr><td>${x.label}</td><td style="text-align:right;">${money(x.amount)}</td></tr>`,
      )
      .join("");

    const deductionsRows = slip.deductions
      .map(
        (x) => `<tr><td>${x.label}</td><td style="text-align:right;">${money(x.amount)}</td></tr>`,
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Payslip - ${result.employeeName}</title>
          <style>
            body { font-family: Arial, sans-serif; color: var(--ds-border-default); background: var(--ds-surface); padding: 24px; }
            .payslip { max-width: 760px; margin: 0 auto; border: 1px solid var(--ds-border-default); padding: 18px; }
            h1, h2, h3 { margin: 0; }
            .center { text-align: center; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; font-size: 12px; margin: 16px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid var(--ds-border-default); padding: 6px 8px; }
            th { background: var(--ds-border-default); text-align: left; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .net { margin-top: 14px; border: 1px solid var(--ds-border-default); padding: 10px; font-size: 14px; font-weight: bold; }
            .sign { display: flex; justify-content: space-between; margin-top: 52px; font-size: 12px; }
            @media print { body { padding: 0; } .payslip { border: none; } @page { size: A5 landscape; margin: 10mm; } }
          </style>
        </head>
        <body>
          <div class="payslip">
            <div class="center">
              <h2>${slip.header.companyName}</h2>
              <h3>Payslip</h3>
              <div>${slip.header.month} ${slip.header.year}</div>
            </div>

            <div class="meta">
              <div><b>Employee:</b> ${slip.header.employeeName}</div>
              <div><b>PAN:</b> ${slip.header.panNo || "—"}</div>
              <div><b>Designation:</b> ${slip.header.designation}</div>
              <div><b>Department:</b> ${slip.header.department}</div>
            </div>

            <div class="grid">
              <div>
                <h3>Earnings</h3>
                <table>
                  <thead><tr><th>Particular</th><th>Amount</th></tr></thead>
                  <tbody>${earningsRows}</tbody>
                  <tfoot><tr><th>Gross Earnings</th><th style="text-align:right;">${money(slip.grossEarnings)}</th></tr></tfoot>
                </table>
              </div>
              <div>
                <h3>Deductions</h3>
                <table>
                  <thead><tr><th>Particular</th><th>Amount</th></tr></thead>
                  <tbody>${deductionsRows}</tbody>
                  <tfoot><tr><th>Total Deductions</th><th style="text-align:right;">${money(slip.totalDeductions)}</th></tr></tfoot>
                </table>
              </div>
            </div>

            <div class="net">
              Net Salary: Rs. ${money(slip.netSalary)}<br/>
              ${slip.netSalaryWords}
            </div>

            <div class="sign">
              <div>Prepared By<br/><br/>__________________</div>
              <div>Received By<br/><br/>__________________</div>
              <div>Authorized By<br/><br/>__________________</div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const openNewEmployee = () => {
    setEditingEmployee({ ...blankEmployee, id: crypto.randomUUID() });
    setShowEmployeeModal(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee({ ...emp });
    setShowEmployeeModal(true);
  };

  const saveEditingEmployee = () => {
    if (!editingEmployee) return;
    if (!editingEmployee.name.trim()) {
      alert("Employee name is required");
      return;
    }
    saveEmployee(editingEmployee, companyId);
    refreshEmployees();
    setShowEmployeeModal(false);
    setEditingEmployee(null);
  };

  const updateAttendance = (
    empId: string,
    patch: Partial<{ presentDays: number; workingDays: number; overtimeHours: number }>,
  ) => {
    setAttendanceOverrides((prev) => ({
      ...prev,
      [empId]: {
        presentDays: prev[empId]?.presentDays ?? workingDays,
        workingDays: prev[empId]?.workingDays ?? workingDays,
        overtimeHours: prev[empId]?.overtimeHours ?? 0,
        ...patch,
      },
    }));
  };

  const totalBasic = payrollResults.reduce((s, r) => s + r.basicSalary, 0);
  const totalAllowancesAmount = payrollResults.reduce(
    (s, r) =>
      s +
      r.gradeAllowance +
      r.houseRentAllowance +
      r.medicalAllowance +
      r.fuelAllowance +
      r.telephoneAllowance +
      r.otherAllowances,
    0,
  );
  const totalOT = payrollResults.reduce((s, r) => s + r.overtimePay, 0);

  return (
    <div className="p-6 bg-[var(--ds-canvas)] min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Payroll</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Process monthly salary with Nepal income tax, SSF, PF deductions
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!payrollProcessed}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportBank}
            disabled={!payrollProcessed}
            className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Export Bank Transfer
          </button>
          <button
            type="button"
            onClick={handleProcessPayroll}
            className="h-9 px-4 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] font-semibold rounded-md flex items-center gap-1.5"
          >
            <Calculator className="h-3.5 w-3.5" />
            Process Payroll
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex items-center gap-3">
        <span className="text-[12px] text-gray-700 font-medium">Payroll for:</span>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white"
        >
          {NEPALI_MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-24"
        />
        <span className="text-[12px] text-gray-700 ml-3">Working Days:</span>
        <input
          type="number"
          value={workingDays}
          onChange={(e) => setWorkingDays(Number(e.target.value))}
          className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20"
        />
      </div>

      <div className="flex border-b border-gray-200 mb-4">
        {[
          ["employees", "Employees"],
          ["process", "Attendance & Advances"],
          ["payslips", "Payroll Results"],
          ["summary", "Summary & Reports"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={
              activeTab === key
                ? "px-4 py-2 border-b-2 border-[var(--ds-action-primary)] text-[var(--ds-action-primary)] text-[12px] font-medium"
                : "px-4 py-2 text-gray-500 text-[12px] hover:text-gray-700"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "employees" && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-200 flex justify-end">
            <button
              type="button"
              onClick={openNewEmployee}
              className="h-8 px-3 bg-[var(--ds-action-primary)] hover:bg-[var(--ds-action-primary-hover)] text-white text-[12px] rounded-md"
            >
              + Add Employee
            </button>
          </div>
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                {[
                  "Name",
                  "Designation",
                  "Dept",
                  "Basic Salary",
                  "Total Allowances",
                  "SSF",
                  "PF",
                  "Payment Mode",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[12px] text-gray-400">
                    No employees added
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                      {emp.name}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{emp.designation}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{emp.department}</td>
                    <td className="number-cell">
                      {money(emp.basicSalary)}
                    </td>
                    <td className="number-cell">
                      {money(totalAllowances(emp))}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">
                      {emp.isSSFContributor ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">
                      {emp.isPFContributor ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 capitalize">
                      {emp.paymentMode}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[12px] font-semibold uppercase ${
                          emp.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEmployee(emp)}
                          className="h-7 w-7 border border-gray-300 rounded text-[var(--ds-action-primary)] bg-white"
                        >
                          <Edit2 className="h-3.5 w-3.5 mx-auto" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            saveEmployee({ ...emp, isActive: !emp.isActive }, companyId);
                            refreshEmployees();
                          }}
                          className="h-7 px-2 border border-gray-300 rounded text-[12px] bg-white"
                        >
                          {emp.isActive ? "Inactive" : "Active"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "process" && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                {[
                  "Employee Name",
                  "Present Days",
                  "Working Days",
                  "OT Hours",
                  "Advance Deduction",
                  "Other Deductions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((emp) => {
                const att = attendanceOverrides[emp.id] ?? {
                  presentDays: workingDays,
                  workingDays,
                  overtimeHours: 0,
                };

                return (
                  <tr key={emp.id} className="border-b border-gray-100">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">
                      {emp.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={att.presentDays}
                        onChange={(e) =>
                          updateAttendance(emp.id, { presentDays: Number(e.target.value) })
                        }
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={att.workingDays}
                        onChange={(e) =>
                          updateAttendance(emp.id, { workingDays: Number(e.target.value) })
                        }
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={att.overtimeHours}
                        onChange={(e) =>
                          updateAttendance(emp.id, { overtimeHours: Number(e.target.value) })
                        }
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-20"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={advanceDeductions[emp.id] ?? 0}
                        onChange={(e) =>
                          setAdvanceDeductions({
                            ...advanceDeductions,
                            [emp.id]: Number(e.target.value),
                          })
                        }
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-28 text-right"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        value={otherDeductions[emp.id] ?? 0}
                        onChange={(e) =>
                          setOtherDeductions({
                            ...otherDeductions,
                            [emp.id]: Number(e.target.value),
                          })
                        }
                        className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-28 text-right"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "payslips" && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {!payrollProcessed ? (
            <div className="py-14 text-center">
              <Calculator className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-[12px] text-gray-400">
                Click 'Process Payroll' to calculate salaries
              </p>
            </div>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr className="bg-[var(--ds-canvas)] border-b border-gray-200">
                  {[
                    "Employee",
                    "Gross Earnings",
                    "Employee PF",
                    "Employee SSF",
                    "Income Tax",
                    "Total Deductions",
                    "Net Salary",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[12px] font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollResults.map((r) => (
                  <React.Fragment key={r.employeeId}>
                    <tr
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        setExpandedEmployee(expandedEmployee === r.employeeId ? null : r.employeeId)
                      }
                    >
                      <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium flex items-center gap-1">
                        <ChevronRight className="h-3.5 w-3.5" />
                        {r.employeeName}
                      </td>
                      <td className="number-cell">
                        {money(r.grossEarnings)}
                      </td>
                      <td className="number-cell">
                        {money(r.employeePF)}
                      </td>
                      <td className="number-cell">
                        {money(r.employeeSSF)}
                      </td>
                      <td className="number-cell">
                        {money(r.incomeTax)}
                      </td>
                      <td className="number-cell">
                        {money(r.totalDeductions)}
                      </td>
                      <td className="number-cell-bold text-[var(--ds-action-primary)]">
                        {money(r.netSalary)}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPayslip(r);
                          }}
                          className="h-7 px-2 bg-white border border-gray-300 text-gray-700 text-[12px] rounded flex items-center gap-1"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Payslip
                        </button>
                      </td>
                    </tr>

                    {expandedEmployee === r.employeeId && (
                      <tr>
                        <td colSpan={8} className="p-3 bg-gray-50">
                          <div className="grid grid-cols-2 gap-4 text-[12px]">
                            <div className="bg-white border rounded p-3">
                              <h3 className="font-semibold mb-2">Earnings</h3>
                              {[
                                ["Basic", r.basicSalary],
                                ["Grade", r.gradeAllowance],
                                ["HRA", r.houseRentAllowance],
                                ["Medical", r.medicalAllowance],
                                ["Fuel", r.fuelAllowance],
                                ["Telephone", r.telephoneAllowance],
                                ["Other", r.otherAllowances],
                                ["Overtime", r.overtimePay],
                                ["Arrears", r.arrears],
                                ["Bonus", r.bonus],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="flex justify-between py-0.5">
                                  <span>{label}</span>
                                  <span className="number-cell">{money(Number(value))}</span>
                                </div>
                              ))}
                            </div>
                            <div className="bg-white border rounded p-3">
                              <h3 className="font-semibold mb-2">Deductions</h3>
                              {[
                                ["Employee PF", r.employeePF],
                                ["Employee SSF", r.employeeSSF],
                                ["Income Tax", r.incomeTax],
                                ["Advance", r.advanceDeduction],
                                ["Other", r.otherDeductions],
                              ].map(([label, value]) => (
                                <div key={String(label)} className="flex justify-between py-0.5">
                                  <span>{label}</span>
                                  <span className="number-cell">{money(Number(value))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                <tr className="bg-[var(--ds-surface-selected)] font-bold border-t-2 border-[var(--ds-border-strong)]">
                  <td className="px-3 py-2.5 text-[12px]">Total</td>
                  <td className="number-cell">
                    {money(payrollSummary.totalGrossEarnings)}
                  </td>
                  <td className="number-cell">
                    {money(payrollSummary.totalEmployeePF)}
                  </td>
                  <td className="number-cell">
                    {money(payrollSummary.totalEmployeeSSF)}
                  </td>
                  <td className="number-cell">
                    {money(payrollSummary.totalIncomeTax)}
                  </td>
                  <td className="number-cell">
                    {money(payrollSummary.totalDeductions)}
                  </td>
                  <td className="number-cell">
                    {money(payrollSummary.totalNetSalary)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "summary" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-800 mb-3">Earnings Summary</h2>
            {[
              ["Total Gross", payrollSummary.totalGrossEarnings],
              ["Total Basic", totalBasic],
              ["Total Allowances", totalAllowancesAmount],
              ["Total OT", totalOT],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex justify-between py-2 text-[12px] border-b border-gray-100"
              >
                <span className="text-gray-700">{label}</span>
                <span className="number-cell text-gray-800">{money(Number(value))}</span>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-[13px] font-semibold text-gray-800 mb-3">
              Deductions & Employer Cost
            </h2>
            {[
              ["Employee PF", payrollSummary.totalEmployeePF],
              ["Employer PF", payrollSummary.totalEmployerPF],
              ["Employee SSF", payrollSummary.totalEmployeeSSF],
              ["Employer SSF", payrollSummary.totalEmployerSSF],
              ["Income Tax", payrollSummary.totalIncomeTax],
              ["Total Net Salary", payrollSummary.totalNetSalary],
              ["Total Employer Cost", payrollSummary.totalEmployerCost],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex justify-between py-2 text-[12px] border-b border-gray-100"
              >
                <span className="text-gray-700">{label}</span>
                <span className="number-cell text-gray-800">{money(Number(value))}</span>
              </div>
            ))}
          </div>

          <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-5">
            <div className="text-[13px] font-semibold text-[var(--ds-action-primary)]">
              Total Net Salary Payable: Rs. {money(payrollSummary.totalNetSalary)}
            </div>
            <div className="text-[12px] text-gray-600 mt-1">
              Total Employer Cost: Rs. {money(payrollSummary.totalEmployerCost)}
            </div>
          </div>
        </div>
      )}

      {showEmployeeModal && editingEmployee && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-[14px] font-semibold text-gray-800">
                {employees.some((e) => e.id === editingEmployee.id)
                  ? "Edit Employee"
                  : "Add Employee"}
              </h2>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              {[
                ["Name", "name", "text"],
                ["Designation", "designation", "text"],
                ["Department", "department", "text"],
                ["PAN No", "panNo", "text"],
                ["PF No", "pfNo", "text"],
                ["SSF No", "ssfNo", "text"],
                ["Basic Salary", "basicSalary", "number"],
                ["Grade Allowance", "gradeAllowance", "number"],
                ["HRA", "houseRentAllowance", "number"],
                ["Medical", "medicalAllowance", "number"],
                ["Fuel", "fuelAllowance", "number"],
                ["Phone", "telephoneAllowance", "number"],
                ["Other Allowances", "otherAllowances", "number"],
                ["Bank Name", "bankName", "text"],
                ["Bank Account", "bankAccount", "text"],
                ["Joining Date", "joiningDate", "date"],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(editingEmployee as any)[key]}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      } as Employee)
                    }
                    className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-full"
                  />
                </div>
              ))}

              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">
                  Payment Mode
                </label>
                <select
                  value={editingEmployee.paymentMode}
                  onChange={(e) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      paymentMode: e.target.value as Employee["paymentMode"],
                    })
                  }
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white w-full"
                >
                  <option value="bank">Bank</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="flex items-center gap-4 mt-5">
                <label className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingEmployee.isSSFContributor}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        isSSFContributor: e.target.checked,
                      })
                    }
                  />
                  SSF Contributor
                </label>
                <label className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingEmployee.isPFContributor}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        isPFContributor: e.target.checked,
                      })
                    }
                  />
                  PF Contributor
                </label>
                <label className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={editingEmployee.isActive}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        isActive: e.target.checked,
                      })
                    }
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditingEmployee}
                className="h-8 px-3 bg-[var(--ds-action-primary)] text-white text-[12px] rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
