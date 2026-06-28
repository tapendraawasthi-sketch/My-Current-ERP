// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { getDB, generateId } from "../lib/db";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

const BORDER = "1px solid #000";
const BG = "#E4F1D9";
const BG_CARD = "#EBF5E2";
const BG_HEADER = "#D4EABD";
const BG_DEEP = "#C9DEB5";

function money(v) {
  const abs = Math.abs(Number(v || 0));
  return v < 0
    ? `(${abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const TAX_SLABS = [
  { min: 0, max: 500000, rate: 0.01 },
  { min: 500001, max: 700000, rate: 0.10 },
  { min: 700001, max: 1000000, rate: 0.20 },
  { min: 1000001, max: 2000000, rate: 0.30 },
  { min: 2000001, max: Infinity, rate: 0.36 },
];

export default function Form25B() {
  const { fiscalYears, employees, companySettings } = useStore();
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [certificates, setCertificates] = useState([]);
  const [payrollRuns, setPayrollRuns] = useState([]);
  const [status, setStatus] = useState("");

  // Load payroll runs
  useEffect(() => {
    const db = getDB();
    db.table("payrollRuns")
      .toArray()
      .then(setPayrollRuns)
      .catch(() => {
        // Fallback: use vouchers with type "payroll"
        db.vouchers
          .where("type")
          .equals("payroll")
          .toArray()
          .then(setPayrollRuns)
          .catch(() => setPayrollRuns([]));
      });
  }, []);

  const generateCertificateData = (emp, fy) => {
    // Find all payroll data for the selected employee in the fiscal year
    const empPayrolls = payrollRuns.filter(
      (p) => p.employeeId === emp.id && p.fiscalYear === fy.id
    );

    const monthlyData = FY_MONTHS.map((month, index) => {
      // Find payroll for this month
      const payroll = empPayrolls.find((p) => p.monthIndex === index);
      
      // If no payroll found, return zeros
      return {
        month,
        grossSalary: payroll?.grossSalary || 0,
        ssf: payroll?.deductions?.ssf || 0,
        pf: payroll?.deductions?.pf || 0,
        cit: payroll?.tax || 0,
        taxableIncome: payroll?.taxableIncome || 0,
        taxDeducted: payroll?.tax || 0,
      };
    });

    // Calculate totals
    const totals = {
      grossSalary: monthlyData.reduce((sum, m) => sum + m.grossSalary, 0),
      ssf: monthlyData.reduce((sum, m) => sum + m.ssf, 0),
      pf: monthlyData.reduce((sum, m) => sum + m.pf, 0),
      cit: monthlyData.reduce((sum, m) => sum + m.cit, 0),
      taxableIncome: monthlyData.reduce((sum, m) => sum + m.taxableIncome, 0),
      taxDeducted: monthlyData.reduce((sum, m) => sum + m.taxDeducted, 0),
    };

    // Calculate tax rate applied (simplified)
    let taxRate = "N/A";
    if (totals.taxableIncome > 0) {
      const avgRate = (totals.taxDeducted / totals.taxableIncome) * 100;
      taxRate = `${avgRate.toFixed(2)}%`;
    }

    return {
      employee: emp,
      fiscalYear: fy,
      monthlyData,
      totals,
      taxRate,
    };
  };

  const handleGenerate = () => {
    if (!selectedFiscalYear || !selectedEmployee) {
      toast.error("Please select both Fiscal Year and Employee");
      return;
    }

    const fy = fiscalYears.find((f) => f.id === selectedFiscalYear);
    const emp = employees.find((e) => e.id === selectedEmployee);

    if (!fy || !emp) {
      toast.error("Invalid selection");
      return;
    }

    const cert = generateCertificateData(emp, fy);
    setCertificates([cert]);
    setStatus(`Certificate generated for ${emp.name}`);
    toast.success("Certificate generated successfully");
  };

  const handlePrintPDF = () => {
    if (certificates.length === 0) {
      toast.error("No certificate to print. Please generate first.");
      return;
    }

    const cert = certificates[0];
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(14);
    doc.text("INCOME TAX ACT, 2058", 105, 20, null, null, "center");
    doc.setFontSize(13);
    doc.text("CERTIFICATE OF TAX DEDUCTED AT SOURCE", 105, 30, null, null, "center");
    doc.setFontSize(12);
    doc.text("FORM 25B", 105, 38, null, null, "center");
    doc.setFontSize(11);
    doc.text("भाग / Section 90 अन्तर्गत", 105, 44, null, null, "center");

    // Add horizontal line
    doc.line(20, 50, 190, 50);

    // Section 1: Employer Details
    doc.setFontSize(12);
    doc.text("1. EMPLOYER DETAILS", 20, 60);
    
    doc.setFontSize(10);
    doc.text(`Employer Name: ${companySettings?.name || "N/A"}`, 20, 70);
    doc.text(`Employer PAN: ${companySettings?.panNumber || "N/A"}`, 20, 78);
    doc.text(`Address: ${companySettings?.address || "N/A"}`, 20, 86);
    doc.text(`Fiscal Year: ${cert.fiscalYear.yearBs}`, 20, 94);
    doc.text("Period: Shrawan 1 to Ashad End", 20, 102);

    // Section 2: Employee Details
    doc.setFontSize(12);
    doc.text("2. EMPLOYEE DETAILS", 20, 112);
    
    doc.setFontSize(10);
    doc.text(`Employee Name: ${cert.employee.name || "N/A"}`, 20, 122);
    doc.text(`Employee PAN: ${cert.employee.pan || "N/A"}`, 20, 130);
    doc.text(`Designation: ${cert.employee.designation || "N/A"}`, 20, 138);
    doc.text(`Department: ${cert.employee.department || "N/A"}`, 20, 146);
    doc.text(`Employee Code: ${cert.employee.code || "N/A"}`, 20, 154);

    // Section 3: Salary Details Table
    doc.setFontSize(12);
    doc.text("3. SALARY DETAILS", 20, 164);
    
    const tableData = cert.monthlyData.map(m => [
      m.month,
      money(m.grossSalary),
      money(m.ssf),
      money(m.pf),
      money(m.cit),
      money(m.taxableIncome),
      money(m.taxDeducted),
    ]);
    
    // Add total row
    tableData.push([
      "TOTAL",
      money(cert.totals.grossSalary),
      money(cert.totals.ssf),
      money(cert.totals.pf),
      money(cert.totals.cit),
      money(cert.totals.taxableIncome),
      money(cert.totals.taxDeducted),
    ]);

    (doc as any).autoTable({
      startY: 170,
      head: [["Month", "Gross Salary", "SSF Employee", "PF Employee", "CIT", "Taxable Income", "Tax Deducted"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [212, 234, 189], textColor: 0, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20 },
    });

    // Section 4: Summary Box
    const summaryStartY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("4. SUMMARY", 20, summaryStartY);
    
    doc.setFontSize(10);
    doc.text(`Total Gross Salary: ${money(cert.totals.grossSalary)}`, 20, summaryStartY + 10);
    doc.text(`Total SSF (Employee): ${money(cert.totals.ssf)}`, 20, summaryStartY + 18);
    doc.text(`Total PF (Employee): ${money(cert.totals.pf)}`, 20, summaryStartY + 26);
    doc.text(`Total CIT: ${money(cert.totals.cit)}`, 20, summaryStartY + 34);
    doc.text(`Total Taxable Income: ${money(cert.totals.taxableIncome)}`, 20, summaryStartY + 42);
    doc.setFontSize(14);
    doc.text(`Total Tax Deducted at Source: ${money(cert.totals.taxDeducted)}`, 20, summaryStartY + 52);
    doc.setFontSize(10);
    doc.text(`Tax Rate Applied: ${cert.taxRate}`, 20, summaryStartY + 60);

    // Section 5: Declaration
    const declStartY = summaryStartY + 70;
    doc.setFontSize(10);
    doc.text("5. DECLARATION", 20, declStartY);
    doc.text("I hereby certify that the above amount has been deducted from the salary of the above-named employee and deposited to the Inland Revenue Department as per the provisions of Income Tax Act, 2058.", 20, declStartY + 8);

    // Section 6: Signature Block
    const sigStartY = declStartY + 20;
    doc.setFontSize(10);
    doc.text("6. SIGNATURE BLOCK", 20, sigStartY);
    
    // Left column
    doc.text("Signature of Employer/Authorized Person", 20, sigStartY + 8);
    doc.line(20, sigStartY + 12, 90, sigStartY + 12); // signature line
    doc.text("Name:", 20, sigStartY + 20);
    doc.text("Designation:", 20, sigStartY + 28);
    doc.text("Date:", 20, sigStartY + 36);
    
    // Right column - Stamp area
    doc.text("Official Stamp Area", 110, sigStartY + 8);
    doc.rect(110, sigStartY + 12, 80, 60, "D"); // dashed box
    doc.text("OFFICIAL STAMP", 150, sigStartY + 40, null, null, "center");

    // Save the PDF
    doc.save(`Form25B_${cert.employee.code}_${cert.fiscalYear.yearBs}.pdf`);
  };

  const handleExportExcel = () => {
    if (certificates.length === 0) {
      toast.error("No certificate to export. Please generate first.");
      return;
    }

    const cert = certificates[0];
    
    // Create worksheet for salary details
    const wsData = [
      ["Month", "Gross Salary", "SSF Employee", "PF Employee", "CIT", "Taxable Income", "Tax Deducted"],
      ...cert.monthlyData.map(m => [
        m.month,
        m.grossSalary,
        m.ssf,
        m.pf,
        m.cit,
        m.taxableIncome,
        m.taxDeducted,
      ]),
      [
        "TOTAL",
        cert.totals.grossSalary,
        cert.totals.ssf,
        cert.totals.pf,
        cert.totals.cit,
        cert.totals.taxableIncome,
        cert.totals.taxDeducted,
      ]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Form25B_${cert.employee.code}`);
    XLSX.writeFile(wb, `Form25B_${cert.employee.code}_${cert.fiscalYear.yearBs}.xlsx`);
    toast.success("Exported to Excel successfully");
  };

  const renderCertificate = (cert) => (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>INCOME TAX ACT, 2058</div>
        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>CERTIFICATE OF TAX DEDUCTED AT SOURCE</div>
        <div style={{ fontSize: '12px', fontWeight: 'bold' }}>FORM 25B</div>
        <div style={{ fontSize: '11px' }}>भाग / Section 90 अन्तर्गत</div>
        <hr style={{ marginTop: '10px', border: '0.5px solid #000' }} />
      </div>

      {/* Section 1 - Employer Details */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>1. EMPLOYER DETAILS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER }}>
          <tbody>
            <tr>
              <td style={{ border: BORDER, padding: '6px', width: '50%' }}>Employer Name</td>
              <td style={{ border: BORDER, padding: '6px', width: '50%' }}>{companySettings?.name || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Employer PAN</td>
              <td style={{ border: BORDER, padding: '6px' }}>{companySettings?.panNumber || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Address</td>
              <td style={{ border: BORDER, padding: '6px' }}>{companySettings?.address || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Fiscal Year</td>
              <td style={{ border: BORDER, padding: '6px' }}>{cert.fiscalYear.yearBs}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Period</td>
              <td style={{ border: BORDER, padding: '6px' }}>Shrawan 1 to Ashad End</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 2 - Employee Details */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>2. EMPLOYEE DETAILS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER }}>
          <tbody>
            <tr>
              <td style={{ border: BORDER, padding: '6px', width: '50%' }}>Employee Full Name</td>
              <td style={{ border: BORDER, padding: '6px', width: '50%' }}>{cert.employee.name || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Employee PAN</td>
              <td style={{ border: BORDER, padding: '6px' }}>{cert.employee.pan || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Designation</td>
              <td style={{ border: BORDER, padding: '6px' }}>{cert.employee.designation || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Department</td>
              <td style={{ border: BORDER, padding: '6px' }}>{cert.employee.department || "N/A"}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Employee Code</td>
              <td style={{ border: BORDER, padding: '6px' }}>{cert.employee.code || "N/A"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 3 - Salary Details Table */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>3. SALARY DETAILS</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER }}>
          <thead>
            <tr style={{ backgroundColor: BG_HEADER }}>
              <th style={{ border: BORDER, padding: '6px' }}>Month</th>
              <th style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>Gross Salary</th>
              <th style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>SSF Employee</th>
              <th style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>PF Employee</th>
              <th style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>CIT</th>
              <th style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>Taxable Income</th>
              <th style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>Tax Deducted</th>
            </tr>
          </thead>
          <tbody>
            {cert.monthlyData.map((m, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? BG_DEEP : 'transparent' }}>
                <td style={{ border: BORDER, padding: '6px' }}>{m.month}</td>
                <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(m.grossSalary)}</td>
                <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(m.ssf)}</td>
                <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(m.pf)}</td>
                <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(m.cit)}</td>
                <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(m.taxableIncome)}</td>
                <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(m.taxDeducted)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', backgroundColor: BG_HEADER }}>
              <td style={{ border: BORDER, padding: '6px' }}>TOTAL</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.grossSalary)}</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.ssf)}</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.pf)}</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.cit)}</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.taxableIncome)}</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.taxDeducted)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 4 - Summary */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>4. SUMMARY</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: BORDER }}>
          <tbody>
            <tr>
              <td style={{ border: BORDER, padding: '6px', width: '60%' }}>Total Gross Salary</td>
              <td style={{ border: BORDER, padding: '6px', width: '40%', textAlign: 'right' }}>{money(cert.totals.grossSalary)}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Total SSF (Employee)</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.ssf)}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Total PF (Employee)</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.pf)}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Total CIT</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.cit)}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Total Taxable Income</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{money(cert.totals.taxableIncome)}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px', fontWeight: 'bold', fontSize: '14px' }}>Total Tax Deducted at Source</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>{money(cert.totals.taxDeducted)}</td>
            </tr>
            <tr>
              <td style={{ border: BORDER, padding: '6px' }}>Tax Rate Applied</td>
              <td style={{ border: BORDER, padding: '6px', textAlign: 'right' }}>{cert.taxRate}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 5 - Declaration */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', border: BORDER }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>5. DECLARATION</div>
        <div style={{ fontSize: '10px' }}>
          I hereby certify that the above amount has been deducted from the salary of the above-named employee and deposited to the Inland Revenue Department as per the provisions of Income Tax Act, 2058.
        </div>
      </div>

      {/* Section 6 - Signature Block */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '48%' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>6. SIGNATURE BLOCK</div>
          <div style={{ marginBottom: '10px' }}>Signature of Employer/Authorized Person</div>
          <div style={{ height: '30px', borderBottom: BORDER, marginBottom: '10px' }}></div>
          <div style={{ marginBottom: '5px' }}>Name:</div>
          <div style={{ marginBottom: '5px' }}>Designation:</div>
          <div style={{ marginBottom: '5px' }}>Date:</div>
        </div>
        <div style={{ width: '48%', textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}>Official Stamp Area</div>
          <div style={{ 
            width: '80px', 
            height: '60px', 
            border: '2px dashed #000', 
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px'
          }}>
            OFFICIAL STAMP
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: BG }}>
      {/* Left Panel */}
      <div style={{ 
        width: '280px', 
        backgroundColor: BG_CARD, 
        padding: '20px', 
        borderRight: BORDER,
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
      }}>
        <h2 style={{ fontSize: '13px', fontWeight: 'bold', color: '#000000', margin: 0 }}>Form 25B — Tax Certificate</h2>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Fiscal Year</label>
          <select
            value={selectedFiscalYear}
            onChange={(e) => setSelectedFiscalYear(e.target.value)}
            style={{ width: '100%', padding: '8px', border: BORDER, borderRadius: '4px' }}
          >
            <option value="">Select Fiscal Year</option>
            {fiscalYears.map(fy => (
              <option key={fy.id} value={fy.id}>{fy.yearBs}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}>Employee</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            style={{ width: '100%', padding: '8px', border: BORDER, borderRadius: '4px' }}
          >
            <option value="">Select Employee</option>
            {employees.filter(e => e.isActive).map(emp => (
              <option key={emp.id} value={emp.id}>{emp.code} - {emp.name}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleGenerate}
          style={{
            backgroundColor: '#1557b0',
            color: 'white',
            border: BORDER,
            padding: '10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px'
          }}
        >
          GENERATE CERTIFICATE
        </button>
        
        <button
          onClick={handlePrintPDF}
          style={{
            backgroundColor: BG_HEADER,
            color: '#000000',
            border: BORDER,
            padding: '10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          PRINT PDF
        </button>
        
        <button
          onClick={handleExportExcel}
          style={{
            backgroundColor: BG_HEADER,
            color: '#000000',
            border: BORDER,
            padding: '10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          EXPORT EXCEL
        </button>
        
        {status && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: BG_DEEP, 
            border: BORDER, 
            borderRadius: '4px',
            fontSize: '11px'
          }}>
            {status}
          </div>
        )}
        
        <div style={{ marginTop: '10px', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ marginRight: '5px' }}>☐</span>
            <span>Employer PAN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ marginRight: '5px' }}>☐</span>
            <span>Employee PAN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ marginRight: '5px' }}>☐</span>
            <span>Tax Calculation</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '5px' }}>☐</span>
            <span>Signature Block</span>
          </div>
        </div>
      </div>
      
      {/* Right Panel */}
      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#FFFFFF' }}>
        {certificates.length > 0 ? (
          certificates.map((cert, idx) => (
            <div key={idx}>
              {renderCertificate(cert)}
            </div>
          ))
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: '#666',
            fontSize: '14px'
          }}>
            Select Fiscal Year and Employee, then click "Generate Certificate" to view Form 25B
          </div>
        )}
      </div>
    </div>
  );
}
