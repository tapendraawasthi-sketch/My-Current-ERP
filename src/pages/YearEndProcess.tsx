// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "../store/useStore";
import { getDB, generateId } from "../lib/db";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  ChevronRight,
  RefreshCw,
  Shield,
  FileText,
  CalendarDays,
  Settings,
  ArrowRight,
} from "lucide-react";

function money(v: number): string {
  const abs = Math.abs(Number(v || 0));
  const s = abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `(${s})` : s;
}

const cardClass = "bg-white border border-gray-200 rounded-md shadow-sm p-4";
const tableHeadClass =
  "bg-[#f5f6fa] border-b border-gray-200 px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide";
const tableCellClass = "px-3 py-2.5 text-[12px] text-gray-700 border-b border-gray-100";

const primaryBtn =
  "h-8 px-3 bg-[#1557b0] hover:bg-[#0f4a96] text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
const outlineBtn =
  "h-8 px-3 bg-white border border-gray-300 text-gray-700 text-[12px] font-medium rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 shadow-sm";
const inputClass =
  "h-8 px-2.5 text-[12px] border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1557b0]/20 focus:border-[#1557b0] transition-shadow";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function getLineAccount(line: any, accounts: any[]) {
  return (
    accounts.find((a) => a.id === line.accountId) ||
    accounts.find((a) => a.name === line.accountName) ||
    {}
  );
}

function calculateTrialBalance(vouchers: any[]) {
  let dr = 0;
  let cr = 0;

  (vouchers || [])
    .filter((v) => v.status === "posted")
    .forEach((v) => {
      (v.lines || []).forEach((l) => {
        dr += Number(l.debit || 0);
        cr += Number(l.credit || 0);
      });
    });

  return { dr, cr, diff: dr - cr };
}

function nextFYName(currentName: string) {
  const match = String(currentName || "").match(/(\d{4})/);
  if (!match) return "2082-83";
  const y = Number(match[1]);
  return `${y + 1}-${String(y + 2).slice(-2)}`;
}

function approximateNextFYDates(currentFY: any) {
  const name = nextFYName(currentFY?.name || currentFY?.fiscalYearBS || "2081-82");
  const startYear = Number(String(name).match(/\d{4}/)?.[0] || "2082");
  return {
    name,
    startBS: `${startYear}-04-01`,
    endBS: `${startYear + 1}-03-32`,
    startAD: `${new Date().getFullYear()}-07-16`,
    endAD: `${new Date().getFullYear() + 1}-07-15`,
  };
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white border border-gray-200 shadow-xl rounded-lg w-full flex flex-col max-w-xl">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function YearEndProcess() {
  const {
    accounts = [],
    vouchers = [],
    invoices = [],
    items = [],
    stockMovements = [],
    companySettings = {},
    currentFiscalYear = {},
    fiscalYears = [],
    employees = [],
    currentUser = {},
    addVoucher,
    updateFiscalYear,
  } = useStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [checks, setChecks] = useState([]);
  const [manualOverride, setManualOverride] = useState(false);

  const [adjustmentStatus, setAdjustmentStatus] = useState({});
  const [allEntriesPosted, setAllEntriesPosted] = useState(false);
  const [manualJournalModal, setManualJournalModal] = useState(false);
  const [manualJournalType, setManualJournalType] = useState("");
  const [manualJournalForm, setManualJournalForm] = useState({
    debitAccountId: "",
    creditAccountId: "",
    amount: "",
    narration: "",
  });

  const [closingPosted, setClosingPosted] = useState(false);

  const [lockModal, setLockModal] = useState(false);
  const [lockConfirmName, setLockConfirmName] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [requiredPin, setRequiredPin] = useState("");

  const initialNextFY = approximateNextFYDates(currentFiscalYear);
  const [newFYForm, setNewFYForm] = useState({
    name: initialNextFY.name,
    startBS: initialNextFY.startBS,
    endBS: initialNextFY.endBS,
    startAD: initialNextFY.startAD,
    endAD: initialNextFY.endAD,
  });

  const isAllowed = currentUser?.role === "admin" || currentUser?.role === "manager";

  useEffect(() => {
    const db = getDB();
    db.table("securitySettings")
      .get("global")
      .catch(() => null)
      .then((s) => setRequiredPin(s?.adminPin || s?.periodLockPin || ""));
  }, []);

  const runChecks = useCallback(() => {
    const tb = calculateTrialBalance(vouchers);

    const draftCount = (vouchers || []).filter(
      (v) => v.status === "draft" || v.status === "submitted",
    ).length;

    const negativeStockItems = (items || []).filter((item) => {
      const stock = (stockMovements || [])
        .filter((m) => m.itemId === item.id)
        .reduce(
          (a, m) => {
            const qty = Number(m.quantity || m.qty || 0);
            const type = String(m.type || "").toLowerCase();
            return type === "in" || type === "purchase" || type.includes("in") ? a + qty : a - qty;
          },
          Number(item.currentStock || 0),
        );

      return stock < 0;
    });

    const checkResults = [
      {
        id: "tb-balance",
        label: "Trial Balance is balanced (Total Dr = Total Cr)",
        pass: Math.abs(tb.dr - tb.cr) < 1,
        note: `Dr Rs. ${money(tb.dr)} | Cr Rs. ${money(tb.cr)} | Diff Rs. ${money(tb.diff)}`,
        automated: true,
      },
      {
        id: "no-drafts",
        label: "All vouchers posted (no drafts pending)",
        pass: draftCount === 0,
        note: `${draftCount} pending vouchers found`,
        automated: true,
      },
      {
        id: "no-negative-stock",
        label: "No negative stock items",
        pass: negativeStockItems.length === 0,
        note: `${negativeStockItems.length} negative stock items found`,
        automated: true,
      },
      {
        id: "vat-filed",
        label: "VAT returns reviewed for all periods",
        pass: true,
        note: "Manual verification required — check IRD portal",
        automated: false,
      },
      {
        id: "tds-filed",
        label: "TDS remitted to IRD",
        pass: true,
        note: "Manual verification required",
        automated: false,
      },
      {
        id: "payroll-done",
        label: "All salary payments processed",
        pass: true,
        note: "Manual verification required",
        automated: false,
      },
      {
        id: "bank-recon",
        label: "Bank reconciliation completed",
        pass: true,
        note: "Manual verification required",
        automated: false,
      },
      {
        id: "assets-depr",
        label: "Fixed asset depreciation posted",
        pass: true,
        note: "Manual verification required",
        automated: false,
      },
    ];

    setChecks(checkResults);
  }, [vouchers, items, stockMovements]);

  useEffect(() => {
    if (currentStep === 1) runChecks();
  }, [currentStep, runChecks]);

  const passedCount = checks.filter((c) => c.pass).length;
  const totalCount = checks.length;
  const failedAutomated = checks.some((c) => c.automated && !c.pass);

  const adjustments = [
    {
      type: "depreciation",
      label: "Fixed Asset Depreciation",
      description: "Depreciation for all fixed assets this fiscal year",
      source: "Computed from Fixed Assets",
      status: "manual",
    },
    {
      type: "closing-stock",
      label: "Closing Stock Valuation",
      description: "Adjust for physical stock count value",
      source: "Manual entry required",
      status: "manual",
    },
    {
      type: "gratuity",
      label: "Gratuity Provision (Labour Act 2074)",
      description:
        "Provision for gratuity: 1 month salary per year of service for employees with more than 1 year tenure",
      source: "Computed from payroll",
      status: "auto",
    },
    {
      type: "tax-provision",
      label: "Income Tax Provision",
      description: "Provision for estimated income tax",
      source: "Manual entry required",
      status: "manual",
    },
    {
      type: "prepaid",
      label: "Prepaid Expenses Adjustment",
      description: "Adjust insurance, rent paid in advance",
      source: "Manual entry required",
      status: "manual",
    },
    {
      type: "accrued",
      label: "Accrued Expenses",
      description: "Expenses incurred but not yet invoiced",
      source: "Manual entry required",
      status: "manual",
    },
  ];

  const gratuityAmount = useMemo(() => {
    return (employees || [])
      .filter((e) => e.isActive !== false)
      .reduce((s, e) => {
        const basic = Number(e.basicSalary || e.salaryDetails?.basicSalary || 0);
        return s + basic;
      }, 0);
  }, [employees]);

  const plSummary = useMemo(() => {
    // Compute from posted vouchers within the fiscal year — do NOT rely on cached balance field.
    const fyStart = currentFiscalYear?.startDate;
    const fyEnd = currentFiscalYear?.endDate;

    const balances: Record<string, number> = {};
    for (const v of (vouchers || [])) {
      if (v.status !== "posted") continue;
      if (fyStart && v.date < fyStart) continue;
      if (fyEnd && v.date > fyEnd) continue;
      for (const line of v.lines || []) {
        balances[line.accountId] =
          (balances[line.accountId] || 0) + (line.credit || 0) - (line.debit || 0);
      }
    }

    const totalIncome = (accounts || [])
      .filter((a) => !a.isGroup && (a.type === "income" || a.type === "revenue"))
      .reduce((s, a) => s + Math.max(0, balances[a.id] || 0), 0);

    const totalExpenses = (accounts || [])
      .filter((a) => !a.isGroup && a.type === "expense")
      .reduce((s, a) => s + Math.max(0, -(balances[a.id] || 0)), 0);

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
    };
  }, [accounts, vouchers, currentFiscalYear]);

  const closingPreview = useMemo(() => {
    const fyStart = currentFiscalYear?.startDate;
    const fyEnd = currentFiscalYear?.endDate;
    const creditBals: Record<string, number> = {};
    for (const v of (vouchers || [])) {
      if (v.status !== "posted") continue;
      if (fyStart && v.date < fyStart) continue;
      if (fyEnd && v.date > fyEnd) continue;
      for (const line of v.lines || []) {
        creditBals[line.accountId] =
          (creditBals[line.accountId] || 0) + (line.credit || 0) - (line.debit || 0);
      }
    }

    const incomeLines = (accounts || [])
      .filter((a) => !a.isGroup && (a.type === "income" || a.type === "revenue"))
      .map((a) => ({ account: a, bal: creditBals[a.id] || 0 }))
      .filter((r) => r.bal !== 0)
      .map((r) => ({
        account: r.account,
        debit: Math.max(0, r.bal),
        credit: Math.max(0, -r.bal),
      }));

    const expenseLines = (accounts || [])
      .filter((a) => !a.isGroup && a.type === "expense")
      .map((a) => ({ account: a, bal: creditBals[a.id] || 0 }))
      .filter((r) => r.bal !== 0)
      .map((r) => ({
        account: r.account,
        debit: Math.max(0, -r.bal),
        credit: Math.max(0, r.bal),
      }));

    return { incomeLines, expenseLines };
  }, [accounts, vouchers, currentFiscalYear]);

  const balanceSheetRollover = useMemo(() => {
    // Derive closing balance from posted vouchers up to fiscal year end.
    // Do NOT trust account.balance which can be stale.
    const fyEnd = currentFiscalYear?.endDate;

    const balances: Record<string, number> = {};
    for (const v of (vouchers || [])) {
      if (v.status !== "posted") continue;
      if (fyEnd && v.date > fyEnd) continue;
      for (const line of v.lines || []) {
        balances[line.accountId] =
          (balances[line.accountId] || 0) + (line.debit || 0) - (line.credit || 0);
      }
    }

    return (accounts || [])
      .filter((a) => ["asset", "liability", "equity"].includes(a.type) && !a.isGroup)
      .map((a) => {
        const obDr = Number(a.openingBalanceDr || 0);
        const obCr = Number(a.openingBalanceCr || 0);
        const voucherNet = balances[a.id] || 0;
        const closingBalance = obDr - obCr + voucherNet;
        return {
          ...a,
          closingBalance,
          openingDr: closingBalance > 0 ? closingBalance : 0,
          openingCr: closingBalance < 0 ? Math.abs(closingBalance) : 0,
        };
      })
      .filter((a) => Math.abs(a.closingBalance) > 0.01);
  }, [accounts, vouchers, currentFiscalYear]);

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800 flex items-center justify-center">
        <div className={`${cardClass} max-w-md text-center py-8`}>
          <Shield size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-[16px] font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-[12px] text-gray-600">
            Year-end processing is restricted to admin and manager roles.
          </p>
        </div>
      </div>
    );
  }

  function goStep(step: number) {
    setCurrentStep(step);
  }

  async function postManualAdjustment() {
    const amount = Number(manualJournalForm.amount || 0);
    if (!manualJournalForm.debitAccountId) return toast.error("Select debit account");
    if (!manualJournalForm.creditAccountId) return toast.error("Select credit account");
    if (amount <= 0) return toast.error("Enter valid amount");

    const drAcc = accounts.find((a) => a.id === manualJournalForm.debitAccountId);
    const crAcc = accounts.find((a) => a.id === manualJournalForm.creditAccountId);

    const voucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date: currentFiscalYear?.endDate || todayISO(),
      narration: manualJournalForm.narration || `Year-end adjustment - ${manualJournalType}`,
      amount,
      grandTotal: amount,
      lines: [
        {
          id: generateId(),
          accountId: drAcc?.id,
          accountName: drAcc?.name,
          debit: amount,
          credit: 0,
        },
        {
          id: generateId(),
          accountId: crAcc?.id,
          accountName: crAcc?.name,
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

    setAdjustmentStatus((s) => ({ ...s, [manualJournalType]: "Posted" }));
    setManualJournalModal(false);
    setManualJournalForm({
      debitAccountId: "",
      creditAccountId: "",
      amount: "",
      narration: "",
    });
    toast.success("Adjustment journal posted");
  }

  async function postGratuityJournal() {
    if (gratuityAmount <= 0) return toast.error("No gratuity amount computed");

    const expAcc =
      accounts.find((a) =>
        String(a.name || "")
          .toLowerCase()
          .includes("gratuity expense"),
      ) || accounts.find((a) => a.type === "expense");
    const payAcc =
      accounts.find((a) =>
        String(a.name || "")
          .toLowerCase()
          .includes("gratuity payable"),
      ) || accounts.find((a) => a.type === "liability");

    if (!expAcc || !payAcc) return toast.error("Gratuity Expense or Payable account not found");

    const voucher = {
      id: generateId(),
      type: "journal",
      status: "posted",
      date: currentFiscalYear?.endDate || todayISO(),
      narration: "Gratuity Provision for FY " + (currentFiscalYear?.name || ""),
      amount: gratuityAmount,
      grandTotal: gratuityAmount,
      lines: [
        {
          id: generateId(),
          accountId: expAcc.id,
          accountName: expAcc.name,
          debit: gratuityAmount,
          credit: 0,
        },
        {
          id: generateId(),
          accountId: payAcc.id,
          accountName: payAcc.name,
          debit: 0,
          credit: gratuityAmount,
        },
      ],
    };

    if (addVoucher) await addVoucher(voucher);
    else
      await getDB()
        .table("vouchers")
        .put(voucher)
        .catch(() => {});

    setAdjustmentStatus((s) => ({ ...s, gratuity: "Posted" }));
    toast.success("Gratuity provision posted");
  }

  function skipAdjustment(type: string) {
    setAdjustmentStatus((s) => ({ ...s, [type]: "Skipped" }));
  }

  async function postClosingEntries() {
    const retained =
      accounts.find((a) =>
        String(a.name || "")
          .toLowerCase()
          .includes("retained"),
      ) || accounts.find((a) => a.type === "equity");

    if (!retained) return toast.error("Retained Earnings account not found");

    const closingLines = [];

    closingPreview.incomeLines.forEach((x) => {
      closingLines.push({
        id: generateId(),
        accountId: x.account.id,
        accountName: x.account.name,
        debit: Math.abs(Number(x.account.balance || 0)),
        credit: 0,
      });
    });

    closingPreview.expenseLines.forEach((x) => {
      closingLines.push({
        id: generateId(),
        accountId: x.account.id,
        accountName: x.account.name,
        debit: 0,
        credit: Math.abs(Number(x.account.balance || 0)),
      });
    });

    if (plSummary.netProfit >= 0) {
      closingLines.push({
        id: generateId(),
        accountId: retained.id,
        accountName: retained.name,
        debit: 0,
        credit: plSummary.netProfit,
      });
    } else {
      closingLines.push({
        id: generateId(),
        accountId: retained.id,
        accountName: retained.name,
        debit: Math.abs(plSummary.netProfit),
        credit: 0,
      });
    }

    const voucher = {
      id: generateId(),
      type: "closing-entry",
      status: "posted",
      date: currentFiscalYear?.endDate || todayISO(),
      narration: "Year-end closing entry for " + (currentFiscalYear?.name || ""),
      lines: closingLines,
      amount: Math.abs(plSummary.netProfit),
      grandTotal: Math.abs(plSummary.netProfit),
    };

    if (addVoucher) await addVoucher(voucher);
    else
      await getDB()
        .table("vouchers")
        .put(voucher)
        .catch(() => {});

    setClosingPosted(true);
    toast.success("P&L closing entries posted");
  }

  async function confirmLockFY() {
    if (lockConfirmName !== currentFiscalYear?.name) {
      return toast.error("Fiscal year name does not match");
    }

    if (currentUser?.role === "admin" && requiredPin && adminPin !== requiredPin) {
      return toast.error("Invalid admin PIN");
    }

    const db = getDB();
    await db
      .table("fiscalYears")
      .update(currentFiscalYear.id, {
        isClosed: true,
        closedAt: new Date().toISOString(),
        closedBy: currentUser?.id,
        closedByName: currentUser?.name,
      })
      .catch(() => {});

    if (updateFiscalYear) {
      await updateFiscalYear(currentFiscalYear.id, {
        isClosed: true,
        closedAt: new Date().toISOString(),
        closedBy: currentUser?.id,
      }).catch(() => {});
    }

    toast.success("Fiscal year locked successfully.");
    setLockModal(false);
    setCurrentStep(5);
  }

  async function createNewFiscalYear() {
    if (!newFYForm.name || !newFYForm.startAD || !newFYForm.endAD) {
      return toast.error("Complete new fiscal year details");
    }

    const db = getDB();
    const newFYId = generateId();

    const newFY = {
      id: newFYId,
      name: newFYForm.name,
      fiscalYearBS: newFYForm.name,
      startDate: newFYForm.startAD,
      endDate: newFYForm.endAD,
      startDateBS: newFYForm.startBS,
      endDateBS: newFYForm.endBS,
      isCurrent: true,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };

    await db
      .table("fiscalYears")
      .add(newFY)
      .catch(() => {});
    await db
      .table("fiscalYears")
      .update(currentFiscalYear.id, { isCurrent: false })
      .catch(() => {});

    for (const acc of balanceSheetRollover) {
      const nextAccount = {
        ...acc,
        id: generateId(),
        fiscalYearId: newFYId,
        openingBalanceDr: acc.openingDr,
        openingBalanceCr: acc.openingCr,
        balance: acc.closingBalance,
        createdAt: new Date().toISOString(),
      };
      await db
        .table("accounts")
        .put(nextAccount)
        .catch(() => {});
    }

    toast.success(`New fiscal year ${newFYForm.name} is now active. Opening balances transferred.`);
  }

  const steps = [
    { n: 1, label: "Verify" },
    { n: 2, label: "Adjustments" },
    { n: 3, label: "Close P&L" },
    { n: 4, label: "Lock Year" },
    { n: 5, label: "Open New Year" },
  ];

  const fyVoucherCount = (vouchers || []).filter(
    (v) =>
      v.date >= (currentFiscalYear?.startDate || "1900-01-01") &&
      v.date <= (currentFiscalYear?.endDate || "2999-12-31"),
  ).length;

  return (
    <div className="min-h-screen bg-[#f5f6fa] p-4 text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800 flex items-center gap-2">
            <Shield size={18} className="text-[#1557b0]" /> Year-End Process
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Guided fiscal year closing, P&L transfer, locking and new year opening for{" "}
            {currentFiscalYear?.name || "current year"}.
          </p>
        </div>
      </div>

      <div className="flex items-center mb-8 overflow-x-auto py-2">
        {steps.map((s, idx) => {
          const completed = currentStep > s.n;
          const current = currentStep === s.n;
          return (
            <React.Fragment key={s.n}>
              <div
                className="flex flex-col items-center flex-shrink-0 cursor-pointer"
                onClick={() => setCurrentStep(s.n)}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold mb-1.5 transition-colors ${
                    completed
                      ? "bg-green-500 text-white shadow-sm"
                      : current
                        ? "bg-[#1557b0] text-white shadow-md ring-4 ring-blue-100"
                        : "bg-white border-2 border-gray-200 text-gray-400"
                  }`}
                >
                  {completed ? <CheckCircle size={16} /> : s.n}
                </div>
                <div
                  className={`text-[11px] font-medium ${current ? "text-[#1557b0]" : completed ? "text-green-700" : "text-gray-400"}`}
                >
                  {s.label}
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-12 md:w-20 lg:w-32 h-[2px] mx-2 -mt-4 transition-colors ${completed ? "bg-green-500" : "bg-gray-200"}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {currentStep === 1 && (
        <div className={`${cardClass} max-w-4xl mx-auto`}>
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
            <h2 className="text-[14px] font-semibold text-gray-800">Pre-Closing Verification</h2>
            <button className={outlineBtn} onClick={runChecks}>
              <RefreshCw size={14} /> Re-run Checks
            </button>
          </div>

          <p className="text-[11px] text-gray-500 mb-6">
            Verify that your books are balanced and ready to close. Automated checks analyze your
            data, while manual checks require your confirmation.
          </p>

          <div className="space-y-2 mb-6">
            {checks.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-3 p-3 rounded-md border ${
                  c.pass ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                }`}
              >
                <div className="mt-0.5">
                  {c.pass ? (
                    <CheckCircle size={16} className="text-green-600" />
                  ) : (
                    <XCircle size={16} className="text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-[12px] font-medium ${c.pass ? "text-green-800" : "text-red-800"}`}
                  >
                    {c.label}
                    {!c.automated && (
                      <span className="ml-2 text-[9px] uppercase tracking-wide bg-white/50 px-1.5 py-0.5 rounded border border-current opacity-70">
                        Manual
                      </span>
                    )}
                  </div>
                  {c.note && (
                    <div
                      className={`text-[11px] mt-0.5 ${c.pass ? "text-green-600" : "text-red-600 font-semibold"}`}
                    >
                      {c.note}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-md">
            <div>
              <div className="text-[14px] font-bold text-gray-800">
                {passedCount} of {totalCount} checks passed
              </div>
              {failedAutomated && (
                <div className="mt-1 text-[11px] text-red-600 flex items-center gap-1.5 font-medium">
                  <AlertTriangle size={14} /> Some automated checks failed. Admin can override to
                  proceed.
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {currentUser?.role === "admin" && failedAutomated && (
                <label className="text-[11px] flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                    checked={manualOverride}
                    onChange={(e) => setManualOverride(e.target.checked)}
                  />
                  Admin Override
                </label>
              )}
              <button
                className={primaryBtn}
                disabled={failedAutomated && !(currentUser?.role === "admin" && manualOverride)}
                onClick={() => setCurrentStep(2)}
              >
                Proceed to Adjustments <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className={`${cardClass} max-w-5xl mx-auto`}>
          <div className="border-b border-gray-100 pb-3 mb-4">
            <h2 className="text-[14px] font-semibold text-gray-800">Year-End Adjustments</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Post required year-end adjustment entries for provisions, depreciation, and closing
              values.
            </p>
          </div>

          <div className="mb-6 p-4 rounded-md border border-indigo-200 bg-indigo-50 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-indigo-900 flex items-center gap-2">
                <FileText size={16} /> Computed Gratuity Provision
              </div>
              <div className="text-[11px] text-indigo-700 mt-1">
                Automatically computed based on basic salary of active employees.
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-[18px] font-bold text-indigo-900">
                Rs. {money(gratuityAmount)}
              </div>
              <button
                className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-medium rounded-md transition-colors shadow-sm whitespace-nowrap"
                onClick={postGratuityJournal}
              >
                Post Journal
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200 mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Adjustment Type", "Description", "Source", "Status", "Actions"].map((h) => (
                    <th key={h} className={tableHeadClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustments.map((a) => (
                  <tr key={a.type} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>{a.label}</td>
                    <td className={tableCellClass}>{a.description}</td>
                    <td className={tableCellClass}>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border border-gray-200">
                        {a.source}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      {adjustmentStatus[a.type] === "Posted" ? (
                        <span className="text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircle size={12} /> Posted
                        </span>
                      ) : adjustmentStatus[a.type] === "Skipped" ? (
                        <span className="text-gray-500 italic">Skipped</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Pending</span>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex items-center gap-3">
                        {a.type !== "gratuity" && (
                          <button
                            className="text-[11px] font-medium text-[#1557b0] hover:underline"
                            onClick={() => {
                              setManualJournalType(a.type);
                              setManualJournalForm({
                                debitAccountId: "",
                                creditAccountId: "",
                                amount: "",
                                narration: a.label,
                              });
                              setManualJournalModal(true);
                            }}
                          >
                            Post Entry
                          </button>
                        )}
                        <button
                          className="text-[11px] text-gray-400 hover:text-gray-700 underline"
                          onClick={() => skipAdjustment(a.type)}
                        >
                          Skip
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-md">
            <label className="flex items-center gap-2 text-[12px] font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-[#1557b0] focus:ring-[#1557b0]"
                checked={allEntriesPosted}
                onChange={(e) => setAllEntriesPosted(e.target.checked)}
              />
              I confirm all necessary year-end adjustment entries have been posted.
            </label>
            <div className="flex gap-2">
              <button className={outlineBtn} onClick={() => setCurrentStep(1)}>
                Back
              </button>
              <button
                className={primaryBtn}
                disabled={!allEntriesPosted}
                onClick={() => setCurrentStep(3)}
              >
                Proceed to Close P&L <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className={`${cardClass} max-w-4xl mx-auto`}>
          <div className="border-b border-gray-100 pb-3 mb-6">
            <h2 className="text-[14px] font-semibold text-gray-800">Close Profit & Loss</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Transfer all income and expense balances to Retained Earnings to clear them for the
              next fiscal year.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm flex flex-col items-center justify-center text-center">
              <div className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-1">
                Total Income
              </div>
              <div className="text-[18px] font-bold text-gray-900">
                Rs. {money(plSummary.totalIncome)}
              </div>
            </div>
            <div className="border border-gray-200 rounded-md p-4 bg-white shadow-sm flex flex-col items-center justify-center text-center">
              <div className="text-[11px] text-gray-500 uppercase tracking-wide font-medium mb-1">
                Total Expenses
              </div>
              <div className="text-[18px] font-bold text-gray-900">
                Rs. {money(plSummary.totalExpenses)}
              </div>
            </div>
            <div
              className={`border rounded-md p-4 shadow-sm flex flex-col items-center justify-center text-center ${plSummary.netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
            >
              <div
                className={`text-[11px] uppercase tracking-wide font-bold mb-1 ${plSummary.netProfit >= 0 ? "text-green-800" : "text-red-800"}`}
              >
                Net Profit / (Loss)
              </div>
              <div
                className={`text-[20px] font-bold ${plSummary.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}
              >
                Rs. {money(plSummary.netProfit)}
              </div>
            </div>
          </div>

          <h3 className="text-[13px] font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
            Closing Entries Journal Preview
            <span className="text-[11px] font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {closingPreview.incomeLines.length + closingPreview.expenseLines.length + 1} lines
            </span>
          </h3>

          <div className="overflow-x-auto rounded-md border border-gray-200 mb-6 max-h-80">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#f5f6fa]">
                <tr>
                  {["Account", "Debit", "Credit"].map((h) => (
                    <th
                      key={h}
                      className={h === "Account" ? tableHeadClass : `${tableHeadClass} text-right`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {closingPreview.incomeLines.map((x) => (
                  <tr key={x.account.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} text-gray-600`}>
                      <span className="text-gray-400 mr-1 text-[10px]">Dr</span> {x.account.name}
                    </td>
                    <td className={`${tableCellClass} text-right font-medium`}>
                      {money(Math.abs(x.account.balance || 0))}
                    </td>
                    <td className={`${tableCellClass} text-right text-gray-400`}>0.00</td>
                  </tr>
                ))}

                {closingPreview.expenseLines.map((x) => (
                  <tr key={x.account.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} text-gray-600 pl-6`}>
                      <span className="text-gray-400 mr-1 text-[10px]">Cr</span> {x.account.name}
                    </td>
                    <td className={`${tableCellClass} text-right text-gray-400`}>0.00</td>
                    <td className={`${tableCellClass} text-right font-medium`}>
                      {money(Math.abs(x.account.balance || 0))}
                    </td>
                  </tr>
                ))}

                <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                  <td className={`${tableCellClass} font-bold text-indigo-900 pl-6`}>
                    <span className="text-indigo-400 mr-1 text-[10px]">
                      {plSummary.netProfit >= 0 ? "Cr" : "Dr"}
                    </span>{" "}
                    Retained Earnings
                  </td>
                  <td className={`${tableCellClass} text-right font-bold text-indigo-900`}>
                    {plSummary.netProfit < 0 ? money(Math.abs(plSummary.netProfit)) : "0.00"}
                  </td>
                  <td className={`${tableCellClass} text-right font-bold text-indigo-900`}>
                    {plSummary.netProfit >= 0 ? money(plSummary.netProfit) : "0.00"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {closingPosted && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-800 rounded-md text-[12px] font-medium mb-6">
              <CheckCircle size={16} /> P&L closed. Income and expense accounts now show zero
              balance.
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-md">
            <button className={outlineBtn} onClick={() => setCurrentStep(2)}>
              Back
            </button>
            <div className="flex gap-2">
              <button className={outlineBtn} onClick={postClosingEntries} disabled={closingPosted}>
                <CheckCircle size={14} className={closingPosted ? "text-green-500" : ""} />
                {closingPosted ? "Entries Posted" : "Post Closing Entries"}
              </button>
              <button
                className={primaryBtn}
                disabled={!closingPosted}
                onClick={() => setCurrentStep(4)}
              >
                Proceed to Lock Year <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className={`${cardClass} max-w-3xl mx-auto`}>
          <div className="border-b border-gray-100 pb-3 mb-6">
            <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
              <Lock size={16} /> Lock the Fiscal Year
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Secure the current fiscal year to prevent any further modifications.
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 text-red-800 rounded-md text-[12px] mb-6">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <b className="block mb-1">Critical Warning</b>
              Once locked, no vouchers can be entered, edited, or deleted for this fiscal year. This
              action is irreversible without the Master Admin PIN.
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <h3 className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-3 border-b border-gray-200 pb-2">
              Fiscal Year Summary
            </h3>
            <div className="grid grid-cols-2 gap-y-3 text-[12px]">
              <div className="text-gray-500">Name</div>
              <div className="font-medium text-gray-900">{currentFiscalYear?.name}</div>

              <div className="text-gray-500">Period</div>
              <div className="font-medium text-gray-900">
                {currentFiscalYear?.startDate} to {currentFiscalYear?.endDate}
              </div>

              <div className="text-gray-500">Total Vouchers</div>
              <div className="font-medium text-gray-900">{fyVoucherCount}</div>

              <div className="text-gray-500">Net Profit</div>
              <div className="font-bold text-[#1557b0]">Rs. {money(plSummary.netProfit)}</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-md">
            <button className={outlineBtn} onClick={() => setCurrentStep(3)}>
              Back
            </button>
            <button
              className="h-8 px-4 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              onClick={() => setLockModal(true)}
            >
              <Lock size={14} /> Lock {currentFiscalYear?.name}
            </button>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className={`${cardClass} max-w-5xl mx-auto`}>
          <div className="border-b border-gray-100 pb-3 mb-6">
            <h2 className="text-[14px] font-semibold text-gray-800 flex items-center gap-2">
              <CalendarDays size={16} /> Activate Next Fiscal Year
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Define the dates for the new fiscal year and roll over closing balances as opening
              balances.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <h3 className="text-[12px] font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Settings size={14} /> New Fiscal Year Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  FY Name (BS)
                </label>
                <input
                  className={inputClass}
                  value={newFYForm.name}
                  onChange={(e) => setNewFYForm({ ...newFYForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Start Date (BS)
                </label>
                <input
                  className={inputClass}
                  value={newFYForm.startBS}
                  onChange={(e) => setNewFYForm({ ...newFYForm, startBS: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  End Date (BS)
                </label>
                <input
                  className={inputClass}
                  value={newFYForm.endBS}
                  onChange={(e) => setNewFYForm({ ...newFYForm, endBS: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  Start Date (AD)
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={newFYForm.startAD}
                  onChange={(e) => setNewFYForm({ ...newFYForm, startAD: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">
                  End Date (AD)
                </label>
                <input
                  className={inputClass}
                  type="date"
                  value={newFYForm.endAD}
                  onChange={(e) => setNewFYForm({ ...newFYForm, endAD: e.target.value })}
                />
              </div>
            </div>
          </div>

          <h3 className="text-[13px] font-semibold text-gray-800 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
            Balance Sheet Roll-over Preview
            <span className="text-[11px] font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {balanceSheetRollover.length} accounts
            </span>
          </h3>

          <div className="overflow-x-auto rounded-md border border-gray-200 mb-6 max-h-[400px]">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[#f5f6fa]">
                <tr>
                  {["Account Name", "Closing Balance", "New Opening Balance"].map((h) => (
                    <th
                      key={h}
                      className={
                        h === "Account Name" ? tableHeadClass : `${tableHeadClass} text-right`
                      }
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balanceSheetRollover.map((a) => (
                  <tr key={a.id} className="bg-white hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium`}>{a.name}</td>
                    <td className={`${tableCellClass} text-right text-gray-500`}>
                      Rs. {money(a.closingBalance)}
                    </td>
                    <td className={`${tableCellClass} text-right font-medium text-[#1557b0]`}>
                      {a.openingDr > 0
                        ? `Dr Rs. ${money(a.openingDr)}`
                        : `Cr Rs. ${money(a.openingCr)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end p-4 bg-indigo-50 border border-indigo-100 rounded-md">
            <button className={primaryBtn} onClick={createNewFiscalYear}>
              <CheckCircle size={14} /> Create New FY & Roll Balances
            </button>
          </div>
        </div>
      )}

      <Modal
        open={manualJournalModal}
        title="Post Year-End Adjustment"
        onClose={() => setManualJournalModal(false)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Debit Account
            </label>
            <select
              className={inputClass}
              value={manualJournalForm.debitAccountId}
              onChange={(e) =>
                setManualJournalForm({ ...manualJournalForm, debitAccountId: e.target.value })
              }
            >
              <option value="">Select Account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">
              Credit Account
            </label>
            <select
              className={inputClass}
              value={manualJournalForm.creditAccountId}
              onChange={(e) =>
                setManualJournalForm({ ...manualJournalForm, creditAccountId: e.target.value })
              }
            >
              <option value="">Select Account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Amount (NPR)</label>
            <input
              className={inputClass}
              type="number"
              placeholder="0.00"
              value={manualJournalForm.amount}
              onChange={(e) =>
                setManualJournalForm({ ...manualJournalForm, amount: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">Narration</label>
            <textarea
              className={`${inputClass} py-2 min-h-[80px]`}
              placeholder="Description..."
              value={manualJournalForm.narration}
              onChange={(e) =>
                setManualJournalForm({ ...manualJournalForm, narration: e.target.value })
              }
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
            <button className={outlineBtn} onClick={() => setManualJournalModal(false)}>
              Cancel
            </button>
            <button className={primaryBtn} onClick={postManualAdjustment}>
              Post Journal
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={lockModal} title="Confirm Fiscal Year Lock" onClose={() => setLockModal(false)}>
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-[12px]">
            Please type the fiscal year name exactly to confirm:{" "}
            <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-red-200 ml-1">
              {currentFiscalYear?.name}
            </b>
          </div>

          <div>
            <input
              className={`${inputClass} font-mono`}
              placeholder={currentFiscalYear?.name}
              value={lockConfirmName}
              onChange={(e) => setLockConfirmName(e.target.value)}
            />
          </div>

          {currentUser?.role === "admin" && requiredPin && (
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Admin PIN Required
              </label>
              <input
                className={inputClass}
                type="password"
                placeholder="Enter PIN"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-2">
            <button className={outlineBtn} onClick={() => setLockModal(false)}>
              Cancel
            </button>
            <button
              className="h-8 px-4 bg-red-600 hover:bg-red-700 text-white text-[12px] font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                lockConfirmName !== currentFiscalYear?.name ||
                (currentUser?.role === "admin" && requiredPin && adminPin !== requiredPin)
              }
              onClick={confirmLockFY}
            >
              Confirm Lock
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
