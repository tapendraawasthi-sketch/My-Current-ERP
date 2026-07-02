// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import {
  Calculator,
  FileSpreadsheet,
  Home,
  Plus,
  Printer,
  Save,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Building,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const TDS_SECTIONS = {
  "87": { label: "Sec 87 - Contractor/Employment", rate: 0.015 },
  "88": { label: "Sec 88 - Rent", rate: 0.1 },
  "88Ka": { label: "Sec 88Ka - Professional Fees", rate: 0.15 },
  "89": { label: "Sec 89 - Others", rate: 0.15 },
  salary: { label: "Salary TDS", rate: null },
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function monthsBetween(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  return Math.max(1, months || 1);
}

function getFYInstallmentDates(fy: any) {
  const fyBS = fy?.fiscalYearBS || fy?.name || "2081-82";
  const firstYear = String(fyBS).match(/\d{4}/)?.[0] || "2081";
  const secondYear = String(Number(firstYear) + 1);

  return [
    {
      no: "1st",
      label: `Poush End (${firstYear}-09-30 BS)`,
      pct: 0.4,
      approximateAD: `${new Date().getFullYear()}-12-15`,
    },
    {
      no: "2nd",
      label: `Chaitra End (${firstYear}-12-30 BS)`,
      pct: 0.7,
      approximateAD: `${new Date().getFullYear() + 1}-03-15`,
    },
    {
      no: "3rd",
      label: `Ashadh End (${secondYear}-03-32 BS)`,
      pct: 1,
      approximateAD: `${new Date().getFullYear() + 1}-07-15`,
    },
  ];
}

function inferSection(v: any) {
  const text = `${v?.tdsSection || ""} ${v?.narration || ""} ${(v?.lines || [])
    .map((l: any) => l.accountName || l.name || "")
    .join(" ")}`.toLowerCase();

  if (v?.tdsSection && TDS_SECTIONS[v.tdsSection]) return v.tdsSection;
  if (text.includes("rent")) return "88";
  if (text.includes("professional") || text.includes("consult")) return "88Ka";
  if (text.includes("salary") || text.includes("payroll")) return "salary";
  if (text.includes("contract")) return "87";
  return "89";
}

function normalizePAN(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function isBSDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function computeEmployeeTaxWorksheet(emp: any, annualIncome?: number) {
  const basic = Number(emp.basicSalary || emp.salaryDetails?.basicSalary || 0);
  const annualBasic = basic * 12;
  const annualAllowances = annualBasic * 0.3;
  const grossIncome = annualIncome || annualBasic + annualAllowances;

  const pfDeduction = emp.isPFContributor ? annualBasic * 0.1 : 0;
  const ssaDeduction = 450000;
  const taxableIncome = Math.max(0, grossIncome - pfDeduction - ssaDeduction);

  const slabs = [
    { limit: 500000, rate: 0.01, label: "Up to 5,00,000" },
    { limit: 700000, rate: 0.1, label: "5,00,001 to 7,00,000" },
    { limit: 1000000, rate: 0.2, label: "7,00,001 to 10,00,000" },
    { limit: 2000000, rate: 0.3, label: "10,00,001 to 20,00,000" },
    { limit: Infinity, rate: 0.36, label: "Above 20,00,000" },
  ];

  let remaining = taxableIncome;
  let totalTax = 0;
  const slabBreakdown = [];
  let prevLimit = 0;

  for (const slab of slabs) {
    if (remaining <= 0) break;
    const slabAmount = Math.min(remaining, slab.limit - prevLimit);
    const slabTax = slabAmount * slab.rate;
    slabBreakdown.push({
      label: slab.label,
      rate: slab.rate * 100,
      income: slabAmount,
      tax: slabTax,
    });
    totalTax += slabTax;
    remaining -= slabAmount;
    prevLimit = slab.limit;
  }

  const beforeRebate = totalTax;
  if (String(emp.gender || "").toLowerCase() === "female") totalTax = totalTax * 0.9;
  const rebate = beforeRebate - totalTax;
  const monthlyTDS = Math.round(totalTax / 12);

  return {
    grossIncome,
    annualBasic,
    annualAllowances,
    pfDeduction,
    ssaDeduction,
    taxableIncome,
    totalTax: Math.round(totalTax),
    beforeRebate: Math.round(beforeRebate),
    rebate: Math.round(rebate),
    monthlyTDS,
    slabBreakdown,
  };
}

export default function AdvancedTaxCompliance() {
  const {
    invoices = [],
    vouchers = [],
    parties = [],
    employees = [],
    accounts = [],
    companySettings = {},
    currentFiscalYear = {},
    addVoucher,
  } = useStore();

  const [activeTab, setActiveTab] = useState("Advance Tax");
  const [properties, setProperties] = useState([]);
  const [showAdvForm, setShowAdvForm] = useState(false);
  const [advAmount, setAdvAmount] = useState("");
  const [advDate, setAdvDate] = useState(todayISO());
  const [advBank, setAdvBank] = useState("");
  const [advInstallment, setAdvInstallment] = useState("1st");

  const [expandedEmp, setExpandedEmp] = useState("");
  const [printHTML, setPrintHTML] = useState("");

  const [tdsValidation, setTdsValidation] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("01");

  const [propModal, setPropModal] = useState(false);
  const [propForm, setPropForm] = useState({
    propertyAddress: "",
    ownerName: "",
    ownerPan: "",
    monthlyRent: "",
    tdsRate: "10",
    startDate: todayISO(),
    endDate: "",
  });

  const [journalMonth, setJournalMonth] = useState(todayISO().slice(0, 7));
  const [journalPreview, setJournalPreview] = useState([]);

  const printRef = useRef(null);

  useEffect(() => {
    const db = getDB();
    db.table("tdsPropertyRegister")
      .toArray()
      .catch(() => [])
      .then(setProperties);
  }, []);

  const advanceTax = useMemo(() => {
    const fyStart = currentFiscalYear?.startDate || new Date().getFullYear() + "-01-01";
    const today = todayISO();

    const accountMap = {};
    (accounts || []).forEach((a: any) => (accountMap[a.id] = a));

    const posted = (vouchers || []).filter(
      (v: any) => v.date >= fyStart && v.date <= today && v.status === "posted",
    );

    let totalIncome = 0;
    let totalExpense = 0;

    posted.forEach((v: any) => {
      (v.lines || []).forEach((l: any) => {
        const acc = accountMap[l.accountId] || accounts.find((a: any) => a.name === l.accountName);
        if (acc?.type === "income") totalIncome += Number(l.credit || 0);
        if (acc?.type === "expense") totalExpense += Number(l.debit || 0);
      });
    });

    const ytdProfit = totalIncome - totalExpense;
    const monthsElapsed = monthsBetween(fyStart, today);
    const estimatedAnnualProfit = (ytdProfit / monthsElapsed) * 12;
    const taxRate = companySettings?.isPrivateFirm ? 0.25 : 0.25;
    const estimatedAnnualTax = Math.max(0, estimatedAnnualProfit * taxRate);

    const tdsPaid = (vouchers || [])
      .filter(
        (v: any) =>
          String(v.type || "")
            .toLowerCase()
            .includes("tds") ||
          String(v.narration || "")
            .toLowerCase()
            .includes("tds"),
      )
      .reduce((s: number, v: any) => s + Number(v.tdsAmount || v.amount || v.grandTotal || 0), 0);

    const advanceTaxPaid = (vouchers || [])
      .filter((v: any) => {
        const text = `${v.narration || ""} ${(v.lines || [])
          .map((l: any) => l.accountName || "")
          .join(" ")}`.toLowerCase();
        return text.includes("advance tax");
      })
      .reduce((s: number, v: any) => s + Number(v.amount || v.grandTotal || 0), 0);

    const totalPaid = tdsPaid + advanceTaxPaid;
    const installments = getFYInstallmentDates(currentFiscalYear).map((i) => {
      const amountDue = estimatedAnnualTax * i.pct;
      const paid = Math.min(totalPaid, amountDue);
      const balance = Math.max(0, amountDue - totalPaid);
      const status =
        balance <= 1 ? "Paid" : new Date(i.approximateAD) < new Date() ? "Due" : "Upcoming";
      return { ...i, amountDue, paid, balance, status };
    });

    return {
      totalIncome,
      totalExpense,
      ytdProfit,
      monthsElapsed,
      estimatedAnnualProfit,
      taxRate,
      estimatedAnnualTax,
      tdsPaid,
      advanceTaxPaid,
      totalPaid,
      netTaxPayable: estimatedAnnualTax - totalPaid,
      installments,
    };
  }, [vouchers, accounts, companySettings, currentFiscalYear]);

  const salaryRows = useMemo(() => {
    return (employees || []).map((emp: any) => ({
      emp,
      worksheet: computeEmployeeTaxWorksheet(emp),
    }));
  }, [employees]);

  const tdsRows = useMemo(() => {
    return (vouchers || [])
      .filter((v: any) => {
        const text = `${v.type || ""} ${v.narration || ""}`.toLowerCase();
        return Number(v.tdsAmount || 0) > 0 || text.includes("tds");
      })
      .map((v: any) => {
        const section = inferSection(v);
        const sectionInfo = TDS_SECTIONS[section] || TDS_SECTIONS["89"];
        const partyId = v.partyId || v.lines?.find((l: any) => l.partyId)?.partyId;
        const party = parties.find((p: any) => p.id === partyId) || {};
        const amountPaid =
          Number(v.taxableAmount || v.amountPaid || v.amount || v.grandTotal || 0) ||
          (v.lines || []).reduce((s: number, l: any) => s + Number(l.debit || l.credit || 0), 0);
        const tdsAmount = Number(v.tdsAmount || 0);
        const quarter = getQuarter(v.date || todayISO(), currentFiscalYear?.startDate);
        return {
          section,
          sectionLabel: sectionInfo.label,
          partyName: party.name || v.partyName || "Unknown",
          partyPan: party.panNumber || party.pan || "",
          amountPaid,
          tdsRate: v.tdsRate || (sectionInfo.rate ? sectionInfo.rate * 100 : ""),
          tdsAmount,
          quarter,
          paymentDate: v.date,
          invoiceDateBS: v.dateNepali || "",
          invoiceNo: v.invoiceNo || v.voucherNo || v.id,
        };
      });
  }, [vouchers, parties, currentFiscalYear]);

  function getQuarter(dateStr: string, fyStart?: string) {
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    if ([7, 8, 9].includes(m)) return "Q1";
    if ([10, 11, 12].includes(m)) return "Q2";
    if ([1, 2, 3].includes(m)) return "Q3";
    return "Q4";
  }

  async function createAdvanceVoucher() {
    const amount = Number(advAmount || 0);
    if (amount <= 0) return toast.error("Enter valid amount");
    if (!advBank) return toast.error("Select bank account");

    const voucher = {
      id: generateId(),
      type: "payment",
      status: "posted",
      date: advDate,
      narration: `Advance Tax Payment - Installment ${advInstallment}`,
      amount,
      grandTotal: amount,
      lines: [
        {
          id: generateId(),
          accountName: "Advance Tax",
          debit: amount,
          credit: 0,
        },
        {
          id: generateId(),
          accountId: advBank,
          accountName: accounts.find((a: any) => a.id === advBank)?.name || "Bank Account",
          debit: 0,
          credit: amount,
        },
      ],
    };

    if (addVoucher) await addVoucher(voucher);
    else
      await getDB()
        .table("vouchers")
        .put(voucher)
        .catch(() => {});
    toast.success("Advance tax payment voucher created");
    setShowAdvForm(false);
    setAdvAmount("");
  }

  function certificateHTML(rows: any[]) {
    return rows
      .map(({ emp, worksheet }) => {
        return `
          <div style="page-break-after:always;font-family:Arial;padding:30px;color:#000">
            <h2 style="text-align:center">SALARY TAX CERTIFICATE - ${currentFiscalYear?.name || ""}</h2>
            <p><b>Company:</b> ${companySettings?.name || ""} | <b>PAN:</b> ${
              companySettings?.panNumber || ""
            }</p>
            <p><b>Employee:</b> ${emp.name || ""} | <b>PAN:</b> ${emp.panNumber || ""}</p>
            <table style="width:100%;border-collapse:collapse;margin-top:20px">
              <tr><td style="border:1px solid #000;padding:6px">Total Earnings During Year</td><td style="border:1px solid #000;padding:6px;text-align:right">Rs. ${money(
                worksheet.grossIncome,
              )}</td></tr>
              <tr><td style="border:1px solid #000;padding:6px">PF Deduction</td><td style="border:1px solid #000;padding:6px;text-align:right">Rs. ${money(
                worksheet.pfDeduction,
              )}</td></tr>
              <tr><td style="border:1px solid #000;padding:6px">SSA</td><td style="border:1px solid #000;padding:6px;text-align:right">Rs. ${money(
                worksheet.ssaDeduction,
              )}</td></tr>
              <tr><td style="border:1px solid #000;padding:6px">Taxable Income</td><td style="border:1px solid #000;padding:6px;text-align:right">Rs. ${money(
                worksheet.taxableIncome,
              )}</td></tr>
              <tr><td style="border:1px solid #000;padding:6px">Income Tax Deducted</td><td style="border:1px solid #000;padding:6px;text-align:right">Rs. ${money(
                worksheet.totalTax,
              )}</td></tr>
            </table>
            <p style="margin-top:30px">This is to certify the above is correct.</p>
            <p style="margin-top:60px">Authorized Signatory: ____________________ Date: _____________</p>
          </div>
        `;
      })
      .join("");
  }

  function printCertificates(rows: any[]) {
    const html = certificateHTML(rows);
    const w = window.open("", "_blank");
    w.document.write(
      `<html><head><title>Salary Tax Certificates</title></head><body>${html}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function validateTDS() {
    const errors = [];
    tdsRows.forEach((r: any) => {
      if (normalizePAN(r.partyPan).length !== 9)
        errors.push({ level: "Critical", msg: `${r.partyName}: PAN must be exactly 9 digits` });
      if (r.invoiceDateBS && !isBSDate(r.invoiceDateBS))
        errors.push({ level: "Critical", msg: `${r.invoiceNo}: Date must be BS YYYY-MM-DD` });

      const sectionInfo = TDS_SECTIONS[r.section];
      if (sectionInfo?.rate !== null && Number(r.amountPaid || 0) > 0) {
        const expected = Number(r.amountPaid || 0) * Number(sectionInfo.rate || 0);
        if (Math.abs(expected - Number(r.tdsAmount || 0)) > 1) {
          errors.push({
            level: "Warning",
            msg: `${r.invoiceNo}: TDS ${money(r.tdsAmount)} differs from expected ${money(expected)}`,
          });
        }
      }
    });
    setTdsValidation(errors);
    return errors;
  }

  function exportETDS() {
    const errors = validateTDS();
    if (errors.some((e) => e.level === "Critical")) {
      toast.error("Critical validation errors found. Export blocked.");
      return;
    }

    const salarySheet = salaryRows.map(({ emp, worksheet }) => ({
      "Fiscal Year": currentFiscalYear?.name || "",
      "Month BS": selectedMonth,
      "Employee Name": emp.name || "",
      "Employee PAN": emp.panNumber || "",
      "Total Salary": worksheet.grossIncome,
      "Taxable Salary": worksheet.taxableIncome,
      "Tax Deducted": worksheet.totalTax,
    }));

    const nonSalarySheet = tdsRows
      .filter((r: any) => r.section !== "salary")
      .map((r: any) => ({
        Section: r.sectionLabel,
        "Party Name": r.partyName,
        "Party PAN": r.partyPan,
        "Invoice Date (BS)": r.invoiceDateBS,
        "Invoice No": r.invoiceNo,
        "Amount Paid": r.amountPaid,
        "TDS Rate %": r.tdsRate,
        "TDS Amount": r.tdsAmount,
        "Remittance Date": r.paymentDate,
      }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salarySheet), "Salary TDS");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nonSalarySheet), "Non-Salary TDS");
    XLSX.writeFile(wb, `eTDS_${currentFiscalYear?.name || "FY"}.xlsx`);
    toast.success("e-TDS export created");
  }

  function printForm29() {
    const totals: any = {};
    tdsRows.forEach((r: any) => {
      totals[r.sectionLabel] = (totals[r.sectionLabel] || 0) + Number(r.tdsAmount || 0);
    });

    const rows = Object.entries(totals)
      .map(
        ([k, v]) =>
          `<tr><td style="border:1px solid #000;padding:6px">${k}</td><td style="border:1px solid #000;padding:6px;text-align:right">Rs. ${money(
            v as number,
          )}</td></tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:Arial;padding:30px">
        <h2 style="text-align:center">FORM 29 - Annual TDS Return</h2>
        <p><b>Company:</b> ${companySettings?.name || ""}</p>
        <p><b>PAN:</b> ${companySettings?.panNumber || ""}</p>
        <p><b>Fiscal Year:</b> ${currentFiscalYear?.name || ""}</p>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>
    `;

    const w = window.open("", "_blank");
    w.document.write(`<html><body>${html}</body></html>`);
    w.document.close();
    w.print();
  }

  async function saveProperty() {
    if (!propForm.propertyAddress || !propForm.ownerName)
      return toast.error("Address and owner required");
    if (normalizePAN(propForm.ownerPan).length !== 9)
      return toast.error("Owner PAN must be 9 digits");

    const row = {
      id: generateId(),
      ...propForm,
      monthlyRent: Number(propForm.monthlyRent || 0),
      tdsRate: Number(propForm.tdsRate || 10),
      ownerPan: normalizePAN(propForm.ownerPan),
      createdAt: new Date().toISOString(),
    };

    await getDB()
      .table("tdsPropertyRegister")
      .put(row)
      .catch(() => {});
    setProperties((p) => [...p, row]);
    setPropModal(false);
    setPropForm({
      propertyAddress: "",
      ownerName: "",
      ownerPan: "",
      monthlyRent: "",
      tdsRate: "10",
      startDate: todayISO(),
      endDate: "",
    });
    toast.success("Property added");
  }

  function buildPropertyJournals() {
    const active = properties.filter((p: any) => {
      const m = journalMonth + "-01";
      return p.startDate <= m && (!p.endDate || p.endDate >= m);
    });

    const previews = active.map((p: any) => {
      const rent = Number(p.monthlyRent || 0);
      const tds = rent * (Number(p.tdsRate || 10) / 100);
      const net = rent - tds;
      return {
        property: p,
        rent,
        tds,
        net,
        lines: [
          { accountName: "Rent Expense", debit: rent, credit: 0 },
          { accountName: "TDS Payable (Rent)", debit: 0, credit: tds },
          { accountName: "Bank/Cash", debit: 0, credit: net },
        ],
      };
    });

    setJournalPreview(previews);
  }

  async function postPropertyJournals() {
    for (const p of journalPreview) {
      const voucher = {
        id: generateId(),
        type: "journal",
        status: "posted",
        date: journalMonth + "-28",
        narration: `Monthly Rent TDS Journal - ${p.property.ownerName} - ${journalMonth}`,
        grandTotal: p.rent,
        lines: p.lines.map((l: any) => ({ id: generateId(), ...l })),
      };
      if (addVoucher) await addVoucher(voucher);
      else
        await getDB()
          .table("vouchers")
          .put(voucher)
          .catch(() => {});
    }
    toast.success(`${journalPreview.length} rent TDS journals posted`);
    setJournalPreview([]);
  }

  const tabs = ["Advance Tax", "Salary Tax Worksheet", "e-TDS Filing", "TDS Property Register"];

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Advanced Tax Compliance</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Nepal VAT, TDS, salary tax and advance tax workflows
          </p>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-4 bg-white px-2 pt-2 rounded-t-md shadow-sm overflow-x-auto hide-scrollbar">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t
                ? "border-[#1557b0] text-[#1557b0]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Advance Tax" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4">Advance Tax Computation</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold mb-1">
                  YTD Profit
                </div>
                <div className="text-[14px] font-bold text-gray-800">
                  Rs. {money(advanceTax.ytdProfit)}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold mb-1">
                  Months Elapsed
                </div>
                <div className="text-[14px] font-bold text-gray-800">
                  {advanceTax.monthsElapsed}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold mb-1">
                  Est. Annual Profit
                </div>
                <div className="text-[14px] font-bold text-gray-800">
                  Rs. {money(advanceTax.estimatedAnnualProfit)}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold mb-1">
                  Tax Rate
                </div>
                <div className="text-[14px] font-bold text-gray-800">25% (Corporate)</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-100">
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold mb-1">
                  Est. Annual Tax
                </div>
                <div className="text-[14px] font-bold text-gray-800">
                  Rs. {money(advanceTax.estimatedAnnualTax)}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-md border border-green-100">
                <div className="text-[11px] text-green-700 tracking-wide font-semibold mb-1">
                  TDS Deducted at Source
                </div>
                <div className="text-[14px] font-bold text-green-700">
                  Rs. {money(advanceTax.tdsPaid)}
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                <div className="text-[11px] text-[#1557b0] tracking-wide font-semibold mb-1">
                  Advance Tax Paid
                </div>
                <div className="text-[14px] font-bold text-[#1557b0]">
                  Rs. {money(advanceTax.advanceTaxPaid)}
                </div>
              </div>
              <div className="bg-amber-50 p-3 rounded-md border border-amber-100">
                <div className="text-[11px] text-amber-700 tracking-wide font-semibold mb-1">
                  Net Tax Payable
                </div>
                <div className="text-[15px] font-bold text-amber-700">
                  Rs. {money(advanceTax.netTaxPayable)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold text-gray-800">Installment Schedule</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors flex items-center gap-1.5 shadow-sm"
                onClick={() => setShowAdvForm(!showAdvForm)}
              >
                <Plus size={14} /> Create Advance Tax Payment Voucher
              </button>
            </div>

            {showAdvForm && (
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Installment
                    </label>
                    <select
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm"
                      value={advInstallment}
                      onChange={(e) => setAdvInstallment(e.target.value)}
                    >
                      <option>1st</option>
                      <option>2nd</option>
                      <option>3rd</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Amount
                    </label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm"
                      type="number"
                      placeholder="Amount"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Date</label>
                    <input
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm"
                      type="date"
                      value={advDate}
                      onChange={(e) => setAdvDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">
                      Bank Account
                    </label>
                    <select
                      className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full shadow-sm"
                      value={advBank}
                      onChange={(e) => setAdvBank(e.target.value)}
                    >
                      <option value="">Select Bank Account</option>
                      {accounts
                        .filter((a: any) =>
                          String(a.name || "")
                            .toLowerCase()
                            .includes("bank"),
                        )
                        .map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-3 border-t border-gray-200">
                  <button
                    className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm"
                    onClick={createAdvanceVoucher}
                  >
                    Save Voucher
                  </button>
                </div>
              </div>
            )}

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Installment
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Due Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      % of Annual Tax
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Amount Due
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Paid
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Balance
                    </th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {advanceTax.installments.map((i: any) => (
                    <tr
                      key={i.no}
                      className="bg-white hover:bg-gray-50 text-[12px] transition-colors"
                    >
                      <td className="px-3 py-2.5 font-medium text-gray-800">{i.no}</td>
                      <td className="px-3 py-2.5 text-gray-600">{i.label}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {Math.round(i.pct * 100)}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-800">
                        Rs. {money(i.amountDue)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-green-600 font-medium">
                        Rs. {money(i.paid)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-amber-600">
                        Rs. {money(i.balance)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${
                            i.status === "Paid"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : i.status === "Due"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Salary Tax Worksheet" && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[14px] font-bold text-gray-800">Salary Tax Worksheet</h2>
            <button
              className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
              onClick={() => printCertificates(salaryRows)}
            >
              <Printer size={14} /> Generate All Certificates
            </button>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {[
                      "Employee",
                      "PAN",
                      "Annual Gross",
                      "SSA Deduct",
                      "PF Deduct",
                      "Taxable Income",
                      "Slab 1%",
                      "Slab 10%",
                      "Slab 20%",
                      "Slab 30%",
                      "Slab 36%",
                      "Total Tax",
                      "Rebate",
                      "Net Tax",
                      "Monthly TDS",
                      "Action",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-2 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${i >= 2 && i < 15 ? "text-right" : "text-left"} ${i === 15 ? "text-center" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {salaryRows.map(({ emp, worksheet }) => {
                    const slabTax = (rate: number) =>
                      worksheet.slabBreakdown.find((s: any) => s.rate === rate)?.tax || 0;
                    const open = expandedEmp === emp.id;

                    return (
                      <React.Fragment key={emp.id}>
                        <tr className="bg-white hover:bg-gray-50 text-[12px] transition-colors group">
                          <td className="px-2 py-2 whitespace-nowrap">
                            <button
                              className="font-medium text-[#1557b0] hover:underline flex items-center gap-1"
                              onClick={() => setExpandedEmp(open ? "" : emp.id)}
                            >
                              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{" "}
                              {emp.name}
                            </button>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-gray-600">
                            {emp.panNumber || ""}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-800">
                            Rs. {money(worksheet.grossIncome)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-500">
                            Rs. {money(worksheet.ssaDeduction)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-500">
                            Rs. {money(worksheet.pfDeduction)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap font-medium text-gray-800">
                            Rs. {money(worksheet.taxableIncome)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-600">
                            {money(slabTax(1))}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-600">
                            {money(slabTax(10))}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-600">
                            {money(slabTax(20))}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-600">
                            {money(slabTax(30))}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-600">
                            {money(slabTax(36))}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-gray-600">
                            {money(worksheet.beforeRebate)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap text-green-600">
                            {money(worksheet.rebate)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap font-bold text-gray-800">
                            {money(worksheet.totalTax)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap font-bold text-[#1557b0]">
                            {money(worksheet.monthlyTDS)}
                          </td>
                          <td className="px-2 py-2 text-center whitespace-nowrap">
                            <button
                              className="h-6 px-2 bg-[#1557b0]/10 text-[#1557b0] text-[10px] font-medium rounded hover:bg-[#1557b0]/20 transition-colors"
                              onClick={() => printCertificates([{ emp, worksheet }])}
                            >
                              Certificate
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-gray-50/80">
                            <td colSpan={16} className="p-4 border-b border-gray-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border border-gray-200 p-4 rounded-md shadow-sm">
                                <div>
                                  <h3 className="font-bold text-[13px] text-gray-800 mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <Calculator size={14} className="text-gray-500" /> Deductions
                                    Breakdown
                                  </h3>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[12px]">
                                      <span className="text-gray-500">Annual Basic:</span>{" "}
                                      <span className="font-medium text-gray-800">
                                        Rs. {money(worksheet.annualBasic)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[12px]">
                                      <span className="text-gray-500">Allowances:</span>{" "}
                                      <span className="font-medium text-gray-800">
                                        Rs. {money(worksheet.annualAllowances)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[12px]">
                                      <span className="text-gray-500">Provident Fund (PF):</span>{" "}
                                      <span className="font-medium text-gray-800">
                                        Rs. {money(worksheet.pfDeduction)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[12px]">
                                      <span className="text-gray-500">Social Security (SSA):</span>{" "}
                                      <span className="font-medium text-gray-800">
                                        Rs. {money(worksheet.ssaDeduction)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <h3 className="font-bold text-[13px] text-gray-800 mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <FileSpreadsheet size={14} className="text-gray-500" /> Slab
                                    Breakdown
                                  </h3>
                                  <div className="space-y-2">
                                    {worksheet.slabBreakdown.map((s: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex justify-between items-center text-[12px]"
                                      >
                                        <span className="text-gray-600">
                                          {s.label} @ {s.rate}%
                                        </span>
                                        <div className="flex gap-4">
                                          <span className="text-gray-500 w-24 text-right">
                                            Inc: {money(s.income)}
                                          </span>
                                          <span className="font-medium text-gray-800 w-24 text-right">
                                            Tax: {money(s.tax)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {salaryRows.length === 0 && (
                    <tr>
                      <td colSpan={16} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No employee salary data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "e-TDS Filing" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold text-gray-800">e-TDS Filing Export</h2>
              <div className="flex gap-2">
                <button
                  className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                  onClick={validateTDS}
                >
                  <CheckCircle size={14} /> Validate
                </button>
                <button
                  className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors flex items-center gap-1.5 shadow-sm"
                  onClick={exportETDS}
                >
                  <Download size={14} /> Export for IRD e-TDS Portal
                </button>
                <button
                  className="h-8 px-3 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
                  onClick={printForm29}
                >
                  <Printer size={14} /> Print Form 29
                </button>
              </div>
            </div>

            {tdsValidation.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <h3 className="font-bold text-red-700 text-[13px] mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Validation Issues
                </h3>
                <ul className="list-disc pl-5 text-[12px]">
                  {tdsValidation.map((e, idx) => (
                    <li
                      key={idx}
                      className={
                        e.level === "Critical" ? "text-red-600 font-medium" : "text-amber-600"
                      }
                    >
                      <span className="font-bold">{e.level}:</span> {e.msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {[
                      "Section",
                      "Party Name",
                      "Party PAN",
                      "Amount Paid",
                      "TDS Rate",
                      "TDS Amount",
                      "Quarter",
                      "Payment Date",
                    ].map((h, i) => (
                      <th
                        className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide ${[3, 4, 5].includes(i) ? "text-right" : "text-left"}`}
                        key={h}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tdsRows.map((r: any, idx: number) => (
                    <tr
                      key={idx}
                      className="bg-white hover:bg-gray-50 text-[12px] transition-colors"
                    >
                      <td className="px-3 py-2.5 text-gray-800 font-medium">{r.sectionLabel}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.partyName}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.partyPan}</td>
                      <td className="px-3 py-2.5 text-right text-gray-800">
                        Rs. {money(r.amountPaid)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{r.tdsRate}%</td>
                      <td className="px-3 py-2.5 text-right font-medium text-[#1557b0]">
                        Rs. {money(r.tdsAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{r.quarter}</td>
                      <td className="px-3 py-2.5 text-gray-600">{r.paymentDate}</td>
                    </tr>
                  ))}
                  {tdsRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No TDS deductions found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
            <h2 className="text-[14px] font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              Form 29 Annual Return Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold">
                  Company
                </div>
                <div className="text-[13px] text-gray-800">{companySettings?.name || "N/A"}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold">
                  PAN
                </div>
                <div className="text-[13px] text-gray-800">
                  {companySettings?.panNumber || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 tracking-wide font-semibold">
                  Fiscal Year
                </div>
                <div className="text-[13px] text-gray-800">{currentFiscalYear?.name || "N/A"}</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden max-w-2xl">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Section
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      Total TDS Deducted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(
                    tdsRows.reduce((m: any, r: any) => {
                      m[r.sectionLabel] = (m[r.sectionLabel] || 0) + Number(r.tdsAmount || 0);
                      return m;
                    }, {}),
                  ).map(([k, v]: any) => (
                    <tr key={k} className="bg-white hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-[12px] text-gray-800">{k}</td>
                      <td className="px-3 py-2.5 text-[12px] text-right font-bold text-[#1557b0]">
                        Rs. {money(v)}
                      </td>
                    </tr>
                  ))}
                  {Object.keys(
                    tdsRows.reduce((m: any, r: any) => {
                      m[r.sectionLabel] = (m[r.sectionLabel] || 0) + Number(r.tdsAmount || 0);
                      return m;
                    }, {}),
                  ).length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No data available for Form 29 summary.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "TDS Property Register" && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[14px] font-bold text-gray-800">TDS Property Register</h2>
              <button
                className="h-8 px-3 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors flex items-center gap-1.5 shadow-sm"
                onClick={() => setPropModal(true)}
              >
                <Plus size={14} /> Add Property
              </button>
            </div>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full min-w-max border-collapse">
                <thead>
                  <tr className="bg-[#f5f6fa] border-b border-gray-200">
                    {[
                      "Address",
                      "Owner",
                      "PAN",
                      "Monthly Rent",
                      "TDS %",
                      "Monthly TDS",
                      "Annual TDS",
                      "Agreement Period",
                      "Action",
                    ].map((h, i) => (
                      <th
                        className={`px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide ${[3, 4, 5, 6].includes(i) ? "text-right" : "text-left"}`}
                        key={h}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {properties.map((p: any) => {
                    const monthlyTDS = Number(p.monthlyRent || 0) * (Number(p.tdsRate || 10) / 100);
                    return (
                      <tr
                        key={p.id}
                        className="bg-white hover:bg-gray-50 text-[12px] transition-colors"
                      >
                        <td className="px-3 py-2.5 text-gray-800 font-medium">
                          {p.propertyAddress}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{p.ownerName}</td>
                        <td className="px-3 py-2.5 text-gray-600">{p.ownerPan}</td>
                        <td className="px-3 py-2.5 text-right text-gray-800">
                          Rs. {money(p.monthlyRent)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{p.tdsRate}%</td>
                        <td className="px-3 py-2.5 text-right font-medium text-amber-600">
                          Rs. {money(monthlyTDS)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                          Rs. {money(monthlyTDS * 12)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {p.startDate} to {p.endDate || "Open"}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            className="text-red-500 hover:text-red-700 transition-colors"
                            onClick={async () => {
                              if (window.confirm("Delete this property?")) {
                                await getDB()
                                  .table("tdsPropertyRegister")
                                  .delete(p.id)
                                  .catch(() => {});
                                setProperties((rows) => rows.filter((x: any) => x.id !== p.id));
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {properties.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[12px] text-gray-500">
                        No rented properties configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
              <h2 className="text-[14px] font-bold text-gray-800 mb-4">
                Generate TDS Journal for Month
              </h2>
              <div className="flex gap-2 mb-4">
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] max-w-[180px] shadow-sm"
                  type="month"
                  value={journalMonth}
                  onChange={(e) => setJournalMonth(e.target.value)}
                />
                <button
                  className="h-8 px-4 bg-white text-gray-700 border border-gray-300 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                  onClick={buildPropertyJournals}
                >
                  Preview Journals
                </button>
                {journalPreview.length > 0 && (
                  <button
                    className="h-8 px-4 bg-[#059669] text-white text-[12px] font-medium rounded-md hover:bg-[#047857] transition-colors shadow-sm"
                    onClick={postPropertyJournals}
                  >
                    Confirm & Post All
                  </button>
                )}
              </div>

              {journalPreview.length > 0 && (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#f5f6fa] border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Property
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Rent
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          TDS
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          Net Pay
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {journalPreview.map((j: any, idx: number) => (
                        <tr key={idx} className="bg-white text-[12px]">
                          <td className="px-3 py-2">{j.property.propertyAddress}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            Rs. {money(j.rent)}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-600 font-medium">
                            Rs. {money(j.tds)}
                          </td>
                          <td className="px-3 py-2 text-right text-[#1557b0] font-medium">
                            Rs. {money(j.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
              <h2 className="text-[14px] font-bold text-gray-800 mb-4">Annual TDS Summary</h2>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f5f6fa] border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Property
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Annual TDS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {properties.map((p: any) => {
                      const annual =
                        Number(p.monthlyRent || 0) * (Number(p.tdsRate || 10) / 100) * 12;
                      return (
                        <tr key={p.id} className="bg-white text-[12px]">
                          <td className="px-3 py-2">{p.propertyAddress}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-800">
                            Rs. {money(annual)}
                          </td>
                        </tr>
                      );
                    })}
                    {properties.length > 0 ? (
                      <tr className="bg-[#f5f6fa] border-t-2 border-gray-300">
                        <td className="px-3 py-2 font-bold text-[12px] text-gray-800">
                          Grand Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[12px] text-[#1557b0]">
                          NPR{" "}
                          {money(
                            properties.reduce(
                              (s: number, p: any) =>
                                s +
                                Number(p.monthlyRent || 0) * (Number(p.tdsRate || 10) / 100) * 12,
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-3 py-6 text-center text-[12px] text-gray-500">
                          No data to summarize
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {propModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 shadow-lg rounded-md p-5 w-full max-w-xl">
            <h2 className="text-[15px] font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
              Add Rented Property
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  placeholder="Property Address"
                  value={propForm.propertyAddress}
                  onChange={(e) => setPropForm({ ...propForm, propertyAddress: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Owner Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  placeholder="Owner Name"
                  value={propForm.ownerName}
                  onChange={(e) => setPropForm({ ...propForm, ownerName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Owner PAN <span className="text-red-500">*</span>
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  placeholder="Owner PAN"
                  value={propForm.ownerPan}
                  onChange={(e) => setPropForm({ ...propForm, ownerPan: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Monthly Rent (NPR)
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  type="number"
                  placeholder="Monthly Rent NPR"
                  value={propForm.monthlyRent}
                  onChange={(e) => setPropForm({ ...propForm, monthlyRent: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  TDS Rate %
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  type="number"
                  placeholder="TDS Rate %"
                  value={propForm.tdsRate}
                  onChange={(e) => setPropForm({ ...propForm, tdsRate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Start Date
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  type="date"
                  value={propForm.startDate}
                  onChange={(e) => setPropForm({ ...propForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  End Date (Optional)
                </label>
                <input
                  className="h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] w-full"
                  type="date"
                  value={propForm.endDate}
                  onChange={(e) => setPropForm({ ...propForm, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-gray-200">
              <button
                className="h-8 px-4 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
                onClick={() => setPropModal(false)}
              >
                Cancel
              </button>
              <button
                className="h-8 px-4 bg-[#1557b0] text-white text-[12px] font-medium rounded-md hover:bg-[#0f4a96] transition-colors shadow-sm"
                onClick={saveProperty}
              >
                Save Property
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
