/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Card, Button } from "../components/ui";
import { useStore } from "../store/useStore";
import { Employee, VoucherType, VoucherStatus, AccountType } from "../lib/types";
import { computeNepalPayroll } from "../lib/payrollUtils";
import { CheckCircle, FileText, Printer, Save, Send, Users } from "lucide-react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { formatNumber } from "../lib/utils";
import { getDB } from "../lib/db";

const nepaliMonths = [
  "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin", 
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"
];

interface PayrollLine {
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  totalAllowances: number;
  grossSalary: number;
  ssfEmployee: number;
  ssfEmployer: number;
  incomeTax: number;
  netSalary: number;
}

export default function PayrollRun() {
  const { employees, companySettings, addVoucher, currentFiscalYear } = useStore();
  const [selectedYear, setSelectedYear] = useState(2081);
  const [selectedMonth, setSelectedMonth] = useState("Shrawan");
  const [workingDays, setWorkingDays] = useState(30);

  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [status, setStatus] = useState<"draft" | "approved" | "posted">("draft");

  const handleRunPayroll = () => {
    const activeEmployees = employees.filter(e => e.status === "active");
    if (activeEmployees.length === 0) {
      toast.error("No active employees found.");
      return;
    }

    const newLines: PayrollLine[] = activeEmployees.map(emp => {
      // Default to full paid days for now
      const paidDays = workingDays;
      const calc = computeNepalPayroll(emp, selectedYear, nepaliMonths.indexOf(selectedMonth) + 1, paidDays, workingDays);
      
      const totalAllowances = calc.allowances.houseRent + calc.allowances.transport + calc.allowances.medical + calc.allowances.dashain;
      
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        basicSalary: calc.basicSalary,
        totalAllowances,
        grossSalary: calc.grossSalary,
        ssfEmployee: calc.ssfEmployee,
        ssfEmployer: calc.ssfEmployer,
        incomeTax: calc.incomeTax,
        netSalary: calc.netSalary
      };
    });

    setLines(newLines);
    setStatus("draft");
    toast.success("Payroll computation complete.");
  };

  const handleApprove = () => {
    setStatus("approved");
    toast.success("Payroll approved.");
  };

  const generatePayslips = () => {
    if (lines.length === 0) return;

    try {
      const doc = new jsPDF();
      
      lines.forEach((line, index) => {
        if (index > 0) doc.addPage();
        
        doc.setFontSize(18);
        doc.text(companySettings?.companyName || "Sutra ERP", 105, 20, { align: "center" });
        doc.setFontSize(12);
        doc.text("Payslip", 105, 28, { align: "center" });
        
        doc.setFontSize(10);
        doc.text(`For the month of: ${selectedMonth} ${selectedYear}`, 14, 40);
        doc.text(`Employee Name: ${line.employeeName}`, 14, 46);
        
        const tableData = [
          ["Basic Salary", formatNumber(line.basicSalary)],
          ["Allowances", formatNumber(line.totalAllowances)],
          ["Gross Salary", formatNumber(line.grossSalary)],
          ["Less: SSF Contribution (11%)", formatNumber(line.ssfEmployee)],
          ["Less: TDS / Income Tax", formatNumber(line.incomeTax)],
          ["Net Salary Payable", formatNumber(line.netSalary)]
        ];

        (doc as any).autoTable({
          startY: 55,
          head: [["Particulars", "Amount (Rs.)"]],
          body: tableData,
          theme: "grid",
          styles: { fontSize: 10 },
          headStyles: { fillColor: [21, 87, 176] }
        });
      });

      doc.save(`Payslips_${selectedMonth}_${selectedYear}.pdf`);
      toast.success("Payslips generated successfully.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
  };

  const handlePostAccounts = async () => {
    if (status !== "approved") {
      toast.error("Approve payroll before posting.");
      return;
    }

    try {
      const db = getDB();
      // Ensure ledgers exist. In real app, you'd fetch or create them properly.
      // Assuming IDs: 'exp-salary', 'exp-ssf-employer', 'liab-ssf', 'liab-tds', 'liab-salary-payable'
      
      for (const line of lines) {
        // Create an individual journal voucher for each employee's salary expense
        await addVoucher({
          type: VoucherType.JOURNAL,
          date: new Date().toISOString().split("T")[0],
          dateBS: `${selectedYear}-${(nepaliMonths.indexOf(selectedMonth)+1).toString().padStart(2,'0')}-28`,
          narration: `Salary posting for ${line.employeeName} - ${selectedMonth} ${selectedYear}`,
          status: VoucherStatus.POSTED,
          lines: [
            { accountId: "exp-salary", debit: line.grossSalary, credit: 0, narration: "Gross Salary" },
            { accountId: "exp-ssf", debit: line.ssfEmployer, credit: 0, narration: "Employer SSF Contribution" },
            { accountId: "liab-ssf", debit: 0, credit: line.ssfEmployee + line.ssfEmployer, narration: "SSF Payable" },
            { accountId: "liab-tds", debit: 0, credit: line.incomeTax, narration: "TDS Payable" },
            { accountId: `liab-emp-${line.employeeId}`, debit: 0, credit: line.netSalary, narration: "Salary Payable" }
          ]
        });
      }

      setStatus("posted");
      toast.success("Payroll successfully posted to accounts.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to post accounts.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1557b0]" /> Payroll Run
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Nepal SSF and Income Tax compliant</p>
        </div>
      </div>

      <Card className="p-4 bg-white border border-gray-200">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Year (BS)</label>
            <input 
              type="number" 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="h-8 px-2.5 w-24 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Month</label>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
              className="h-8 px-2.5 w-32 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
            >
              {nepaliMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Working Days</label>
            <input 
              type="number" 
              value={workingDays} 
              onChange={e => setWorkingDays(Number(e.target.value))}
              className="h-8 px-2.5 w-24 text-[12px] border border-gray-300 rounded-md focus:border-[#1557b0]"
            />
          </div>
          <Button onClick={handleRunPayroll} className="bg-[#1557b0] hover:bg-[#0f4a96] text-white h-8 text-[12px]">
            Run Payroll
          </Button>
        </div>
      </Card>

      {lines.length > 0 && (
        <Card className="bg-white border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#f5f6fa]">
            <h2 className="text-[13px] font-semibold text-gray-800 flex items-center gap-2">
              Payroll Register ({selectedMonth} {selectedYear})
              {status === "approved" && <span className="badge badge-posted">APPROVED</span>}
              {status === "posted" && <span className="badge badge-posted">POSTED</span>}
            </h2>
            <div className="flex gap-2">
              {status === "draft" && (
                <Button onClick={handleApprove} className="h-7 text-[11px] border border-green-600 text-green-600 hover:bg-green-50">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
              )}
              {status !== "draft" && (
                <Button onClick={generatePayslips} variant="outline" className="h-7 text-[11px]">
                  <Printer className="w-3.5 h-3.5 mr-1" /> Generate Payslips
                </Button>
              )}
              {status === "approved" && (
                <Button onClick={handlePostAccounts} className="bg-[#1557b0] hover:bg-[#0f4a96] text-white h-7 text-[11px]">
                  <Send className="w-3.5 h-3.5 mr-1" /> Post to Accounts
                </Button>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f5f6fa] border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase">Employee</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Basic</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Allowances</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Gross</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">SSF (Emp)</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">TDS</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.employeeId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 font-medium">{line.employeeName}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">{formatNumber(line.basicSalary)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700 text-right font-mono">{formatNumber(line.totalAllowances)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#1557b0] font-bold text-right font-mono">{formatNumber(line.grossSalary)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-red-600 text-right font-mono">{formatNumber(line.ssfEmployee)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-red-600 text-right font-mono">{formatNumber(line.incomeTax)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-green-700 font-bold text-right font-mono">{formatNumber(line.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
