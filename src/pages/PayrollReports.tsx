// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import toast from "react-hot-toast";

const BORDER = "1px solid #000";
const BG_PAGE = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const FY_MONTHS = [
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
  "Ashad",
];

export default function PayrollReports() {
  const { employees, companySettings, fiscalYears } = useStore();
  const [activeTab, setActiveTab] = useState("ssf");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(FY_MONTHS[0]);
  const [estimatedAnnualTax, setEstimatedAnnualTax] = useState(0);
  const [installmentData, setInstallmentData] = useState([]);
  const [complianceStatus, setComplianceStatus] = useState({});

  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees]);

  // Load compliance status from localStorage
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

  // Calculate installment data when estimated tax changes
  useEffect(() => {
    const annualTax = Number(estimatedAnnualTax) || 0;
    const installments = [
      {
        id: 1,
        no: "1st",
        dueMonth: "Poush",
        dueDate: "2081-01-07", // Example BS date
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

  // Calculate SSF data
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
        year: selectedFiscalYear.split("/")[1] || "2081",
      };
    });
  }, [activeEmployees, selectedFiscalYear, selectedMonth]);

  // Calculate PF data
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

  // Calculate CIT data
  const citData = useMemo(() => {
    if (!selectedFiscalYear || !selectedMonth) return [];
    return activeEmployees.map((emp) => {
      const basic = emp.salaryDetails?.basicSalary || emp.basicSalary || 0;
      const citDeducted = basic * 0.1; // Assuming 10% CIT

      return {
        name: emp.name,
        basicSalary: basic,
        citDeducted,
      };
    });
  }, [activeEmployees, selectedFiscalYear, selectedMonth]);

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
    link.setAttribute(
      "download",
      `SSF_Export_${selectedMonth}_${selectedFiscalYear.split("/")[1] || "2081"}.csv`,
    );
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
    XLSX.writeFile(
      wb,
      `PF_Schedule_${selectedMonth}_${selectedFiscalYear.split("/")[1] || "2081"}.xlsx`,
    );

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
    XLSX.writeFile(
      wb,
      `CIT_Schedule_${selectedMonth}_${selectedFiscalYear.split("/")[1] || "2081"}.xlsx`,
    );

    toast.success("CIT Excel exported successfully!");
  };

  const handlePrintPFChallan = () => {
    const challanHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">PF Deposit Challan</h2>
        <div style="margin: 20px 0;">
          <div><strong>Employer Name:</strong> ${companySettings?.name || "N/A"}</div>
          <div><strong>Employer PAN:</strong> ${companySettings?.panNumber || "N/A"}</div>
          <div><strong>Bank Name:</strong> ________________</div>
          <div><strong>Cheque/DD No:</strong> ________________</div>
          <div><strong>Date:</strong> ________________</div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: ${BG_HEADER};">
              <th style="${BORDER}; padding: 8px;">Code</th>
              <th style="${BORDER}; padding: 8px;">Name</th>
              <th style="${BORDER}; padding: 8px; text-align: right;">Employee PF</th>
              <th style="${BORDER}; padding: 8px; text-align: right;">Employer PF</th>
              <th style="${BORDER}; padding: 8px; text-align: right;">Total PF</th>
            </tr>
          </thead>
          <tbody>
            ${pfData
              .map(
                (row) => `
              <tr>
                <td style="${BORDER}; padding: 8px;">${row.code}</td>
                <td style="${BORDER}; padding: 8px;">${row.name}</td>
                <td style="${BORDER}; padding: 8px; text-align: right;">${money(row.employeePF)}</td>
                <td style="${BORDER}; padding: 8px; text-align: right;">${money(row.employerPF)}</td>
                <td style="${BORDER}; padding: 8px; text-align: right;">${money(row.totalPF)}</td>
              </tr>
            `,
              )
              .join("")}
            <tr style="font-weight: bold; background-color: ${BG_HEADER};">
              <td style="${BORDER}; padding: 8px;"></td>
              <td style="${BORDER}; padding: 8px;">TOTAL</td>
              <td style="${BORDER}; padding: 8px; text-align: right;">${money(pfData.reduce((sum, row) => sum + row.employeePF, 0))}</td>
              <td style="${BORDER}; padding: 8px; text-align: right;">${money(pfData.reduce((sum, row) => sum + row.employerPF, 0))}</td>
              <td style="${BORDER}; padding: 8px; text-align: right;">${money(pfData.reduce((sum, row) => sum + row.totalPF, 0))}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 40px; display: flex; justify-content: space-between;">
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
    <div style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}>
      <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Fiscal Year
          </label>
          <select
            value={selectedFiscalYear}
            onChange={(e) => setSelectedFiscalYear(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px" }}
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
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px" }}
          >
            {FY_MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {}}
          style={{
            backgroundColor: "#1557b0",
            color: "white",
            border: BORDER,
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            alignSelf: "flex-end",
          }}
        >
          Load Employees
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={exportSSFCSV}
          style={{
            backgroundColor: "#059669",
            color: "white",
            border: BORDER,
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export SSF Portal CSV
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>SSF Member No</th>
              <th style={{ border: BORDER, padding: "8px" }}>Employee Name</th>
              <th style={{ border: BORDER, padding: "8px" }}>Department</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Gross Salary</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                Employee Contribution (11%)
              </th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                Employer Contribution (20%)
              </th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Total SSF</th>
            </tr>
          </thead>
          <tbody>
            {ssfData.length > 0 ? (
              ssfData.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}>
                  <td style={{ border: BORDER, padding: "8px" }}>{row.ssfNo}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{row.name}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{row.department}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.grossSalary)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.employeeContribution)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.employerContribution)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.totalSSF)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No employees loaded. Click "Load Employees" to populate data.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <td style={{ border: BORDER, padding: "8px", fontWeight: "bold" }}>TOTAL</td>
              <td style={{ border: BORDER, padding: "8px" }}></td>
              <td style={{ border: BORDER, padding: "8px" }}></td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(ssfData.reduce((sum, row) => sum + row.grossSalary, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(ssfData.reduce((sum, row) => sum + row.employeeContribution, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(ssfData.reduce((sum, row) => sum + row.employerContribution, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(ssfData.reduce((sum, row) => sum + row.totalSSF, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const renderPFContributionSchedule = () => (
    <div style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}>
      <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Fiscal Year
          </label>
          <select
            value={selectedFiscalYear}
            onChange={(e) => setSelectedFiscalYear(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px" }}
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
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px" }}
          >
            {FY_MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {}}
          style={{
            backgroundColor: "#1557b0",
            color: "white",
            border: BORDER,
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            alignSelf: "flex-end",
          }}
        >
          Load Employees
        </button>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button
          onClick={handlePrintPFChallan}
          style={{
            backgroundColor: "#1557b0",
            color: "white",
            border: BORDER,
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Print PF Challan
        </button>
        <button
          onClick={exportPFExcel}
          style={{
            backgroundColor: "#059669",
            color: "white",
            border: BORDER,
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export Excel
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Employee Code</th>
              <th style={{ border: BORDER, padding: "8px" }}>Name</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Basic Salary</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                Employee PF (10%)
              </th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                Employer PF (10%)
              </th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Total PF</th>
            </tr>
          </thead>
          <tbody>
            {pfData.length > 0 ? (
              pfData.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}>
                  <td style={{ border: BORDER, padding: "8px" }}>{row.code}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{row.name}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.basicSalary)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.employeePF)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.employerPF)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.totalPF)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No employees loaded. Click "Load Employees" to populate data.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <td style={{ border: BORDER, padding: "8px", fontWeight: "bold" }}>TOTAL</td>
              <td style={{ border: BORDER, padding: "8px" }}></td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(pfData.reduce((sum, row) => sum + row.basicSalary, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(pfData.reduce((sum, row) => sum + row.employeePF, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(pfData.reduce((sum, row) => sum + row.employerPF, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(pfData.reduce((sum, row) => sum + row.totalPF, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const renderCITSchedule = () => (
    <div style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}>
      <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Fiscal Year
          </label>
          <select
            value={selectedFiscalYear}
            onChange={(e) => setSelectedFiscalYear(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px" }}
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
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: "6px", border: BORDER, borderRadius: "4px" }}
          >
            {FY_MONTHS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {}}
          style={{
            backgroundColor: "#1557b0",
            color: "white",
            border: BORDER,
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            alignSelf: "flex-end",
          }}
        >
          Load Employees
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={exportCITExcel}
          style={{
            backgroundColor: "#059669",
            color: "white",
            border: BORDER,
            padding: "10px 16px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Export CIT Schedule
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Employee Name</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Basic Salary</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                CIT Deducted (10%)
              </th>
            </tr>
          </thead>
          <tbody>
            {citData.length > 0 ? (
              citData.map((row, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}>
                  <td style={{ border: BORDER, padding: "8px" }}>{row.name}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.basicSalary)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(row.citDeducted)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  style={{ border: BORDER, padding: "16px", textAlign: "center", color: "#666" }}
                >
                  No employees loaded. Click "Load Employees" to populate data.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <td style={{ border: BORDER, padding: "8px", fontWeight: "bold" }}>TOTAL</td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(citData.reduce((sum, row) => sum + row.basicSalary, 0))}
              </td>
              <td
                style={{ border: BORDER, padding: "8px", textAlign: "right", fontWeight: "bold" }}
              >
                {money(citData.reduce((sum, row) => sum + row.citDeducted, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const renderIncomeTaxAdvanceInstallments = () => (
    <div style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}>
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Estimated Annual Tax (Rs.)
        </label>
        <input
          type="number"
          value={estimatedAnnualTax}
          onChange={(e) => setEstimatedAnnualTax(e.target.value)}
          style={{ width: "300px", padding: "8px", border: BORDER, borderRadius: "4px" }}
        />
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: "8px" }}>Installment No</th>
              <th style={{ border: BORDER, padding: "8px" }}>Due Month</th>
              <th style={{ border: BORDER, padding: "8px" }}>Due Date (BS)</th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                Amount Required
              </th>
              <th style={{ border: BORDER, padding: "8px", textAlign: "right" }}>Amount Paid</th>
              <th style={{ border: BORDER, padding: "8px" }}>Status</th>
              <th style={{ border: BORDER, padding: "8px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {installmentData.map((inst, idx) => {
              const statusColor =
                inst.status === "paid"
                  ? "#059669"
                  : new Date(inst.dueDate) < new Date()
                    ? "#dc2626"
                    : "#d97706";

              return (
                <tr
                  key={inst.id}
                  style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : "transparent" }}
                >
                  <td style={{ border: BORDER, padding: "8px" }}>{inst.no} Installment</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{inst.dueMonth}</td>
                  <td style={{ border: BORDER, padding: "8px" }}>{inst.dueDate}</td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    {money(inst.amountRequired)}
                  </td>
                  <td style={{ border: BORDER, padding: "8px", textAlign: "right" }}>
                    <input
                      type="number"
                      value={inst.amountPaid}
                      onChange={(e) => {
                        const newAmount = Number(e.target.value) || 0;
                        setInstallmentData((prev) =>
                          prev.map((i) =>
                            i.id === inst.id
                              ? {
                                  ...i,
                                  amountPaid: newAmount,
                                  status: newAmount >= inst.amountRequired ? "paid" : "pending",
                                }
                              : i,
                          ),
                        );
                      }}
                      style={{
                        width: "100px",
                        padding: "4px",
                        border: BORDER,
                        borderRadius: "4px",
                      }}
                    />
                  </td>
                  <td
                    style={{
                      border: BORDER,
                      padding: "8px",
                      color: statusColor,
                      fontWeight: "bold",
                    }}
                  >
                    {inst.status === "paid" ? "PAID" : "PENDING"}
                  </td>
                  <td style={{ border: BORDER, padding: "8px" }}>
                    <button
                      onClick={() => {
                        setInstallmentData((prev) =>
                          prev.map((i) =>
                            i.id === inst.id
                              ? { ...i, status: "paid", amountPaid: i.amountRequired }
                              : i,
                          ),
                        );
                      }}
                      style={{
                        backgroundColor: "#059669",
                        color: "white",
                        border: BORDER,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
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
    </div>
  );

  const renderComplianceCalendar = () => {
    const months = [
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

    const now = new Date();
    const currentYear = now.getFullYear();

    return (
      <div
        style={{ padding: "20px", backgroundColor: BG_CARD, borderRadius: "8px", border: BORDER }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "15px",
          }}
        >
          {months.map((month, idx) => {
            const ssfDeadline = new Date(currentYear, (idx + 1) % 12, 25); // 25th of next month
            const pfDeadline = new Date(currentYear, (idx + 1) % 12, 15); // 15th of next month

            const ssfKey = `${month.name}_ssf`;
            const pfKey = `${month.name}_pf`;
            const tdsRetKey = `${month.name}_tds_ret`;
            const tdsDepKey = `${month.name}_tds_dep`;

            const isSSFCompleted = complianceStatus[ssfKey] || false;
            const isPFCompleted = complianceStatus[pfKey] || false;
            const isTDSRetCompleted = complianceStatus[tdsRetKey] || false;
            const isTDSDepCompleted = complianceStatus[tdsDepKey] || false;

            const ssfStatus = isSSFCompleted
              ? "#059669"
              : ssfDeadline < now
                ? "#dc2626"
                : "#d97706";
            const pfStatus = isPFCompleted ? "#059669" : pfDeadline < now ? "#dc2626" : "#d97706";

            return (
              <div
                key={month.name}
                style={{
                  border: BORDER,
                  borderRadius: "8px",
                  padding: "15px",
                  backgroundColor: BG_DEEP,
                }}
              >
                <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "bold" }}>
                  {month.name}
                </h3>

                <div style={{ marginBottom: "8px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>SSF Filing (25th)</span>
                    <span style={{ color: ssfStatus, fontWeight: "bold" }}>
                      {isSSFCompleted ? "✓" : ssfDeadline < now ? "❌" : "⏰"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleComplianceStatus(month.name, "ssf")}
                    style={{
                      backgroundColor: isSSFCompleted ? "#059669" : "#dc2626",
                      color: "white",
                      border: BORDER,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    {isSSFCompleted ? "Done" : "Mark Done"}
                  </button>
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>PF Deposit (15th)</span>
                    <span style={{ color: pfStatus, fontWeight: "bold" }}>
                      {isPFCompleted ? "✓" : pfDeadline < now ? "❌" : "⏰"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleComplianceStatus(month.name, "pf")}
                    style={{
                      backgroundColor: isPFCompleted ? "#059669" : "#dc2626",
                      color: "white",
                      border: BORDER,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    {isPFCompleted ? "Done" : "Mark Done"}
                  </button>
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>TDS Return</span>
                    <span
                      style={{
                        color: isTDSRetCompleted ? "#059669" : "#d97706",
                        fontWeight: "bold",
                      }}
                    >
                      {isTDSRetCompleted ? "✓" : "⏰"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleComplianceStatus(month.name, "tds_ret")}
                    style={{
                      backgroundColor: isTDSRetCompleted ? "#059669" : "#d97706",
                      color: "white",
                      border: BORDER,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    {isTDSRetCompleted ? "Done" : "Mark Done"}
                  </button>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Salary TDS Dep</span>
                    <span
                      style={{
                        color: isTDSDepCompleted ? "#059669" : "#d97706",
                        fontWeight: "bold",
                      }}
                    >
                      {isTDSDepCompleted ? "✓" : "⏰"}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleComplianceStatus(month.name, "tds_dep")}
                    style={{
                      backgroundColor: isTDSDepCompleted ? "#059669" : "#d97706",
                      color: "white",
                      border: BORDER,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    {isTDSDepCompleted ? "Done" : "Mark Done"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: BG_PAGE, minHeight: "100vh", padding: "20px" }}>
      <div
        style={{
          backgroundColor: BG_HEADER,
          padding: "15px",
          borderRadius: "8px",
          border: BORDER,
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "18px", fontWeight: "bold", color: "#000000", margin: 0 }}>
          Payroll Compliance Reports
        </h1>

        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "3px",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Fiscal Year
            </label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              style={{ padding: "4px", border: BORDER, borderRadius: "4px", fontSize: "12px" }}
            >
              <option value="">Select Fiscal Year</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.yearBs}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "5px", alignItems: "flex-end" }}>
            {[
              { id: "ssf", label: "SSF Portal Export" },
              { id: "pf", label: "PF Contribution Schedule" },
              { id: "cit", label: "CIT Schedule" },
              { id: "tax", label: "Income Tax Installments" },
              { id: "calendar", label: "Compliance Calendar" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  backgroundColor: activeTab === tab.id ? "#1557b0" : "transparent",
                  color: activeTab === tab.id ? "white" : "#000000",
                  border: BORDER,
                  padding: "8px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: activeTab === tab.id ? "bold" : "normal",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
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
