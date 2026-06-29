// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import toast from "react-hot-toast";
import {
  Users,
  Calculator,
  FileText,
  Download,
  Calendar,
  DollarSign,
  CheckCircle,
  UserCheck,
  Clock,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const PayrollRun: React.FC = () => {
  const { employees, payHeads, companySettings, currentFiscalYear, addVoucher, accounts } =
    useStore();
  const [step, setStep] = useState(1);
  const [selectedYear, setSelectedYear] = useState(currentFiscalYear?.name || "");
  const [selectedMonth, setSelectedMonth] = useState(4); // April (Baisakh) as default
  const [workingDays, setWorkingDays] = useState(26);
  const [payrollDate, setPayrollDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [payrollResults, setPayrollResults] = useState<any[]>([]);
  const [editingCell, setEditingCell] = useState<{ empId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const nepaliMonths = [
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

  // Load employees and initialize attendance
  const handleLoadEmployees = () => {
    const initialAttendance = {};
    employees
      .filter((emp) => emp.isActive)
      .forEach((emp) => {
        initialAttendance[emp.id] = {
          empId: emp.id,
          empCode: emp.code || "",
          name: emp.name || "",
          department: emp.department || "",
          basicSalary: emp.salaryDetails?.basicSalary || emp.basicSalary || 0,
          presentDays: workingDays,
          absentDays: 0,
          otHours: 0,
          advanceDeduct: 0,
          otherDeduct: 0,
          arrears: 0,
          bonus: 0,
        };
      });
    setAttendance(initialAttendance);
    setStep(2);
  };

  // Compute employee salary
  function computeEmployeeSalary(
    emp,
    payHeads,
    presentDays,
    workingDays,
    otHrs,
    advDeduct,
    otherDeduct,
    arrears,
    bonus,
  ) {
    const basic = Number(emp.salaryDetails?.basicSalary || emp.basicSalary || 0);

    // Compute each payHead
    let earnTotal = basic;
    (payHeads || [])
      .filter((ph) => ph.payHeadType === "earnings" || ph.category === "earnings")
      .forEach((ph) => {
        if (ph.calculationType === "pct_of_basic" || ph.calcType === "percentage") {
          earnTotal += (basic * Number(ph.percentage || ph.rate || 0)) / 100;
        } else if (ph.calculationType === "flat_rate" || ph.calcType === "fixed") {
          earnTotal += Number(ph.rate || ph.amount || 0);
        }
      });

    const grossEarnings = earnTotal + arrears + bonus;
    const proratedGross = workingDays > 0 ? (grossEarnings / workingDays) * presentDays : 0;

    // OT pay (1.5x rate)
    const dailyRate = basic / workingDays;
    const hourlyRate = dailyRate / 8;
    const otPay = otHrs * hourlyRate * 1.5;
    const totalGross = proratedGross + otPay;

    // Nepal SSF: employee 11%, employer 20% of basic
    const empSSF = emp.isSSFContributor ? basic * 0.11 : 0;
    const empSSFEmployer = emp.isSSFContributor ? basic * 0.2 : 0;

    // Nepal PF: employee 10%, employer 10% of basic
    const empPF = emp.isPFContributor ? basic * 0.1 : 0;
    const empPFEmployer = emp.isPFContributor ? basic * 0.1 : 0;

    // CIT (Citizen Investment Trust): optional 10% of basic
    const cit = emp.isCITContributor ? basic * 0.1 : 0;

    // Income Tax — Nepal slab (FY 2081-82 rates)
    const annualGross = totalGross * 12;
    const ssaDeduction = 450000; // Social Security Allowance
    const pfDeductionAnnual = empPF * 12;
    const taxableIncome = Math.max(0, annualGross - ssaDeduction - pfDeductionAnnual);

    function computeAnnualTax(income, isWoman) {
      let tax = 0;
      if (income <= 500000) tax = income * 0.01;
      else if (income <= 700000) tax = 5000 + (income - 500000) * 0.1;
      else if (income <= 1000000) tax = 25000 + (income - 700000) * 0.2;
      else if (income <= 2000000) tax = 85000 + (income - 1000000) * 0.3;
      else tax = 385000 + (income - 2000000) * 0.36;
      if (isWoman) tax = tax * 0.9;
      return Math.round(tax);
    }

    const annualTax = computeAnnualTax(taxableIncome, emp.gender === "female");
    const monthlyTax = Math.round(annualTax / 12);

    const totalDeductions = empSSF + empPF + monthlyTax + cit + advDeduct + otherDeduct;
    const netSalary = totalGross - totalDeductions;

    return {
      basic,
      grossEarnings: totalGross,
      otPay,
      empSSF,
      empPF,
      cit,
      monthlyTax,
      advDeduct,
      otherDeduct,
      totalDeductions,
      netSalary,
      empSSFEmployer,
      empPFEmployer,
      annualTax,
    };
  }

  // Compute payroll
  const handleComputeSalary = () => {
    const results = Object.values(attendance)
      .map((record) => {
        const emp = employees.find((e) => e.id === record.empId);
        if (!emp) return null;

        const computed = computeEmployeeSalary(
          emp,
          payHeads,
          record.presentDays,
          workingDays,
          record.otHours,
          record.advanceDeduct,
          record.otherDeduct,
          record.arrears,
          record.bonus,
        );

        return {
          employeeId: record.empId,
          employeeName: record.name,
          basic: record.basicSalary,
          ...computed,
        };
      })
      .filter(Boolean);

    setPayrollResults(results);
    setStep(4); // Moving to step 4 as per original logic
  };

  // Post to accounts
  const handlePostToAccounts = async () => {
    try {
      // Calculate totals
      const totalGross = payrollResults.reduce((sum, r) => sum + r.grossEarnings, 0);
      const totalEmpSSF = payrollResults.reduce((sum, r) => sum + r.empSSF, 0);
      const totalEmpPF = payrollResults.reduce((sum, r) => sum + r.empPF, 0);
      const totalNet = payrollResults.reduce((sum, r) => sum + r.netSalary, 0);
      const totalEmployerSSF = payrollResults.reduce((sum, r) => sum + r.empSSFEmployer, 0);
      const totalEmployerPF = payrollResults.reduce((sum, r) => sum + r.empPFEmployer, 0);
      const totalTax = payrollResults.reduce((sum, r) => sum + r.monthlyTax, 0);

      // Find relevant accounts
      const salaryExpenseAccount = accounts.find(
        (a) => a.name.toLowerCase().includes("salary") && a.type === "expense",
      );
      const netSalaryPayableAccount = accounts.find((a) =>
        a.name.toLowerCase().includes("net salary payable"),
      );
      const ssfPayableAccount = accounts.find((a) => a.name.toLowerCase().includes("ssf payable"));
      const pfPayableAccount = accounts.find((a) => a.name.toLowerCase().includes("pf payable"));
      const incomeTaxPayableAccount = accounts.find((a) =>
        a.name.toLowerCase().includes("tax payable"),
      );
      const employerSSFAccount = accounts.find((a) =>
        a.name.toLowerCase().includes("employer ssf"),
      );
      const employerPFAccount = accounts.find((a) => a.name.toLowerCase().includes("employer pf"));

      if (!salaryExpenseAccount || !netSalaryPayableAccount) {
        toast.error("Required accounts not found. Please check your chart of accounts.");
        return;
      }

      // Create journal voucher
      const journalVoucher = {
        id: generateId(),
        type: "journal",
        date: payrollDate,
        dateNepali: "", // Will be calculated later
        narration: `Salary for ${nepaliMonths[selectedMonth - 1]} ${selectedYear}`,
        status: "posted",
        lines: [
          {
            accountId: salaryExpenseAccount.id,
            accountName: salaryExpenseAccount.name,
            debit: totalGross,
            credit: 0,
            narration: "Salary & Wages Expense",
          },
          {
            accountId: employerSSFAccount?.id || salaryExpenseAccount.id,
            accountName: employerSSFAccount?.name || salaryExpenseAccount.name,
            debit: totalEmployerSSF,
            credit: 0,
            narration: "Employer SSF Contribution",
          },
          {
            accountId: employerPFAccount?.id || salaryExpenseAccount.id,
            accountName: employerPFAccount?.name || salaryExpenseAccount.name,
            debit: totalEmployerPF,
            credit: 0,
            narration: "Employer PF Contribution",
          },
          {
            accountId: netSalaryPayableAccount.id,
            accountName: netSalaryPayableAccount.name,
            debit: 0,
            credit: totalNet,
            narration: "Net Salary Payable",
          },
          {
            accountId: ssfPayableAccount?.id || netSalaryPayableAccount.id,
            accountName: ssfPayableAccount?.name || netSalaryPayableAccount.name,
            debit: 0,
            credit: totalEmpSSF + totalEmployerSSF,
            narration: "SSF Payable",
          },
          {
            accountId: pfPayableAccount?.id || netSalaryPayableAccount.id,
            accountName: pfPayableAccount?.name || netSalaryPayableAccount.name,
            debit: 0,
            credit: totalEmpPF + totalEmployerPF,
            narration: "PF Payable",
          },
          {
            accountId: incomeTaxPayableAccount?.id || netSalaryPayableAccount.id,
            accountName: incomeTaxPayableAccount?.name || netSalaryPayableAccount.name,
            debit: 0,
            credit: totalTax,
            narration: "Income Tax Payable",
          },
        ].filter((line) => line.debit > 0 || line.credit > 0),
      };

      await addVoucher(journalVoucher);

      // Save payroll records to DB
      const db = getDB();
      await db.payrollRecords.bulkAdd(
        payrollResults.map((result) => ({
          id: generateId(),
          ...result,
          month: selectedMonth,
          year: selectedYear,
          processedDate: payrollDate,
        })),
      );

      toast.success("Payroll posted successfully!");
      setStep(5);
    } catch (error) {
      console.error("Error posting payroll:", error);
      toast.error("Failed to post payroll. Please try again.");
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const headers = [
      "Employee Name",
      "Gross",
      "SSF Emp",
      "PF Emp",
      "Tax TDS",
      "CIT",
      "OT Pay",
      "Advance",
      "Other",
      "Total Deductions",
      "Net Salary",
      "Employer Cost",
    ];

    const rows = payrollResults.map((result) => [
      result.employeeName,
      result.grossEarnings,
      result.empSSF,
      result.empPF,
      result.monthlyTax,
      result.cit,
      result.otPay,
      result.advDeduct,
      result.otherDeduct,
      result.totalDeductions,
      result.netSalary,
      result.grossEarnings + result.empSSFEmployer + result.empPFEmployer,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll Results");
    XLSX.writeFile(wb, `payroll_${selectedYear}_${nepaliMonths[selectedMonth - 1]}.xlsx`);
    toast.success("Payroll exported to Excel");
  };

  // Export bank file
  const handleExportBank = () => {
    const rows = payrollResults.map((result) => {
      const emp = employees.find((e) => e.id === result.employeeId);
      return {
        AccountNo: emp?.bankAccount || "",
        EmployeeName: result.employeeName,
        Amount: result.netSalary,
        Narration: `${nepaliMonths[selectedMonth - 1]} ${selectedYear} salary`,
      };
    });

    const csvContent = [
      ["AccountNo", "EmployeeName", "Amount", "Narration"],
      ...rows.map((row) => [row.AccountNo, row.EmployeeName, row.Amount, row.Narration]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `bank_transfer_${selectedYear}_${nepaliMonths[selectedMonth - 1]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Bank file exported");
  };

  // Export PF submission
  const handleExportPF = () => {
    const headers = ["Employee", "PF Number", "Emp Contribution", "Employer Contribution"];
    const rows = payrollResults
      .filter((result) => result.empPF > 0)
      .map((result) => {
        const emp = employees.find((e) => e.id === result.employeeId);
        return [result.employeeName, emp?.pfNo || "", result.empPF, result.empPFEmployer];
      });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PF Submission");
    XLSX.writeFile(wb, `pf_submission_${selectedYear}_${nepaliMonths[selectedMonth - 1]}.xlsx`);
    toast.success("PF submission sheet exported");
  };

  // Export SSF submission
  const handleExportSSF = () => {
    const headers = ["Employee", "SSF Number", "Emp Contribution", "Employer Contribution"];
    const rows = payrollResults
      .filter((result) => result.empSSF > 0)
      .map((result) => {
        const emp = employees.find((e) => e.id === result.employeeId);
        return [result.employeeName, emp?.ssfNo || "", result.empSSF, result.empSSFEmployer];
      });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SSF Submission");
    XLSX.writeFile(wb, `ssf_submission_${selectedYear}_${nepaliMonths[selectedMonth - 1]}.xlsx`);
    toast.success("SSF submission sheet exported");
  };

  // Export salary tax certificate
  const handleExportTaxCertificate = () => {
    payrollResults.forEach((result) => {
      const emp = employees.find((e) => e.id === result.employeeId);
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(`${companySettings?.name || "Company Name"}`, 20, 20);

      doc.setFontSize(14);
      doc.text("Salary Tax Certificate", 20, 30);

      doc.setFontSize(12);
      doc.text(`Employee: ${result.employeeName}`, 20, 45);
      doc.text(`PAN: ${emp?.panNo || "N/A"}`, 20, 55);
      doc.text(`Period: ${nepaliMonths[selectedMonth - 1]} ${selectedYear}`, 20, 65);

      doc.autoTable({
        startY: 75,
        head: [["Description", "Amount"]],
        body: [
          ["Annual Gross Income", money(result.grossEarnings * 12)],
          ["Annual Tax Deducted", money(result.annualTax)],
          ["Net Annual Income", money((result.grossEarnings - result.monthlyTax) * 12)],
        ],
      });

      doc.save(
        `tax_certificate_${result.employeeName}_${selectedYear}_${nepaliMonths[selectedMonth - 1]}.pdf`,
      );
    });

    toast.success("Tax certificates generated");
  };

  // Start editing a cell
  const startEditing = (empId: string, field: string, value: any) => {
    setEditingCell({ empId, field });
    setEditValue(String(value));
  };

  // Save edited value
  const saveEdit = () => {
    if (editingCell) {
      const { empId, field } = editingCell;
      setAttendance((prev) => ({
        ...prev,
        [empId]: {
          ...prev[empId],
          [field]: isNaN(Number(editValue)) ? editValue : Number(editValue),
        },
      }));
      setEditingCell(null);
      setEditValue("");
    }
  };

  // Calculate totals
  const totals = payrollResults.reduce(
    (acc, r) => {
      acc.grossEarnings += r.grossEarnings;
      acc.empSSF += r.empSSF;
      acc.empPF += r.empPF;
      acc.monthlyTax += r.monthlyTax;
      acc.cit += r.cit;
      acc.otPay += r.otPay;
      acc.advDeduct += r.advDeduct;
      acc.otherDeduct += r.otherDeduct;
      acc.totalDeductions += r.totalDeductions;
      acc.netSalary += r.netSalary;
      acc.employerCost += r.grossEarnings + r.empSSFEmployer + r.empPFEmployer;
      return acc;
    },
    {
      grossEarnings: 0,
      empSSF: 0,
      empPF: 0,
      monthlyTax: 0,
      cit: 0,
      otPay: 0,
      advDeduct: 0,
      otherDeduct: 0,
      totalDeductions: 0,
      netSalary: 0,
      employerCost: 0,
    },
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4">
      <div className="w-full">
        {/* Standard Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-800">Payroll Run</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Process and manage employee payroll</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          {[1, 2, 3, 4, 5].map((num) => (
            <div key={num} className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold shadow-sm transition-colors text-[13px] ${
                  step >= num
                    ? "bg-[#1557b0] text-white border-transparent"
                    : "bg-gray-100 text-gray-500 border border-gray-200"
                }`}
              >
                {num}
              </div>
              <div
                className={`text-[10px] mt-1.5 font-medium uppercase tracking-wide ${step >= num ? "text-[#1557b0]" : "text-gray-400"}`}
              >
                {num === 1 && "Setup"}
                {num === 2 && "Attendance"}
                {num === 3 && "Compute"}
                {num === 4 && "Summary"}
                {num === 5 && "Post & Export"}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Setup */}
        {step === 1 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Fiscal Year
                </label>
                <input
                  type="text"
                  value={selectedYear}
                  readOnly
                  className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-md bg-gray-50 text-gray-500 w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">BS Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                >
                  {nepaliMonths.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Working Days
                </label>
                <input
                  type="number"
                  value={workingDays}
                  onChange={(e) => setWorkingDays(Number(e.target.value))}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Payroll Date
                </label>
                <input
                  type="date"
                  value={payrollDate}
                  onChange={(e) => setPayrollDate(e.target.value)}
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={handleLoadEmployees}
              >
                <UserCheck size={14} />
                Load Employees
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Attendance */}
        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-[13px] font-semibold text-gray-800">Attendance & Details</h2>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={handleComputeSalary}
              >
                <Calculator size={14} />
                Compute Salary
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Emp Code
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Department
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Basic Salary
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Present Days
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-red-600">
                      Absent Days
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-amber-600">
                      OT Hours
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Advance Deduct
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Other Deduct
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Arrears
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-green-600">
                      Bonus
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-12">
                      Edit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(attendance).map((record: any) => (
                    <tr
                      key={record.empId}
                      className="border-b border-gray-100 hover:bg-gray-50 group"
                    >
                      <td className="px-3 py-2 text-[12px] text-gray-700 font-mono">
                        {editingCell?.empId === record.empId && editingCell?.field === "empCode" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(record.empId, "empCode", record.empCode)}
                            className="cursor-pointer hover:text-[#1557b0] block w-full"
                          >
                            {record.empCode || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-800 font-medium">
                        {record.name}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-600">
                        {editingCell?.empId === record.empId &&
                        editingCell?.field === "department" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded outline-none"
                          />
                        ) : (
                          <span
                            onClick={() =>
                              startEditing(record.empId, "department", record.department)
                            }
                            className="cursor-pointer hover:text-[#1557b0] block w-full"
                          >
                            {record.department || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {editingCell?.empId === record.empId &&
                        editingCell?.field === "basicSalary" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() =>
                              startEditing(record.empId, "basicSalary", record.basicSalary)
                            }
                            className="cursor-pointer hover:text-[#1557b0] block w-full"
                          >
                            {money(record.basicSalary)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-800 font-medium text-right bg-blue-50/30">
                        {editingCell?.empId === record.empId &&
                        editingCell?.field === "presentDays" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() =>
                              startEditing(record.empId, "presentDays", record.presentDays)
                            }
                            className="cursor-pointer hover:text-[#1557b0] block w-full"
                          >
                            {record.presentDays}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 font-medium text-right bg-red-50/30">
                        {editingCell?.empId === record.empId &&
                        editingCell?.field === "absentDays" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() =>
                              startEditing(record.empId, "absentDays", record.absentDays)
                            }
                            className="cursor-pointer hover:text-[#1557b0] block w-full"
                          >
                            {record.absentDays}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-amber-700 font-medium text-right bg-amber-50/30">
                        {editingCell?.empId === record.empId && editingCell?.field === "otHours" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(record.empId, "otHours", record.otHours)}
                            className="cursor-pointer hover:text-[#1557b0] block w-full"
                          >
                            {record.otHours}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {editingCell?.empId === record.empId &&
                        editingCell?.field === "advanceDeduct" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() =>
                              startEditing(record.empId, "advanceDeduct", record.advanceDeduct)
                            }
                            className="cursor-pointer hover:text-[#1557b0] block w-full text-red-600"
                          >
                            {money(record.advanceDeduct)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {editingCell?.empId === record.empId &&
                        editingCell?.field === "otherDeduct" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() =>
                              startEditing(record.empId, "otherDeduct", record.otherDeduct)
                            }
                            className="cursor-pointer hover:text-[#1557b0] block w-full text-red-600"
                          >
                            {money(record.otherDeduct)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {editingCell?.empId === record.empId && editingCell?.field === "arrears" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(record.empId, "arrears", record.arrears)}
                            className="cursor-pointer hover:text-[#1557b0] block w-full text-green-600"
                          >
                            {money(record.arrears)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {editingCell?.empId === record.empId && editingCell?.field === "bonus" ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            autoFocus
                            className="w-full h-6 border border-[#1557b0] bg-white px-1.5 text-[11px] rounded text-right outline-none"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(record.empId, "bonus", record.bonus)}
                            className="cursor-pointer hover:text-[#1557b0] block w-full text-green-600"
                          >
                            {money(record.bonus)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400 group-hover:text-blue-500 transition-colors">
                        <button
                          className="p-1 hover:bg-blue-50 rounded"
                          onClick={() =>
                            startEditing(record.empId, "basicSalary", record.basicSalary)
                          }
                          title="Edit Employee Row"
                        >
                          <Calendar size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(attendance).length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No active employees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-[13px] font-semibold text-gray-800">Payroll Summary</h2>
              <button
                className="h-8 px-4 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-sm"
                onClick={handlePostToAccounts}
              >
                <CheckCircle size={14} />
                Post to Accounts
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Employee Name
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Gross
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      SSF Emp
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      PF Emp
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Tax TDS
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      CIT
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      OT Pay
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Advance
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Other
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Total Deductions
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-[#1557b0]">
                      Net Salary
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Employer Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payrollResults.map((result) => (
                    <tr
                      key={result.employeeId}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 text-[12px] text-gray-800 font-medium">
                        {result.employeeName}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {money(result.grossEarnings)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 text-right">
                        {money(result.empSSF)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 text-right">
                        {money(result.empPF)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 text-right">
                        {money(result.monthlyTax)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 text-right">
                        {money(result.cit)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-green-600 text-right">
                        {money(result.otPay)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 text-right">
                        {money(result.advDeduct)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-red-600 text-right">
                        {money(result.otherDeduct)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-800 font-medium text-right bg-gray-50/50">
                        {money(result.totalDeductions)}
                      </td>
                      <td
                        className={`px-3 py-2 text-[12px] font-semibold text-right bg-blue-50/30 ${result.netSalary >= 0 ? "text-[#1557b0]" : "text-red-600"}`}
                      >
                        {money(result.netSalary)}
                      </td>
                      <td className="px-3 py-2 text-[12px] text-gray-700 text-right">
                        {money(result.grossEarnings + result.empSSFEmployer + result.empPFEmployer)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe]">
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800">TOTALS</td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                      {money(totals.grossEarnings)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-red-700 text-right">
                      {money(totals.empSSF)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-red-700 text-right">
                      {money(totals.empPF)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-red-700 text-right">
                      {money(totals.monthlyTax)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-red-700 text-right">
                      {money(totals.cit)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-green-700 text-right">
                      {money(totals.otPay)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-red-700 text-right">
                      {money(totals.advDeduct)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-red-700 text-right">
                      {money(totals.otherDeduct)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                      {money(totals.totalDeductions)}
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-bold text-[#1557b0] text-right">
                      {money(totals.netSalary)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] font-bold text-gray-800 text-right">
                      {money(totals.employerCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 5: Post & Export */}
        {step === 5 && (
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-800">Payroll Posted Successfully</h2>
                <p className="text-[12px] text-gray-500">
                  Journal vouchers have been created. You can now export the required documents.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <button
                className="bg-white border border-gray-200 hover:border-[#1557b0] hover:bg-blue-50 hover:shadow-sm text-gray-700 px-4 py-5 rounded-md flex flex-col items-center gap-3 transition-all"
                onClick={handleExportExcel}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Download size={18} className="text-[#1557b0]" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-semibold">Export Excel</div>
                  <div className="text-[10px] text-gray-500 mt-1">Full Summary</div>
                </div>
              </button>

              <button
                className="bg-white border border-gray-200 hover:border-[#1557b0] hover:bg-blue-50 hover:shadow-sm text-gray-700 px-4 py-5 rounded-md flex flex-col items-center gap-3 transition-all"
                onClick={handleExportBank}
              >
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <DollarSign size={18} className="text-green-600" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-semibold">Bank File</div>
                  <div className="text-[10px] text-gray-500 mt-1">For NMB upload</div>
                </div>
              </button>

              <button
                className="bg-white border border-gray-200 hover:border-[#1557b0] hover:bg-blue-50 hover:shadow-sm text-gray-700 px-4 py-5 rounded-md flex flex-col items-center gap-3 transition-all"
                onClick={handleExportPF}
              >
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <FileText size={18} className="text-purple-600" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-semibold">PF Report</div>
                  <div className="text-[10px] text-gray-500 mt-1">Provident Fund</div>
                </div>
              </button>

              <button
                className="bg-white border border-gray-200 hover:border-[#1557b0] hover:bg-blue-50 hover:shadow-sm text-gray-700 px-4 py-5 rounded-md flex flex-col items-center gap-3 transition-all"
                onClick={handleExportSSF}
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <FileText size={18} className="text-amber-600" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-semibold">SSF Report</div>
                  <div className="text-[10px] text-gray-500 mt-1">Social Security</div>
                </div>
              </button>

              <button
                className="bg-white border border-gray-200 hover:border-[#1557b0] hover:bg-blue-50 hover:shadow-sm text-gray-700 px-4 py-5 rounded-md flex flex-col items-center gap-3 transition-all"
                onClick={handleExportTaxCertificate}
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <FileText size={18} className="text-red-600" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-semibold">Tax Certs</div>
                  <div className="text-[10px] text-gray-500 mt-1">Generate PDFs</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollRun;
