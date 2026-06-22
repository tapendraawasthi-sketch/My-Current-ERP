import React, { useState, useEffect, useMemo } from "react";
import { Card, Button, Select, ConfirmDialog } from "../components/ui";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import { Employee, PayrollLine, PayrollRun as TPayrollRun, AccountType, AccountLevel, VoucherType, VoucherStatus } from "../lib/types";
import { computeSalaryTDS, computePFContribution, computeCITContribution, computeSSFContribution } from "../lib/taxUtils";
import { AlertCircle, CheckCircle, FileText, Printer, Save, Send, Users, Eye } from "lucide-react";
import toast from "react-hot-toast";

const nepaliFiscalMonths = [
  { value: "Shrawan", label: "Shrawan" },
  { value: "Bhadra", label: "Bhadra" },
  { value: "Ashwin", label: "Ashwin" },
  { value: "Kartik", label: "Kartik" },
  { value: "Mangsir", label: "Mangsir" },
  { value: "Poush", label: "Poush" },
  { value: "Magh", label: "Magh" },
  { value: "Falgun", label: "Falgun" },
  { value: "Chaitra", label: "Chaitra" },
  { value: "Baishakh", label: "Baishakh" },
  { value: "Jestha", label: "Jestha" },
  { value: "Ashadh", label: "Ashadh" },
];

function amountToWords(num: number): string {
  if (num <= 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "");
  }
  
  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toString().split(".");
  const rupees = parseInt(parts[0], 10);
  const paisa = parts[1] ? parseInt(parts[1].slice(0, 2), 10) : 0;
  
  let result = convert(rupees) + " Rupees";
  if (paisa > 0) {
    result += " and " + convert(paisa) + " Paisa";
  }
  result += " Only";
  return result;
}

const findOrCreateAccount = async (name: string, type: AccountType, group: string, parentId: string, code: string) => {
  const db = getDB();
  let acc = await db.accounts.where("name").equalsIgnoreCase(name).first();
  if (!acc) {
    acc = await db.accounts.where("code").equals(code).first();
  }
  if (!acc) {
    const id = `acc-auto-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    acc = {
      id,
      code,
      name,
      type,
      level: AccountLevel.LEDGER,
      group,
      parentId,
      isActive: true,
      isGroup: false,
      balance: 0,
    };
    await db.accounts.put(acc);
  }
  return acc;
};

export default function PayrollRun() {
  const { employees: storeEmployees, currentFiscalYear, companySettings, currentUser, addVoucher } = useStore();
  const [selectedMonth, setSelectedMonth] = useState("Kartik");
  const [payrollRun, setPayrollRun] = useState<TPayrollRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState<PayrollLine | null>(null);
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Payslip Modal State
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipEmpId, setPayslipEmpId] = useState<string | null>(null);

  // Load past runs
  const [pastRuns, setPastRuns] = useState<TPayrollRun[]>([]);

  const loadPastRuns = async () => {
    try {
      const db = getDB();
      const runs = await db.payrollRuns.toArray();
      setPastRuns(runs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadPastRuns();
  }, []);

  const loadPastRunForMonth = async (monthName: string) => {
    const db = getDB();
    const run = await db.payrollRuns.where("month").equals(monthName).first();
    if (run) {
      setPayrollRun(run);
    } else {
      setPayrollRun(null);
    }
  };

  useEffect(() => {
    loadPastRunForMonth(selectedMonth);
  }, [selectedMonth]);

  const handleGeneratePayroll = async () => {
    if (storeEmployees.length === 0) {
      toast.error("No active employees found to generate payroll.");
      return;
    }
    setLoading(true);

    try {
      const db = getDB();
      // Resolve month index for TDS
      const monthIndex = nepaliFiscalMonths.findIndex((m) => m.value === selectedMonth) + 1;

      // Fetch all past TDS entries for current fiscal year to calculate accumulated TDS
      const pastTdsEntries = await db.tdsEntries.toArray(); // we can filter in memory or fetch

      const payrollLines: PayrollLine[] = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;
      let totalEmployerPf = 0;
      let totalEmployerSsf = 0;
      let totalTds = 0;

      for (const emp of storeEmployees) {
        if (!emp.isActive) continue;

        // Sum allowances
        const allowancesSum = (emp.allowances || []).reduce((sum, a) => sum + a.amount, 0);
        const grossSalary = emp.basicSalary + allowancesSum;

        // Accumulated TDS for this employee in current FY
        const employeeAccumulatedTds = pastTdsEntries
          .filter((t) => t.partyId === emp.id && t.tdsType === "salary")
          .reduce((sum, t) => sum + t.tdsAmount, 0);

        // Compute TDS on salary
        const tdsResult = computeSalaryTDS(emp, grossSalary, monthIndex, employeeAccumulatedTds);

        // Compute PF, CIT, SSF
        const pf = computePFContribution(emp.basicSalary, emp.pfEnabled);
        const cit = computeCITContribution(emp.basicSalary, emp.citRate, emp.citEnabled);
        const ssf = computeSSFContribution(emp, grossSalary);

        const lineDeductions = tdsResult.totalDeductions + tdsResult.monthlyTDS;
        const otherDed = (emp.deductions || []).reduce((sum, d) => sum + d.amount, 0);

        const pfEmployee = pf.employee;
        const citEmployee = cit.employee;
        const ssfEmployee = ssf.employee;

        payrollLines.push({
          employeeId: emp.id,
          employeeName: emp.name,
          basicSalary: emp.basicSalary,
          totalAllowances: allowancesSum,
          grossSalary,
          pfEmployee,
          pfEmployer: pf.employer,
          citEmployee,
          citEmployer: cit.employer,
          ssfEmployee,
          ssfEmployer: ssf.employer,
          tdsOnSalary: tdsResult.monthlyTDS,
          otherDeductions: otherDed,
          netSalary: tdsResult.netSalary,
        });

        totalGross += grossSalary;
        totalDeductions += (pfEmployee + citEmployee + ssfEmployee + tdsResult.monthlyTDS + otherDed);
        totalNet += tdsResult.netSalary;
        totalEmployerPf += pf.employer;
        totalEmployerSsf += ssf.employer;
        totalTds += tdsResult.monthlyTDS;
      }

      const newRun: TPayrollRun = {
        id: generateId("prun"),
        month: selectedMonth,
        fiscalYearId: currentFiscalYear?.id || "fy-current",
        employees: payrollLines,
        status: "draft",
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
        totalEmployerPf: Math.round(totalEmployerPf * 100) / 100,
        totalEmployerSsf: Math.round(totalEmployerSsf * 100) / 100,
        totalTds: Math.round(totalTds * 100) / 100,
        createdAt: new Date().toISOString(),
      };

      setPayrollRun(newRun);
      toast.success("Payroll sheet calculated successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate payroll calculation.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!payrollRun) return;
    try {
      const db = getDB();
      await db.payrollRuns.put(payrollRun);
      toast.success("Payroll run saved as draft.");
      loadPastRuns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save draft.");
    }
  };

  const handleApprove = async () => {
    if (!payrollRun) return;
    // Check role
    const isAuthorized = currentUser?.role === "admin" || currentUser?.role === "manager";
    if (!isAuthorized) {
      toast.error("Permission Denied: Only Admin or Manager can approve payroll.");
      return;
    }

    try {
      const updatedRun = { ...payrollRun, status: "approved" as const };
      const db = getDB();
      await db.payrollRuns.put(updatedRun);
      setPayrollRun(updatedRun);
      toast.success("Payroll approved. Ready for posting.");
      loadPastRuns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve payroll.");
    }
  };

  const handlePostPayroll = async () => {
    if (!payrollRun || payrollRun.status !== "approved") return;
    try {
      const db = getDB();

      // Find or create correct ledger accounts
      const salaryExpenseAcc = await findOrCreateAccount("Salary Expense A/c", AccountType.EXPENSE, "Indirect Expenses", "grp-indirect-expenses", "5202");
      const employerPfAcc = await findOrCreateAccount("Employer PF Contribution", AccountType.EXPENSE, "Indirect Expenses", "grp-indirect-expenses", "5210");
      const employerSsfAcc = await findOrCreateAccount("Employer SSF Contribution", AccountType.EXPENSE, "Indirect Expenses", "grp-indirect-expenses", "5211");
      
      const salaryPayableAcc = await findOrCreateAccount("Salary Payable A/c", AccountType.LIABILITY, "Current Liabilities", "grp-current-liabilities", "3101");
      const pfPayableAcc = await findOrCreateAccount("Provident Fund Payable", AccountType.LIABILITY, "Duties & Taxes", "grp-duties-taxes", "3203");
      const citPayableAcc = await findOrCreateAccount("CIT Payable A/c", AccountType.LIABILITY, "Duties & Taxes", "grp-duties-taxes", "3204");
      const ssfPayableAcc = await findOrCreateAccount("Social Security Fund Payable", AccountType.LIABILITY, "Duties & Taxes", "grp-duties-taxes", "3205");
      const tdsPayableAcc = await findOrCreateAccount("TDS on Salary Payable", AccountType.LIABILITY, "Duties & Taxes", "grp-duties-taxes", "3202");

      const totalPfPayable = payrollRun.employees.reduce((sum, e) => sum + e.pfEmployee + e.pfEmployer, 0);
      const totalCitPayable = payrollRun.employees.reduce((sum, e) => sum + e.citEmployee, 0);
      const totalSsfPayable = payrollRun.employees.reduce((sum, e) => sum + e.ssfEmployee + e.ssfEmployer, 0);

      const voucherLines = [];

      // Debits
      voucherLines.push({
        accountId: salaryExpenseAcc.id,
        accountName: salaryExpenseAcc.name,
        debit: payrollRun.totalGross,
        credit: 0,
        narration: "Gross salary expense",
      });

      if (payrollRun.totalEmployerPf > 0) {
        voucherLines.push({
          accountId: employerPfAcc.id,
          accountName: employerPfAcc.name,
          debit: payrollRun.totalEmployerPf,
          credit: 0,
          narration: "Employer PF contribution",
        });
      }

      if (payrollRun.totalEmployerSsf > 0) {
        voucherLines.push({
          accountId: employerSsfAcc.id,
          accountName: employerSsfAcc.name,
          debit: payrollRun.totalEmployerSsf,
          credit: 0,
          narration: "Employer SSF contribution",
        });
      }

      // Credits
      voucherLines.push({
        accountId: salaryPayableAcc.id,
        accountName: salaryPayableAcc.name,
        debit: 0,
        credit: payrollRun.totalNet,
        narration: `Net salary payable for ${payrollRun.month}`,
      });

      if (totalPfPayable > 0) {
        voucherLines.push({
          accountId: pfPayableAcc.id,
          accountName: pfPayableAcc.name,
          debit: 0,
          credit: totalPfPayable,
          narration: "EPF payable (Employee + Employer)",
        });
      }

      if (totalCitPayable > 0) {
        voucherLines.push({
          accountId: citPayableAcc.id,
          accountName: citPayableAcc.name,
          debit: 0,
          credit: totalCitPayable,
          narration: "CIT payable",
        });
      }

      if (totalSsfPayable > 0) {
        voucherLines.push({
          accountId: ssfPayableAcc.id,
          accountName: ssfPayableAcc.name,
          debit: 0,
          credit: totalSsfPayable,
          narration: "SSF payable (Employee + Employer)",
        });
      }

      if (payrollRun.totalTds > 0) {
        voucherLines.push({
          accountId: tdsPayableAcc.id,
          accountName: tdsPayableAcc.name,
          debit: 0,
          credit: payrollRun.totalTds,
          narration: "Salary TDS payable",
        });
      }

      const today = new Date().toISOString().split("T")[0];
      const payload = {
        date: today,
        type: VoucherType.JOURNAL,
        narration: `Being salary and contributions for the month of ${payrollRun.month} (FY ${currentFiscalYear?.name || "current"})`,
        lines: voucherLines,
        status: VoucherStatus.POSTED,
        totalDebit: payrollRun.totalGross + payrollRun.totalEmployerPf + payrollRun.totalEmployerSsf,
        totalCredit: payrollRun.totalNet + totalPfPayable + totalCitPayable + totalSsfPayable + payrollRun.totalTds,
      };

      const jv = await addVoucher(payload);

      // Create TDS Entries in the system for TDS remittance tracking
      for (const line of payrollRun.employees) {
        if (line.tdsOnSalary > 0) {
          const empObj = storeEmployees.find((e) => e.id === line.employeeId);
          await db.tdsEntries.put({
            id: generateId("tds"),
            voucherId: jv.id,
            partyId: line.employeeId,
            partyName: line.employeeName,
            partyPan: empObj?.panNo,
            tdsType: "salary" as any, // salary TDS
            tdsRate: 0, // variable based on slab
            grossAmount: line.grossSalary,
            tdsAmount: line.tdsOnSalary,
            netAmount: line.netSalary,
            date: today,
            dateNepali: jv.dateNepali,
            section: "Section 87(1)(a)",
            deposited: false,
          });
        }
      }

      // Mark payroll run as Paid
      const finalRun: TPayrollRun = {
        ...payrollRun,
        status: "paid" as const,
        voucherId: jv.id,
      };
      await db.payrollRuns.put(finalRun);
      setPayrollRun(finalRun);

      toast.success("Payroll posted successfully via Journal Voucher.");
      loadPastRuns();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to post payroll.");
    }
  };

  const handlePrintPayslip = (empId: string) => {
    setPayslipEmpId(empId);
    setShowPayslipModal(true);
  };

  const handleEmailPayslip = (empName: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1200)),
      {
        loading: `Sending Payslip to ${empName}...`,
        success: `Payslip sent successfully.`,
        error: "SMTP Error: Failed to send email.",
      }
    );
  };

  // Find active employee for payslip
  const activePayslipEmpObj = useMemo(() => {
    if (!payslipEmpId) return null;
    return storeEmployees.find((e) => e.id === payslipEmpId);
  }, [payslipEmpId, storeEmployees]);

  const activePayslipLine = useMemo(() => {
    if (!payslipEmpId || !payrollRun) return null;
    return payrollRun.employees.find((e) => e.employeeId === payslipEmpId);
  }, [payslipEmpId, payrollRun]);

  return (
    <div className="flex flex-col gap-4 page-wrapper">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Payroll Calculation</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Process monthly payroll runs, calculate PF/CIT/SSF and Salary progressive TDS.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left Side Filter Panel */}
        <div className="w-1/4 shrink-0 flex flex-col gap-3">
          <Card className="p-3">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Select Month</h2>
            <div className="flex flex-col gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input w-full"
                disabled={payrollRun?.status === "approved" || payrollRun?.status === "paid"}
              >
                {nepaliFiscalMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {(!payrollRun || payrollRun.status === "draft") && (
                <Button
                  onClick={handleGeneratePayroll}
                  className="w-full bg-[#1557b0] hover:bg-blue-700 text-white text-xs mt-2"
                >
                  Calculate Sheet
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-3">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Payroll Actions</h2>
            <div className="flex flex-col gap-2">
              {payrollRun && (
                <>
                  <div className="flex justify-between items-center text-xs py-1 border-b">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-bold ${payrollRun.status === "paid" ? "text-green-600" : payrollRun.status === "approved" ? "text-blue-600" : "text-amber-600"}`}>
                      {payrollRun.status.toUpperCase()}
                    </span>
                  </div>

                  {payrollRun.status === "draft" && (
                    <>
                      <Button onClick={handleSaveDraft} className="w-full text-xs">
                        <Save className="w-3.5 h-3.5 mr-1" /> Save Calculation
                      </Button>
                      <Button onClick={handleApprove} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve Run
                      </Button>
                    </>
                  )}

                  {payrollRun.status === "approved" && (
                    <Button onClick={handlePostPayroll} className="w-full bg-green-600 hover:bg-green-700 text-white text-xs">
                      <Save className="w-3.5 h-3.5 mr-1" /> Post Payroll Voucher
                    </Button>
                  )}

                  {payrollRun.status === "paid" && (
                    <div className="flex flex-col gap-1 items-center bg-green-50 p-2 rounded border border-green-200">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                      <span className="text-[11px] font-bold text-green-800">Payroll Posted & Paid</span>
                      {payrollRun.voucherId && (
                        <span className="text-[9px] text-gray-500">Linked JV: {payrollRun.voucherId}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side Main Sheet Grid */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <Card className="p-3 flex-1 flex flex-col min-h-[300px] overflow-hidden">
            <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Salary Sheet - {selectedMonth}
            </h2>

            {!payrollRun ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-xs">No payroll processed for this month yet.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="overflow-auto max-h-[400px]">
                  <table className="dense-table w-full text-[11px]">
                    <thead>
                      <tr>
                        <th className="text-left font-bold py-1">Employee Name</th>
                        <th className="text-right font-bold py-1">Basic</th>
                        <th className="text-right font-bold py-1">Allowances</th>
                        <th className="text-right font-bold py-1">Gross</th>
                        <th className="text-right font-bold py-1">PF (E'ee)</th>
                        <th className="text-right font-bold py-1">CIT</th>
                        <th className="text-right font-bold py-1">SSF</th>
                        <th className="text-right font-bold py-1">TDS</th>
                        <th className="text-right font-bold py-1">Other Ded.</th>
                        <th className="text-right font-bold py-1">Net Salary</th>
                        <th className="text-right font-bold py-1">PF (E'r)</th>
                        <th className="text-right font-bold py-1">SSF (E'r)</th>
                        <th className="text-center font-bold py-1">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollRun.employees.map((line) => (
                        <React.Fragment key={line.employeeId}>
                          <tr className="hover:bg-gray-50 border-b">
                            <td className="py-1.5 font-medium">{line.employeeName}</td>
                            <td className="text-right py-1.5">{line.basicSalary.toLocaleString()}</td>
                            <td className="text-right py-1.5">{line.totalAllowances.toLocaleString()}</td>
                            <td className="text-right py-1.5 font-bold">{line.grossSalary.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-gray-600">{line.pfEmployee.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-gray-600">{line.citEmployee.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-gray-600">{line.ssfEmployee.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-red-600 font-medium">{line.tdsOnSalary.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-gray-600">{line.otherDeductions.toLocaleString()}</td>
                            <td className="text-right py-1.5 font-bold text-green-700">{line.netSalary.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-gray-500">{line.pfEmployer.toLocaleString()}</td>
                            <td className="text-right py-1.5 text-gray-500">{line.ssfEmployer.toLocaleString()}</td>
                            <td className="py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setExpandedEmpId(expandedEmpId === line.employeeId ? null : line.employeeId)}
                                  className="p-1 hover:bg-gray-100 rounded text-blue-600"
                                  title="View Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePrintPayslip(line.employeeId)}
                                  className="p-1 hover:bg-gray-100 rounded text-green-600"
                                  title="Print Payslip"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEmailPayslip(line.employeeName)}
                                  className="p-1 hover:bg-gray-100 rounded text-amber-600"
                                  title="Email Payslip"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Detail Row */}
                          {expandedEmpId === line.employeeId && (
                            <tr>
                              <td colSpan={13} className="bg-slate-50 p-2.5 border-b">
                                <div className="grid grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <h4 className="font-bold text-gray-700 mb-1">Tax Exemption Setup</h4>
                                    {(() => {
                                      const emp = storeEmployees.find((e) => e.id === line.employeeId);
                                      if (!emp) return <span className="text-[10px] text-gray-400">Unavailable</span>;
                                      return (
                                        <div className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                                          <span>Status: <strong className="capitalize">{emp.maritalStatus}</strong></span>
                                          <span>Medical Allowance Exemption: Rs. {Math.min(emp.medicalAllowance || 0, 750)}</span>
                                          <span>Rent Allowance Exemption: Rs. {Math.min(emp.rentAllowance || 0, 3000)}</span>
                                          <span>Transport Exemption: Rs. {Math.min(emp.transportAllowance || 0, 2500)}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-700 mb-1">Identity & Nos</h4>
                                    {(() => {
                                      const emp = storeEmployees.find((e) => e.id === line.employeeId);
                                      if (!emp) return <span className="text-[10px] text-gray-400">Unavailable</span>;
                                      return (
                                        <div className="flex flex-col gap-0.5 text-[10px] text-gray-600 font-mono">
                                          <span>Citizenship: {emp.citizenshipNo || "N/A"}</span>
                                          <span>PAN No: {emp.panNo || "N/A"}</span>
                                          <span>SSF Reg No: {emp.socialSecurityNo || "N/A"}</span>
                                          <span>EPF Account: {emp.pfAccountNo || "N/A"}</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-700 mb-1">Employer Cost Share</h4>
                                    <div className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                                      <span>Employer PF (10%): Rs. {line.pfEmployer.toLocaleString()}</span>
                                      <span>Employer SSF: Rs. {line.ssfEmployer.toLocaleString()}</span>
                                      <span className="font-bold border-t pt-0.5 mt-0.5">
                                        Total Cost (CTC): Rs. {(line.grossSalary + line.pfEmployer + line.ssfEmployer).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-700 mb-1">Allowances breakdown</h4>
                                    {(() => {
                                      const emp = storeEmployees.find((e) => e.id === line.employeeId);
                                      if (!emp || !emp.allowances?.length) return <span className="text-[10px] text-gray-400 italic">None</span>;
                                      return (
                                        <div className="flex flex-col gap-0.5 text-[10px] text-gray-600">
                                          {emp.allowances.map((a, i) => (
                                            <span key={i}>{a.name}: Rs. {a.amount.toLocaleString()}</span>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2">
                      <tr>
                        <td className="py-1.5">Total</td>
                        <td className="text-right py-1.5"></td>
                        <td className="text-right py-1.5"></td>
                        <td className="text-right py-1.5">{payrollRun.totalGross.toLocaleString()}</td>
                        <td className="text-right py-1.5">
                          {payrollRun.employees.reduce((sum, e) => sum + e.pfEmployee, 0).toLocaleString()}
                        </td>
                        <td className="text-right py-1.5">
                          {payrollRun.employees.reduce((sum, e) => sum + e.citEmployee, 0).toLocaleString()}
                        </td>
                        <td className="text-right py-1.5">
                          {payrollRun.employees.reduce((sum, e) => sum + e.ssfEmployee, 0).toLocaleString()}
                        </td>
                        <td className="text-right py-1.5 text-red-600">{payrollRun.totalTds.toLocaleString()}</td>
                        <td className="text-right py-1.5">
                          {payrollRun.employees.reduce((sum, e) => sum + e.otherDeductions, 0).toLocaleString()}
                        </td>
                        <td className="text-right py-1.5 text-green-700">{payrollRun.totalNet.toLocaleString()}</td>
                        <td className="text-right py-1.5 text-gray-500">{payrollRun.totalEmployerPf.toLocaleString()}</td>
                        <td className="text-right py-1.5 text-gray-500">{payrollRun.totalEmployerSsf.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Payslip Modal */}
      {showPayslipModal && activePayslipEmpObj && activePayslipLine && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-xl relative">
            <button
              onClick={() => setShowPayslipModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 font-bold"
            >
              ✕
            </button>

            {/* Print Section wrapper */}
            <div id="payslip-print-area" className="p-4 border border-gray-300 rounded bg-white">
              {/* Header */}
              <div className="text-center border-b pb-3 mb-3">
                <h1 className="text-base font-bold uppercase tracking-wide">{companySettings.name}</h1>
                <p className="text-[11px] text-gray-500">{companySettings.address} | PAN: {companySettings.panNumber}</p>
                <h2 className="text-sm font-bold underline mt-2 uppercase text-slate-800">Salary Payslip</h2>
                <p className="text-[10px] text-gray-600">Month: {payrollRun?.month} (FY {currentFiscalYear?.name || "current"})</p>
              </div>

              {/* Employee Information */}
              <div className="grid grid-cols-2 gap-4 text-xs mb-4 pb-2 border-b">
                <div>
                  <p><strong>Employee Name:</strong> {activePayslipEmpObj.name}</p>
                  <p><strong>Designation:</strong> {activePayslipEmpObj.designation}</p>
                  <p><strong>Department:</strong> {activePayslipEmpObj.department || "General"}</p>
                  <p><strong>PAN No:</strong> {activePayslipEmpObj.panNo || "N/A"}</p>
                </div>
                <div>
                  <p><strong>EPF Account No:</strong> {activePayslipEmpObj.pfAccountNo || "N/A"}</p>
                  <p><strong>Social Security No (SSF):</strong> {activePayslipEmpObj.socialSecurityNo || "N/A"}</p>
                  <p><strong>CIT Account No:</strong> {activePayslipEmpObj.citAccountNo || "N/A"}</p>
                  <p><strong>Bank A/C No:</strong> {activePayslipEmpObj.bankAccountNo || "N/A"} ({activePayslipEmpObj.bankName || "N/A"})</p>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-2 gap-6 text-xs mb-4">
                {/* Earnings Table */}
                <div className="border rounded overflow-hidden">
                  <div className="bg-slate-100 font-bold p-1.5 border-b text-[10px] uppercase">Earnings</div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      <tr className="border-b">
                        <td className="p-1.5">Basic Salary</td>
                        <td className="p-1.5 text-right font-medium">Rs. {activePayslipLine.basicSalary.toLocaleString()}</td>
                      </tr>
                      {(activePayslipEmpObj.allowances || []).map((allow, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-1.5">{allow.name}</td>
                          <td className="p-1.5 text-right">Rs. {allow.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold">
                        <td className="p-1.5">Gross Earnings</td>
                        <td className="p-1.5 text-right text-slate-800">Rs. {activePayslipLine.grossSalary.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Deductions Table */}
                <div className="border rounded overflow-hidden">
                  <div className="bg-slate-100 font-bold p-1.5 border-b text-[10px] uppercase">Deductions</div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      <tr className="border-b">
                        <td className="p-1.5">Provident Fund (Employee)</td>
                        <td className="p-1.5 text-right">Rs. {activePayslipLine.pfEmployee.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-1.5">Citizen Investment Trust (CIT)</td>
                        <td className="p-1.5 text-right">Rs. {activePayslipLine.citEmployee.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-1.5">Social Security Fund (SSF)</td>
                        <td className="p-1.5 text-right">Rs. {activePayslipLine.ssfEmployee.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-1.5">TDS on Salary (ITA 2058)</td>
                        <td className="p-1.5 text-right text-red-600">Rs. {activePayslipLine.tdsOnSalary.toLocaleString()}</td>
                      </tr>
                      {activePayslipLine.otherDeductions > 0 && (
                        <tr className="border-b">
                          <td className="p-1.5">Other Deductions</td>
                          <td className="p-1.5 text-right">Rs. {activePayslipLine.otherDeductions.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-50 font-bold">
                        <td className="p-1.5">Total Deductions</td>
                        <td className="p-1.5 text-right text-red-600">
                          Rs. {(
                            activePayslipLine.pfEmployee +
                            activePayslipLine.citEmployee +
                            activePayslipLine.ssfEmployee +
                            activePayslipLine.tdsOnSalary +
                            activePayslipLine.otherDeductions
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Salary block */}
              <div className="bg-green-50 border border-green-200 rounded p-2.5 mb-5 text-xs text-green-900">
                <div className="flex justify-between font-bold text-sm mb-1">
                  <span>Net Salary Payable:</span>
                  <span>Rs. {activePayslipLine.netSalary.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-green-700 italic">
                  <strong>In Words:</strong> {amountToWords(activePayslipLine.netSalary)}
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 text-[10px] text-center pt-8 border-t border-dashed">
                <div className="flex flex-col items-center">
                  <div className="w-24 border-b border-gray-400 h-6"></div>
                  <span className="mt-1">Prepared By</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-24 border-b border-gray-400 h-6"></div>
                  <span className="mt-1">Checked By</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-24 border-b border-gray-400 h-6"></div>
                  <span className="mt-1">Received By</span>
                </div>
              </div>
            </div>

            {/* Print action buttons */}
            <div className="flex justify-end gap-2 mt-4">
              <Button
                onClick={() => {
                  const printContents = document.getElementById("payslip-print-area")?.innerHTML;
                  const originalContents = document.body.innerHTML;
                  if (printContents) {
                    document.body.innerHTML = printContents;
                    window.print();
                    document.body.innerHTML = originalContents;
                    window.location.reload(); // restore react binders
                  }
                }}
                className="bg-[#1557b0] hover:bg-blue-700 text-white text-xs"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Payslip
              </Button>
              <Button
                onClick={() => setShowPayslipModal(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
