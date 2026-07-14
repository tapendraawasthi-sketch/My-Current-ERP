// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import * as XLSX from "xlsx";
import toast from "@/lib/appToast";
import { CalendarDays, Download, Printer, RefreshCcw, ShieldCheck, Users } from "lucide-react";
import { ReportEmptyState } from "../components/ReportEmptyState";

const inputCls =
  "h-8 w-full px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const compactInputCls =
  "h-7 w-full px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0]";
const labelCls = "mb-1 block text-[11px] font-medium text-gray-600";
const primaryButtonCls =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-[#1557b0] px-3 text-[12px] font-medium text-white hover:bg-[#0f4a96]";
const outlineButtonCls =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-[12px] font-medium text-gray-700 hover:bg-gray-50";
const smallOutlineButtonCls =
  "inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50";
const sectionCls = "overflow-hidden rounded-md border border-gray-200 bg-white";
const amountCellCls = "number-cell";
const tabs = [
  { id: "ssf", label: "SSF Portal Export" },
  { id: "pf", label: "PF Contribution Schedule" },
  { id: "cit", label: "CIT Schedule" },
  { id: "tax", label: "Income Tax Installments" },
  { id: "calendar", label: "Compliance Calendar" },
];
const calendarMonths = [
  { name: "Shrawan", days: 31 },
  { name: "Bhadra", days: 31 },
  { name: "Ashwin", days: 31 },
  { name: "Kartik", days: 30 },
  { name: "Mangsir", days: 30 },
  { name: "Poush", days: 30 },
  { name: "Magh", days: 30 },
  { name: "Falgun", days: 30 },
  { name: "Chaitra", days: 30 },
  { name: "Baisakh", days: 31 },
  { name: "Jestha", days: 31 },
  { name: "Ashad", days: 31 },
];

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

function tabCls(active) {
  return [
    "inline-flex items-center border-b-2 px-1 py-2 text-[12px] font-medium transition-colors",
    active
      ? "border-[#1557b0] text-[#1557b0]"
      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-800",
  ].join(" ");
}

function badgeCls(kind) {
  if (kind === "success") return "bg-green-100 text-green-700";
  if (kind === "danger") return "bg-red-100 text-red-700";
  if (kind === "warning") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

export default function PayrollReports() {
  const { employees, companySettings, fiscalYears } = useStore();
  const [activeTab, setActiveTab] = useState("ssf");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(calendarMonths[0].name);
  const [estimatedAnnualTax, setEstimatedAnnualTax] = useState(0);
  const [installmentData, setInstallmentData] = useState([]);
  const [complianceStatus, setComplianceStatus] = useState({});

  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees]);
  const exportYear = selectedFiscalYear.split("/")[1] || "2081";
  const selectedFiscalYearLabel = useMemo(() => {
    return (
      fiscalYears.find((fy) => fy.id === selectedFiscalYear)?.yearBs || "No fiscal year selected"
    );
  }, [fiscalYears, selectedFiscalYear]);

  useEffect(() => {
    const savedStatus = localStorage.getItem("payroll_compliance_status");
    if (savedStatus) {
      try {
        setComplianceStatus(JSON.parse(savedStatus));
      } catch (e) {
        console.error("Error parsing compliance status", e);
      }
    }
  }, []);

  useEffect(() => {
    const annualTax = Number(estimatedAnnualTax) || 0;
    const installments = [
      {
        id: 1,
        no: "1st",
        dueMonth: "Poush",
        dueDate: "2081-01-07",
        amountRequired: annualTax * 0.4,
        amountPaid: 0,
        status: "pending",
      },
      {
        id: 2,
        no: "2nd",
        dueMonth: "Chaitra",
        dueDate: "2081-04-07",
        amountRequired: annualTax * 0.7,
        amountPaid: 0,
        status: "pending",
      },
      {
        id: 3,
        no: "3rd",
        dueMonth: "Ashad",
        dueDate: "2081-07-07",
        amountRequired: annualTax,
        amountPaid: 0,
        status: "pending",
      },
    ];
    setInstallmentData(installments);
  }, [estimatedAnnualTax]);

  const ssfData = useMemo(() => {
    if (!selectedFiscalYear || !selectedMonth) return [];
    return activeEmployees.map((emp) => {
      const basic = emp.salaryDetails?.basicSalary || emp.basicSalary || 0;
      const employeeSSF = basic * 0.11;
      const employerSSF = basic * 0.2;
      const totalSSF = employeeSSF + employerSSF;

      return {
        ssfNo: emp.ssfNo || emp.code,
        name: emp.name,
        department: emp.department || "N/A",
        grossSalary: basic,
        employeeContribution: employeeSSF,
        employerContribution: employerSSF,
        totalSSF,
        month: selectedMonth,
        year: exportYear,
      };
    });
  }, [activeEmployees, exportYear, selectedFiscalYear, selectedMonth]);

  const pfData = useMemo(() => {
    if (!selectedFiscalYear || !selectedMonth) return [];
    return activeEmployees.map((emp) => {
      const basic = emp.salaryDetails?.basicSalary || emp.basicSalary || 0;
      const employeePF = basic * 0.1;
      const employerPF = basic * 0.1;
      const totalPF = employeePF + employerPF;

      return {
        code: emp.code,
        name: emp.name,
        basicSalary: basic,
        employeePF,
        employerPF,
        totalPF,
      };
    });
  }, [activeEmployees, selectedFiscalYear, selectedMonth]);

  const citData = useMemo(() => {
    if (!selectedFiscalYear || !selectedMonth) return [];
    return activeEmployees.map((emp) => {
      const basic = emp.salaryDetails?.basicSalary || emp.basicSalary || 0;
      const citDeducted = basic * 0.1;

      return {
        name: emp.name,
        basicSalary: basic,
        citDeducted,
      };
    });
  }, [activeEmployees, selectedFiscalYear, selectedMonth]);

  const ssfTotals = useMemo(() => {
    return ssfData.reduce(
      (totals, row) => ({
        grossSalary: totals.grossSalary + row.grossSalary,
        employeeContribution: totals.employeeContribution + row.employeeContribution,
        employerContribution: totals.employerContribution + row.employerContribution,
        totalSSF: totals.totalSSF + row.totalSSF,
      }),
      { grossSalary: 0, employeeContribution: 0, employerContribution: 0, totalSSF: 0 },
    );
  }, [ssfData]);

  const pfTotals = useMemo(() => {
    return pfData.reduce(
      (totals, row) => ({
        basicSalary: totals.basicSalary + row.basicSalary,
        employeePF: totals.employeePF + row.employeePF,
        employerPF: totals.employerPF + row.employerPF,
        totalPF: totals.totalPF + row.totalPF,
      }),
      { basicSalary: 0, employeePF: 0, employerPF: 0, totalPF: 0 },
    );
  }, [pfData]);

  const citTotals = useMemo(() => {
    return citData.reduce(
      (totals, row) => ({
        basicSalary: totals.basicSalary + row.basicSalary,
        citDeducted: totals.citDeducted + row.citDeducted,
      }),
      { basicSalary: 0, citDeducted: 0 },
    );
  }, [citData]);

  const complianceSummary = useMemo(() => {
    const completed = Object.values(complianceStatus).filter(Boolean).length;
    return {
      completed,
      total: calendarMonths.length * 4,
    };
  }, [complianceStatus]);

  const exportSSFCSV = () => {
    if (ssfData.length === 0) {
      toast.error("No data to export. Please load employees first.");
      return;
    }

    const csvContent = [
      [
        "SSF Membership No",
        "Employee Name",
        "Employer Name",
        "Employer Registration No",
        "Month",
        "Year",
        "Gross Salary",
        "Employee Contribution (11%)",
        "Employer Contribution (20%)",
        "Total Contribution",
      ],
      ...ssfData.map((row) => [
        row.ssfNo,
        row.name,
        companySettings?.name || "N/A",
        companySettings?.panNumber || "N/A",
        row.month,
        row.year,
        row.grossSalary,
        row.employeeContribution,
        row.employerContribution,
        row.totalSSF,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `SSF_Export_${selectedMonth}_${exportYear}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("SSF CSV exported successfully!");
  };

  const exportPFExcel = () => {
    if (pfData.length === 0) {
      toast.error("No data to export. Please load employees first.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      pfData.map((row) => ({
        "Employee Code": row.code,
        "Employee Name": row.name,
        "Basic Salary": row.basicSalary,
        "Employee PF (10%)": row.employeePF,
        "Employer PF (10%)": row.employerPF,
        "Total PF": row.totalPF,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PF Schedule");
    XLSX.writeFile(wb, `PF_Schedule_${selectedMonth}_${exportYear}.xlsx`);

    toast.success("PF Excel exported successfully!");
  };

  const exportCITExcel = () => {
    if (citData.length === 0) {
      toast.error("No data to export. Please load employees first.");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      citData.map((row) => ({
        "Employee Name": row.name,
        "Basic Salary": row.basicSalary,
        "CIT Deducted (10%)": row.citDeducted,
      })),
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CIT Schedule");
    XLSX.writeFile(wb, `CIT_Schedule_${selectedMonth}_${exportYear}.xlsx`);

    toast.success("CIT Excel exported successfully!");
  };

  const handlePrintPFChallan = () => {
    const borderStyle = "border: 1px solid #d1d5db;";
    const challanHTML = `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">
        <h2 style="text-align: center; border-bottom: 2px solid #1557b0; padding-bottom: 10px; margin-bottom: 20px;">PF Deposit Challan</h2>
        <div style="margin: 20px 0; font-size: 12px; line-height: 1.7;">
          <div><strong>Employer Name:</strong> ${companySettings?.name || "N/A"}</div>
          <div><strong>Employer PAN:</strong> ${companySettings?.panNumber || "N/A"}</div>
          <div><strong>Bank Name:</strong> ________________</div>
          <div><strong>Cheque/DD No:</strong> ________________</div>
          <div><strong>Date:</strong> ________________</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f5f6fa;">
              <th style="${borderStyle} padding: 8px; text-align: left;">Code</th>
              <th style="${borderStyle} padding: 8px; text-align: left;">Name</th>
              <th style="${borderStyle} padding: 8px; text-align: right;">Employee PF</th>
              <th style="${borderStyle} padding: 8px; text-align: right;">Employer PF</th>
              <th style="${borderStyle} padding: 8px; text-align: right;">Total PF</th>
            </tr>
          </thead>
          <tbody>
            ${pfData
              .map(
                (row) => `
              <tr>
                <td style="${borderStyle} padding: 8px;">${row.code}</td>
                <td style="${borderStyle} padding: 8px;">${row.name}</td>
                <td style="${borderStyle} padding: 8px; text-align: right;">${money(row.employeePF)}</td>
                <td style="${borderStyle} padding: 8px; text-align: right;">${money(row.employerPF)}</td>
                <td style="${borderStyle} padding: 8px; text-align: right;">${money(row.totalPF)}</td>
              </tr>
            `,
              )
              .join("")}
            <tr style="font-weight: 700; background-color: #eef2ff;">
              <td style="${borderStyle} padding: 8px;"></td>
              <td style="${borderStyle} padding: 8px;">TOTAL</td>
              <td style="${borderStyle} padding: 8px; text-align: right;">${money(pfTotals.employeePF)}</td>
              <td style="${borderStyle} padding: 8px; text-align: right;">${money(pfTotals.employerPF)}</td>
              <td style="${borderStyle} padding: 8px; text-align: right;">${money(pfTotals.totalPF)}</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px;">
          <div>
            <div>____________________</div>
            <div>Signature of Authorized Officer</div>
          </div>
          <div>
            <div>____________________</div>
            <div>Seal</div>
          </div>
        </div>
      </div>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>PF Deposit Challan</title>
          <style>
            body { margin: 0; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>${challanHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const toggleComplianceStatus = (month, type) => {
    const key = `${month}_${type}`;
    const newStatus = { ...complianceStatus, [key]: !complianceStatus[key] };
    setComplianceStatus(newStatus);
    localStorage.setItem("payroll_compliance_status", JSON.stringify(newStatus));
  };

  const renderSSFPortalExport = () => (
    <div className={sectionCls}>
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-800">SSF portal export</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Prepare the monthly contribution file for SSF portal upload.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportSSFCSV} className={outlineButtonCls}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {ssfData.length === 0 ? (
        <ReportEmptyState
          message="No SSF data available"
          hint="Select a fiscal year and month, then load employees to prepare the export."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  SSF Member No
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employee Name
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Department
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Gross Salary
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employee Contribution
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employer Contribution
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Total SSF
                </th>
              </tr>
            </thead>
            <tbody>
              {ssfData.map((row, idx) => (
                <tr
                  key={`${row.ssfNo}-${idx}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2.5 text-[12px] font-mono text-gray-700">{row.ssfNo}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.name}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-500">{row.department}</td>
                  <td className={amountCellCls}>{money(row.grossSalary)}</td>
                  <td className={amountCellCls}>{money(row.employeeContribution)}</td>
                  <td className={amountCellCls}>{money(row.employerContribution)}</td>
                  <td className={amountCellCls}>{money(row.totalSSF)}</td>
                </tr>
              ))}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                <td className="px-3 py-2.5 text-gray-800">TOTAL</td>
                <td className="px-3 py-2.5" />
                <td className="px-3 py-2.5" />
                <td className={`${amountCellCls} font-bold`}>{money(ssfTotals.grossSalary)}</td>
                <td className={`${amountCellCls} font-bold`}>
                  {money(ssfTotals.employeeContribution)}
                </td>
                <td className={`${amountCellCls} font-bold`}>
                  {money(ssfTotals.employerContribution)}
                </td>
                <td className={`${amountCellCls} font-bold`}>{money(ssfTotals.totalSSF)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderPFContributionSchedule = () => (
    <div className={sectionCls}>
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-800">PF contribution schedule</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Print the challan or export the monthly provident fund schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePrintPFChallan} className={outlineButtonCls}>
            <Printer className="h-3.5 w-3.5" />
            Print Challan
          </button>
          <button type="button" onClick={exportPFExcel} className={outlineButtonCls}>
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {pfData.length === 0 ? (
        <ReportEmptyState
          message="No PF schedule is ready yet"
          hint="Choose a fiscal year and month, then load employees to build the contribution schedule."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employee Code
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Basic Salary
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employee PF
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employer PF
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Total PF
                </th>
              </tr>
            </thead>
            <tbody>
              {pfData.map((row, idx) => (
                <tr
                  key={`${row.code}-${idx}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2.5 text-[12px] font-mono text-gray-700">{row.code}</td>
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.name}</td>
                  <td className={amountCellCls}>{money(row.basicSalary)}</td>
                  <td className={amountCellCls}>{money(row.employeePF)}</td>
                  <td className={amountCellCls}>{money(row.employerPF)}</td>
                  <td className={amountCellCls}>{money(row.totalPF)}</td>
                </tr>
              ))}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                <td className="px-3 py-2.5 text-gray-800">TOTAL</td>
                <td className="px-3 py-2.5" />
                <td className={`${amountCellCls} font-bold`}>{money(pfTotals.basicSalary)}</td>
                <td className={`${amountCellCls} font-bold`}>{money(pfTotals.employeePF)}</td>
                <td className={`${amountCellCls} font-bold`}>{money(pfTotals.employerPF)}</td>
                <td className={`${amountCellCls} font-bold`}>{money(pfTotals.totalPF)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderCITSchedule = () => (
    <div className={sectionCls}>
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-gray-800">CIT schedule</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Review monthly CIT deductions before exporting the schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCITExcel} className={outlineButtonCls}>
            <Download className="h-3.5 w-3.5" />
            Export CIT
          </button>
        </div>
      </div>

      {citData.length === 0 ? (
        <ReportEmptyState
          message="No CIT schedule data available"
          hint="Select the reporting period and load employees to calculate monthly deductions."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Employee Name
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Basic Salary
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  CIT Deducted
                </th>
              </tr>
            </thead>
            <tbody>
              {citData.map((row, idx) => (
                <tr
                  key={`${row.name}-${idx}`}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2.5 text-[12px] text-gray-700">{row.name}</td>
                  <td className={amountCellCls}>{money(row.basicSalary)}</td>
                  <td className={amountCellCls}>{money(row.citDeducted)}</td>
                </tr>
              ))}
              <tr className="bg-[#eef2ff] border-t-2 border-[#c7d2fe] font-bold text-[12px]">
                <td className="px-3 py-2.5 text-gray-800">TOTAL</td>
                <td className={`${amountCellCls} font-bold`}>{money(citTotals.basicSalary)}</td>
                <td className={`${amountCellCls} font-bold`}>{money(citTotals.citDeducted)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderIncomeTaxAdvanceInstallments = () => (
    <div className={sectionCls}>
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-gray-800">Income tax advance installments</h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Track installment targets against the estimated annual tax liability.
        </p>
      </div>

      <div className="border-b border-gray-200 px-4 py-3">
        <label className={labelCls}>Estimated annual tax (Rs.)</label>
        <input
          type="number"
          value={estimatedAnnualTax}
          onChange={(e) => setEstimatedAnnualTax(e.target.value)}
          className={`${inputCls} max-w-[280px]`}
        />
      </div>

      {Number(estimatedAnnualTax) <= 0 ? (
        <ReportEmptyState
          message="Enter estimated annual tax to calculate installments"
          hint="The installment schedule appears once an annual tax estimate is provided."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-[#f5f6fa] border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Installment No
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Due Month
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Due Date (BS)
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Amount Required
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Amount Paid
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {installmentData.map((inst) => {
                const isOverdue = new Date(inst.dueDate) < new Date();
                const statusKind =
                  inst.status === "paid" ? "success" : isOverdue ? "danger" : "warning";

                return (
                  <tr key={inst.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{inst.no} Installment</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-700">{inst.dueMonth}</td>
                    <td className="px-3 py-2.5 text-[12px] text-gray-500">{inst.dueDate}</td>
                    <td className={amountCellCls}>{money(inst.amountRequired)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        value={inst.amountPaid}
                        onChange={(e) => {
                          const newAmount = Number(e.target.value) || 0;
                          setInstallmentData((prev) =>
                            prev.map((entry) =>
                              entry.id === inst.id
                                ? {
                                    ...entry,
                                    amountPaid: newAmount,
                                    status: newAmount >= inst.amountRequired ? "paid" : "pending",
                                  }
                                : entry,
                            ),
                          );
                        }}
                        className={`${compactInputCls} ml-auto max-w-[120px]`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeCls(statusKind)}`}
                      >
                        {inst.status === "paid" ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setInstallmentData((prev) =>
                            prev.map((entry) =>
                              entry.id === inst.id
                                ? { ...entry, status: "paid", amountPaid: entry.amountRequired }
                                : entry,
                            ),
                          );
                        }}
                        className={smallOutlineButtonCls}
                      >
                        Mark as Paid
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderComplianceCalendar = () => {
    const now = new Date();
    const currentYear = now.getFullYear();

    return (
      <div className={sectionCls}>
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-gray-800">Compliance calendar</h2>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Monitor SSF, PF, TDS return, and salary TDS deposit completion month by month.
          </p>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {calendarMonths.map((month, idx) => {
            const ssfDeadline = new Date(currentYear, (idx + 1) % 12, 25);
            const pfDeadline = new Date(currentYear, (idx + 1) % 12, 15);

            const ssfKey = `${month.name}_ssf`;
            const pfKey = `${month.name}_pf`;
            const tdsRetKey = `${month.name}_tds_ret`;
            const tdsDepKey = `${month.name}_tds_dep`;

            const isSSFCompleted = complianceStatus[ssfKey] || false;
            const isPFCompleted = complianceStatus[pfKey] || false;
            const isTDSRetCompleted = complianceStatus[tdsRetKey] || false;
            const isTDSDepCompleted = complianceStatus[tdsDepKey] || false;

            const ssfKind = isSSFCompleted ? "success" : ssfDeadline < now ? "danger" : "warning";
            const pfKind = isPFCompleted ? "success" : pfDeadline < now ? "danger" : "warning";

            return (
              <div key={month.name} className="rounded-md border border-gray-200 bg-[#fcfcfd] p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-[12px] font-semibold text-gray-800">{month.name}</h3>
                    <p className="mt-0.5 text-[11px] text-gray-500">{month.days} days</p>
                  </div>
                  <CalendarDays className="h-4 w-4 text-[#1557b0]" />
                </div>

                <div className="space-y-3">
                  {[
                    {
                      label: "SSF Filing (25th)",
                      done: isSSFCompleted,
                      kind: ssfKind,
                      action: () => toggleComplianceStatus(month.name, "ssf"),
                    },
                    {
                      label: "PF Deposit (15th)",
                      done: isPFCompleted,
                      kind: pfKind,
                      action: () => toggleComplianceStatus(month.name, "pf"),
                    },
                    {
                      label: "TDS Return",
                      done: isTDSRetCompleted,
                      kind: isTDSRetCompleted ? "success" : "warning",
                      action: () => toggleComplianceStatus(month.name, "tds_ret"),
                    },
                    {
                      label: "Salary TDS Dep",
                      done: isTDSDepCompleted,
                      kind: isTDSDepCompleted ? "success" : "warning",
                      action: () => toggleComplianceStatus(month.name, "tds_dep"),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-gray-200 bg-white p-2.5"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[12px] text-gray-700">{item.label}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeCls(item.kind)}`}
                        >
                          {item.done ? "Done" : item.kind === "danger" ? "Overdue" : "Pending"}
                        </span>
                      </div>
                      <button type="button" onClick={item.action} className={smallOutlineButtonCls}>
                        {item.done ? "Undo" : "Mark Done"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f5f6fa] p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Payroll compliance reports</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            SSF, PF, CIT, tax installments, and recurring payroll compliance tracking
          </p>
        </div>
        <div className="flex items-center gap-2" />
      </div>

      <div className="no-print mb-4 rounded-md border border-gray-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={labelCls}>Fiscal year</label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              className={inputCls}
            >
              <option value="">Select Fiscal Year</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.yearBs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className={inputCls}
            >
              {calendarMonths.map((month) => (
                <option key={month.name} value={month.name}>
                  {month.name}
                </option>
              ))}
            </select>
          </div>
          <div className="xl:col-span-2 flex items-end gap-2">
            <button type="button" onClick={() => {}} className={primaryButtonCls}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Load Employees
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          {selectedFiscalYearLabel} · {selectedMonth} · {activeEmployees.length} active employee
          {activeEmployees.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Active Employees
              </p>
              <p className="mt-2 text-[18px] font-semibold text-gray-800">
                {activeEmployees.length}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Included in payroll compliance reports
              </p>
            </div>
            <Users className="h-4 w-4 text-[#1557b0]" />
          </div>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Gross Salary
          </p>
          <p className="mt-2 text-[18px] font-semibold text-gray-800">
            {money(ssfTotals.grossSalary)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            For {selectedMonth || "the selected month"}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Total SSF
          </p>
          <p className="mt-2 text-[18px] font-semibold text-gray-800">
            {money(ssfTotals.totalSSF)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">Employee plus employer contribution</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Compliance Complete
              </p>
              <p className="mt-2 text-[18px] font-semibold text-gray-800">
                {complianceSummary.completed}/{complianceSummary.total}
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Tracked filing and deposit checkpoints
              </p>
            </div>
            <ShieldCheck className="h-4 w-4 text-[#1557b0]" />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={tabCls(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "ssf" && renderSSFPortalExport()}
        {activeTab === "pf" && renderPFContributionSchedule()}
        {activeTab === "cit" && renderCITSchedule()}
        {activeTab === "tax" && renderIncomeTaxAdvanceInstallments()}
        {activeTab === "calendar" && renderComplianceCalendar()}
      </div>
    </div>
  );
}
